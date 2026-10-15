import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

export function findMissingDisableReasons(source, fileName = "source.ts") {
  const scanner = ts.createScanner(
    ts.ScriptTarget.Latest,
    false,
    fileName.endsWith(".tsx") ? ts.LanguageVariant.JSX : ts.LanguageVariant.Standard,
    source,
  );
  const failures = [];
  for (let token = scanner.scan(); token !== ts.SyntaxKind.EndOfFileToken; token = scanner.scan()) {
    if (
      token !== ts.SyntaxKind.SingleLineCommentTrivia &&
      token !== ts.SyntaxKind.MultiLineCommentTrivia
    ) {
      continue;
    }
    const comment = scanner.getTokenText();
    if (
      /^\/(?:\/|\*)\s*eslint-disable(?:-next-line|-line)?\b/.test(comment) &&
      !/--\s*\S/.test(comment)
    ) {
      const line = source.slice(0, scanner.getTokenPos()).split("\n").length;
      failures.push(`${fileName}:${line}: eslint-disable requires -- reason`);
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
