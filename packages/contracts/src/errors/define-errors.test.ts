import { expect, expectTypeOf, it } from "vitest";
import { z } from "zod";
import { defineErrors } from "./define-errors.ts";
import { sanitisedRelativePath } from "./safe-details.ts";

const definition = {
  http: 403,
  severity: "warn",
  retryable: false,
  messageKey: "errors:perm.denied",
  defaultMessage: "Access was denied.",
  telegramSafe: true,
} as const;

it("creates typed safe errors and rejects invalid registrations", () => {
  const errors = defineErrors("perm", {
    denied: {
      ...definition,
      detailsSchema: z.strictObject({ count: z.number().int().nonnegative() }),
    },
  });
  const error = errors.denied({ count: 3 });
  expect(error).toEqual({
    code: "perm.denied",
    message: "Access was denied.",
    retryable: false,
    details: { count: 3 },
  });
  expectTypeOf(error.code).toEqualTypeOf<"perm.denied">();
  expectTypeOf(errors.denied).parameter(0).toEqualTypeOf<{ count: number }>();
  expect(() => defineErrors("perm", { BadReason: definition })).toThrow();
  expect(() => defineErrors("unknown", { denied: definition })).toThrow();
  expect(() => defineErrors("perm", { denied: { ...definition, messageKey: "" } })).toThrow();
});

it("drops free-form details without explicit sanitised schema approval", () => {
  const errors = defineErrors("perm", {
    denied: { ...definition, detailsSchema: z.strictObject({ output: z.string() }) },
  });
  expect(errors.denied({ output: "untrusted output" })).not.toHaveProperty("details");
});

it("allows explicitly sanitised workspace-relative text and rejects unsafe values", () => {
  const errors = defineErrors("perm", {
    denied: {
      ...definition,
      detailsSchema: z.strictObject({ requestedRelative: sanitisedRelativePath }),
    },
  });
  expect(errors.denied({ requestedRelative: "src/file.ts\n" }).details).toEqual({
    requestedRelative: "src/file.ts",
  });
  for (const value of [
    "/Users/fake/private",
    "SELECT private_table",
    ["sk", "ant", "fake", "not", "a", "real", "token"].join("-"),
    "x".repeat(201),
    "../../etc/private",
  ]) {
    expect(errors.denied({ requestedRelative: value })).not.toHaveProperty("details");
  }
});
