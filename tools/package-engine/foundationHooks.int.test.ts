// SPDX-License-Identifier: Apache-2.0
import { execFileSync, spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname, resolve } from "node:path";
import { expect, test } from "vitest";
import { safeDirectory, safeFile } from "./files.ts";
import { json, metafileInputs, parseNodeLock, sourceMapSchema } from "./input.parse-boundary.ts";

const root = resolve(import.meta.dirname, "../..");
function packagingFixture(): string {
  const parent = safeDirectory(root, resolve(root, "build/engine-tmp"), true);
  const fixture = mkdtempSync(resolve(parent, "foundation-public-"));
  try {
    for (const path of [
      ".nvmrc",
      "package.json",
      "pnpm-lock.yaml",
      "node_modules",
      "tools/node_modules",
      "tools/package-engine",
      "tools/build/engine",
      "tools/pinned-bin",
      "tools/boundaries/policy.parse-boundary.ts",
      "apps/engine/package.json",
      "apps/engine/src",
      "apps/engine/node_modules",
      "packages/contracts/package.json",
      "packages/contracts/src",
      "packages/contracts/node_modules",
    ]) {
      const source = resolve(root, path);
      if (existsSync(source)) {
        const destination = resolve(fixture, path);
        mkdirSync(dirname(destination), { recursive: true });
        cpSync(source, destination, { recursive: true, verbatimSymlinks: true });
      }
    }
    const lock = parseNodeLock(
      json(readFileSync(resolve(root, "tools/package-engine/node.lock.json"), "utf8")),
      readFileSync(resolve(root, ".nvmrc"), "utf8"),
    );
    const cache = `.cache/tools/engine-node-${lock.sha256}/resource`;
    if (existsSync(resolve(root, cache))) {
      mkdirSync(dirname(resolve(fixture, cache)), { recursive: true });
      cpSync(safeFile(root, resolve(root, cache)), resolve(fixture, cache));
    }
    execFileSync("/usr/bin/git", ["init", "--quiet", fixture], { timeout: 5000 });
    return fixture;
  } catch (error) {
    rmSync(fixture, { recursive: true, force: true });
    throw error;
  }
}

function observedPackager(fixture: string, canonicalHook: string, removeAlias: boolean): string {
  const worker = resolve(fixture, "packaging-probe.mjs");
  writeFileSync(
    worker,
    `
import { copyFileSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { packageEngine, parseOptions } from "./tools/package-engine/run.ts";
import { diagnostic } from "./tools/package-engine/context.ts";
import { NodeRunner } from "./tools/package-engine/runner.ts";
const root = process.cwd();
const actual = new NodeRunner(root);
const observer = {
  async run(file, args, options) {
    const result = await actual.run(file, args, options);
    if (result.status === 0 && args[0] === resolve(root, "tools/build/engine/bundle.mjs")) {
      const dist = args[2];
      copyFileSync(resolve(dist, "engine.meta.json"), resolve(root, "captured.meta.json"));
      copyFileSync(resolve(dist, "engine.cjs.map"), resolve(root, "captured.cjs.map"));
      if (${JSON.stringify(removeAlias)}) rmSync(${JSON.stringify(canonicalHook)});
    }
    return result;
  },
};
try {
  await packageEngine(parseOptions(["--identity", "-", "--out", "output"]), observer);
} catch (error) {
  process.stderr.write(diagnostic(error) + "\\n");
  process.exitCode = 1;
}
`,
  );
  return worker;
}

