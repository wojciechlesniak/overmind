import process from "node:process";
import { lstatSync, readFileSync, readdirSync, realpathSync } from "node:fs";
import { dirname, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const rules = [
  ["dynamic-eval", /\beval\s*\(/u],
  ["dynamic-function", /\bnew\s+Function\s*\(/u],
  ["remote-url", /https?:\/\/(?!www\.w3\.org\/)/u],
  ["remote-provider", /fonts\.googleapis\.com|\bcdn\.|\bunpkg\b|\bjsdelivr\b/iu],
  ["inline-style", /<style\b|\sstyle\s*=/iu],
];
function readAllowances(path) {
  const metadata = lstatSync(path);
  if (!metadata.isFile() || metadata.size > 65536) {
    throw new Error("Dist allow-list must be a bounded regular file");
  }
  const value = JSON.parse(readFileSync(path, "utf8"));
  if (
    !Array.isArray(value) ||
    value.length > 20 ||
    value.some(
      (entry) =>
        !entry ||
        typeof entry !== "object" ||
        Object.keys(entry).sort().join(",") !== "file,pattern,reason" ||
        typeof entry.file !== "string" ||
        entry.file.length > 200 ||
        (entry.file.match(/\*/gu)?.length ?? 0) > 1 ||
        !/^[a-zA-Z0-9_./*-]+$/u.test(entry.file) ||
        entry.file.includes("..") ||
        entry.file.startsWith("/") ||
        typeof entry.pattern !== "string" ||
        entry.pattern.length < 10 ||
        entry.pattern.length > 200 ||
        typeof entry.reason !== "string" ||
        entry.reason.trim().length < 30,
    )
  ) {
    throw new Error("Invalid reviewed dist allow-list");
  }
  return value;
}
function matchesFile(pattern, file) {
  const expression = pattern
    .split("*")
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"))
    .join("[^/]*");
  return new RegExp(`^${expression}$`, "u").test(file);
}
function unsafeScript(content) {
  for (const tag of content.matchAll(/<script\b([^>]*)>/giu)) {
    const attributes = tag[1];
    const lexer = /\s+([a-zA-Z][a-zA-Z0-9-]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s<>`"'=]+)))?/gy;
    const values = new Map();
    let offset = 0;
    while (offset < attributes.length && attributes.slice(offset).trim()) {
      lexer.lastIndex = offset;
      const match = lexer.exec(attributes);
      if (!match) {
        return true;
      }
      const name = match[1].toLowerCase();
      if (!["src", "type", "crossorigin"].includes(name) || values.has(name)) {
        return true;
      }
      values.set(name, match[2] ?? match[3] ?? match[4] ?? "");
      offset = lexer.lastIndex;
    }
    const src = values.get("src");
    if (!src || !/^(?:\/(?!\/)|\.\/)[a-zA-Z0-9_./-]+$/u.test(src)) {
      return true;
    }
    if (values.has("type") && values.get("type") !== "module") {
      return true;
    }
    if (values.has("crossorigin") && !["", "anonymous"].includes(values.get("crossorigin"))) {
      return true;
    }
  }
  return false;
}
export function checkDist(
  directory,
  allowancePath = resolve(scriptDirectory, "check-dist.allow.json"),
) {
  if (lstatSync(directory).isSymbolicLink()) {
    throw new Error("Bundle directory cannot be a symlink");
  }
  const root = realpathSync(directory);
  const allowances = readAllowances(allowancePath);
  const files = [];
  const failures = [];
  function visit(path) {
    for (const name of readdirSync(path).sort()) {
      const item = resolve(path, name);
      const metadata = lstatSync(item);
      if (metadata.isSymbolicLink()) {
        throw new Error("Bundle entries cannot be symlinks");
      }
      if (metadata.isDirectory()) {
        visit(item);
        continue;
      }
      if (!metadata.isFile() || metadata.size > 32 * 1024 * 1024) {
        throw new Error("Bundle entries must be bounded regular files");
      }
      const file = relative(root, item).split(sep).join("/");
      files.push({ file, bytes: metadata.size });
      let content = readFileSync(item, "utf8");
      for (const allowance of allowances) {
        if (matchesFile(allowance.file, file)) {
          content = content.replaceAll(allowance.pattern, "");
        }
      }
      if (unsafeScript(content)) {
        failures.push({ file, rule: "inline-or-unsafe-script" });
      }
      for (const [rule, pattern] of rules) {
        if (pattern.test(content)) {
          failures.push({ file, rule });
        }
      }
      if (file.endsWith(".map") || /sourceMappingURL\s*=/u.test(content)) {
        failures.push({ file, rule: "source-map" });
      }
    }
  }
  visit(root);
  if (!files.some((item) => item.file === "index.html")) {
    throw new Error("Bundle index.html is missing");
  }
  return { failures, largest: files.sort((a, b) => b.bytes - a.bytes).slice(0, 10) };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { failures, largest } = checkDist(
    resolve(process.argv[2] ?? resolve(scriptDirectory, "../dist")),
  );
  process.stdout.write(
    "File\tBytes\n" + largest.map((item) => `${item.file}\t${item.bytes}`).join("\n") + "\n",
  );
  for (const failure of failures) {
    process.stderr.write(`Bundle policy violation: ${failure.rule} (${failure.file})\n`);
  }
  process.exitCode = failures.length ? 1 : 0;
}
