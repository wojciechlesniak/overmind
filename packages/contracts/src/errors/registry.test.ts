import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";
import { expect, expectTypeOf, it } from "vitest";
import { catalogueModules, errorRegistry, isKnownCode, type ErrorCode } from "./index.generated.ts";
import { createErrorRegistry, type CatalogueModule } from "./registry.ts";
import { internalErrors } from "./internal.errors.ts";
import { defineErrors } from "./define-errors.ts";
import type { ErrorCatalogue } from "./definition.ts";

function catalogueDeclaration(source: string, text: string) {
  const file = ts.createSourceFile(source, text, ts.ScriptTarget.Latest, true);
  const registrations = file.statements.flatMap((statement) =>
    ts.isVariableStatement(statement) &&
    statement.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)
      ? statement.declarationList.declarations.filter(
          (declaration) =>
            declaration.initializer &&
            ts.isCallExpression(declaration.initializer) &&
            ts.isIdentifier(declaration.initializer.expression) &&
            declaration.initializer.expression.text === "defineErrors",
        )
      : [],
  );
  const registration = registrations[0];
  if (
    registrations.length !== 1 ||
    !registration ||
    !ts.isIdentifier(registration.name) ||
    !registration.initializer ||
    !ts.isCallExpression(registration.initializer)
  ) {
    throw new Error("Expected one exported error catalogue in " + source);
  }
  const [area, table] = registration.initializer.arguments;
  if (
    !area ||
    !ts.isStringLiteral(area) ||
    area.text + ".errors.ts" !== source ||
    !table ||
    !ts.isObjectLiteralExpression(table)
  ) {
    throw new Error("Expected a literal area and table matching " + source);
  }
  const codes = table.properties.map((property) => {
    if (
      !ts.isPropertyAssignment(property) ||
      !(ts.isIdentifier(property.name) || ts.isStringLiteral(property.name))
    ) {
      throw new Error("Expected literal error reasons in " + source);
    }
    return area.text + "." + property.name.text;
  });
  if (new Set(codes).size !== codes.length) {
    throw new Error("Duplicate error reasons in " + source);
  }
  return { source, codes, table };
}

