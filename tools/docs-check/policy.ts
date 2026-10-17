import { posix } from "node:path";
import { extractLinks, headings, markdownLines } from "./markdown.ts";
import { translationStatus } from "./input.parse-boundary.ts";
export interface Diagnostic {
  file: string;
  line: number;
  rule: string;
  severity: "error" | "warning";
  message: string;
}
export const diagnostic = (
  file: string,
  line: number,
  rule: string,
  message: string,
  severity: Diagnostic["severity"] = "error",
): Diagnostic => ({ file, line, rule, severity, message });

export function checkLinks(
  files: ReadonlyMap<string, string>,
  paths: ReadonlySet<string> = new Set(files.keys()),
  pending: ReadonlyMap<string, string> = new Map(),
  targets: ReadonlyMap<string, string> = files,
): Diagnostic[] {
  const errors: Diagnostic[] = [];
  const anchors = new Map<string, Set<string>>();
  const hasAnchor = (file: string, fragment: string): boolean => {
    if (targets.has(file) && fragment === "top") {
      return true;
    }
    let found = anchors.get(file);
    if (!found) {
      found = new Set(headings(targets.get(file) ?? "").map((h) => h.anchor));
      anchors.set(file, found);
    }
    return found.has(fragment);
  };
  for (const [file, md] of files) {
    for (const { target, line } of extractLinks(md)) {
      const report = (rule: string, message: string, severity: Diagnostic["severity"] = "error") =>
        errors.push(diagnostic(file, line, rule, message, severity));
      if (/^https?:/iu.test(target)) {
        try {
          const url = new URL(target);
          if (!url.hostname || url.username || url.password) {
            throw new Error("Unsafe URL");
          }
        } catch {
          report("unsafe-link", "External URL is malformed or contains credentials.");
        }
        continue;
      }
      if (/^mailto:/iu.test(target)) {
        continue;
      }
      try {
        const hash = target.indexOf("#");
        const rawPath = decodeURIComponent(
          (hash < 0 ? target : target.slice(0, hash)).split("?")[0] ?? "",
        );
        const fragment = hash < 0 ? "" : decodeURIComponent(target.slice(hash + 1));
        if (/^(?:\/|[A-Za-z][A-Za-z0-9+.-]*:)/u.test(rawPath) || rawPath.includes("\\")) {
          throw new Error("Unsafe path");
        }
        const resolved = rawPath ? posix.normalize(posix.join(posix.dirname(file), rawPath)) : file;
        if (resolved === ".." || resolved.startsWith("../")) {
          throw new Error("Escaping path");
        }
        const document = targets.has(resolved)
          ? resolved
          : targets.has(`${resolved.replace(/\/$/u, "")}/README.md`)
            ? `${resolved.replace(/\/$/u, "")}/README.md`
            : resolved;
        const exists =
          paths.has(resolved) ||
          [...paths].some((path) => path.startsWith(`${resolved.replace(/\/$/u, "")}/`));
        if (!exists) {
          if (pending.has(resolved)) {
            report("pending-link", "Target is pending its documented owning task.", "warning");
          } else {
            report("broken-link", "Linked local target does not exist.");
          }
        } else if (fragment && !hasAnchor(document, fragment)) {
          report("broken-anchor", "Linked heading anchor does not exist.");
        }
      } catch {
        report("unsafe-link", "Local link is malformed or escapes the repository.");
      }
    }
  }
  return errors;
}

