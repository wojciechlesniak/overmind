import { parse } from "yaml";
import { z } from "zod";
import type { Configuration } from "markdownlint";
import type { Diagnostic } from "./policy.ts";
import { markdownFrontMatter } from "./markdown.ts";

export function translationStatus(md: string): string | undefined {
  const lines = [...markdownFrontMatter(md)];
  if (!lines.length) {
    const first = md
      .replace(/^\uFEFF/u, "")
      .split(/\r\n?|\n/u, 1)[0]
      ?.trimEnd();
    if (first && ["---", "+++", "{"].includes(first)) {
      throw new Error("Unrecognized translation front matter.");
    }
    return undefined;
  }
  if (lines.shift()?.trimEnd() !== "---") {
    throw new Error("Translation front matter must use YAML.");
  }
  while (lines.at(-1)?.trim() === "") {
    lines.pop();
  }
  if (lines.pop()?.trimEnd() !== "---") {
    throw new Error("Unsupported translation front matter delimiter.");
  }
  const raw: unknown = parse(lines.join("\n"));
  return z.object({ status: z.string().optional() }).loose().parse(raw).status;
}

function jsonc(text: string): string {
  let quoted = false;
  let escaped = false;
  let output = "";
  for (let index = 0; index < text.length; index++) {
    const character = text[index] ?? "";
    if (quoted) {
      output += character;
      if (escaped) {
        escaped = false;
      } else if (character === "\\") {
        escaped = true;
      } else if (character === '"') {
        quoted = false;
      }
    } else if (character === '"') {
      quoted = true;
      output += character;
    } else if (character === "/" && text[index + 1] === "/") {
      while (index < text.length && text[index] !== "\n") {
        index++;
      }
      output += "\n";
    } else if (character === "/" && text[index + 1] === "*") {
      const end = text.indexOf("*/", index + 2);
      if (end < 0) {
        throw new Error("Unterminated JSONC comment.");
      }
      output += " ";
      index = end + 1;
    } else {
      output += character;
    }
  }
  let clean = "";
  quoted = false;
  escaped = false;
  for (let index = 0; index < output.length; index++) {
    const character = output[index] ?? "";
    if (!quoted && character === "," && /^\s*[}\]]/u.test(output.slice(index + 1))) {
      continue;
    }
    clean += character;
    if (escaped) {
      escaped = false;
    } else if (quoted && character === "\\") {
      escaped = true;
    } else if (character === '"') {
      quoted = !quoted;
    }
  }
  return clean;
}

export function lintConfiguration(text: string): Configuration {
  const raw: unknown = JSON.parse(jsonc(text));
  const schema = z
    .object({
      config: z.record(
        z.string(),
        z.union([
          z.boolean(),
          z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.array(z.string())])),
        ]),
      ),
      ignores: z.array(z.string()),
    })
    .strict();
  return schema.parse(raw).config;
}

export function rootScripts(text: string): ReadonlySet<string> {
  const raw: unknown = JSON.parse(text);
  return new Set(
    Object.keys(z.object({ scripts: z.record(z.string(), z.string()) }).parse(raw).scripts),
  );
}

export function workspacePatterns(text: string): string[] {
  const raw: unknown = parse(text);
  return z.object({ packages: z.array(z.string()) }).parse(raw).packages;
}

export function workspaceManifest(text: string): { name: string; scripts: ReadonlySet<string> } {
  const raw: unknown = JSON.parse(text);
  const manifest = z
    .object({
      name: z.string().min(1).max(214),
      scripts: z.record(z.string(), z.string()).optional(),
    })
    .parse(raw);
  return { name: manifest.name, scripts: new Set(Object.keys(manifest.scripts ?? {})) };
}

export function pendingLinks(text: string): ReadonlyMap<string, string> {
  const raw: unknown = JSON.parse(text);
  const parsed = z
    .record(
      z.string().regex(/^(?!\/|.*(?:^|\/)\.\.(?:\/|$))[A-Za-z0-9_./-]+$/u),
      z.string().regex(/^OVE_[A-Z]{2,6}\d{3}$/u),
    )
    .parse(raw);
  return new Map(Object.entries(parsed));
}

const diagnosticSchema = z
  .object({
    file: z.string().min(1),
    line: z.number().int().positive(),
    rule: z.string().min(1),
    severity: z.enum(["error", "warning"]),
    message: z.string().min(1),
  })
  .strict();
export function pluginDiagnostics(raw: unknown): Diagnostic[] {
  return z.array(diagnosticSchema).parse(raw);
}

export function pluginModule(raw: unknown): { name: string; run: (ctx: unknown) => unknown } {
  const namespace = z.object({ default: z.unknown() }).loose().parse(raw);
  return z
    .object({
      name: z.string().regex(/^[a-z][a-z0-9-]*$/u),
      run: z.custom<(ctx: unknown) => unknown>((value) => typeof value === "function"),
    })
    .strict()
    .parse(namespace.default);
}

export function documentationPluginPaths(raw: unknown): readonly string[] {
  try {
    const paths = z.array(z.string().min(1)).parse(raw);
    const candidate = /^tools\/docs-[a-z0-9-]+\/check\.ts$/u;
    if (
      new Set(paths).size !== paths.length ||
      paths.some(
        (path) =>
          path.startsWith("/") ||
          path.includes("\\") ||
          /\p{Cc}/u.test(path) ||
          path.split("/").some((part) => !part || part === "." || part === "..") ||
          (/^tools\/docs-/iu.test(path) && /\/check\.ts$/iu.test(path) && !candidate.test(path)),
      )
    ) {
      throw new Error("Invalid inventory path.");
    }
    return Object.freeze(paths.filter((path) => candidate.test(path)).sort());
  } catch {
    throw new Error("Invalid documentation plugin inventory.");
  }
}
