// @vitest-environment node
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { randomBytes } from "node:crypto";
import { expect, it } from "vitest";
import { isolatedGitEnvironment } from "../../../tools/hooks/git-test-environment.ts";
import { installSecurityTool } from "../../../tools/secret-scan/install.ts";
import { createGitleaksConfig } from "../../../tools/secret-scan/config.ts";
import { scanSecrets } from "../../../tools/secret-scan/scan.ts";

const root = resolve(import.meta.dirname, "../../..");
const desktop = resolve(root, "apps/desktop");
it("real production bundle passes CSP checks, excludes private env and passes the actual secret scanner", async () => {
  const directory = mkdtempSync(resolve(tmpdir(), "overmind-desktop-build-"));
  const output = resolve(directory, "bundle");
  const marker = randomBytes(32).toString("hex");
  const env = {
    ...isolatedGitEnvironment(),
    NODE_ENV: "production",
    PRIVATE_BUILD_MARKER: marker,
    VITE_UNRELATED_PRIVATE_MARKER: marker,
    OVERMIND_DEV_PROXY: "https://must-not-be-consumed.invalid",
  };
  const config = await createGitleaksConfig(true);
  if (!config) {
    throw new Error("Prewarm verified security configuration before integration tests");
  }
  try {
    const build = spawnSync(
      process.execPath,
      [
        resolve(root, "node_modules/vite/bin/vite.js"),
        "build",
        "--config",
        resolve(root, "tools/vite/desktop.config.ts"),
        "--outDir",
        output,
      ],
      {
        cwd: desktop,
        env,
        encoding: "utf8",
        timeout: 30000,
      },
    );
    expect(build.status).toBe(0);
    const guard = spawnSync(
      process.execPath,
      [resolve(root, "tools/build/desktop/check-dist.mjs"), output],
      { encoding: "utf8", timeout: 10000 },
    );
    expect(guard.status).toBe(0);
    expect(readFileSync(resolve(output, "index.html"), "utf8")).not.toMatch(
      /https?:\/\/|<script(?![^>]*\bsrc=)/iu,
    );
    for (const name of readdirSync(resolve(output, "assets"))) {
      const text = readFileSync(resolve(output, "assets", name), "utf8");
      expect(text.includes(marker)).toBe(false);
      expect(text).not.toContain("must-not-be-consumed.invalid");
      expect(name).not.toMatch(/\.map$/u);
    }
    execFileSync("git", ["init", "--quiet", output], { env });
    const binary = await installSecurityTool("gitleaks");
    const scan = () =>
      scanSecrets({
        binary,
        config: config.path,
        cwd: output,
        report: resolve(directory, "build.sarif"),
        mode: "tree",
        env,
      });
    expect(scan().findings).toBe(0);
    const credential = `123456789:${randomBytes(30).toString("hex").slice(0, 35)}`;
    writeFileSync(resolve(output, "leak.txt"), `telegram_bot_token=${credential}\n`);
    expect(scan().findings).toBeGreaterThan(0);
    expect(readFileSync(resolve(directory, "build.sarif"), "utf8").includes(credential)).toBe(
      false,
    );
  } finally {
    config.dispose();
    rmSync(directory, { recursive: true, force: true });
  }
}, 60000);
