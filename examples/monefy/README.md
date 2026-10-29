# Monefy

An invoice workspace with a muted green palette from [monefy.ro](https://monefy.ro), animated SVG illustrations, versioned profiles, invoice branching and history, custom languages, modifiers, subtotal viewers, PDF previews, and the current adira.ts implementation in this checkout.

## Run the containers

From this directory, with Docker Engine, Compose, and Buildx installed:

```sh
cp .env.example .env
docker compose --profile dev up --build -d
docker compose --profile tools run --rm seed
```

Open <http://localhost:8080>. The development account is `demo@monefy.ro` / `MonefyDemo2026!` (override `DEMO_PASSWORD` before seeding). Administrators can invite users from Profile; invitation links open the password setup page. Public registration accepts the configured work-email domain (`monefy.ro` by default). Email verification and password reset messages appear in Mailpit at <http://localhost:8025>. Seeding is idempotent and requires `NODE_ENV=development`; it never drops a database.

Only nginx is exposed for application traffic. Every browser API request uses `/api`; nginx resolves `backend:5000` on the private Compose network. MongoDB, Redis, RabbitMQ, the API and the PDF worker have no published ports.

The Dockerfiles use the **repository root** as their build context. Each has a matching `Dockerfile.dockerignore`, a cached dependency stage, a build stage, and a non-root runtime. Buildx is needed for cache mounts and the Dockerfile-specific ignore files.

## Preview jobs and cache reuse

`POST /api/generate/preview` validates the complete invoice draft, resolves language templates and closing remarks and queues a persistent RabbitMQ message. It returns `202` with a job ID and status URL; a cache hit returns `200` with the existing artifact. The UI polls `GET /api/invoice/jobs/:id` and downloads `GET /api/invoice/artifacts/:id`. Saved invoice PDFs use the same worker through `GET /api/generate/invoice/:id`.

A SHA-256 key includes the entire validated request, resolved data, renderer version, and the authenticated user's ID. Object key order is normalized; array order is preserved. Redis maps hashes to artifact IDs and coalesces simultaneous matching requests. Each worker streams the PDF to a temporary file and atomically renames it before publishing readiness. The API streams the saved binary from the shared `previews` volume. Artifact and status endpoints check ownership. Uploaded company logos, signatures and stamps live in a separate shared `assets` volume. Returning to an earlier invoice state reuses the existing PDF. Cache and timing information remains in the API responses and headers for inspection in developer tools.

The default cache lifetime is 24 hours (`PDF_CACHE_SECONDS`). Workers remove expired files, stale temporary files and entries whose binary has disappeared regenerate on the next submission. Bump `RENDERER_VERSION` when changing the template or fonts. The worker acknowledges messages after persistence, retries failures up to three attempts and retains terminal failures in `monefy.pdf.failed` for inspection. Unacknowledged jobs survive a worker restart. Redis uses append-only persistence with `noeviction`, so job metadata is not discarded under memory pressure.

The artificial **4.5-second delay** is controlled only by `PDF_DEVELOPMENT_DELAY=true`, including in a deployed demo. Set it to `false` or leave it unset to disable the delay. Only the rendering worker waits on uncached jobs; the API can serve other requests. Scale rendering independently with:

```sh
docker compose up -d --scale pdf-worker=2
```

The local disk volume is shared by API and workers on one host. Running workers on multiple hosts requires a shared filesystem or an object-storage adapter. This example is one organization workspace: authenticated users share invoice records, while preview caches are scoped per user.

## Current adira.ts integration

The example uses `@n/adira.core.ts`, `@n/adira.backend.ts`, `@n/adira.client.ts`, and `@n/adira.generator.ts` from `../../packages`. `scripts/sync-adira.mjs` refreshes the ignored `.adira` workspace from the current source; Docker performs the same refresh. It does not rely on a separately published registry package.

```sh
npm --prefix . run setup
npm --prefix . run build
npm --prefix . test
npm --prefix . run test:smoke
```

Generation runs the current generator and replaces `backend/shared/src` with declarations consumed as `@monefy/types`. Route paths contain their resource prefix and mount once under `/api`, matching the generator and client's conventions. The versioned resource handlers use the current Adira executors and the frontend uses `createApiClient` with the generated contract. Query projections use the current `rows` API and response bodies contain records directly. The generation script emits the path metadata expected by the client.

For Vite development, run the API on port 5000 and use `npm --prefix . run dev -w @monefy/frontend`. Vite proxies `/api` using its server-side `API_UPSTREAM` setting. Browser code always uses relative paths.

## Verification

`tests/pdf-cache.test.cjs` protects canonical hashing, ownership namespaces, path validation, the production delay guard, fixed line discounts, mixed currencies and subtotal viewers. Build the backend before running it. `tests/smoke.mjs` exercises the running stack through nginx: authenticated generation, duplicate job coalescing, API responsiveness during rendering, editing and reverting to byte-identical cached PDFs, input validation, versioned profile records, invoice versions and branches, changelogs, translations, saved invoice downloads, invitation emails, live role changes, preview ownership and logout. Set `MONEFY_BROWSER_TEST=true` to verify painted PDF pixels, the Profile menu, direct route reloads and same-origin API traffic in Chromium.

Run the smoke check with the delay enabled as in `.env.example`. Use `EXPECT_PDF_DELAY=false` when running without that delay. Configure `MONEFY_URL` and `DEMO_PASSWORD` for a different local address/account password. The check saves a synthetic invoice in the demo database.

Liveness is `/api/health`; readiness is `/api/health/ready`, including database, broker, Redis and a live PDF worker. Compose restarts application processes after connection failures. MongoDB 7 is used because [MongoDB 8 has a documented startup incompatibility on some newer Linux kernels](https://jira.mongodb.org/browse/SERVER-121912).

## AWS CI/CD

The [AWS deployment guide](infra/aws/README.md) covers the CloudFormation stack, GitHub OIDC environment, production secrets, immutable ECR images, SSM rollout and readiness-based rollback. The workflow lives in the repository's `.github/workflows/monefy.yml` so GitHub discovers it. It tests the local stack before publishing or deploying.

The development database uses the v1.1 schema directly; no data migration is required. Invoice edits create new records, including company, customer, product, modifier and viewer definitions, so historical invoices retain their referenced versions.
