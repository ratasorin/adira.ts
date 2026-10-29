#!/usr/bin/env bash
set -euo pipefail
umask 077
: "${AWS_REGION:?}" "${PUBLIC_ORIGIN:?}" "${TLS_EMAIL:?}" "${FRONTEND_IMAGE:?}" "${BACKEND_IMAGE:?}"
release_dir=$(cd "$(dirname "$0")" && pwd)
exec 9>/var/lock/monefy-deploy.lock
flock -w 300 9
for attempt in $(seq 1 180); do
  if [ -f /opt/monefy/bootstrap-ready ]; then break; fi
  sleep 5
done
test -f /opt/monefy/bootstrap-ready
export NODE_ENV=production HTTP_BIND=127.0.0.1 HTTP_PORT=8080
export MONEFY_RELEASE_DIR="$release_dir"
python3 - <<'PY'
import os, pathlib, stat
root = pathlib.Path(os.environ['MONEFY_RELEASE_DIR'])
source = pathlib.Path('/opt/monefy/infra/aws/.env')
metadata = source.lstat()
if not stat.S_ISREG(metadata.st_mode) or metadata.st_uid != os.geteuid() or stat.S_IMODE(metadata.st_mode) != 0o600:
    raise ValueError('/opt/monefy/infra/aws/.env must be a regular file owned by the deployment user (root) with mode 0600')
values = {
    'NODE_ENV': 'production', 'HTTP_BIND': '127.0.0.1', 'HTTP_PORT': '8080',
    'PUBLIC_ORIGIN': os.environ['PUBLIC_ORIGIN'], 'FRONTEND_IMAGE': os.environ['FRONTEND_IMAGE'], 'BACKEND_IMAGE': os.environ['BACKEND_IMAGE'],
}
# Append enforced settings. Compose parses .env values; never source the file
# as shell code. Single quotes preserve literal dollar signs in credentials.
lines = [source.read_text(), '\n']
for key, value in values.items():
    if any(char in value for char in '\n\r\0'):
        raise ValueError('Configuration values must be single-line strings')
    escaped = value.replace("'", "\\'")
    lines.append(f"{key}='{escaped}'\n")
(root / '.env').write_text(''.join(lines))
(root / '.env').chmod(0o600)
PY
compose=(docker compose -p monefy --env-file "$release_dir/.env" -f "$release_dir/compose.yaml")
trap 'rm -f "$release_dir/.config.json" "$release_dir/.config-errors"' EXIT
if ! "${compose[@]}" config --format json > "$release_dir/.config.json" 2> "$release_dir/.config-errors"; then
  echo 'Invalid private .env or Compose configuration; check the file on the host.' >&2
  exit 1
fi
python3 - <<'PY'
import json, os, pathlib, re
root = pathlib.Path(os.environ['MONEFY_RELEASE_DIR'])
services = json.loads((root / '.config.json').read_text())['services']
values = services['backend']['environment']
jwt = values.get('JWT_SECRET') or ''
if len(jwt) < 32 or 'local-development' in jwt or jwt.startswith('replace-'):
    raise ValueError('Configure a unique production JWT_SECRET of at least 32 characters')
broker = services['rabbitmq']['environment'].get('RABBITMQ_DEFAULT_PASS') or ''
if not re.fullmatch(r'[A-Za-z0-9_-]{24,}', broker) or broker.startswith('replace-'):
    raise ValueError('RABBITMQ_PASSWORD must be a URL-safe random secret of at least 24 characters')
if not values.get('SMTP_HOST') or values['SMTP_HOST'] == 'mailpit':
    raise ValueError('Configure production SMTP settings')
if values.get('SMTP_USER') and (not values.get('SMTP_PASSWORD') or values['SMTP_PASSWORD'].startswith('replace-')):
    raise ValueError('Configure the SMTP password for the selected user')
PY
rm -f "$release_dir/.config.json" "$release_dir/.config-errors"
trap - EXIT
registry=${BACKEND_IMAGE%%/*}
aws ecr get-login-password --region "$AWS_REGION" | docker login --username AWS --password-stdin "$registry"
"${compose[@]}" pull frontend backend pdf-worker mongo redis rabbitmq
previous=$(readlink -f /opt/monefy/current || true)
rollback() {
  local failed=$?
  trap - ERR
  if [ -n "$previous" ] && [ -f "$previous/.env" ]; then
    echo 'Readiness failed; restoring the previous application images.'
    docker compose -p monefy --env-file "$previous/.env" -f "$previous/compose.yaml" up -d --no-build --wait --wait-timeout 180 || true
  fi
  exit "$failed"
}
trap rollback ERR
"${compose[@]}" up -d --no-build --wait --wait-timeout 180
curl -fsS --retry 20 --retry-delay 2 --retry-connrefused http://127.0.0.1:8080/api/health/ready
bash "$release_dir/setup-https.sh"
curl -fsS --resolve "${PUBLIC_ORIGIN#https://}:443:127.0.0.1" "$PUBLIC_ORIGIN/api/health/ready"
ln -sfn "$release_dir" /opt/monefy/current
trap - ERR
echo 'Monefy deployment is ready.'