it("keeps the generated registry synchronized with every independently scanned catalogue", () => {
  const declarations = readdirSync(import.meta.dirname)
    .filter((name) => name.endsWith(".errors.ts"))
    .sort()
    .map((source) =>
      catalogueDeclaration(source, readFileSync(resolve(import.meta.dirname, source), "utf8")),
    );
  expect(catalogueModules.map((module) => module.source).sort()).toEqual(
    declarations.map((declaration) => declaration.source),
  );
  for (const declaration of declarations) {
    const module = catalogueModules.find((entry) => entry.source === declaration.source);
    if (!module) {
      throw new Error("Missing generated catalogue metadata.");
    }
    const errors: ErrorCatalogue = module.errors;
    expect(
      Object.values(errors)
        .map((factory) => factory.code)
        .sort(),
    ).toEqual(declaration.codes.sort());
  }
  expect(Object.keys(errorRegistry).sort()).toEqual(
    declarations.flatMap((declaration) => declaration.codes).sort(),
  );
  expect(isKnownCode("internal.unexpected")).toBe(true);
  expect(isKnownCode("newer.unknown")).toBe(false);
  expect(isKnownCode("toString")).toBe(false);
  expectTypeOf<ErrorCode>().toExtend<string>();
  expectTypeOf<string>().not.toExtend<ErrorCode>();
  expectTypeOf<
    | "internal.unexpected"
    | "internal.cancelled"
    | "validation.invalid_input"
    | "validation.malformed_json"
  >().toExtend<ErrorCode>();
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

function extensionDiagnostics(
  existingFiles = new Map<string, string>(),
  requiredCode = "internal.unexpected",
) {
  const extensionPath = resolve(import.meta.dirname, "internal.errors.ts");
  const source = existingFiles.get(extensionPath) ?? readFileSync(extensionPath, "utf8");
  const declaration = catalogueDeclaration("internal.errors.ts", source);
  let reason = "fixture_extension";
  for (let suffix = 1; declaration.codes.includes("internal." + reason); suffix += 1) {
    reason = "fixture_extension_" + String(suffix);
  }
  const addedCode = "internal." + reason;
  const closing = declaration.table.getEnd() - 1;
  const separator =
    declaration.table.properties.length > 0 && !declaration.table.properties.hasTrailingComma
      ? ","
      : "";
  const entry = [
    separator,
    reason + ': { http: 500, severity: "error", retryable: false,',
    "messageKey: " +
      JSON.stringify("errors:" + addedCode) +
      ', defaultMessage: "Fixture failure.", telegramSafe: true },',
    "",
  ].join("\n");
  let assertionPath = resolve(import.meta.dirname, "extension.typecheck.ts");
  for (let suffix = 1; existsSync(assertionPath) || existingFiles.has(assertionPath); suffix += 1) {
    assertionPath = resolve(import.meta.dirname, "extension.typecheck_" + String(suffix) + ".ts");
  }
  const virtual = new Map([
    ...existingFiles,
    [extensionPath, source.slice(0, closing) + entry + source.slice(closing)],
    [
      assertionPath,
      [
        'import type { ErrorCode } from "./index.generated.ts";',
        "const added: ErrorCode = " + JSON.stringify(addedCode) + ";",
        'const core: ErrorCode = "internal.unexpected";',
        "const existing: ErrorCode = " + JSON.stringify(requiredCode) + ";",
        "// @ts-expect-error Unknown values must not widen the literal code union.",
        'const unknown: ErrorCode = "newer.unknown";',
        "void [added, core, existing, unknown];",
      ].join("\n"),
    ],
  ]);
  const root = resolve(import.meta.dirname, "../../../..");
  const configuration = ts.getParsedCommandLineOfConfigFile(
    resolve(root, "tsconfig.tests.json"),
    {},
    {
      ...ts.sys,
      onUnRecoverableConfigFileDiagnostic: () => {
        throw new Error("Cannot read the test compiler configuration.");
      },
    },
  );
  if (!configuration || configuration.errors.length > 0) {
    throw new Error("Invalid test compiler configuration.");
  }
  const options = configuration.options;
  const original = ts.createCompilerHost(options);
  const host: ts.CompilerHost = {
    ...original,
    fileExists: (path) => virtual.has(path) || original.fileExists(path),
    readFile: (path) => virtual.get(path) ?? original.readFile(path),
    getSourceFile: (path, version, onError, fresh) => {
      const text = virtual.get(path);
      return text === undefined
        ? original.getSourceFile(path, version, onError, fresh)
        : ts.createSourceFile(path, text, version, true);
    },
  };
  const program = ts.createProgram([import.meta.filename, assertionPath], options, host);
  return ts.getPreEmitDiagnostics(program).map((diagnostic) => diagnostic.code);
}

it("typechecks an additive catalogue extension without closing ErrorCode", () => {
  expect(extensionDiagnostics()).toEqual([]);
});

it("keeps a real PERM catalogue intact when checking an additional error code", () => {
  const registryPath = resolve(import.meta.dirname, "index.generated.ts");
  const permPath = resolve(import.meta.dirname, "perm.errors.ts");
  const modules: readonly CatalogueModule[] = catalogueModules;
  const existing = modules.find((module) => module.source === "perm.errors.ts");
  const requiredCode = existing ? Object.values(existing.errors)[0]?.code : "perm.existing_reason";
  if (!requiredCode) {
    throw new Error("The existing PERM catalogue has no codes.");
  }
  const files = new Map<string, string>();
  if (!existing) {
    files.set(
      permPath,
      [
        'import { defineErrors } from "./define-errors.ts";',
        'export const permErrors = defineErrors("perm", {',
        '  existing_reason: { http: 403, severity: "warn", retryable: false,',
        '    messageKey: "errors:perm.existing_reason", defaultMessage: "Access was denied.", telegramSafe: true },',
        "});",
      ].join("\n"),
    );
    files.set(
      registryPath,
      readFileSync(registryPath, "utf8")
        .replace(
          'import { createErrorRegistry } from "./registry.ts";',
          'import { createErrorRegistry } from "./registry.ts";\nimport { permErrors } from "./perm.errors.ts";',
        )
        .replace("] as const;", '  { source: "perm.errors.ts", errors: permErrors },\n] as const;'),
    );
  }
  expect(extensionDiagnostics(files, requiredCode)).toEqual([]);
});
