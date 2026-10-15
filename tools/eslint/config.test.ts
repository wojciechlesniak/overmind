import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import {
  existsSync,
  readdirSync,
  mkdtempSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";
import { test } from "node:test";
import { ESLint } from "eslint";
import { z } from "zod";
import { findMissingDisableReasons } from "./check-disable-reasons.mjs";

const root = fileURLToPath(new URL("../../", import.meta.url));
const require = createRequire(import.meta.url);
const cli = resolve(require.resolve("eslint/package.json"), "../bin/eslint.js");

async function lintProbe(path: string, source: string): Promise<string[]> {
  const filePath = resolve(root, path);
  assert.equal(existsSync(filePath), false);
  writeFileSync(filePath, source);
  try {
    const results = await new ESLint({ cwd: root }).lintFiles([filePath]);
    return results.flatMap((result) =>
      result.messages.map((message) => message.ruleId ?? message.message),
    );
  } finally {
    unlinkSync(filePath);
  }
}

await test("dangerous code, unsafe types, unchecked JSON, comments and focused tests are reported", async () => {
  const cases = [
    ["export const value = eval('1');", "no-eval"],
    ["export const value = new Function('return 1');", "no-new-func"],
    ["export const value: any = 1;", "@typescript-eslint/no-explicit-any"],
    ["Promise.resolve(1);", "@typescript-eslint/no-floating-promises"],
    ["export const value = JSON.parse('{}');", "no-restricted-syntax"],
    ["// @ts-ignore\nexport const value = missing;", "@typescript-eslint/ban-ts-comment"],
    [
      "import { test } from 'node:test'; await test.only('x', () => {});",
      "overmind/no-focused-tests",
    ],
  ] as const;
  for (const [source, rule] of cases) {
    assert.ok((await lintProbe("tools/__ove003_probe__.test.ts", source)).includes(rule), rule);
  }
});

await test("React hook dependency rules apply only to the UI projects", async () => {
  const source =
    "import { useEffect } from 'react'; export function Component({ value }: { value: string }) { useEffect(() => { void value; }, []); return null; }";
  assert.ok(
    (await lintProbe("packages/ui-kit/src/__ove003_probe__.tsx", source)).includes(
      "react-hooks/exhaustive-deps",
    ),
  );
  assert.ok(
    !(await lintProbe("packages/domain/src/__ove003_probe__.tsx", source)).includes(
      "react-hooks/exhaustive-deps",
    ),
  );
});

await test("config extensions load automatically and throwing or escaping modules fail closed", () => {
  const moduleFile = resolve(root, "eslint.config.d/zzz-ove003-probe.mjs");
  const fixture = mkdtempSync(join(tmpdir(), "overmind-eslint-external-"));
  assert.equal(existsSync(moduleFile), false);
  const run = () =>
    spawnSync(process.execPath, [cli, "tools/src/index.ts"], {
      cwd: root,
      encoding: "utf8",
      timeout: 30_000,
    });
  try {
    writeFileSync(moduleFile, "export default [];\n");
    assert.equal(run().status, 0);
    writeFileSync(moduleFile, "throw new Error('OVE003_IMPORT_FAILURE');\n");
    const thrown = run();
    assert.notEqual(thrown.status, 0);
    assert.match(thrown.stderr, /OVE003_IMPORT_FAILURE/);
    unlinkSync(moduleFile);
    const external = join(fixture, "external.mjs");
    writeFileSync(external, "export default [];\n");
    symlinkSync(external, moduleFile);
    const escaped = run();
    assert.notEqual(escaped.status, 0);
    assert.match(escaped.stderr, /escapes the repository/);
  } finally {
    if (existsSync(moduleFile)) {
      unlinkSync(moduleFile);
    }
    rmSync(fixture, { recursive: true, force: true });
  }
});

await test("only real ESLint suppression comments require a reason", () => {
  assert.equal(
    findMissingDisableReasons("// eslint-disable-next-line no-console\nconsole.log(1);").length,
    1,
  );
  assert.equal(
    findMissingDisableReasons("console.log(1); // eslint-disable-line no-console").length,
    1,
  );
  assert.deepEqual(
    findMissingDisableReasons(
      "// eslint-disable-next-line no-console -- OVE_TEST001 deliberate fixture\nconsole.log(1);",
    ),
    [],
  );
  assert.deepEqual(
    findMissingDisableReasons('const text = "// eslint-disable-next-line no-console";'),
    [],
  );
  assert.deepEqual(findMissingDisableReasons("/* eslint-disable no-console */"), [
    "source.ts:1: eslint-disable requires -- reason",
  ]);
  for (const source of [
    "const value = 1; const message = `${value}`;\n// eslint-disable-next-line no-console\nconsole.log(value);",
    "const value = 1; const message = `${value}`;\n/* eslint-disable no-console */",
    "/* eslint-disable no-eval -- */",
    "/* eslint-disable no-eval --   \n */",
    "// eslint-disable no-console --   ",
  ]) {
    assert.equal(findMissingDisableReasons(source).length, 1, source);
  }
  assert.deepEqual(
    findMissingDisableReasons(
      "const value = 1; const message = `literal // eslint-disable ${value}`;",
    ),
    [],
  );
  assert.deepEqual(
    findMissingDisableReasons("/* eslint-disable no-eval -- OVE_TEST001 deliberate fixture */"),
    [],
  );
  execFileSync(process.execPath, ["tools/eslint/check-disable-reasons.mjs"], { cwd: root });
});

await test("test files still reject explicit any and permit non-null assertions", async () => {
  const source = "export const values: string[] = []; export const first = values[0]!;";
  assert.ok(
    !(await lintProbe("tools/__ove003_probe__.test.ts", source)).includes(
      "@typescript-eslint/no-non-null-assertion",
    ),
  );
  assert.ok(
    (await lintProbe("tools/__ove003_probe__.ts", source)).includes(
      "@typescript-eslint/no-non-null-assertion",
    ),
  );
});

await test("critical rules survive config composition and generated build outputs remain ignored", async () => {
  const engine = new ESLint({ cwd: root });
  const schema = z.object({ rules: z.record(z.string(), z.array(z.unknown())) });
  const config = schema.parse(await engine.calculateConfigForFile("tools/src/index.ts"));
  for (const rule of [
    "curly",
    "no-eval",
    "no-new-func",
    "@typescript-eslint/no-explicit-any",
    "@typescript-eslint/no-floating-promises",
    "no-restricted-syntax",
  ]) {
    assert.equal(config.rules[rule]?.[0], 2, rule);
  }
  assert.equal(await engine.calculateConfigForFile("tools/.tsbuild/src/index.d.ts"), undefined);
  assert.equal(await engine.calculateConfigForFile("tools/example.generated.ts"), undefined);
});

await test("rule overrides between modules are surfaced for review", async (context) => {
  const schema = z.object({
    default: z.array(z.object({ rules: z.record(z.string(), z.unknown()).optional() }).loose()),
  });
  const ownerByRule = new Map<string, string>();
  for (const name of readdirSync(resolve(root, "eslint.config.d"))
    .filter((file) => file.endsWith(".mjs"))
    .sort()) {
    const namespace: unknown = await import(
      pathToFileURL(resolve(root, "eslint.config.d", name)).href
    );
    for (const config of schema.parse(namespace).default) {
      for (const rule of Object.keys(config.rules ?? {})) {
        const previous = ownerByRule.get(rule);
        if (previous !== undefined && previous !== name) {
          context.diagnostic(`Rule override: ${rule}, ${previous} -> ${name}`);
        }
        ownerByRule.set(rule, name);
      }
    }
  }
});
