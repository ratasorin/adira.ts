# AWS deployment

The workflow at [`.github/workflows/monefy.yml`](../../../../.github/workflows/monefy.yml) builds both images, runs the cache guards and the browser/API smoke check through nginx, and deploys only after those checks pass. Pull requests run verification. Pushes to `master` and manual runs from `master` can deploy through the GitHub `production` environment.

The demo target is one Amazon Linux 2023 EC2 host. Host nginx terminates HTTPS using Let's Encrypt and proxies to the Docker frontend at `127.0.0.1:8080`. Only nginx ports 80 and 443 accept public application traffic; SSH is restricted to the administrator's `/32`; the API, MongoDB, Redis and RabbitMQ remain on the Docker network. There is no load balancer, ACM certificate or Route 53 hosted zone. API and PDF workers share the same filesystem; MongoDB, Redis, RabbitMQ, preview files and uploaded invoice assets persist on a separate encrypted EBS volume. Host administration and deployments use [Systems Manager Run Command](https://docs.aws.amazon.com/systems-manager/latest/userguide/walkthrough-cli.html). The host and deployment identities have separate IAM roles. GitHub uses [OIDC credentials](https://docs.github.com/en/actions/how-tos/secure-your-work/security-harden-deployments/oidc-in-aws), without stored AWS access keys.

The default host is `t3.small` (2 vCPUs, 2 GiB RAM), a starting point for light use rather than a measured capacity guarantee. All application services share that memory; the PDF worker processes one queued job at a time. Check memory usage and container restarts under representative use before relying on this size. Images are built in GitHub Actions, not on the host. To select a larger host, pass `InstanceType=t3.medium` or another suitable type in the parameter overrides. EC2, EBS, public IPv4 and other services still consume credits or incur charges; this template is not permanently free hosting. Configuration lives in a private `.env` on EC2; no Secrets Manager or Parameter Store service is used.

## Provision once

The demo defaults to a 16 GiB root volume, a retained 20 GiB Docker data volume and 2 GiB of swap. CPU credits use standard mode to avoid surplus-credit charges. Override `RootVolumeGiB` or `DataVolumeGiB` if needed.

Choose an AWS region, an existing VPC and **one public subnet** with an internet-gateway route. The host needs outbound HTTPS for SSM, ECR, S3, Docker Hub and Let's Encrypt. Have access to your domain's authoritative DNS provider and an email address for the certificate account. The dedicated host security group exposes public TCP 80/443 and TCP 22 only to `AdminCidr`; keep Docker port 8080 on loopback. The setup script owns the host's nginx configuration, so use a new dedicated host rather than a server hosting other websites.

The existing `examples/monefy/.env` is the local development configuration read by Compose; its values are passed to the backend and worker. Keep it for local development. Store the production values in `examples/monefy/infra/aws/.env`, using the same format. The EC2 deploy script copies the private production file into each deployed release root as `.env`, then appends enforced settings. No `.env.dev` or `.env.prod` filenames are required. Use [`.env.example`](.env.example) in this directory as the EC2 template. It includes Gmail SMTP settings; `SMTP_PASSWORD` is a Google app password, not your normal Google password. No environment file is baked into the backend image.

Your workstation's root `.env` always remains the local development file. Deployment copies the production configuration only on EC2, from `/opt/monefy/infra/aws/.env` to the deployed release root `.env`. Provision that private production file on the host once using the instructions below; later deployments reuse it. The GitHub workflow and release uploader do not upload either local `.env` file or bake secrets into images.

Generate the JWT and broker secrets separately, for example with `python3 -c 'import secrets; print(secrets.token_hex(32))'`. Broker passwords must contain only letters, digits, underscores or hyphens because Compose inserts them into an AMQP URI. Single-quote values containing dollar signs to prevent Compose interpolation; follow Compose `.env` quoting rules for other special characters. Set `MAIL_FROM` to your authorized sender. `REGISTRATION_EMAIL_DOMAIN` controls which users may register; it is independent of the sending address, and the example allows `@thood.ro` addresses. A Gmail sender does not make Gmail addresses eligible for registration.

Provision the supplied template, replacing the example values:

```sh
aws cloudformation deploy \
  --region eu-north-1 \
  --stack-name monefy \
  --template-file examples/monefy/infra/aws/stack.yaml \
  --capabilities CAPABILITY_IAM \
  --parameter-overrides \
    VpcId=vpc-0123456789abcdef0 \
    PublicSubnet=subnet-0123456789abcdef0 \
    SshKeyName=monefy-demo \
    AdminCidr=YOUR_PUBLIC_IP/32 \
    TlsEmail=your-email@example.com \
    PublicOrigin=https://monefy.thood.ro \
    GitHubRepository=your-organization/your-repository
```

If the account already has a GitHub OIDC provider, also pass `ExistingGitHubOidcProviderArn`; otherwise the stack creates it. The template provisions ECR repositories, an artifact bucket, IAM roles, the EC2 host and data volume, and a dedicated web security group. Host bootstrap installs Docker and nginx and checksum-verifies the pinned Compose binary. Configure snapshots for the retained EBS data volume; application deployment does not delete or recreate it. This parameter/output interface replaces the previous ALB template: `PublicSubnet` replaces `PublicSubnets`, `TlsEmail` replaces `CertificateArn`, and `PublicIp` replaces `LoadBalancerDns`. Existing ALB deployments require a reviewed migration rather than applying this as an unattended update.

Read the outputs with:

```sh
aws cloudformation describe-stacks --region eu-north-1 --stack-name monefy \
  --query 'Stacks[0].Outputs' --output table
```

After provisioning, open a Session Manager session to the new instance. Create `/opt/monefy/infra/aws/.env` with the example's contents and your actual values. Keep values out of SSM Run Command arguments, GitHub logs and Git. For an interactive SSM session:

```sh
sudo install -d -m 0700 -o root -g root /opt/monefy/infra/aws
sudo install -m 0600 -o root -g root /dev/null /opt/monefy/infra/aws/.env
sudo vi /opt/monefy/infra/aws/.env
```

The `install` command is for first-time setup only: it empties the file if run again. To update existing settings, use `sudo vi /opt/monefy/infra/aws/.env`, then redeploy. Back up this private file securely; replacing the host root disk loses it. Deployment requires the file to be owned by root with mode `0600`, snapshots its values into each release, and never executes it as shell code. Production flags, loopback binding, application origin and image digests are enforced by deployment. Real `.env` files are ignored by Git; only examples may be committed.

Before the first application deployment, add an **A record** at the authoritative DNS provider pointing the application hostname at the stack's `PublicIp` output. For `thood.ro`, DNS is hosted by Cloudflare; in **DNS → Records → Add record**, use:

| Field | Value |
| --- | --- |
| Type | `A` |
| Name | `monefy` |
| IPv4 address | The new stack's `PublicIp` output |
| Proxy status | **DNS only** (grey cloud) for initial setup and direct origin checks |
| TTL | Auto |

Keep unrelated domain and email records unchanged. Do not publish an AAAA record unless this host is configured for IPv6. Verify `dig +short A monefy.thood.ro` returns the instance IP before deploying. The first deployment uses HTTP-01 validation on port 80 to obtain a certificate, then serves the app only over HTTPS. An unreachable or incorrect DNS record causes certificate issuance and deployment to fail; HTTP never serves the application's login page.

The default automatically assigned public IP changes after stop/start. Update the DNS A record after every such change; rerun `aws ec2 describe-instances --region eu-north-1 --instance-ids INSTANCE_ID --query 'Reservations[0].Instances[0].PublicIpAddress' --output text` to get the current IP rather than relying on an old stack output. An Elastic IP can keep the address stable but remains chargeable while the instance is stopped; it is not allocated by this template.

Create a GitHub environment named **production**, restrict deployment branches to **master** and the reviewed initial deployment branch **deploy/monefy-ec2**, and set four environment variables:

| Variable         | Value                                |
| ---------------- | ------------------------------------ |
| `AWS_ACCOUNT_ID` | The AWS account ID |
| `AWS_REGION`     | The stack region                     |
| `AWS_STACK_NAME` | The stack name, for example `monefy` |
| `AWS_ROLE_ARN`   | The `DeploymentRoleArn` stack output |

Pushes to `deploy/monefy-ec2` also verify and deploy the initial release; merge the reviewed branch into `master` to use the regular release branch. The workflow reads the remaining targets from stack outputs. Configure environment reviewers if your deployment process requires them. The first deployment starts an empty workspace; create and verify an account using the configured work-email domain. Production never runs the demo seed.

## Release and rollback

After verification, the workflow publishes ECR tags containing the commit, run ID and attempt. The host deploys their immutable image **digests**. A small, checksummed release bundle contains Compose configuration, `deploy-host.sh` and `setup-https.sh`; it travels through the private artifact bucket. The private `/opt/monefy/infra/aws/.env` stays on EC2 and is copied into releases with mode `0600`; its contents do not enter the release bundle, GitHub logs or SSM command arguments. Rollbacks use the previous release's configuration snapshot, so redeploy after rotating credentials rather than rolling back to a revoked password.

Deployment locks serialize host changes. Production always uses `NODE_ENV=production` and `HTTP_BIND=127.0.0.1`. The private host `.env` controls `PDF_DEVELOPMENT_DELAY`: `true` adds 4.5 seconds to uncached PDF jobs in any environment; `false` or unset disables it. The demo example enables it. New containers must pass health checks, including `/api/health/ready`, before configuring HTTPS and moving the `current` release link. A host deployment failure restores the previous release's application images and Compose configuration when available. Host nginx and certificate changes are not rolled back automatically. The workflow then checks readiness through the public HTTPS hostname. A failed public check reports a DNS, certificate, nginx or security-group problem.

Certbot runs from the pinned `certbot/certbot:v5.8.0` image using webroot validation. Certificates and account keys live in `/etc/letsencrypt` on the host root disk and must remain private. The `monefy-renew-tls.timer` systemd timer checks twice daily with a randomized delay, serializes with deployments, and reloads nginx after a successful renewal. Keep the hostname pointed to this host and port 80 reachable for renewal. Check `systemctl list-timers monefy-renew-tls.timer` and `journalctl -u monefy-renew-tls.service` through SSM. To test renewal against Let's Encrypt's staging service without replacing the production certificate, run through SSM:

```sh
docker run --rm \
  -v /etc/letsencrypt:/etc/letsencrypt \
  -v /var/lib/letsencrypt:/var/lib/letsencrypt \
  -v /var/www/letsencrypt:/var/www/letsencrypt \
  certbot/certbot:v5.8.0 renew --dry-run
```

To roll back manually, use SSM to run the following against an existing release directory:

```sh
docker compose -p monefy \
  --env-file /opt/monefy/releases/PREVIOUS_RELEASE/.env \
  -f /opt/monefy/releases/PREVIOUS_RELEASE/compose.yaml \
  up -d --no-build --wait --wait-timeout 180
```

This deployment has one application host and restarts containers during releases. Multi-host deployment would require shared/object artifact storage and a separate database/broker plan. The CloudFormation data volume and release bucket are retained on stack deletion.

## Validation performed locally

CloudFormation passes `cfn-lint`; the workflow passes `actionlint`; deployment scripts pass syntax checks. Run `python3 -m unittest discover -s examples/monefy/infra/aws/tests -v` to exercise first certificate issuance, repeated deployment, renewal and failure behavior with mocked Certbot/systemd calls. When nginx is installed, those tests also validate generated virtual hosts using a local self-signed test certificate. Existing local validation also exercised archive packaging, SSM payload construction, secret handling, forced production flags and rollback; an actual Docker container verified preservation of SMTP credentials containing dollar signs, quotes and backslashes. These checks do not provision AWS resources or request real certificates.

Provisioning and an actual cloud deployment require the account, network, certificate-account email, DNS, private host `.env` and GitHub environment configuration above. Live Let's Encrypt issuance and Amazon Linux deployment remain to be verified on the provisioned host.
