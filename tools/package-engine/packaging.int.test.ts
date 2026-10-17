import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "vitest";
import { parseManifest } from "./manifest.ts";
import { hashFile, safeDirectory } from "./files.ts";

const root = resolve(import.meta.dirname, "../..");
test.skipIf(process.platform !== "darwin" || process.arch !== "arm64")(
  "real SEA builds reproducibly, signs and executes without inherited Node injection",
  () => {
    const directory = safeDirectory(root, resolve(root, "build/engine-tmp"), true);
    const out = mkdtempSync(resolve(directory, "integration-"));
    try {
      execFileSync(
        process.execPath,
        [
          "--import",
          "tsx",
          "tools/package-engine/run.ts",
          "--identity",
          "-",
          "--check-reproducible",
          "--out",
          out,
        ],
        {
          cwd: root,
          timeout: 240000,
          maxBuffer: 4 * 1024 * 1024,
          env: { PATH: process.env["PATH"], LANG: "C", TZ: "UTC" },
        },
      );
      const manifest = parseManifest(
        readFileSync(resolve(out, "overmind-engine.manifest.json"), "utf8"),
      );
      const binary = resolve(out, "overmind-engine-aarch64-apple-darwin");
      expect(hashFile(binary)).toBe(manifest.sha256);
      for (const injection of [
        "--inspect=127.0.0.1:0",
        "--require=/OVE017_ABSENT_INJECTION_PROBE",
      ]) {
        const result = spawnSync(binary, ["version", "--json"], {
          encoding: "utf8",
          timeout: 5000,
          env: { NODE_OPTIONS: injection },
        });
        expect(result.status).toBe(0);
        expect(result.stdout).toContain('"node":"22.23.3"');
        expect(result.stderr).not.toContain("Debugger listening");
      }
      for (const item of manifest.companions) {
        expect(
          hashFile(resolve(out, "overmind-engine.resources", item.path.slice("engine/".length))),
        ).toBe(item.sha256);
      }
    } finally {
      rmSync(out, { recursive: true, force: true });
    }
  },
  250000,
);

test.skipIf(process.platform !== "darwin" || process.arch !== "arm64")(
  "release rejects unsafe entitlements and quarantine is never stripped from an input",
  () => {
    const parent = safeDirectory(root, resolve(root, "build/engine-tmp"), true);
    const work = mkdtempSync(resolve(parent, "denied-"));
    const plist = resolve(work, "input.plist");
    const out = resolve(work, "out");
    const run = (args: string[]) =>
      spawnSync(
        process.execPath,
        [
          "--import",
          "tsx",
          "tools/package-engine/run.ts",
          ...args,
          "--entitlements",
          plist,
          "--out",
          out,
        ],
        { cwd: root, env: { PATH: process.env["PATH"] }, timeout: 15000, encoding: "utf8" },
      );
    try {
      writeFileSync(
        plist,
        '<plist version="1.0"><dict><key>com.apple.security.cs.allow-jit</key><true/><key>com.apple.security.cs.disable-library-validation</key><true/></dict></plist>',
      );
      const release = run(["--release", "--identity", "-"]);
      expect(release.status).toBe(1);
      expect(release.stderr).toContain("Engine entitlements must grant only allow-jit");
      expect(existsSync(resolve(out, "overmind-engine.manifest.json"))).toBe(false);
      writeFileSync(
        plist,
        '<plist version="1.0"><dict><key>com.apple.security.cs.allow-jit</key><true/></dict></plist>',
      );
      execFileSync("/usr/bin/xattr", [
        "-w",
        "com.apple.quarantine",
        "0083;00000000;OvermindTest;",
        plist,
      ]);
      const quarantined = run(["--identity", "-"]);
      expect(quarantined.status).toBe(1);
      expect(quarantined.stderr).toContain("Quarantined packaging input is refused");
      expect(
        execFileSync("/usr/bin/xattr", ["-p", "com.apple.quarantine", plist], { encoding: "utf8" }),
      ).toContain("OvermindTest");
    } finally {
      rmSync(work, { recursive: true, force: true });
    }
  },
  40000,
);
