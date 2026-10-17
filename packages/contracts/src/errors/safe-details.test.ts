import { expect, it } from "vitest";
import { z } from "zod";
import { createAppError } from "./create-error.ts";
import { defineErrors } from "./define-errors.ts";
import { sanitisedText } from "./safe-details.ts";
import { resolveUserMessage } from "./user-message.ts";
import { createErrorRegistry } from "./registry.ts";

const definition = {
  http: 400,
  severity: "warn",
  retryable: false,
  messageKey: "errors:gateway.invalid_input",
  defaultMessage: "The input is invalid.",
  telegramSafe: true,
} as const;

it("accepts only schema-approved primitive message parameters and bounded nested JSON", () => {
  const errors = defineErrors("gateway", {
    invalid_input: {
      ...definition,
      detailsSchema: z.strictObject({
        count: z.number(),
        allowed: z.boolean(),
        absent: z.null(),
        choice: z.enum(["one", "two"]),
        label: z.union([z.literal("none"), sanitisedText]),
        nested: z.strictObject({ values: z.array(z.number()) }),
      }),
    },
  });
  const details = {
    count: 1,
    allowed: false,
    absent: null,
    choice: "one" as const,
    label: "safe\nlabel",
    nested: { values: [1, 2] },
  };
  const error = errors.invalid_input(details);
  expect(error.details).toEqual({ ...details, label: "safelabel" });
  const registry = createErrorRegistry([{ source: "gateway.errors.ts", errors }]);
  expect(resolveUserMessage(error, "telegram", registry)).toEqual({
    key: "errors:gateway.invalid_input",
    params: { count: 1, allowed: false, absent: null, choice: "one", label: "safelabel" },
  });
  expect(resolveUserMessage({ ...error, code: "newer.unknown" }, "ui", registry)).toEqual({
    key: "errors:generic.try_again_on_desktop",
    params: {},
  });
});

it("rejects malformed, reflective and oversized detail values without invoking accessors", () => {
  const cycle: Record<string, unknown> = {};
  cycle["self"] = cycle;
  const accessor = Object.defineProperty({}, "count", {
    get() {
      throw new Error("Accessor must not execute.");
    },
    enumerable: true,
  });
  const hostile = new Proxy(
    {},
    {
      ownKeys: () => {
        throw new Error("Reflection denied.");
      },
    },
  );
  const sparse: number[] = [];
  sparse.length = 2;
  const tooDeep = Array.from({ length: 10 }).reduce<unknown>((value) => ({ value }), 1);
  const invalid = [
    null,
    [],
    "text",
    new Date(0),
    { count: 1n },
    { count: Number.NaN },
    { count: Number.POSITIVE_INFINITY },
    { count: undefined },
    { count: () => 1 },
    { count: 1, [Symbol("hidden")]: "private fixture value" },
    Object.defineProperty({}, "count", { value: 1, enumerable: false }),
    { values: Object.assign([1], { extra: 2 }) },
    { count: new Date(0) },
    cycle,
    accessor,
    hostile,
    { values: sparse },
    tooDeep,
    Object.fromEntries(Array.from({ length: 101 }, (_, index) => [`key${String(index)}`, index])),
    { constructor: 1 },
    { ["x".repeat(65)]: 1 },
    { count: "x".repeat(241) },
  ];
  const bounded = { ...definition, detailsSchema: z.strictObject({ count: z.number() }) };
  for (const input of invalid) {
    expect(createAppError("gateway.invalid_input", bounded, input)).not.toHaveProperty("details");
  }
  const large = {
    ...definition,
    detailsSchema: z.strictObject({ values: z.array(sanitisedText) }),
  };
  expect(
    createAppError("gateway.invalid_input", large, { values: Array(100).fill("x".repeat(200)) }),
  ).not.toHaveProperty("details");
});

it("keeps causes in memory and rejects unsafe registration messages", () => {
  const cause = new Error("foreign detail");
  const error = createAppError("gateway.invalid_input", definition, undefined, cause);
  expect(error.cause).toBe(cause);
  expect(JSON.stringify(error)).not.toContain("foreign");
  expect(() =>
    createAppError("gateway.invalid_input", {
      ...definition,
      defaultMessage: "/Users/fake/private",
    }),
  ).toThrow("Unsafe error definition.");
});

it("bounds repeated DAG expansion before schema parsing", () => {
  let descriptorReads = 0;
  let schemaCalls = 0;
  let graph: Record<string, unknown> = new Proxy(
    { count: 1 },
    {
      getOwnPropertyDescriptor(target, key) {
        descriptorReads += 1;
        return Reflect.getOwnPropertyDescriptor(target, key);
      },
    },
  );
  for (let level = 0; level < 7; level += 1) {
    graph = { a: graph, b: graph, c: graph, d: graph };
  }
  const schema = z.strictObject({ value: z.json() }).superRefine(() => {
    schemaCalls += 1;
  });
  const error = createAppError(
    "gateway.invalid_input",
    { ...definition, detailsSchema: schema },
    { value: graph },
  );
  expect(error).not.toHaveProperty("details");
  expect(descriptorReads).toBeLessThanOrEqual(512);
  expect(schemaCalls).toBe(0);
});

it("rejects the global serialized size before invoking the details schema", () => {
  let schemaCalls = 0;
  const schema = z.strictObject({ values: z.array(sanitisedText) }).superRefine(() => {
    schemaCalls += 1;
  });
  const error = createAppError(
    "gateway.invalid_input",
    { ...definition, detailsSchema: schema },
    { values: Array(100).fill("x".repeat(200)) },
  );
  expect(error).not.toHaveProperty("details");
  expect(schemaCalls).toBe(0);
});

it("accepts small shared JSON and enforces the global value budget before parsing", () => {
  let schemaCalls = 0;
  const schema = z.strictObject({ groups: z.array(z.array(z.number())) }).superRefine(() => {
    schemaCalls += 1;
  });
  const shared = Array.from({ length: 100 }, () => 1);
  const bounded = { ...definition, detailsSchema: schema };
  const accepted = { groups: Array.from({ length: 5 }, () => shared) };
  expect(createAppError("gateway.invalid_input", bounded, accepted).details).toEqual(accepted);
  expect(schemaCalls).toBe(1);
  schemaCalls = 0;
  const denied = { groups: Array.from({ length: 6 }, () => shared) };
  expect(createAppError("gateway.invalid_input", bounded, denied)).not.toHaveProperty("details");
  expect(schemaCalls).toBe(0);
});

it("counts UTF-8 bytes rather than string code units before schema parsing", () => {
  let schemaCalls = 0;
  const schema = z.strictObject({ values: z.array(sanitisedText) }).superRefine(() => {
    schemaCalls += 1;
  });
  const details = { values: Array.from({ length: 100 }, () => "ą".repeat(100)) };
  expect(JSON.stringify(details).length).toBeLessThan(16_384);
  expect(
    createAppError("gateway.invalid_input", { ...definition, detailsSchema: schema }, details),
  ).not.toHaveProperty("details");
  expect(schemaCalls).toBe(0);
});
