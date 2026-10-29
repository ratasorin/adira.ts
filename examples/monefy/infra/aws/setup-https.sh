#!/usr/bin/env bash
# Runs as root on the dedicated Monefy host after application readiness.
set -euo pipefail
umask 077
: "${PUBLIC_ORIGIN:?}" "${TLS_EMAIL:?}"
if [[ ! "$PUBLIC_ORIGIN" =~ ^https://[a-z0-9]+([.-][a-z0-9]+)*\.[a-z]{2,}$ ]]; then
  echo 'PUBLIC_ORIGIN must be an HTTPS DNS origin without a port or path' >&2
  exit 1
fi
if [[ ! "$TLS_EMAIL" =~ ^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$ ]]; then
  echo 'TLS_EMAIL must be an email address' >&2
  exit 1
fi
domain=${PUBLIC_ORIGIN#https://}
certbot_image=certbot/certbot:v5.8.0
mkdir -p /var/www/letsencrypt /etc/letsencrypt /var/lib/letsencrypt
chmod 0755 /var/www/letsencrypt

# This host is dedicated to Monefy. Keep public traffic outside Docker and
# never serve authentication or application data over plaintext HTTP.
cat > /etc/nginx/nginx.conf <<'NGINX'
user nginx;
worker_processes auto;
error_log /var/log/nginx/error.log;
pid /run/nginx.pid;
events { worker_connections 1024; }
http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;
    access_log /var/log/nginx/access.log;
    sendfile on;
    include /etc/nginx/monefy.conf;
}
NGINX

write_site() {
  cat <<NGINX
server {
    listen 80;
    server_name $domain;
    location ^~ /.well-known/acme-challenge/ {
        root /var/www/letsencrypt;
        default_type text/plain;
    }
    location / { return 301 https://$domain\$request_uri; }
}
NGINX
  if [ -s "/etc/letsencrypt/live/$domain/fullchain.pem" ] && [ -s "/etc/letsencrypt/live/$domain/privkey.pem" ]; then
    cat <<NGINX
server {
    listen 443 ssl;
    server_name $domain;
    ssl_certificate /etc/letsencrypt/live/$domain/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$domain/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    client_max_body_size 12m;
    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Host $domain;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$remote_addr;
        proxy_set_header X-Forwarded-Proto https;
        proxy_connect_timeout 5s;
        proxy_read_timeout 60s;
        proxy_buffering off;
    }
}
NGINX
  fi
}

# Keep existing HTTPS working on subsequent deployments. On the first run,
# nginx initially exposes only the challenge path and HTTPS redirects.
write_site > /etc/nginx/monefy.conf
chmod 0644 /etc/nginx/nginx.conf /etc/nginx/monefy.conf
nginx -t
systemctl enable --now nginx
systemctl reload nginx

docker run --rm \
  -v /etc/letsencrypt:/etc/letsencrypt \
  -v /var/lib/letsencrypt:/var/lib/letsencrypt \
  -v /var/www/letsencrypt:/var/www/letsencrypt \
  "$certbot_image" certonly --non-interactive --agree-tos \
  --email "$TLS_EMAIL" --webroot --webroot-path /var/www/letsencrypt \
  --cert-name "$domain" --domain "$domain" --keep-until-expiring

write_site > /etc/nginx/monefy.conf
chmod 0644 /etc/nginx/monefy.conf
nginx -t
systemctl reload nginx

# Persist renewal independently of release directories and reload nginx only
# after Certbot has successfully renewed a certificate.
mkdir -p /usr/local/libexec
cat > /usr/local/libexec/monefy-renew-tls <<'RENEW'
#!/usr/bin/env bash
set -euo pipefail
exec 9>/var/lock/monefy-deploy.lock
flock -w 1800 9
docker run --rm \
  -v /etc/letsencrypt:/etc/letsencrypt \
  -v /var/lib/letsencrypt:/var/lib/letsencrypt \
  -v /var/www/letsencrypt:/var/www/letsencrypt \
  certbot/certbot:v5.8.0 renew --quiet \
  --deploy-hook 'touch /var/lib/letsencrypt/monefy-reload'
if [ -f /var/lib/letsencrypt/monefy-reload ]; then
  nginx -t
  systemctl reload nginx
  rm -f /var/lib/letsencrypt/monefy-reload
fi
RENEW
chmod 0750 /usr/local/libexec/monefy-renew-tls
cat > /etc/systemd/system/monefy-renew-tls.service <<'UNIT'
[Unit]
Description=Renew Monefy HTTPS certificates
After=network-online.target docker.service nginx.service
Requires=docker.service nginx.service
[Service]
Type=oneshot
ExecStart=/usr/local/libexec/monefy-renew-tls
UNIT
cat > /etc/systemd/system/monefy-renew-tls.timer <<'UNIT'
[Unit]
Description=Check Monefy HTTPS certificate renewal twice daily
[Timer]
OnCalendar=*-*-* 00,12:00:00
RandomizedDelaySec=3600
Persistent=true
[Install]
WantedBy=timers.target
UNIT
chmod 0644 /etc/systemd/system/monefy-renew-tls.service /etc/systemd/system/monefy-renew-tls.timer
systemctl daemon-reload
systemctl enable --now monefy-renew-tls.timer
