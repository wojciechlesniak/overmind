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
