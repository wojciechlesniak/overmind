import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import tseslint from "typescript-eslint";

export function findMissingDisableReasons(source, fileName = "source.ts") {
  const { ast } = tseslint.parser.parseForESLint(source, {
    filePath: fileName,
    loc: true,
    range: true,
    comment: true,
    jsx: true,
  });
  const failures = [];
  for (const comment of ast.comments ?? []) {
    const content = comment.value.trim();
    const directive = /^(eslint|oxlint)-disable(?:-next-line|-line)?\b/.exec(content);
    if (directive && !/\s--\s+\S/.test(content)) {
      failures.push(
        `${fileName}:${comment.loc.start.line}: ${directive[1]}-disable requires -- reason`,
      );
    }
  }
  return failures;
}
function sourceFiles(directory) {
  const ignored = new Set([
    ".git",
    "node_modules",
    ".tsbuild",
    "dist",
    "coverage",
    "storybook-static",
    "tasks",
    "docs",
    "target",
    "binaries",
  ]);
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (ignored.has(entry.name) || entry.isSymbolicLink()) {
      return [];
    }
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      return sourceFiles(path);
    }
    return /\.[cm]?[jt]sx?$/.test(entry.name) && !entry.name.endsWith(".generated.ts")
      ? [path]
      : [];
  });
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const failures = sourceFiles(process.cwd()).flatMap((file) =>
    findMissingDisableReasons(readFileSync(file, "utf8"), file),
  );
  for (const failure of failures) {
    console.error(failure);
  }
  if (failures.length > 0) {
    process.exitCode = 1;
  }
}
