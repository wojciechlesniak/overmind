import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { readBinaryLock } from "../pinned-bin/lock.parse-boundary.ts";
import { installSecurityTool } from "./install.ts";
import { createGitleaksConfig } from "./config.ts";
import { scanSecrets } from "./scan.ts";

const root = resolve(import.meta.dirname, "../..");
const entry = readBinaryLock(resolve(import.meta.dirname, "gitleaks.lock.json"), "gitleaks")[0];
const asset = entry?.assets[`${process.platform}-${process.arch}`];
if (!entry || !asset) {
  throw new Error("Unsupported secret-scanner platform");
}
const archive = resolve(
  root,
  ".cache/tools",
  `gitleaks-${entry.version}-${asset.sha256}`,
  "archive.tar.gz",
);
const config = await createGitleaksConfig(true);
if (!existsSync(archive) || !config) {
  config?.dispose();
  console.warn(
    "Secret scan unavailable locally: run pnpm exec tsx tools/secret-scan/install.ts all. CI remains mandatory.",
  );
} else {
  const fixture = mkdtempSync(resolve(tmpdir(), "overmind-staged-secrets-"));
  try {
    const counts = scanSecrets({
      config: config.path,
      binary: await installSecurityTool("gitleaks"),
      cwd: process.cwd(),
      report: resolve(fixture, "report.sarif"),
      mode: "staged",
    });
    console.log(
      `Secret findings: ${String(counts.findings)}; Keychain warnings: ${String(counts.warnings)}`,
    );
    process.exitCode = counts.findings ? 1 : 0;
  } finally {
    config.dispose();
    rmSync(fixture, { recursive: true, force: true });
  }
}
