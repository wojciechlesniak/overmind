import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, expect, it } from "vitest";
import { installSecurityTool } from "./install.ts";
import { createGitleaksConfig } from "./config.ts";
import { scanSecrets } from "./scan.ts";
import { isolatedGitEnvironment } from "../hooks/git-test-environment.ts";

let config: string;
let dispose: (() => void) | undefined;
beforeAll(async () => {
  const compiled = await createGitleaksConfig(true);
  if (!compiled) {
    throw new Error("Prewarm verified default configuration before integration tests");
  }
  config = compiled.path;
  dispose = compiled.dispose;
});
afterAll(() => dispose?.());

it("real scanner denies generated credentials, requires both fixture conditions and redacts every report", async () => {
  const binary = await installSecurityTool("gitleaks");
  const token = `123456789:${randomBytes(30).toString("hex").slice(0, 35)}`;
  const fixture = mkdtempSync(resolve(tmpdir(), "overmind-secret-int-"));
  const env = isolatedGitEnvironment();
  const git = (args: string[]) =>
    execFileSync("git", args, { cwd: fixture, env, encoding: "utf8" });
  try {
    git(["init", "--quiet"]);
    git(["config", "user.name", "Fixture"]);
    git(["config", "user.email", "fixture@example.invalid"]);
    git(["config", "core.hooksPath", "/dev/null"]);
    let counter = 0;
    for (const [path, line, allowed] of [
      ["plain.txt", token, false],
      ["hyphen.txt", token.slice(0, -1) + "-", false],
      ["underscore.txt", token.slice(0, -1) + "_", false],
      ["pnpm-lock.yaml", token, false],
      ["tasks/synthetic.png", token, false],
      ["fixtures/secrets/path-only.txt", token, false],
      ["marker-only.txt", `${token} OVERMIND_FAKE_SECRET`, false],
      ["fixtures/secrets/fake.txt", `${token} OVERMIND_FAKE_SECRET`, true],
      ["comment.txt", `${token} // gitleaks:allow`, false],
      ["slug.txt", "board/task-working-progress-assignee", true],
      [
        "headers.md",
        ["-----BEGIN", "PRIVATE KEY-----"].join(" ") +
          "\n" +
          "documentation text ".repeat(12) +
          ["-----BEGIN", "PRIVATE KEY-----"].join(" "),
        true,
      ],
      [
        "complete.pem",
        ["-----BEGIN", "PRIVATE KEY-----"].join(" ") +
          "\n" +
          randomBytes(96).toString("base64") +
          "\n" +
          ["-----END", "PRIVATE KEY-----"].join(" "),
        false,
      ],
    ] as const) {
      const file = resolve(fixture, path);
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, line + "\n");
      git(["add", path]);
      const report = resolve(fixture, `report-${String(counter++)}.sarif`);
      const counts = scanSecrets({ config, binary, cwd: fixture, report, mode: "staged", env });
      expect(counts.findings === 0, path).toBe(allowed);
      expect(readFileSync(report, "utf8").includes(token)).toBe(false);
      git(["commit", "--quiet", "-m", "chore: generated fixture"]);
    }
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
}, 60000);

