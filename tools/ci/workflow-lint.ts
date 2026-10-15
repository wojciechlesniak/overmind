import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { install } from "../pinned-bin/install.ts";
/** actionlint 1.7.12 predates GitHub's July 2026 self-repository syntax. */
export function actionlintCompatible(source: string): string {
  return source.replace(/^(\s*-?\s*uses:\s*)\$\/(\.github\/actions\/[a-z0-9/-]+)\s*$/gmu, "$1./$2");
}
async function lint() {
  const root = resolve(import.meta.dirname, "../..");
  const temporary = mkdtempSync(join(tmpdir(), "overmind-actionlint-"));
  try {
    const paths = readdirSync(resolve(root, ".github/workflows")).filter((file) =>
      /\.ya?ml$/u.test(file),
    );
    const files = paths.map((file) => {
      const path = resolve(temporary, file);
      writeFileSync(
        path,
        actionlintCompatible(readFileSync(resolve(root, ".github/workflows", file), "utf8")),
      );
      return path;
    });
    execFileSync(
      await install("actionlint"),
      ["-config-file", resolve(root, ".github/actionlint.yaml"), ...files],
      { cwd: root, stdio: "inherit", shell: false },
    );
    execFileSync(await install("zizmor"), ["--offline", "--no-progress", ".github"], {
      cwd: root,
      stdio: "inherit",
      shell: false,
    });
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await lint();
}
