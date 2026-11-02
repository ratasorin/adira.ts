# Inovices local demo

This branch runs Inovices with the Adira packages from commit `53fdd5157ebb76a1b5cfc33273922ab058a7b7fc`. The framework source stays unchanged. Resource handlers return the historical `{ executor, related? }` response, and the frontend reads that response through the generated, typed Adira client.

The application includes versioned companies, customers and products, invoice revisions and branching, profile administration, custom numbering, modifiers, subtotals, languages, translations and PDF previews. Both light and dark modes use a neutral gray, white and black brand palette. The startup coin and logo currency mark use a yellow accent. The startup animation keeps its own CSS reset so it cannot override application spacing.

## Run locally

Requirements: Node.js 22.14 or later and a running local MongoDB server on `127.0.0.1:27017`.

From this directory:

```sh
cp backend/.env.example backend/.env
npm --prefix . run setup
npm --prefix . run build
npm --prefix . run seed
npm --prefix . run dev
```

Open <http://127.0.0.1:5173>. Log in with `demo@inovices.ro` and `InovicesDemo2026!`. Seeding is repeatable and uses the separate `inovices_old_adira` database by default. It adds an administrator, a company, a customer, three products, a sample invoice, English and Romanian templates, modifiers and a subtotal viewer.

Vite serves the frontend and proxies `/api` to the Express server on `127.0.0.1:5001`. Both servers bind to the loopback interface. You can change backend settings in `backend/.env`; set `API_UPSTREAM` when starting the frontend if the backend port changes.

PDFs are generated in the API process and streamed directly to the browser. Each preview request returns `application/pdf`. Uploaded assets are stored under `backend/.data/assets`. Invitations, verification and password reset emails are written as JSON messages under `backend/.data/mail`; their `html` field contains the local action link. Runtime files and `.env` are ignored by Git.

`npm --prefix . run setup` refreshes the ignored `.adira` workspace copies from this checkout before installing dependencies. `npm --prefix . run build` builds those packages, the backend, generated shared API types and the frontend in order. Route handlers are imported from controller modules as required by the historical generator.

## Verify

```sh
npm --prefix . test
npm --prefix . run test:smoke
INOVICES_BROWSER_TEST=true npm --prefix . run test:smoke
```

Run the build before the unit tests and start the seeded app before the smoke checks. For browser checks, install Chromium once with `npx --prefix . playwright install chromium`. The smoke checks cover authentication, typed resource response shapes, seeded data, direct PDF responses and, optionally, rendered previews, profile routing, component padding, theme colors and same-origin `/api` requests.
