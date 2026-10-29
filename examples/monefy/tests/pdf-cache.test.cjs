const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  canonicalJSON,
  payloadHash,
  developmentDelayMs,
  artifactPath,
} = require("../backend/dist/src/pdf/cache");

test("preview hashing is stable across key order and changes with every rendering input", () => {
  assert.equal(
    canonicalJSON({ b: 2, a: { d: 4, c: 3 } }),
    canonicalJSON({ a: { c: 3, d: 4 }, b: 2 }),
  );
  const body = {
    products: [{ name: "Support", quantity: 2, unit_price: 100 }],
  };
  const resolved = { company: { name: "Monefy" } };
  const original = payloadHash("owner-a", body, resolved);
  assert.notEqual(original, payloadHash("owner-b", body, resolved));
  assert.notEqual(
    original,
    payloadHash(
      "owner-a",
      { products: [...body.products].reverse(), note: "changed" },
      resolved,
    ),
  );
  assert.notEqual(
    original,
    payloadHash("owner-a", body, { company: { name: "Updated company" } }),
  );
  assert.notEqual(payloadHash("a", [1, 2], {}), payloadHash("a", [2, 1], {}));
});

test("the artificial delay requires an explicit opt-in, including in production demos", () => {
  assert.equal(
    developmentDelayMs({
      NODE_ENV: "development",
      PDF_DEVELOPMENT_DELAY: "true",
    }),
    4500,
  );
  assert.equal(
    developmentDelayMs({
      NODE_ENV: "production",
      PDF_DEVELOPMENT_DELAY: "true",
    }),
    4500,
  );
  assert.equal(
    developmentDelayMs({
      NODE_ENV: "development",
      PDF_DEVELOPMENT_DELAY: "false",
    }),
    0,
  );
  assert.equal(developmentDelayMs({}), 0);
  assert.equal(developmentDelayMs({ NODE_ENV: "production" }), 0);
  assert.equal(developmentDelayMs({ PDF_DEVELOPMENT_DELAY: "false" }), 0);
  assert.equal(developmentDelayMs({ PDF_DEVELOPMENT_DELAY: "TRUE" }), 0);
});

test("artifact paths reject traversal and arbitrary filenames", () => {
  assert.throws(() => artifactPath("../../etc/passwd"));
  assert.throws(() => artifactPath("invoice.pdf"));
});

const { calculateInvoiceState, lineSubtotal } = require("../backend/dist/src/controller/invoice/utils/total");

test("a fixed line discount is applied once to the line subtotal", async () => {
  const product = { _id: "line", quantity: 2, product: { name: "Service", price: 100, currency: "EUR" } };
  const modifier = { name: "Discount", scope: "line", type: "fixed", currency: "EUR", operation: "subtract", value: 10, targetProductLine: ["line"], index: 0 };
  const result = await calculateInvoiceState([product], [modifier], [{ name: "Net", index: 1 }]);
  assert.equal(result.total, 190);
  assert.equal(result.viewers[0].subtotal, 190);
  assert.equal(lineSubtotal(product, result.modifiers), 190);
});

test("mixed currency invoices retain line modifiers, total modifiers and viewer positions", async (t) => {
  t.mock.method(globalThis, "fetch", async () => new Response(JSON.stringify({ rates: { EUR: 0.9 } })));
  const products = [
    { _id: "eur", quantity: 2, product: { name: "Service", price: 100, currency: "EUR" } },
    { _id: "usd", quantity: 1, product: { name: "Subscription", price: 100, currency: "USD" } },
  ];
  const modifiers = [
    { name: "Discount", scope: "line", type: "fixed", currency: "EUR", operation: "subtract", value: 10, targetProductLine: ["eur"], index: 0 },
    { name: "Tax", scope: "total", type: "percentage", operation: "add", value: 19, index: 2 },
  ];
  const result = await calculateInvoiceState(products, modifiers, [{ name: "Net", index: 1 }, { name: "Gross", index: 3 }]);
  assert.equal(result.currency, "EUR");
  assert.equal(result.total, 333.2);
  assert.deepEqual(result.viewers.map(viewer => viewer.subtotal), [280, 333.2]);
});
