const { test } = require("node:test");
const assert = require("node:assert/strict");
const { calculateInvoiceState, lineSubtotal } = require("../backend/dist/src/controller/invoice/utils/total");

test("a fixed discount applies once to the line subtotal", async () => {
  const product = { _id: "line", quantity: 2, product: { name: "Service", price: 100, currency: "EUR" } };
  const modifier = { name: "Discount", scope: "line", type: "fixed", currency: "EUR", operation: "subtract", value: 10, targetProductLine: ["line"], index: 0 };
  const result = await calculateInvoiceState([product], [modifier], [{ name: "Net", index: 1 }]);
  assert.equal(result.total, 190);
  assert.equal(result.viewers[0].subtotal, 190);
  assert.equal(lineSubtotal(product, result.modifiers), 190);
});

test("mixed currencies preserve discounts, tax and subtotal positions", async (t) => {
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
