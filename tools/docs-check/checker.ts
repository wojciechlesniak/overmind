import {
  checkCommands,
  checkContent,
  checkLinks,
  checkReferences,
  diagnostic,
  type Diagnostic,
} from "./policy.ts";
import type { Configuration } from "markdownlint";
import { lintMarkdown } from "./lint.ts";
import { updateGenerated } from "./generated.ts";
export interface Flags {
  publish: boolean;
  i18n: boolean;
  fixToc: boolean;
  github: boolean;
  external: boolean;
}
export interface CheckContext {
  files: ReadonlyMap<string, string>;
  paths: ReadonlySet<string>;
  scripts: ReadonlySet<string>;
  config: Configuration;
  pending: ReadonlyMap<string, string>;
  flags: Flags;
  workspaces?: ReadonlyMap<string, ReadonlySet<string>>;
}
export async function checkDocuments(ctx: CheckContext): Promise<Diagnostic[]> {
  const selected = new Map(
    [...ctx.files].filter(([file]) => !file.startsWith("tasks/") && !file.startsWith("docs/pl/")),
  );
  const linted = new Map(
    [...selected].filter(
      ([file]) => !["CODE_OF_CONDUCT.md", "THIRD_PARTY_NOTICES.md"].includes(file),
    ),
  );
  const errors = await lintMarkdown(linted, ctx.config);
  errors.push(
    ...checkLinks(selected, ctx.paths, ctx.pending, ctx.files),
    ...checkReferences(selected, ctx.paths),
  );
  for (const [file, md] of selected) {
    errors.push(
      ...checkContent(file, md, ctx.flags.publish),
      ...checkCommands(md, ctx.scripts, file, ctx.workspaces),
    );
  }
  for (const [file, md] of selected) {
    try {
      if (updateGenerated(md, ctx.files.get("docs/dependencies.md") ?? "") !== md) {
        errors.push(
          diagnostic(
            file,
            1,
            "generated-content",
            "Refresh managed documentation sections with --fix-toc.",
          ),
        );
      }
    } catch {
      errors.push(
        diagnostic(file, 1, "generated-content", "Managed documentation markers are malformed."),
      );
    }
  }
  for (const file of ctx.pending.keys()) {
    if (ctx.paths.has(file)) {
      errors.push(
        diagnostic(
          "tools/docs-check/pending-links.json",
          1,
          "stale-pending-link",
          "Remove the pending entry now that its target exists.",
        ),
      );
    }
  }
  if (ctx.flags.publish) {
    if (ctx.pending.size) {
      errors.push(
        diagnostic(
          "tools/docs-check/pending-links.json",
          1,
          "pending-publication",
          "Pending documents must be completed before publication.",
        ),
      );
    }
    if (!ctx.paths.has("LICENSE")) {
      errors.push(
        diagnostic(
          "README.md",
          1,
          "missing-license",
          "Publication requires the repository LICENSE file.",
        ),
      );
    }
    for (const [file, md] of ctx.files) {
      if (!selected.has(file)) {
        errors.push(
          ...checkContent(file, md, true).filter((d) =>
            ["owner-marker", "draft-translation", "front-matter"].includes(d.rule),
          ),
        );
      }
    }
  }
  return errors;
}
