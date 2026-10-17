import { mkdtempSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { expect, test } from "vitest";
import { buildManifest } from "./manifest.ts";
import { hashFile } from "./files.ts";
import { readEngineComponent } from "./sbom.ts";
import { json } from "./input.parse-boundary.ts";
import { parseRuntimeLedger } from "./runtimeLicenses.parse-boundary.ts";

test("SBOM includes only a present, current and hash-verified engine manifest", () => {
  const root = realpathSync(mkdtempSync(resolve(tmpdir(), "ove017-sbom-")));
  const sha = "abc123abc123" + "0".repeat(28);
  try {
    expect(readEngineComponent(root, sha)).toBeUndefined();
    const out = resolve(root, "apps/desktop/src-tauri/binaries");
    mkdirSync(resolve(out, "overmind-engine.resources"), { recursive: true });
    writeFileSync(resolve(out, "overmind-engine-aarch64-apple-darwin"), "binary");
    for (const name of ["LICENSE", "engine.cjs.map"]) {
      writeFileSync(resolve(out, "overmind-engine.resources", name), name);
    }
    const policies = resolve(root, "tools/package-engine");
    mkdirSync(policies, { recursive: true });
    writeFileSync(
      resolve(policies, "node.lock.json"),
      readFileSync(resolve(import.meta.dirname, "node.lock.json")),
    );
    const ledger = parseRuntimeLedger(
      json(readFileSync(resolve(import.meta.dirname, "runtime-licenses.json"), "utf8")),
    );
    writeFileSync(
      resolve(policies, "runtime-licenses.json"),
      JSON.stringify({
        ...ledger,
        status: "proposed",
        ownerDecision: null,
        noticeSha256: hashFile(resolve(out, "overmind-engine.resources/LICENSE")),
      }),
    );
    writeFileSync(resolve(root, "pnpm-lock.yaml"), "fixture lock\n");
    const manifest = buildManifest({
      version: "0.0.0",
      protocol: 1,
      buildSha: "abc123abc123",
      node: "22.23.3",
      sha256: hashFile(resolve(out, "overmind-engine-aarch64-apple-darwin")),
      sha256Unsigned: "a".repeat(64),
      bundleSha256: "b".repeat(64),
      companions: ["LICENSE", "engine.cjs.map"].map((name) => ({
        path: `engine/${name}`,
        sha256: hashFile(resolve(out, "overmind-engine.resources", name)),
      })),
      runtimeLicenseStatus: "proposed",
      inputHashes: {
        runtimeLicenseLedger: hashFile(resolve(policies, "runtime-licenses.json")),
        nodeArchive: "23b25245dcfb9af7262f8ff142e9e2e0af025368117329e7a7458a51e5922f53",
        nodeLock: hashFile(resolve(policies, "node.lock.json")),
        pnpmLock: hashFile(resolve(root, "pnpm-lock.yaml")),
        entitlements: "4".repeat(64),
      },
      toolVersions: { esbuild: "0.28.2", node: "22.23.3", postject: "1.0.0-alpha.6" },
    });
    const path = resolve(out, "overmind-engine.manifest.json");
    writeFileSync(path, manifest);
    const component = readEngineComponent(root, sha);
    expect(component?.type).toBe("file");
    expect(component?.hashes[0]?.content).toBe(
      createHash("sha256").update(readFileSync(path)).digest("hex"),
    );
    expect(() => readEngineComponent(root, "f".repeat(40))).toThrow("stale");
    writeFileSync(resolve(root, "pnpm-lock.yaml"), "changed lock\n");
    expect(() => readEngineComponent(root, sha)).toThrow("input hash");
    writeFileSync(resolve(root, "pnpm-lock.yaml"), "fixture lock\n");
    writeFileSync(resolve(out, "overmind-engine.resources/LICENSE"), "tampered");
    expect(() => readEngineComponent(root, sha)).toThrow("hash");
    writeFileSync(path, "{}");
    expect(() => readEngineComponent(root, sha)).toThrow();
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
