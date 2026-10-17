import { readdirSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { expect, expectTypeOf, it } from "vitest";
import { errorRegistry, isKnownCode, type ErrorCode } from "./index.generated.ts";
import { createErrorRegistry } from "./registry.ts";
import { internalErrors } from "./internal.errors.ts";
import type { ErrorCatalogue } from "./definition.ts";
import { defineErrors } from "./define-errors.ts";

it("keeps the generated registry synchronized with every area catalogue", async () => {
  const modules: { source: string; errors: ErrorCatalogue }[] = [];
  for (const source of readdirSync(import.meta.dirname)
    .filter((name) => name.endsWith(".errors.ts"))
    .sort()) {
    const namespace: unknown = await import(pathToFileURL(`${import.meta.dirname}/${source}`).href);
    const loaded = namespace as Record<string, ErrorCatalogue>;
    for (const errors of Object.values(loaded)) {
      modules.push({ source, errors });
    }
  }
  expect(Object.keys(createErrorRegistry(modules)).sort()).toEqual(
    Object.keys(errorRegistry).sort(),
  );
  expect(isKnownCode("internal.unexpected")).toBe(true);
  expect(isKnownCode("newer.unknown")).toBe(false);
  expect(isKnownCode("toString")).toBe(false);
  expectTypeOf<ErrorCode>().toEqualTypeOf<
    | "internal.unexpected"
    | "internal.cancelled"
    | "validation.invalid_input"
    | "validation.malformed_json"
  >();
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
