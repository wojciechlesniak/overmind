import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { expect, it } from "vitest";

const root = resolve(import.meta.dirname, "../..");
const source = resolve(root, "packages/contracts/src/errors");
const assertionPath = assertionFixturePath();
const script = resolve(import.meta.dirname, "catalogue-compiler.ts");

function assertionFixturePath(): string {
  const nonce = BigInt("0x" + randomUUID().replaceAll("-", "")).toString();
  return resolve(source, "extension.typecheck_" + nonce + ".ts");
}

function rejected(input: string): void {
  const result = spawnSync(process.execPath, [script], {
    cwd: root,
    input,
    encoding: "utf8",
    timeout: 4000,
    maxBuffer: 16_384,
  });
  expect(result.error).toBeUndefined();
  expect(result.status).toBe(1);
  expect(result.stdout).toBe("");
  expect(result.stderr).toBe("Catalogue compiler failed.\n");
}

it.each([
  { name: "malformed input", input: "{" },
  { name: "unbounded input", input: " ".repeat(262_145) },
  {
    name: "an overlay outside the allowed source directory",
    input: JSON.stringify({
      assertionPath,
      files: [
        [assertionPath, "export {};"],
        [resolve(root, "package.json"), "export {};"],
      ],
    }),
  },
  {
    name: "an attempt to replace the actual test assertions",
    input: JSON.stringify({
      assertionPath,
      files: [
        [assertionPath, "export {};"],
        [resolve(source, "registry.test.ts"), "export {};"],
      ],
    }),
  },
  {
    name: "duplicate virtual paths",
    input: JSON.stringify({
      assertionPath,
      files: [
        [assertionPath, "export {};"],
        [assertionPath, "export {};"],
      ],
    }),
  },
])("fails closed for $name without echoing input", ({ input }) => {
  rejected(input);
});

it("rejects a source symlink without reading its target", () => {
  const directory = mkdtempSync(resolve(tmpdir(), "ove037-compiler-path-"));
  const target = resolve(directory, "private.txt");
  const link = assertionFixturePath();
  const marker = "private fixture data";
  writeFileSync(target, marker);
  try {
    symlinkSync(target, link);
    rejected(
      JSON.stringify({
        assertionPath: link,
        files: [
          [link, "export {};"],
          [resolve(source, "internal.errors.ts"), "export {};"],
        ],
      }),
    );
    expect(readFileSync(target, "utf8")).toBe(marker);
  } finally {
    unlinkSync(link);
    rmSync(directory, { recursive: true, force: true });
  }
});
