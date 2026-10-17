import { execFileSync } from "node:child_process";
import { realpath, rename, unlink, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { dirname, matchesGlob, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { checkDocuments, type Flags } from "./checker.ts";
import { diagnostic, type Diagnostic } from "./policy.ts";
import { checkExternalLinks, type ExternalPort } from "./external.ts";
import { canonicalFile, readRepositoryFile } from "./files.ts";
import {
  lintConfiguration,
  pendingLinks,
  rootScripts,
  workspacePatterns,
  workspaceManifest,
} from "./input.parse-boundary.ts";
import { runPlugins } from "./plugins.ts";
import { updateGenerated } from "./generated.ts";

export interface Result {
  diagnostics: Diagnostic[];
  output: string;
  exitCode: number;
}

const clean = (value: string) =>
  value
    .split("")
    .map((character) => {
      const code = character.charCodeAt(0);
      return code < 32 || (code >= 127 && code <= 159) || character === "|" ? " " : character;
    })
    .join("");
const annotation = (value: string) =>
  value
    .replace(/%/gu, "%25")
    .replace(/\r/gu, "%0D")
    .replace(/\n/gu, "%0A")
    .replace(/:/gu, "%3A")
    .replace(/,/gu, "%2C");

function result(diagnostics: Diagnostic[], github: boolean): Result {
  diagnostics.sort(
    (a, b) => a.file.localeCompare(b.file) || a.line - b.line || a.rule.localeCompare(b.rule),
  );
  const rows = [
    "File | Line | Level | Rule | Result",
    ...diagnostics.map(
      (d) =>
        `${clean(d.file)} | ${String(d.line)} | ${d.severity} | ${clean(d.rule)} | ${clean(d.message)}`,
    ),
  ];
  if (github) {
    rows.push(
      ...diagnostics.map(
        (d) =>
          `::${d.severity} file=${annotation(d.file)},line=${String(d.line)}::${annotation(`${d.rule}: ${d.message}`)}`,
      ),
    );
  }
  rows.push(
    `${String(diagnostics.filter((d) => d.severity === "error").length)} errors, ${String(diagnostics.filter((d) => d.severity === "warning").length)} warnings.`,
  );
  return {
    diagnostics,
    output: rows.join("\n"),
    exitCode: diagnostics.some((d) => d.severity === "error") ? 1 : 0,
  };
}

async function fixGenerated(root: string, files: Map<string, string>): Promise<void> {
  for (const [file, source] of files) {
    if (file.startsWith("tasks/") || file.startsWith("docs/pl/")) {
      continue;
    }
    const updated = updateGenerated(source, files.get("docs/dependencies.md") ?? "");
    if (updated === source) {
      continue;
    }
    const destination = await canonicalFile(root, file, true);
    const temporary = resolve(dirname(destination), `.docs-check-${randomUUID()}.tmp`);
    try {
      await writeFile(temporary, updated, { encoding: "utf8", flag: "wx", mode: 0o600 });
      if ((await readRepositoryFile(root, file, true)) !== source) {
        throw new Error("File changed during generation.");
      }
      await rename(temporary, destination);
      files.set(file, updated);
    } finally {
      await unlink(temporary).catch(() => undefined);
    }
  }
}

export async function run(root: string, args: string[], network?: ExternalPort): Promise<Result> {
  const allowed = new Set(["--publish", "--i18n", "--fix-toc", "--github", "--external"]);
  if (args.some((arg) => !allowed.has(arg))) {
    return result(
      [
        diagnostic(
          "tools/docs-check/run.ts",
          1,
          "arguments",
          "Unknown documentation checker option.",
        ),
      ],
      false,
    );
  }
  const flags: Flags = {
    publish: args.includes("--publish"),
    i18n: args.includes("--i18n"),
    fixToc: args.includes("--fix-toc"),
    github: args.includes("--github"),
    external: args.includes("--external"),
  };
  const errors: Diagnostic[] = [];
  try {
    const base = await realpath(root);
    const tracked = execFileSync("git", ["ls-files", "-z", "--cached"], {
      cwd: base,
      encoding: "utf8",
      maxBuffer: 8_388_608,
    })
      .split("\0")
      .filter(Boolean);
    const paths = new Set(tracked);
    const files = new Map<string, string>();
    for (const file of tracked.filter((path) => path.endsWith(".md"))) {
      try {
        files.set(file, await readRepositoryFile(base, file));
      } catch {
        errors.push(
          diagnostic(
            file,
            1,
            "unsafe-file",
            "Tracked document is unavailable, oversized or escapes the repository.",
          ),
        );
      }
    }
    const config = lintConfiguration(
      await readRepositoryFile(base, ".markdownlint-cli2.jsonc", true),
    );
    const scripts = rootScripts(await readRepositoryFile(base, "package.json", true));
    const workspaces = new Map<string, ReadonlySet<string>>();
    if (paths.has("pnpm-workspace.yaml")) {
      const patterns = workspacePatterns(
        await readRepositoryFile(base, "pnpm-workspace.yaml", true),
      );
      for (const file of tracked.filter(
        (path) =>
          path.endsWith("/package.json") &&
          patterns.some((pattern) => matchesGlob(dirname(path), pattern)),
      )) {
        const manifest = workspaceManifest(await readRepositoryFile(base, file, true));
        if (workspaces.has(manifest.name)) {
          throw new Error("Duplicate workspace name.");
        }
        workspaces.set(manifest.name, manifest.scripts);
        workspaces.set(`dir:${dirname(file)}`, manifest.scripts);
      }
    }
    const pending = pendingLinks(
      await readRepositoryFile(base, "tools/docs-check/pending-links.json", true),
    );
    for (const target of pending.values()) {
      if (!paths.has(`tasks/${target}/TASK.md`)) {
        errors.push(
          diagnostic(
            "tools/docs-check/pending-links.json",
            1,
            "pending-owner",
            "A pending target has no tracked owning task.",
          ),
        );
      }
    }
    if (flags.fixToc) {
      await fixGenerated(base, files);
    }
    errors.push(
      ...(await checkDocuments({ files, paths, scripts, config, pending, flags, workspaces })),
    );
    errors.push(...(await runPlugins({ root: base, files, paths, flags })));
    if (flags.external) {
      errors.push(
        ...(await checkExternalLinks(
          new Map(
            [...files].filter(
              ([file]) => !file.startsWith("tasks/") && !file.startsWith("docs/pl/"),
            ),
          ),
          network,
        )),
      );
    }
  } catch {
    errors.push(
      diagnostic(
        "tools/docs-check/run.ts",
        1,
        "configuration",
        "Documentation checks could not load trusted repository input.",
      ),
    );
  }
  return result(errors, flags.github);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const checked = await run(process.cwd(), process.argv.slice(2));
  console.log(checked.output);
  process.exitCode = checked.exitCode;
}
