import { spawnSync } from "node:child_process";

if (process.env.CI !== "true") {
  const result = spawnSync("lefthook", ["install"], { stdio: "inherit", shell: false });
  if (result.error) {
    process.stderr.write(
      `Cannot install Git hooks: ${result.error.message}. Run pnpm exec lefthook install.\n`,
    );
  }
  process.exitCode = result.error ? 1 : (result.status ?? 1);
}
