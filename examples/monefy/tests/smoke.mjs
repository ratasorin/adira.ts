import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { setTimeout as wait } from "node:timers/promises";

const origin = process.env.MONEFY_URL || "http://localhost:8080";
let cookie = "";
async function request(path, body, expected = 200, method = body === undefined ? "GET" : "POST") {
  const response = await fetch(`${origin}/api${path}`, {
    method,
    headers: { ...(cookie ? { Cookie: cookie } : {}), ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  assert.equal(response.status, expected, `${method} ${path.replace(/users\/register\/.*/, "users/register/:token")}: ${response.status} ${response.status === expected ? "" : await response.text()}`);
  return response;
}
const data = async (...args) => (await request(...args)).json();
const query = value => `?query=${encodeURIComponent(JSON.stringify(value))}`;
const rows = async (path, include = [], where = {}) => (await data(path + query({ include, where, rows: { select: [] } }))).rows;
const hash = value => createHash("sha256").update(value).digest("hex");
async function ready(id) {
  const deadline = Date.now() + 90000;
  while (Date.now() < deadline) {
    const job = await data(`/invoice/jobs/${id}`);
    if (job.status === "failed") throw new Error(job.message);
    if (job.status === "ready") return job;
    await wait(200);
  }
  throw new Error("PDF job timed out");
}

await request("/invoices", undefined, 401);
const login = await request("/auth/login", { email: "demo@monefy.ro", password: process.env.DEMO_PASSWORD || "MonefyDemo2026!" });
cookie = login.headers.get("set-cookie").split(";")[0];
await request("/health/ready");
const [company] = await rows("/companies", ["base_company"]);
const [customer] = await rows("/customers", ["base_customer"]);
const [product] = await rows("/products", ["base_product"]);
const [english] = await rows("/templates", ["language"], { "language.code": { $eq: "en" } });
const [romanian] = await rows("/templates", ["language"], { "language.code": { $eq: "ro" } });
const [modifier] = await rows("/modifiers");
const [viewer] = await rows("/viewers");
assert.ok(company && customer && product && english && romanian && modifier && viewer, "Demo data missing");
const id = randomUUID();
const now = new Date().toISOString();
const payload = {
  issuer_company: { ...company.details, name: company.name, _id: company._id },
  receiving_customer: customer.details,
  products: [{ _id: "line-1", product: { name: product.name, price: product.details.unit_price, currency: product.details.currency }, quantity: 1 }],
  modifiers: [{ index: 1, name: modifier.name, type: modifier.type, operation: modifier.operation, scope: modifier.scope, value: modifier.value, ...(modifier.currency ? { currency: modifier.currency } : {}) }],
  viewers: [{ index: 2, name: viewer.name }],
  notes: `Smoke ${id} — Știință, România`,
  language_id: romanian.language._id,
  emittedDate: now,
  reportedPeriod: now,
  invoiceNumber: 900,
};
const start = performance.now();
const first = await data("/generate/preview", payload, 202);
const enqueueMs = Math.round(performance.now() - start);
assert.equal(first.cache, "MISS");
assert.ok(enqueueMs < 2000, `Enqueue blocked for ${enqueueMs} ms`);
const healthStart = performance.now();
await Promise.all(Array.from({ length: 8 }, () => request("/health")));
const healthMs = Math.round(performance.now() - healthStart);
assert.ok(healthMs < 1000, `API blocked during PDF generation: ${healthMs} ms`);
const parallel = await Promise.all(Array.from({ length: 3 }, () => data("/generate/preview", payload, 202)));
assert.ok(parallel.every(job => job.id === first.id && job.cache === "COALESCED"));
const completed = await ready(first.id);
if (process.env.EXPECT_PDF_DELAY !== "false") assert.ok(completed.renderMs >= 4500 && completed.renderMs < 20000, `Development render ${completed.renderMs} ms`);
const artifact = await request(`/invoice/artifacts/${first.id}`);
assert.match(artifact.headers.get("content-type"), /application\/pdf/);
const original = Buffer.from(await artifact.arrayBuffer());
assert.equal(original.subarray(0, 5).toString(), "%PDF-");
const edited = structuredClone(payload);
edited.products[0].quantity = 2;
const editJob = await data("/generate/preview", edited, 202);
assert.notEqual(editJob.id, first.id);
await ready(editJob.id);
const cachedStart = performance.now();
const cached = await data("/generate/preview", Object.fromEntries(Object.entries(payload).reverse()));
const hitMs = Math.round(performance.now() - cachedStart);
assert.equal(cached.cache, "HIT");
assert.equal(cached.id, first.id);
assert.equal(hash(original), hash(Buffer.from(await (await request(`/invoice/artifacts/${cached.id}`)).arrayBuffer())));
await request("/generate/preview", { ...payload, emittedDate: "invalid" }, 400);
await request("/generate/preview", { ...payload, products: [{ ...payload.products[0], quantity: -1 }] }, 400);

// Preserve versioned records: edits must leave the previous version available.
const companyVersion = await data(`/companies/${company._id}/version`, { name: company.name, details: { ...company.details, vat_id: `SMOKE-${id}` } });
assert.notEqual(companyVersion._id, company._id);
assert.equal((await rows("/companies", [], { _id: { $eq: company._id } }))[0].details.vat_id, company.details.vat_id);
assert.equal((await rows("/companies", ["base_company"], { "base_company._id": { $eq: company.base_company._id } })).length >= 2, true);
const customerVersion = await data(`/customers/${customer._id}/version`, { details: { ...customer.details, address: `Updated ${id}` } });
assert.notEqual(customerVersion._id, customer._id);
const productVersion = await data(`/products/${product._id}/version`, { name: product.name, details: { ...product.details, unit_price: product.details.unit_price + 1 } });
assert.notEqual(productVersion._id, product._id);

const allocated = await data(`/base-invoices/allocate/${company.base_company._id}`, {});
const write = {
  base_invoice: allocated._id, issuer_company: company._id, receiving_customer: customer._id,
  language: english.language._id, emitted_date: now, reported_period: now, notes: `Invoice ${id}`,
  products: [{ _id: "line-1", product: product._id, quantity: 2, index: 0 }],
  modifiers: [{ _id: "mod-1", modifier: modifier._id, index: 1 }],
  viewers: [{ _id: "view-1", viewer: viewer._id, index: 2 }],
};
const invoice = await data("/invoices", write);
assert.equal(invoice.version, 1);
assert.equal(typeof invoice.total, "number");
assert.equal(invoice.viewers.length, 1);
const changed = await data(`/invoices/${invoice._id}`, { ...write, notes: `Changed ${id}`, language: romanian.language._id }, 200, "PATCH");
assert.notEqual(changed._id, invoice._id);
assert.equal(changed.version, 2);
assert.ok(changed.related.changes.some(change => change.field === "notes"));
const branch = await data(`/invoices/${invoice._id}`, { ...write, notes: `Branch ${id}` }, 200, "PATCH");
assert.equal(branch.version, 3);
assert.equal(branch.from_invoice, invoice._id);
const graph = await data(`/invoices/${branch._id}/version-graph`);
assert.equal(Object.keys(graph.nodes).length, 3);
assert.equal(graph.adjacency[invoice._id].length, 2);
const versions = await rows("/invoices", [], { base_invoice: { $eq: allocated._id } });
assert.equal(versions.length, 3);
assert.equal(versions.find(version => version._id === invoice._id).notes, write.notes);
const savedJob = await data(`/generate/invoice/${changed._id}`, undefined, 202);
await ready(savedJob.id);
await request(`/invoice/artifacts/${savedJob.id}`);

await data("/modifier-viewer-translations", { entity_type: "modifier", entity_id: modifier._id, language_code: "ro", text: "TVA demonstrativ" });
const translations = await data(`/modifier-viewer-translations${query({ entity_type: "modifier", entity_ids: [modifier._id], language_code: "ro" })}`);
assert.equal(translations.rows[0].text, "TVA demonstrativ");
const sameLanguage = await data("/notes-translations/translate", { text: "Plată", source_language_code: "ro", target_language_code: "ro" });
assert.equal(sameLanguage.text, "Plată");
assert.equal(sameLanguage.cached, true);
const users = await rows("/users");
assert.ok(users.every(user => !Object.hasOwn(user, "password")), "Password leaked");
const session = cookie;
const invitedEmail = `smoke-${id}@monefy.ro`;
const invited = await data("/users", { username: `Smoke ${id}`, email: invitedEmail, role: "BASIC" });
const mailOrigin = process.env.MONEFY_MAILPIT_URL || "http://localhost:8025";
const messages = await (await fetch(`${mailOrigin}/api/v1/messages`)).json();
const message = messages.messages.find(mail => mail.To.some(to => to.Address === invitedEmail));
assert.ok(message, "Invitation email not delivered");
const email = await (await fetch(`${mailOrigin}/api/v1/message/${message.ID}`)).json();
const invitation = (email.Text + " " + email.HTML).match(/set-password\?token=([^"\s<]+)/)?.[1];
assert.ok(invitation, "Invitation link missing");
cookie = "";
await data(`/users/register/${invitation}`, { password: "SmokeInvite2026!" });
await request(`/users/register/${invitation}`, { password: "SmokeInvite2026!" }, 403);
const invitedLogin = await request("/auth/login", { email: invitedEmail, password: "SmokeInvite2026!" });
cookie = invitedLogin.headers.get("set-cookie").split(";")[0];
const invitedSession = cookie;
await request("/users", undefined, 403);
await request(`/invoice/artifacts/${first.id}`, undefined, 404);
cookie = session;
await data(`/users/${invited._id}`, { role: "ADVANCED" }, 200, "PATCH");
cookie = invitedSession;
await request("/users");
cookie = session;
await request(`/users/${invited._id}`, {}, 200, "DELETE");
cookie = invitedSession;
await request("/auth/me", undefined, 401);

cookie = "";
await request(`/invoice/artifacts/${first.id}`, undefined, 401);
cookie = session;
await request("/auth/logout", {});
cookie = "";
await request("/auth/me", undefined, 401);
console.log(JSON.stringify({ enqueueMs, healthMs, renderMs: completed.renderMs, cacheHitMs: hitMs, artifactBytes: original.length, checks: "versioned profiles, invoice branching and changelogs, languages, modifiers, viewers, queued PDFs, cache restoration, invitations and authorization" }, null, 2));

if (process.env.MONEFY_BROWSER_TEST === "true") {
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ headless: true, ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}) });
  try {
    const page = await browser.newPage({ viewport: { width: 1600, height: 1100 } });
    const errors = [], apiRequests = [], offOriginRequests = [];
    page.on("pageerror", error => errors.push(error.message));
    page.on("request", req => {
      const url = new URL(req.url());
      if (url.pathname.startsWith("/api/")) apiRequests.push(url);
      if (["fetch", "xhr"].includes(req.resourceType()) && url.origin !== new URL(origin).origin) offOriginRequests.push(url.href);
    });
    await page.goto(origin);
    await page.getByPlaceholder("Email", { exact: true }).fill("demo@monefy.ro");
    await page.getByPlaceholder("Password", { exact: true }).fill(process.env.DEMO_PASSWORD || "MonefyDemo2026!");
    await page.getByRole("button", { name: "Login", exact: true }).click();
    await page.waitForURL(url => url.pathname === "/");
    await page.getByText("Evergreen Clinic", { exact: false }).first().waitFor();
    await page.waitForFunction(() => {
      const canvas = document.querySelector("canvas");
      if (!canvas || canvas.width < 500) return false;
      const pixels = canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height).data;
      let painted = 0;
      for (let i = 0; i < pixels.length; i += 32) if (pixels[i + 3] > 0 && (pixels[i] < 230 || pixels[i + 1] < 230 || pixels[i + 2] < 230)) painted++;
      return painted > 100;
    }, undefined, { timeout: 90000 });
    assert.equal(await page.getByText(/Fresh PDF|recent invoices/).count(), 0);
    await page.getByRole("button", { name: "Account menu", exact: true }).click();
    await page.getByRole("menuitem", { name: "Profile" }).click();
    await page.waitForURL("**/profile");
    for (const section of ["Users", "Companies", "Customers", "Products"]) await page.getByRole("heading", { name: section, exact: true }).waitFor();
    await page.goto(origin);
    await page.getByRole("button", { name: "Close Sidebar", exact: true }).click();
    await page.getByRole("button", { name: "Close Sidebar", exact: true }).waitFor({ state: "detached" });
    await page.getByRole("button", { name: "Account menu", exact: true }).click();
    await page.getByRole("menuitem", { name: "Profile", exact: true }).click();
    await page.waitForURL("**/profile");
    await page.reload();
    await page.getByRole("heading", { name: "Companies", exact: true }).waitFor();
    assert.ok(apiRequests.some(url => url.pathname === "/api/companies"), "Adira client did not run");
    assert.ok(apiRequests.every(url => url.origin === new URL(origin).origin));
    assert.equal(offOriginRequests.length, 0, offOriginRequests.join("\n"));
    assert.equal(errors.length, 0, errors.join("\n"));
    console.log(`Browser passed: ${apiRequests.length} API requests through /api, painted PDF, profile menu and direct route, no uncaught errors.`);
  } finally { await browser.close(); }
}
