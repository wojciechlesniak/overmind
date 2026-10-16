import { createHash } from "node:crypto";
import {
  closeSync,
  constants,
  fstatSync,
  lstatSync,
  openSync,
  readFileSync,
  readlinkSync,
  realpathSync,
  statSync,
} from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { readManifest } from "../test-support/json.parse-boundary.ts";

const headings = [
  "Read first",
  "Workflow",
  "Scope rules",
  "Architecture",
  "Security",
  "Dependencies",
  "Commits and PRs",
  "Testing",
  "Language",
  "Never",
  "Maintenance",
];
const injectionHash = "2ae5e49dee60379fdbc1233f97f10c33fe9ec218499773759df4701ac441cd3e";
const maintenance =
  "Rules live in CONVENTIONS; this file only summarises. When they diverge, CONVENTIONS wins and this file is fixed in the same PR.";
const sensitivePatterns = [
  /\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|AKIA[A-Z0-9]{16}|sk-[A-Za-z0-9_-]{20,})\b/u,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/u,
  /\b(?:token|password|api[_-]?key|secret)\s*[:=]\s*["']?[A-Za-z0-9/+_.=-]{16,}/iu,
  /https?:\/\/[^\s/]+@/iu,
  /https?:\/\/(?:localhost|127\.|10\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.|[^\s/]+\.(?:internal|local)\b)/iu,
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/u,
];

function inside(root: string, path: string): boolean {
  const difference = relative(root, path);
  return difference !== ".." && !difference.startsWith(`..${sep}`) && !isAbsolute(difference);
}

function paragraphsOf(text: string): string[] {
  return text.split(/\r?\n\s*\r?\n/u).map((part) => part.replace(/\r?\n/gu, " ").trim());
}

function readInstructions(root: string): string {
  const descriptor = openSync(
    resolve(root, "AGENTS.md"),
    constants.O_RDONLY | constants.O_NOFOLLOW,
  );
  try {
    const metadata = fstatSync(descriptor);
    if (!metadata.isFile() || metadata.size > 64 * 1024) {
      throw new Error("Invalid instruction file");
    }
    return readFileSync(descriptor, "utf8");
  } finally {
    closeSync(descriptor);
  }
}

function validLocalLink(root: string, target: string): boolean {
  if (/^https?:\/\//iu.test(target) || target.startsWith("#")) {
    return true;
  }
  try {
    const path = decodeURIComponent(target.split(/[?#]/u)[0] ?? "");
    if (!path || isAbsolute(path) || /^[A-Za-z][A-Za-z0-9+.-]*:/u.test(path)) {
      return false;
    }
    const canonical = realpathSync(resolve(root, path));
    return inside(root, canonical) && statSync(canonical).isFile();
  } catch {
    return false;
  }
}

export function checkAgentInstructions(directory: string): string[] {
  const errors: string[] = [];
  let root: string;
  let text: string;
  let scripts: Record<string, string>;
  try {
    root = realpathSync(directory);
    text = readInstructions(root);
    const manifest = resolve(root, "package.json");
    if (!lstatSync(manifest).isFile()) {
      throw new Error("Invalid manifest file");
    }
    scripts = readManifest(manifest).scripts ?? {};
  } catch {
    return ["AGENTS.md and package.json must be readable regular files with a valid manifest."];
  }

  try {
    const link = resolve(root, "CLAUDE.md");
    if (!lstatSync(link).isSymbolicLink() || readlinkSync(link) !== "AGENTS.md") {
      errors.push("CLAUDE.md must be the relative symlink AGENTS.md.");
    }
  } catch {
    errors.push("CLAUDE.md must be the relative symlink AGENTS.md.");
  }
  const lines = text.replace(/\r\n/gu, "\n").replace(/\n$/u, "").split("\n");
  if (lines.length > 200) {
    errors.push("AGENTS.md must contain at most 200 lines.");
  }
  const visible = text
    .replace(/<!--[^]*?(?:-->|$)/gu, "")
    .replace(/^```[^\n]*\n[^]*?^```[^\n]*$/gmu, "");
  const actual = [...visible.matchAll(/^## (.+)\r?$/gmu)].map((match) => match[1]);
  if (actual.join("\n") !== headings.join("\n")) {
    errors.push("Required sections must appear exactly once, in order, with Maintenance last.");
  }
  const paragraphs = paragraphsOf(visible);
  if (
    !paragraphs.some((part) => createHash("sha256").update(part).digest("hex") === injectionHash)
  ) {
    errors.push("The required prompt-injection paragraph must remain verbatim.");
  }
  if (!paragraphsOf(visible.slice(visible.lastIndexOf("## Maintenance"))).includes(maintenance)) {
    errors.push("The required maintenance rule must remain present.");
  }
  if (/^\s*\[[^\]\n]+\]:|\[[^\]\n]+\]\[[^\]\n]*\]/mu.test(visible)) {
    errors.push("Use inline Markdown links so every local reference can be checked.");
  }
  for (const match of visible.matchAll(/\[[^\]\n]+\]\(([^)\n]+)\)/gu)) {
    const raw = match[1] ?? "";
    const target = raw.startsWith("<") && raw.endsWith(">") ? raw.slice(1, -1) : raw;
    if (/\s/u.test(target) || !validLocalLink(root, target)) {
      errors.push("A linked local file is missing, unsafe or uses unsupported link syntax.");
    }
  }
  for (const match of visible.matchAll(/`([^`\n]+)`/gu)) {
    const command = /^pnpm\s+(?:run\s+)?([A-Za-z][A-Za-z0-9:-]*)(?:\s|$)/u.exec(match[1] ?? "");
    if (
      command &&
      (!Object.hasOwn(scripts, command[1] ?? "") || !scripts[command[1] ?? ""]?.trim())
    ) {
      errors.push("A pnpm command names an unknown root script.");
    }
  }
  if (sensitivePatterns.some((pattern) => pattern.test(text))) {
    errors.push("AGENTS.md contains credential-like or private-contact content; redact it.");
  }
  return [...new Set(errors)];
}
