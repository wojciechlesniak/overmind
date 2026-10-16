import { existsSync, lstatSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { installSecurityTool } from "./install.ts";
import { createGitleaksConfig } from "./config.ts";
import { scanSecrets } from "./scan.ts";
const mode = process.argv[2] ?? "all";
if (mode !== "all" && mode !== "tree" && mode !== "range" && mode !== "staged") {
  throw new Error("Unsupported secret scan mode");
}
const directory = resolve(process.cwd(), "secret-results");
if (
  existsSync(directory) &&
  (lstatSync(directory).isSymbolicLink() || !lstatSync(directory).isDirectory())
) {
  throw new Error("Secret report output must use a real directory");
}
mkdirSync(directory, { recursive: true });
const config = await createGitleaksConfig();
if (!config) {
  throw new Error("Verified secret configuration unavailable");
}
try {
  const counts = scanSecrets({
    config: config.path,
    binary: await installSecurityTool("gitleaks"),
    cwd: process.cwd(),
    report: resolve(directory, `${mode}.sarif`),
    mode,
    base: process.argv[3] ?? "",
    head: process.argv[4] ?? "",
  });
  console.log(
    `Secret findings: ${String(counts.findings)}; Keychain warnings: ${String(counts.warnings)}`,
  );
  process.exitCode = counts.findings ? 1 : 0;
} finally {
  config.dispose();
}
