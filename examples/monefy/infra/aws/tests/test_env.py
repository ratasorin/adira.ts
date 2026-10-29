"""Validate private host .env handling with the real Compose parser, no daemon."""
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest


AWS = Path(__file__).resolve().parents[1]


class PrivateEnvTests(unittest.TestCase):
    def setUp(self):
        if not shutil.which("docker") or subprocess.run(
                ["docker", "compose", "version"], capture_output=True).returncode:
            self.skipTest("Docker Compose CLI required; a daemon is not needed")
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        self.host = self.root / "opt/monefy"
        self.host.mkdir(parents=True)
        (self.host / "bootstrap-ready").touch()
        (self.root / "var/lock").mkdir(parents=True)
        self.release = self.root / "release"
        self.release.mkdir()
        shutil.copyfile(AWS.parents[1] / "compose.yaml", self.release / "compose.yaml")
        # Exercise only preparation/validation, before any pull or deployment.
        script = (AWS / "deploy-host.sh").read_text().split("registry=${BACKEND_IMAGE%%/*}")[0]
        script = script.replace("/opt/monefy", str(self.host))
        script = script.replace("/var/lock", str(self.root / "var/lock"))
        self.script = self.release / "prepare.sh"
        self.script.write_text(script)
        (self.host / "infra/aws").mkdir(parents=True)
        self.source = self.host / "infra/aws/.env"
        self.password = 'test$dollar"double\\backslash'
        self.source.write_text(f'''NODE_ENV=development
PDF_DEVELOPMENT_DELAY=true
HTTP_BIND=0.0.0.0
JWT_SECRET={'a' * 64}
RABBITMQ_PASSWORD={'b' * 48}
SMTP_HOST=smtp.gmail.com
SMTP_USER=test@example.com
SMTP_PASSWORD='{self.password}'
MAIL_FROM='Monefy <test@example.com>'
''')
        self.source.chmod(0o600)
        self.env = dict(os.environ, AWS_REGION="eu-north-1", PUBLIC_ORIGIN="https://monefy.thood.ro",
                        TLS_EMAIL="test@example.com", FRONTEND_IMAGE="frontend:test", BACKEND_IMAGE="backend:test")

    def run_prepare(self):
        return subprocess.run(["bash", str(self.script)], env=self.env, capture_output=True, text=True)

    def test_credentials_preserved_and_production_settings_enforced(self):
        original = self.source.read_text()
        self.env["HTTP_BIND"] = "0.0.0.0"
        result = self.run_prepare()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(result.stdout, "")
        self.assertNotIn(self.password, result.stderr)
        self.assertEqual(self.source.read_text(), original)
        self.assertEqual((self.release / ".env").stat().st_mode & 0o777, 0o600)
        self.assertFalse((self.release / ".config.json").exists())
        result = subprocess.run(["docker", "compose", "-p", "monefy", "--env-file", str(self.release / ".env"),
                                 "-f", str(self.release / "compose.yaml"), "config", "--format", "json"],
                                env={k: v for k, v in self.env.items() if k != "HTTP_BIND"},
                                capture_output=True, text=True, check=True)
        services = json.loads(result.stdout)["services"]
        backend = services["backend"]["environment"]
        # Rendered Compose documents escape dollars for later re-interpolation.
        # Inspect the resolved interpolation environment for the literal value.
        resolved = subprocess.run(["docker", "compose", "-p", "monefy", "--env-file", str(self.release / ".env"),
                                   "-f", str(self.release / "compose.yaml"), "config", "--environment"],
                                  env=self.env, capture_output=True, text=True, check=True)
        variables = dict(line.split("=", 1) for line in resolved.stdout.splitlines() if "=" in line)
        self.assertEqual(variables["SMTP_PASSWORD"], self.password)
        self.assertEqual(backend["NODE_ENV"], "production")
        self.assertEqual(backend["PDF_DEVELOPMENT_DELAY"], "true")
        self.assertEqual(backend["PUBLIC_ORIGIN"], "https://monefy.thood.ro")
        self.assertEqual(services["frontend"]["ports"][0]["host_ip"], "127.0.0.1")

    def test_rejects_publicly_readable_file(self):
        self.source.chmod(0o644)
        result = self.run_prepare()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("mode 0600", result.stderr)

    def test_delay_defaults_to_disabled(self):
        self.source.write_text(self.source.read_text().replace("PDF_DEVELOPMENT_DELAY=true\n", ""))
        result = self.run_prepare()
        self.assertEqual(result.returncode, 0, result.stderr)
        rendered = subprocess.run(["docker", "compose", "-p", "monefy", "--env-file", str(self.release / ".env"),
                                   "-f", str(self.release / "compose.yaml"), "config", "--format", "json"],
                                  env=self.env, capture_output=True, text=True, check=True)
        self.assertEqual(json.loads(rendered.stdout)["services"]["backend"]["environment"]["PDF_DEVELOPMENT_DELAY"], "false")

    def test_rejects_demo_secrets(self):
        self.source.write_text(self.source.read_text().replace("JWT_SECRET=" + "a" * 64,
                                                             "JWT_SECRET=replace-with-a-unique-random-jwt-secret"))
        result = self.run_prepare()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("Configure a unique production JWT_SECRET", result.stderr)
        self.assertFalse((self.release / ".config.json").exists())


if __name__ == "__main__":
    unittest.main()
