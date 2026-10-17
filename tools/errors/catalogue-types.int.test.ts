import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";
import { expect, it } from "vitest";
import {
  catalogueModules,
  errorRegistry,
} from "../../packages/contracts/src/errors/index.generated.ts";
import type { ErrorCatalogue } from "../../packages/contracts/src/errors/definition.ts";

const root = resolve(import.meta.dirname, "../..");
const sourceDirectory = resolve(root, "packages/contracts/src/errors");

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

it("keeps generated metadata and runtime codes synchronized with independently scanned sources", () => {
  const declarations = readdirSync(sourceDirectory)
    .filter((name) => name.endsWith(".errors.ts"))
    .sort()
    .map((source) =>
      catalogueDeclaration(source, readFileSync(resolve(sourceDirectory, source), "utf8")),
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
});

function extensionDiagnostics(
  existingFiles = new Map<string, string>(),
  requiredCode = "internal.unexpected",
): readonly number[] {
  const extensionPath = resolve(sourceDirectory, "internal.errors.ts");
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
  let assertionPath = resolve(sourceDirectory, "extension.typecheck.ts");
  for (let suffix = 1; existsSync(assertionPath) || existingFiles.has(assertionPath); suffix += 1) {
    assertionPath = resolve(sourceDirectory, "extension.typecheck_" + String(suffix) + ".ts");
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
  const payload = JSON.stringify({ assertionPath, files: [...virtual] });
  if (Buffer.byteLength(payload) > 262_144) {
    throw new Error("Compiler fixture exceeds its input bound.");
  }
  const child = spawnSync(process.execPath, [resolve(root, "tools/errors/catalogue-compiler.ts")], {
    cwd: root,
    input: payload,
    encoding: "utf8",
    timeout: 4000,
    maxBuffer: 16_384,
  });
  if (
    child.error ||
    child.status !== 0 ||
    child.stderr !== "" ||
    !/^(?:\d+(?:,\d+)*)?\n$/u.test(child.stdout)
  ) {
    throw new Error("Compiler fixture failed or returned invalid diagnostics.");
  }
  return child.stdout.trim() ? child.stdout.trim().split(",").map(Number) : [];
}

it("typechecks an additive catalogue extension without closing ErrorCode", () => {
  expect(extensionDiagnostics()).toEqual([]);
});

it("keeps a legitimate PERM catalogue intact when checking an additional error code", () => {
  const registryPath = resolve(sourceDirectory, "index.generated.ts");
  const permPath = resolve(sourceDirectory, "perm.errors.ts");
  const files = new Map<string, string>();
  let requiredCode = "perm.existing_reason";
  if (existsSync(permPath)) {
    const declaration = catalogueDeclaration("perm.errors.ts", readFileSync(permPath, "utf8"));
    const firstCode = declaration.codes[0];
    if (!firstCode) {
      throw new Error("The existing PERM catalogue has no codes.");
    }
    requiredCode = firstCode;
  } else {
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

it.each([
  {
    name: "a closed ErrorCode union",
    replacement:
      '"internal.unexpected" | "internal.cancelled" | "validation.invalid_input" | "validation.malformed_json"',
    diagnostic: 2322,
  },
  { name: "a broad ErrorCode string", replacement: "string", diagnostic: 2578 },
])("reports genuine semantic failure for $name", ({ replacement, diagnostic }) => {
  const registryPath = resolve(sourceDirectory, "index.generated.ts");
  const source = readFileSync(registryPath, "utf8").replace(
    "export type ErrorCode = keyof typeof errorRegistry;",
    "export type ErrorCode = " + replacement + ";",
  );
  expect(extensionDiagnostics(new Map([[registryPath, source]]))).toContain(diagnostic);
});
