import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readdirSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { test } from "vitest";
import { satisfies } from "semver";
import { readJsonRecord } from "./test-support/json.parse-boundary.ts";

const root = fileURLToPath(new URL("../", import.meta.url));
const require = createRequire(import.meta.url);
const compiler = require.resolve("typescript/bin/tsc");

const readObject = readJsonRecord;

function object(value: unknown): Record<string, unknown> {
  assert.ok(typeof value === "object" && value !== null && !Array.isArray(value));
  return value as Record<string, unknown>;
}

function string(value: unknown): string {
  assert.equal(typeof value, "string");
  return value as string;
}

const manifests = [
  ...["apps", "packages"].flatMap((parent) =>
    readdirSync(resolve(root, parent))
      .map((name) => resolve(root, parent, name, "package.json"))
      .filter(existsSync),
  ),
  ...readdirSync(resolve(root, "packages/adapters")).map((name) =>
    resolve(root, "packages/adapters", name, "package.json"),
  ),
  resolve(root, "tools/package.json"),
];
const directoryByName = new Map(
  manifests.map((path) => [string(readObject(path)["name"]), dirname(path)]),
);

test("installed TypeScript satisfies the actual typescript-eslint peer range; TypeScript 7 fails", () => {
  const version = string(readObject(require.resolve("typescript/package.json"))["version"]);
  const range = string(
    object(readObject(require.resolve("typescript-eslint/package.json"))["peerDependencies"])[
      "typescript"
    ],
  );
  assert.equal(version, "6.0.3");
  assert.ok(satisfies(version, range), `${version} must satisfy ${range}`);
  assert.equal(satisfies("7.0.2", range), false);
  assert.throws(() => {
    assert.ok(satisfies("7.0.2", range));
  });
});

test("every project reference exactly matches the manifest graph and the solution includes all packages", () => {
  for (const manifestPath of manifests) {
    const directory = dirname(manifestPath);
    const manifest = readObject(manifestPath);
    const config = readObject(resolve(directory, "tsconfig.json"));
    const references = config["references"] ?? [];
    assert.ok(Array.isArray(references));
    const actual = references
      .map((reference) => resolve(directory, string(object(reference)["path"])))
      .sort();
    const expected = Object.keys(object(manifest["dependencies"] ?? {}))
      .map((name) => directoryByName.get(name))
      .sort();
    assert.deepEqual(actual, expected, relative(root, directory));
  }
  const references = readObject(resolve(root, "tsconfig.json"))["references"];
  assert.ok(Array.isArray(references));
  assert.deepEqual(
    references.map((reference) => resolve(root, string(object(reference)["path"]))).sort(),
    manifests.map(dirname).sort(),
  );
});

test("base configuration enables every required strictness and syntax guard without path aliases", () => {
  const options = object(readObject(resolve(root, "tsconfig.base.json"))["compilerOptions"]);
  for (const flag of [
    "strict",
    "noUncheckedIndexedAccess",
    "exactOptionalPropertyTypes",
    "noImplicitOverride",
    "noImplicitReturns",
    "noFallthroughCasesInSwitch",
    "noPropertyAccessFromIndexSignature",
    "useUnknownInCatchVariables",
    "noUnusedLocals",
    "noUnusedParameters",
    "forceConsistentCasingInFileNames",
    "verbatimModuleSyntax",
    "isolatedModules",
    "erasableSyntaxOnly",
    "noUncheckedSideEffectImports",
    "composite",
    "incremental",
    "declaration",
    "emitDeclarationOnly",
  ]) {
    assert.equal(options[flag], true, flag);
  }
  assert.deepEqual(options["types"], []);
  assert.deepEqual(options["lib"], ["ES2023"]);
  assert.equal(options["target"], "ES2023");
  assert.equal(options["moduleResolution"], "Bundler");
  for (const flag of ["paths", "baseUrl", "rootDir", "esModuleInterop"]) {
    assert.equal(options[flag], undefined, flag);
  }
});

function withSource(path: string, content: string, check: () => void): void {
  const file = resolve(root, path);
  assert.equal(existsSync(file), false, "never overwrite an existing source file");
  writeFileSync(file, content);
  try {
    check();
  } finally {
    unlinkSync(file);
  }
}

function expectDiagnostic(content: string, code: string): void {
  withSource("packages/domain/src/__ove002_guard__.ts", content, () => {
    const result = spawnSync(
      process.execPath,
      [compiler, "-p", "packages/domain", "--noEmit", "--pretty", "false"],
      { cwd: root, encoding: "utf8", timeout: 30_000 },
    );
    assert.equal(result.error, undefined);
    assert.notEqual(result.status, 0);
    assert.match(result.stdout + result.stderr, new RegExp(code));
  });
}

test(
  "domain compilation denies process, fetch and a dependency pointing to application",
  { timeout: 30_000 },
  () => {
    expectDiagnostic("export const value = process.env;\n", "TS2591|TS2580|TS2304");
    expectDiagnostic('export const value = fetch("https://example.com");\n', "TS2304");
    expectDiagnostic('import "@overmind/application";\n', "TS2307|TS2882");
  },
);

test("both UI projects compile JSX through react-jsx", { timeout: 30_000 }, () => {
  for (const directory of ["apps/desktop", "packages/ui-kit"]) {
    withSource(
      `${directory}/src/__ove002_jsx__.tsx`,
      'export const sample = <section aria-label="test" />;\n',
      () => {
        execFileSync(process.execPath, [compiler, "-p", directory, "--pretty", "false"], {
          cwd: root,
          encoding: "utf8",
        });
      },
    );
  }
});
