/** Shares the private database lifecycle and deterministic seed in read.test.ts. */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  defineResource,
  field,
  normalizeReadQuery,
  parseReadQuery,
  when,
} from "@n/adira.core.ts";
import { defineRead } from "../read";
import { calls, categorySource, getCategories, relations } from "./fixtures";

const Child = defineResource({
  name: field.string(),
  amount: field.number().nullable(),
});
const Parent = defineResource({
  name: field.string(),
  amount: field.number().nullable().filterable("$eq"),
  count: field.number().filterable("$eq"),
  active: field.boolean().filterable("$eq"),
  child: field.one(Child).nullable(),
  children: field.many(Child),
});

test("conditional query parts are lazy and preserve falsy values", () => {
  let called = 0;
  assert.equal(
    when(false, () => {
      called++;
      throw new Error("Disabled child.");
    }),
    undefined,
  );
  assert.equal(called, 0);
  assert.equal(
    when(true, () => {
      called++;
      return false;
    }),
    false,
  );
  assert.equal(
    when(true, () => 0),
    0,
  );
  assert.equal(
    when(true, () => null),
    null,
  );
  assert.equal(called, 1);
});

test("query normalization omits optional parts recursively without changing operands or input", () => {
  const input = {
    select: {
      name: true,
      amount: undefined,
      child: when(true, () => ({
        select: { name: true, amount: undefined },
        where: undefined,
      })),
      children: when(true, () => ({
        select: { name: true },
        where: undefined,
        orderBy: undefined,
        page: { limit: 2, offset: 0 },
      })),
    },
    where: {
      $and: [
        { active: { $eq: false } },
        { amount: { $eq: 0 } },
        { amount: { $eq: null } },
      ],
    },
    orderBy: undefined,
    page: undefined,
  } as const;
  const normalized = normalizeReadQuery(Parent, input);
  assert.deepEqual(normalized, {
    select: {
      name: true,
      child: { select: { name: true } },
      children: { select: { name: true }, page: { limit: 2, offset: 0 } },
    },
    where: {
      $and: [
        { active: { $eq: false } },
        { amount: { $eq: 0 } },
        { amount: { $eq: null } },
      ],
    },
  });
  assert.equal("amount" in input.select, true);
  assert.equal("orderBy" in input, true);
  assert.notEqual(normalized, input);
  assert.notEqual(normalized.select, input.select);
  assert.equal(normalized.where, input.where);
});

test("undefined selections still enforce empty selections, unknown keys, and operand validation", () => {
  for (const input of [
    { select: { name: undefined } },
    { select: { name: true, child: { select: { amount: undefined } } } },
  ])
    assert.throws(
      () => parseReadQuery(Parent, input),
      /choose at least one field/,
    );
  assert.throws(
    () => parseReadQuery(Parent, { select: { name: true, typo: undefined } }),
    /Unknown selected field/,
  );
  assert.throws(
    () =>
      parseReadQuery(Parent, { select: { name: true }, groupBy: undefined }),
    /unsupported key/,
  );
  assert.throws(
    () =>
      parseReadQuery(Parent, {
        select: { name: true },
        page: { cursor: undefined },
      }),
    /unsupported key/,
  );
  assert.throws(
    () =>
      parseReadQuery(Parent, {
        select: { name: true },
        where: { count: { $eq: undefined } },
      }),
    /number/,
  );
  for (const selected of [false, null]) {
    assert.throws(
      () => parseReadQuery(Parent, { select: { name: selected } }),
      /expected true/,
    );
    assert.throws(
      () => parseReadQuery(Parent, { select: { name: true, child: selected } }),
      /expected an object/,
    );
  }
});

test("managed readers execute conditional selections and prune omitted providers", async () => {
  const omitted = await getCategories({
    select: {
      name: true,
      displayName: when(false, () => true),
      createdBy: when(false, () => ({ select: { initials: true } })),
      products: undefined,
    },
    orderBy: undefined,
    page: undefined,
  });
  assert.deepEqual(
    omitted.rows.map((row) => Object.keys(row)),
    Array.from({ length: 4 }, () => ["name"]),
  );
  assert.equal(calls.displayName, 0);
  assert.equal(calls.initials, 0);
  const included = await getCategories({
    select: {
      name: true,
      createdBy: when(true, () => ({ select: { initials: true } })),
      products: when(true, () => ({
        select: { name: true },
        page: { limit: 1 },
      })),
    },
    where: { name: { $eq: "Books" } },
  });
  assert.deepEqual(included, {
    rows: [
      {
        name: "Books",
        createdBy: { initials: "DI" },
        products: [{ name: "Book A" }],
      },
    ],
  });
  assert.equal(calls.initials, 1);
});

test("complete relation dependencies skip undefined fields while loading their complete rows", async () => {
  const source = categorySource
    .load(
      "names",
      relations.products.all({
        select: { name: true, stock: when(false, () => true) },
      }),
    )
    .derive("names", ["names"], (row) =>
      row.names.map((product) => product.name).join(", "),
    );
  const read = defineRead(
    defineResource({ name: field.string(), names: field.string() }),
    {
      source,
      scope: () => source.condition((e) => e.eq(e.field("name"), "Books")),
    },
  );
  assert.deepEqual(await read({ select: { name: true, names: true } }), {
    rows: [{ name: "Books", names: "Book A, Book B" }],
  });
});