export function checkCommands(
  md: string,
  scripts: ReadonlySet<string>,
  file = "README.md",
  workspaces: ReadonlyMap<string, ReadonlySet<string>> = new Map(),
): Diagnostic[] {
  const builtins = new Set(["install", "exec", "audit", "why", "list", "licenses", "store"]);
  const errors: Diagnostic[] = [];
  for (const row of markdownLines(md)) {
    if (!["bash", "sh", "shell"].includes(row.code ?? "")) {
      continue;
    }
    const match = /^\s*pnpm\s+(.+)$/u.exec(row.text);
    if (!match) {
      continue;
    }
    const tokens = (match[1] ?? "").trim().split(/\s+/u);
    if (["--version", "-v", "--help", "-h"].includes(tokens[0] ?? "")) {
      continue;
    }
    let index = 0;
    let selected: ReadonlySet<string> | undefined = scripts;
    let selectors = 0;
    while (index < tokens.length) {
      const option = tokens[index] ?? "";
      if (["--filter", "-F", "--dir", "-C"].includes(option)) {
        const selector = tokens[index + 1] ?? "";
        selected = workspaces.get(
          option === "--dir" || option === "-C"
            ? `dir:${selector.replace(/^\.\//u, "")}`
            : selector,
        );
        selectors++;
        index += 2;
      } else if (/^--(?:filter|dir)=\S/u.test(option)) {
        const selector = option.slice(option.indexOf("=") + 1);
        selected = workspaces.get(
          option.startsWith("--dir=") ? `dir:${selector.replace(/^\.\//u, "")}` : selector,
        );
        selectors++;
        index++;
      } else {
        break;
      }
    }
    const explicitRun = tokens[index] === "run";
    const command = tokens[index + (explicitRun ? 1 : 0)] ?? "";
    if (
      !selected ||
      selectors > 1 ||
      (!selected.has(command) && (explicitRun || !builtins.has(command)))
    ) {
      errors.push(
        diagnostic(
          file,
          row.line,
          "unknown-command",
          "Command names an unavailable script or workspace.",
        ),
      );
    }
  }
  return errors;
}

export function checkReferences(
  files: ReadonlyMap<string, string>,
  paths: ReadonlySet<string>,
): Diagnostic[] {
  const adrs = new Set(
    [...paths].flatMap((path) => /^docs\/adr\/(\d{4})-[^/]+\.md$/u.exec(path)?.[1] ?? []),
  );
  const sections = new Set(
    headings(files.get("docs/SPECIFICATION.md") ?? "").flatMap(
      (h) => /^(\d+(?:\.\d+)*)(?:[.)]|\s)/u.exec(h.text)?.[1] ?? [],
    ),
  );
  const errors: Diagnostic[] = [];
  for (const [file, md] of files) {
    for (const row of markdownLines(md).filter((r) => r.code === undefined)) {
      for (const match of row.text.matchAll(/\bADR[ -](\d{4})\b/gu)) {
        if (!adrs.has(match[1] ?? "")) {
          errors.push(diagnostic(file, row.line, "missing-adr", "Referenced ADR does not exist."));
        }
      }
      for (const match of row.text.matchAll(
        /\b(?:SPEC(?:IFICATION)?\s+|spec section\s+)(\d+(?:\.\d+)*)\b/gu,
      )) {
        if (!sections.has(match[1] ?? "")) {
          errors.push(
            diagnostic(
              file,
              row.line,
              "missing-spec-section",
              "Referenced specification heading does not exist.",
            ),
          );
        }
      }
    }
  }
  return errors;
}
export function checkContent(file: string, md: string, publish = false): Diagnostic[] {
  const errors: Diagnostic[] = [];
  const report = (
    rule: string,
    message: string,
    line = 1,
    severity: Diagnostic["severity"] = "error",
  ) => errors.push(diagnostic(file, line, rule, message, severity));
  if (md.includes("\r")) {
    report("line-endings", "Documentation must use LF line endings.");
  }
  if (/\/Users\/|\/home\/|file:\/\/|\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/u.test(md)) {
    report(
      "private-content",
      "Remove local paths and personal contact details before publication.",
    );
  }
  if (/TODO\((?!OVE_[A-Z]{2,6}\d{3}\b)/u.test(md)) {
    report("unowned-todo", "Every TODO must reference its owning task ID.");
  }
  if (publish && md.includes("TODO-OWNER")) {
    report("owner-marker", "Resolve Owner placeholders before publication.");
  }
  if (publish) {
    try {
      if (translationStatus(md) === "draft") {
        report("draft-translation", "Draft translations cannot be published.");
      }
    } catch {
      report("front-matter", "Translation metadata is malformed.");
    }
  }
  const polish = markdownLines(md).find(
    (row) =>
      row.code === undefined &&
      /[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/u.test(row.text) &&
      !(file.endsWith("GLOSSARY.md") && /^\s*\|/u.test(row.text)),
  );
  if (polish) {
    report(
      "english",
      "Legacy Polish prose awaits its owning translation task.",
      polish.line,
      "warning",
    );
  }
  return errors;
}
