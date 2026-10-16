import { spawnSync } from "node:child_process";

if (process.env.CI !== "true") {
  const result = spawnSync("lefthook", ["install"], { stdio: "inherit", shell: false });
  if (result.error) {
    process.stderr.write(
      `Cannot install Git hooks: ${result.error.message}. Run pnpm exec lefthook install.\n`,
    );
  }
  process.exitCode = result.error ? 1 : (result.status ?? 1);
  if (!process.exitCode) {
    const scanner = spawnSync(
      process.execPath,
      ["--import", "tsx", "tools/secret-scan/install.ts", "all"],
      {
        stdio: "ignore",
        shell: false,
        timeout: 120000,
      },
    );
    if (scanner.error || scanner.status !== 0) {
      process.stderr.write(
        "Secret scanner download unavailable; local scan will warn until installed. CI remains mandatory.\n",
      );
    }
  }
}