it("the actual staged hook blocks a generated Apple key header without logging it", async () => {
  await installSecurityTool("gitleaks");
  const root = resolve(import.meta.dirname, "../..");
  const fixture = mkdtempSync(resolve(tmpdir(), "overmind-staged-key-"));
  const env = isolatedGitEnvironment();
  const git = (args: string[]) => execFileSync("git", args, { cwd: fixture, env });
  try {
    git(["init", "--quiet"]);
    const header = ["-----BEGIN", "PRIVATE KEY-----"].join(" ");
    writeFileSync(resolve(fixture, "AuthKey_fixture.p8"), header + "\n");
    git(["add", "AuthKey_fixture.p8"]);
    const result = spawnSync(
      resolve(root, "node_modules/.bin/tsx"),
      [resolve(root, "tools/secret-scan/staged.ts")],
      {
        cwd: fixture,
        encoding: "utf8",
        env,
        timeout: 15000,
      },
    );
    expect(result.status).toBe(1);
    expect((result.stdout + result.stderr).includes(header)).toBe(false);
    expect(result.stdout).toContain("Secret findings:");
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
}, 30000);

it("custom provider/certificate rules detect real-format synthetic values and the Keychain guard is warning-only", async () => {
  const fixture = mkdtempSync(resolve(tmpdir(), "overmind-custom-rules-"));
  try {
    const source = resolve(fixture, "source");
    mkdirSync(source);
    execFileSync("git", ["init", "--quiet"], { cwd: source, env: isolatedGitEnvironment() });
    const binary = await installSecurityTool("gitleaks");
    for (const [path, value, rule] of [
      ["anthropic.txt", `sk-ant-${randomBytes(24).toString("hex")}`, "overmind-anthropic-api-key"],
      ["openai.txt", `sk-proj-${randomBytes(24).toString("hex")}`, "overmind-openai-api-key"],
      ["certificate.json", `MIIK${randomBytes(96).toString("base64")}`, "overmind-p12-base64"],
    ] as const) {
      const file = resolve(source, path);
      writeFileSync(file, JSON.stringify({ value }) + "\n");
      const report = resolve(fixture, "report.sarif");
      expect(
        scanSecrets({
          config,
          binary,
          cwd: source,
          report,
          mode: "tree",
          env: isolatedGitEnvironment(),
        }).findings,
      ).toBeGreaterThan(0);
      const text = readFileSync(report, "utf8");
      expect(text).toContain(rule);
      expect(text.includes(value)).toBe(false);
      rmSync(file);
    }
    writeFileSync(
      resolve(source, "command.txt"),
      ["security", "add-generic-password", "-w", "<value>"].join(" "),
    );
    expect(
      scanSecrets({
        config,
        binary,
        cwd: source,
        report: resolve(fixture, "report.sarif"),
        mode: "tree",
        env: isolatedGitEnvironment(),
      }),
    ).toEqual({ findings: 0, warnings: 1 });
    expect(readFileSync(resolve(fixture, "report.sarif"), "utf8")).toContain('"level":"warning"');
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
}, 30000);

it("tree scans do not follow repository symlinks outside their source; a real in-tree credential is detected", async () => {
  const fixture = mkdtempSync(resolve(tmpdir(), "overmind-scan-symlink-"));
  try {
    const source = resolve(fixture, "source");
    mkdirSync(source);
    execFileSync("git", ["init", "--quiet"], { cwd: source, env: isolatedGitEnvironment() });
    const secret = `sk-proj-${randomBytes(32).toString("hex")}`;
    const outside = resolve(fixture, "outside.txt");
    writeFileSync(outside, secret);
    symlinkSync(outside, resolve(source, "link.txt"));
    const binary = await installSecurityTool("gitleaks");
    const options = {
      config,
      env: isolatedGitEnvironment(),
      binary,
      cwd: source,
      report: resolve(fixture, "report.sarif"),
      mode: "tree" as const,
    };
    expect(scanSecrets(options).findings).toBe(0);
    writeFileSync(resolve(source, "real.txt"), secret);
    expect(scanSecrets(options).findings).toBeGreaterThan(0);
    expect(readFileSync(options.report, "utf8").includes(secret)).toBe(false);
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
}, 30000);

it("commit-range reports do not retain a synthetic credential from commit metadata", async () => {
  const fixture = mkdtempSync(resolve(tmpdir(), "overmind-secret-range-"));
  const env = isolatedGitEnvironment();
  const git = (args: string[]) =>
    execFileSync("git", args, { cwd: fixture, env, encoding: "utf8" });
  try {
    git(["init", "--quiet"]);
    git(["config", "user.name", "Fixture"]);
    git(["config", "user.email", "fixture@example.invalid"]);
    git(["config", "core.hooksPath", "/dev/null"]);
    git(["commit", "--allow-empty", "--quiet", "-m", "chore: baseline"]);
    const base = git(["rev-parse", "HEAD"]).trim();
    const value = `123456789:${randomBytes(30).toString("hex").slice(0, 35)}`;
    writeFileSync(resolve(fixture, `${value}.txt`), value);
    git(["add", `${value}.txt`]);
    git(["commit", "--quiet", "-m", `chore: synthetic fixture ${value}`]);
    const head = git(["rev-parse", "HEAD"]).trim();
    const report = resolve(fixture, "report.sarif");
    const counts = scanSecrets({
      config,
      binary: await installSecurityTool("gitleaks"),
      cwd: fixture,
      report,
      mode: "range",
      base,
      head,
      env,
    });
    expect(counts.findings).toBeGreaterThan(0);
    expect(readFileSync(report, "utf8").includes(value)).toBe(false);
    const summary = resolve(fixture, "summary.txt");
    const classified = spawnSync(
      "/bin/bash",
      [resolve(import.meta.dirname, "classify.sh"), report, "1"],
      {
        env: {
          ...env,
          GITHUB_STEP_SUMMARY: summary,
          GITHUB_OUTPUT: resolve(fixture, "output.txt"),
        },
        encoding: "utf8",
        timeout: 10000,
      },
    );
    expect(classified.status).toBe(1);
    expect(
      (classified.stdout + classified.stderr + readFileSync(summary, "utf8")).includes(value),
    ).toBe(false);
    expect(readFileSync(summary, "utf8")).toContain("redacted-path/");
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
}, 30000);
