import { spawnSync } from "node:child_process";
import { copyFileSync, mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { randomBytes } from "node:crypto";
import { expect, it } from "vitest";
import { readBinaryLock } from "../pinned-bin/lock.parse-boundary.ts";
import { isolatedGitEnvironment } from "../hooks/git-test-environment.ts";

it("the actual installer CLI rejects a changed checksum before installing the publisher binary", () => {
  const root = resolve(import.meta.dirname, "../..");
  const entry = readBinaryLock(resolve(import.meta.dirname, "gitleaks.lock.json"), "gitleaks")[0];
  const platform = `${process.platform}-${process.arch}`;
  const asset = entry?.assets[platform];
  if (!entry || !asset) {
    throw new Error("Missing test platform pin");
  }
  const checksum = randomBytes(32).toString("hex");
  const fixture = mkdtempSync(resolve(tmpdir(), "overmind-pin-tamper-"));
  const cache = resolve(root, ".cache/tools", `gitleaks-${entry.version}-${checksum}`);
  try {
    mkdirSync(resolve(fixture, "tools/secret-scan"), { recursive: true });
    writeFileSync(resolve(fixture, "package.json"), '{"type":"module"}\n');
    symlinkSync(resolve(root, "node_modules"), resolve(fixture, "node_modules"));
    symlinkSync(resolve(root, "tools/pinned-bin"), resolve(fixture, "tools/pinned-bin"));
    copyFileSync(
      resolve(root, "tools/secret-scan/install.ts"),
      resolve(fixture, "tools/secret-scan/install.ts"),
    );
    writeFileSync(
      resolve(fixture, "tools/secret-scan/gitleaks.lock.json"),
      JSON.stringify({
        ...entry,
        assets: { ...entry.assets, [platform]: { ...asset, sha256: checksum } },
      }),
    );
    const result = spawnSync(
      resolve(root, "node_modules/.bin/tsx"),
      [resolve(fixture, "tools/secret-scan/install.ts")],
      {
        cwd: fixture,
        env: isolatedGitEnvironment(),
        encoding: "utf8",
        timeout: 30000,
      },
    );
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Binary checksum mismatch");
  } finally {
    rmSync(fixture, { recursive: true, force: true });
    rmSync(cache, { recursive: true, force: true });
  }
}, 60000);