test.skipIf(process.platform !== "darwin" || process.arch !== "arm64").each([
  ["compose", "direct"],
  ["service", "direct"],
  ["service", "file-link"],
  ["service", "directory-link"],
  ["service", "removed-link"],
] as const)(
  "the real public packager denies a side-effecting %s hook through %s before any SEA command",
  (hook, mode) => {
    const fixture = packagingFixture();
    try {
      const hookSentinel = resolve(fixture, "hook-executed");
      const seaSentinel = resolve(fixture, "sea-executed");
      const source = [
        'import { writeFileSync } from "node:fs";',
        `writeFileSync(${JSON.stringify(hookSentinel)}, "executed");`,
        hook === "service"
          ? 'export async function ensureRunning() { return { status: "failed", pid: null, socket: null, detail: null }; }'
          : 'export async function startEngine() { throw new Error("Disposable fixture only"); } export async function shutdown() {}',
      ].join("\n");
      const canonicalPath = `apps/engine/src/${hook}/index.ts`;
      const canonicalHook = resolve(fixture, canonicalPath);
      const aliasPath =
        mode === "directory-link"
          ? `apps/engine/src/live-${hook}/index.ts`
          : `apps/engine/src/live-${hook}.ts`;
      if (mode === "direct") {
        writeFileSync(canonicalHook, source);
      } else {
        const target = resolve(fixture, aliasPath);
        mkdirSync(dirname(target), { recursive: true });
        writeFileSync(target, source);
        if (mode === "directory-link") {
          rmSync(dirname(canonicalHook), { recursive: true });
          symlinkSync(dirname(target), dirname(canonicalHook));
        } else {
          rmSync(canonicalHook);
          symlinkSync(target, canonicalHook);
        }
      }
      const version = resolve(fixture, "apps/engine/src/commands/version.ts");
      writeFileSync(
        version,
        [
          'import { writeFileSync } from "node:fs";',
          `if (process.execPath.endsWith("/overmind-engine-aarch64-apple-darwin")) writeFileSync(${JSON.stringify(seaSentinel)}, "executed");`,
          readFileSync(version, "utf8"),
        ].join("\n"),
      );
      const out = resolve(fixture, "output");
      const command =
        mode === "direct"
          ? ["tools/package-engine/run.ts", "--identity", "-", "--out", out]
          : [observedPackager(fixture, canonicalHook, mode === "removed-link")];
      const result = spawnSync(process.execPath, ["--import", "tsx", ...command], {
        cwd: fixture,
        encoding: "utf8",
        timeout: 110000,
        maxBuffer: 4 * 1024 * 1024,
        env: { PATH: process.env["PATH"], LANG: "C", TZ: "UTC" },
      });
      if (result.stderr.includes("bundle: Packaging command failed")) {
        const diagnosis = spawnSync(
          process.execPath,
          ["tools/build/engine/bundle.mjs", "--out-dir", resolve(fixture, "diagnostic-dist")],
          { cwd: fixture, encoding: "utf8", timeout: 10000 },
        );
        throw new Error(`Disposable fixture bundle failed: ${diagnosis.stderr}`);
      }
      if (mode !== "direct") {
        const inputs = metafileInputs(readFileSync(resolve(fixture, "captured.meta.json"), "utf8"));
        const map = sourceMapSchema.parse(
          json(readFileSync(resolve(fixture, "captured.cjs.map"), "utf8")),
        );
        expect(inputs).toContain(aliasPath);
        expect(inputs).not.toContain(canonicalPath);
        const index = map.sources.indexOf(`file:///overmind/source/${aliasPath}`);
        expect(index).toBeGreaterThanOrEqual(0);
        expect(map.sourcesContent[index]).toBe(source);
      }
      expect(result.error).toBeUndefined();
      expect({
        status: result.status,
        hookExecuted: existsSync(hookSentinel),
        packagedExecuted: existsSync(seaSentinel),
        manifestPublished: existsSync(resolve(out, "overmind-engine.manifest.json")),
      }).toEqual({
        status: 1,
        hookExecuted: false,
        packagedExecuted: false,
        manifestPublished: false,
      });
      expect(result.stderr).toContain("verify: Invalid engine foundation hooks");
    } finally {
      rmSync(fixture, { recursive: true, force: true });
    }
  },
  120000,
);

test.skipIf(process.platform !== "darwin" || process.arch !== "arm64")(
  "the real public packager preserves genuinely absent foundation hooks",
  () => {
    const fixture = packagingFixture();
    try {
      for (const hook of ["compose", "service"]) {
        rmSync(resolve(fixture, `apps/engine/src/${hook}`), { recursive: true });
      }
      const result = spawnSync(
        process.execPath,
        ["--import", "tsx", "tools/package-engine/run.ts", "--identity", "-", "--out", "output"],
        {
          cwd: fixture,
          encoding: "utf8",
          timeout: 110000,
          maxBuffer: 4 * 1024 * 1024,
          env: { PATH: process.env["PATH"], LANG: "C", TZ: "UTC" },
        },
      );
      expect(result.error).toBeUndefined();
      expect(result.status, result.stderr).toBe(0);
      expect(existsSync(resolve(fixture, "output/overmind-engine.manifest.json"))).toBe(true);
    } finally {
      rmSync(fixture, { recursive: true, force: true });
    }
  },
  120000,
);
