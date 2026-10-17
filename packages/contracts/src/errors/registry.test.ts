import { expect, it } from "vitest";
import { errorRegistry, isKnownCode, type ErrorCode } from "./index.generated.ts";
import { createErrorRegistry } from "./registry.ts";
import { internalErrors } from "./internal.errors.ts";
import { defineErrors } from "./define-errors.ts";

it("preserves registered definitions and a literal extensible code type", () => {
  expect(errorRegistry["internal.unexpected"]).toBe(internalErrors.unexpected.definition);
  expect(Object.isFrozen(errorRegistry)).toBe(true);
  expect(isKnownCode("internal.unexpected")).toBe(true);
  expect(isKnownCode("newer.unknown")).toBe(false);
  expect(isKnownCode("toString")).toBe(false);

  type CoreCode =
    | "internal.unexpected"
    | "internal.cancelled"
    | "validation.invalid_input"
    | "validation.malformed_json";
  const codesAreStrings: ErrorCode extends string ? true : never = true;
  const codesAreLiteral: string extends ErrorCode ? never : true = true;
  const coreCodesExist: CoreCode extends ErrorCode ? true : never = true;
  expect([codesAreStrings, codesAreLiteral, coreCodesExist]).toEqual([true, true, true]);
});

it("rejects duplicate codes with both repository-relative source names", () => {
  expect(() =>
    createErrorRegistry([
      { source: "one.errors.ts", errors: internalErrors },
      { source: "two.errors.ts", errors: internalErrors },
    ]),
  ).toThrow(/one\.errors\.ts.*two\.errors\.ts/u);
});

it("rejects two catalogues for the same area even when their reasons differ", () => {
  const extra = defineErrors("internal", {
    other: { ...internalErrors.unexpected.definition, messageKey: "errors:internal.other" },
  });
  expect(() =>
    createErrorRegistry([
      { source: "one.errors.ts", errors: internalErrors },
      { source: "two.errors.ts", errors: extra },
    ]),
  ).toThrow(/one\.errors\.ts.*two\.errors\.ts/u);
});
