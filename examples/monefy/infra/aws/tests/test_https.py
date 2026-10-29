"""Exercise host HTTPS setup without contacting AWS or a certificate authority."""
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest


SCRIPT = Path(__file__).resolve().parents[1] / "setup-https.sh"


class HttpsSetupTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        for name in ["bin", "etc/nginx", "etc/systemd/system", "var/log/nginx", "var/lock"]:
            (self.root / name).mkdir(parents=True)
        # Relocate a copy of the script, never the real host configuration.
        text = SCRIPT.read_text()
        for prefix in ["/etc/", "/var/", "/usr/local/", "/run/"]:
            text = text.replace(prefix, str(self.root) + prefix)
        self.script = self.root / "setup.sh"
        self.script.write_text(text)
        self.env = dict(os.environ, PUBLIC_ORIGIN="https://monefy.thood.ro",
                        TLS_EMAIL="test@example.com", TEST_ROOT=str(self.root))
        self.env["PATH"] = str(self.root / "bin") + ":" + self.env["PATH"]
        self.mock("systemctl", """#!/usr/bin/env python3
import os, sys
from pathlib import Path
with (Path(os.environ['TEST_ROOT']) / 'systemctl.log').open('a') as f:
    f.write(' '.join(sys.argv[1:]) + '\\n')
""")
        self.mock("nginx", """#!/usr/bin/env python3
import os
from pathlib import Path
r = Path(os.environ['TEST_ROOT'])
with (r / 'nginx-configs.log').open('a') as f:
    f.write((r / 'etc/nginx/monefy.conf').read_text() + '\\n---\\n')
""")
        self.mock("docker", """#!/usr/bin/env python3
import os, shutil, sys
from pathlib import Path
r = Path(os.environ['TEST_ROOT'])
args = sys.argv[1:]
if os.environ.get('CERTBOT_FAIL'):
    sys.exit(1)
if 'certonly' in args:
    assert '--webroot' in args and '--keep-until-expiring' in args
    assert '--email' in args and '--domain' in args
    site = (r / 'etc/nginx/monefy.conf').read_text()
    assert 'location ^~ /.well-known/acme-challenge/' in site
    assert 'location / { return 301 https://monefy.thood.ro$request_uri; }' in site
    certificate = r / 'etc/letsencrypt/live/monefy.thood.ro'
    certificate.mkdir(parents=True, exist_ok=True)
    for name in ['fullchain.pem', 'privkey.pem']:
        shutil.copyfile(r / name, certificate / name)
elif 'renew' in args:
    (r / 'var/lib/letsencrypt/monefy-reload').touch()
else:
    sys.exit('Unexpected Docker invocation')
""")
        if not shutil.which("openssl"):
            self.skipTest("openssl is required to generate local test certificates")
        subprocess.run(["openssl", "req", "-x509", "-newkey", "rsa:2048", "-nodes",
                        "-days", "1", "-subj", "/CN=monefy.thood.ro",
                        "-keyout", str(self.root / "privkey.pem"),
                        "-out", str(self.root / "fullchain.pem")],
                       check=True, capture_output=True)

    def mock(self, name, content):
        path = self.root / "bin" / name
        path.write_text(content)
        path.chmod(0o755)

    def run_setup(self):
        return subprocess.run(["bash", str(self.script)], env=self.env, capture_output=True, text=True)

    def test_first_setup_then_repeat_and_renew(self):
        result = self.run_setup()
        self.assertEqual(result.returncode, 0, result.stderr)
        configs = (self.root / "nginx-configs.log").read_text().split("\n---\n")
        self.assertNotIn("listen 443", configs[0])
        self.assertNotIn("proxy_pass", configs[0])
        self.assertIn("listen 443 ssl", configs[1])
        self.assertIn("proxy_pass http://127.0.0.1:8080;", configs[1])
        self.assertIn("proxy_set_header X-Forwarded-Proto https;", configs[1])
        self.assertEqual((self.root / "var/www/letsencrypt").stat().st_mode & 0o777, 0o755)
        self.assertEqual((self.root / "var/www").stat().st_mode & 0o777, 0o755)
        timer = self.root / "etc/systemd/system/monefy-renew-tls.timer"
        self.assertIn("Persistent=true", timer.read_text())

        (self.root / "nginx-configs.log").unlink()
        result = self.run_setup()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("listen 443 ssl", (self.root / "nginx-configs.log").read_text().split("\n---\n")[0])
        renew = self.root / "usr/local/libexec/monefy-renew-tls"
        result = subprocess.run(["bash", str(renew)], env=self.env, capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertFalse((self.root / "var/lib/letsencrypt/monefy-reload").exists())
        self.assertIn("reload nginx", (self.root / "systemctl.log").read_text())

        # Validate the generated virtual hosts with real nginx when available.
        if shutil.which("nginx"):
            # nginx -t also tests sockets. High ports keep this check unprivileged.
            site = self.root / "etc/nginx/monefy.conf"
            site.write_text(site.read_text().replace("listen 80;", "listen 18080;")
                            .replace("listen 443 ssl;", "listen 18443 ssl;"))
            conf = self.root / "check.conf"
            conf.write_text(f'''pid {self.root}/nginx.pid;
error_log {self.root}/nginx-error.log;
events {{}}
http {{
    access_log off;
    client_body_temp_path {self.root}/client_temp;
    proxy_temp_path {self.root}/proxy_temp;
    include {self.root}/etc/nginx/monefy.conf;
}}
''')
            nginx = shutil.which("nginx", path=os.environ["PATH"])
            result = subprocess.run([nginx, "-t", "-p", str(self.root), "-c", str(conf)], capture_output=True, text=True)
            self.assertEqual(result.returncode, 0, result.stderr)

    def test_failed_issuance_does_not_expose_http_application(self):
        self.env["CERTBOT_FAIL"] = "1"
        self.assertNotEqual(self.run_setup().returncode, 0)
        conf = (self.root / "etc/nginx/monefy.conf").read_text()
        self.assertNotIn("proxy_pass", conf)
        self.assertNotIn("listen 443", conf)
        self.assertFalse((self.root / "etc/systemd/system/monefy-renew-tls.timer").exists())

    def test_invalid_origin_fails_before_system_changes(self):
        self.env["PUBLIC_ORIGIN"] = "https://monefy.thood.ro/;injected"
        result = self.run_setup()
        self.assertNotEqual(result.returncode, 0)
        self.assertFalse((self.root / "etc/nginx/nginx.conf").exists())


if __name__ == "__main__":
    unittest.main()
