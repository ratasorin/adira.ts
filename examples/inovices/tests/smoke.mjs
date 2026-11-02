import assert from "node:assert/strict";

const origin = process.env.INOVICES_URL || "http://127.0.0.1:5173";
const password = process.env.DEMO_PASSWORD || "InovicesDemo2026!";
let cookie = "";
async function request(path, body, status = 200) {
  const response = await fetch(`${origin}/api${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: { ...(cookie ? { Cookie: cookie } : {}), ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  assert.equal(response.status, status, `${path}: ${response.status}`);
  return response;
}
const data = async (...args) => (await request(...args)).json();
async function rows(path, include = []) {
  const query = encodeURIComponent(JSON.stringify({ include, rows: { select: [] } }));
  const response = await data(`${path}?query=${query}`);
  assert.ok(response.executor?.rows, `${path}: missing historical Adira response`);
  return response.executor.rows;
}

await request("/invoices", undefined, 401);
const login = await request("/auth/login", { email: "demo@inovices.ro", password });
cookie = login.headers.get("set-cookie").split(";")[0];
await request("/health/ready");
for (const path of ["/companies", "/customers", "/products", "/users", "/templates", "/modifiers", "/viewers"]) {
  assert.ok((await rows(path)).length, `${path}: seed data missing`);
}
assert.ok((await rows("/users")).every(user => !Object.hasOwn(user, "password")));
const [invoice] = await rows("/invoices");
for (const [path, payload] of [[`/generate/invoice/${invoice._id}`, undefined], ["/generate/preview", { products: [], modifiers: [], viewers: [], notes: "Inovices preview" }]]) {
  const response = await request(path, payload);
  assert.match(response.headers.get("content-type"), /application\/pdf/);
  const binary = Buffer.from(await response.arrayBuffer());
  assert.equal(binary.subarray(0, 5).toString(), "%PDF-");
  assert.ok(binary.length > 1000);
}
await request("/generate/preview", { products: [], emittedDate: "invalid" }, 400);
await request("/auth/logout", {});
cookie = "";
await request("/auth/me", undefined, 401);
console.log("API passed: authentication, historical Adira responses, seed data and streamed PDFs.");

if (process.env.INOVICES_BROWSER_TEST === "true") {
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1800, height: 1100 } });
    const errors = [], apiRequests = [], offOrigin = [];
    page.on("pageerror", error => errors.push(error.message));
    page.on("request", request => {
      const url = new URL(request.url());
      if (url.pathname.startsWith("/api/")) apiRequests.push(url);
      if (["fetch", "xhr"].includes(request.resourceType()) && url.origin !== new URL(origin).origin) offOrigin.push(url.href);
    });
    await page.goto(origin);
    await page.getByPlaceholder("Email", { exact: true }).fill("demo@inovices.ro");
    await page.getByPlaceholder("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Login", exact: true }).click();
    await page.waitForURL(url => url.pathname === "/");
    await page.getByRole("button", { name: "Create", exact: true }).click();
    await page.waitForFunction(() => {
      const canvas = document.querySelector("canvas");
      if (!canvas || canvas.width < 500) return false;
      const pixels = canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height).data;
      let painted = 0;
      for (let i = 0; i < pixels.length; i += 32) if (pixels[i + 3] && pixels[i] < 230 && pixels[i + 1] < 230) painted++;
      return painted > 100;
    }, undefined, { timeout: 30000 });
    const productButton = page.getByRole("button", { name: "Add Product", exact: true });
    const style = await productButton.evaluate(button => ({ padding: getComputedStyle(button).paddingLeft, color: getComputedStyle(button).color }));
    assert.ok(parseFloat(style.padding) >= 12, `Missing action padding: ${style.padding}`);
    assert.equal(style.color, "rgb(82, 82, 82)");
    const emitter = page.getByRole("button", { name: /Select Emitter Company/ });
    assert.ok(parseFloat(await emitter.evaluate(button => getComputedStyle(button).paddingLeft)) >= 12);
    assert.equal(await page.getByText(/Fresh PDF|recent invoices/).count(), 0);
    for (const collapsed of [false, true]) {
      if (collapsed) {
        await page.goto(origin);
        await page.getByRole("button", { name: "Close Sidebar", exact: true }).click();
        await page.getByRole("button", { name: "Close Sidebar", exact: true }).waitFor({ state: "detached" });
      }
      await page.getByRole("button", { name: "Account menu", exact: true }).click();
      await page.getByRole("menuitem", { name: "Profile", exact: true }).click();
      await page.waitForURL("**/profile");
      for (const name of ["Users", "Companies", "Customers", "Products"]) await page.getByRole("heading", { name, exact: true }).waitFor();
    }
    await page.reload();
    await page.getByRole("heading", { name: "Companies", exact: true }).waitFor();
    assert.ok(apiRequests.some(url => url.pathname === "/api/companies"));
    assert.ok(apiRequests.every(url => url.origin === new URL(origin).origin));
    assert.deepEqual(offOrigin, []);
    assert.deepEqual(errors, []);
    console.log(`Browser passed: painted PDF, profile routes, padding, neutral secondary actions and ${apiRequests.length} requests through /api.`);
  } finally {
    await browser.close();
  }
}
