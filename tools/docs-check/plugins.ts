import type { Flags } from "./checker.ts";
import { diagnostic, type Diagnostic } from "./policy.ts";
import { pathToFileURL } from "node:url";
import { canonicalFile } from "./files.ts";
import { pluginDiagnostics, pluginModule } from "./input.parse-boundary.ts";
export interface PluginContext {
  root: string;
  files: ReadonlyMap<string, string>;
  paths: ReadonlySet<string>;
  flags: Flags;
}
export async function runPlugins(ctx: PluginContext): Promise<Diagnostic[]> {
  const errors: Diagnostic[] = [];
  let i18n = false;
  for (const file of [...ctx.paths]
    .filter((path) => /^tools\/docs-[a-z0-9-]+\/check\.ts$/u.test(path))
    .sort()) {
    try {
      const source = await canonicalFile(ctx.root, file, true);
      const imported: unknown = await import(pathToFileURL(source).href);
      const plugin = pluginModule(imported);
      const results = pluginDiagnostics(
        await plugin.run(Object.freeze({ ...ctx, flags: Object.freeze({ ...ctx.flags }) })),
      );
      if (results.some((result) => !ctx.paths.has(result.file))) {
        throw new Error("Plugin reported an untracked path.");
      }
      errors.push(...results);
      if (plugin.name === "i18n") {
        i18n = true;
      }
    } catch {
      errors.push(
        diagnostic(
          file,
          1,
          "plugin-failure",
          "Documentation plugin is unavailable or returned invalid diagnostics.",
        ),
      );
    }
  }
  if (!i18n) {
    errors.push(
      diagnostic(
        "docs/README.md",
        1,
        "i18n-unavailable",
        "Translation checks await OVE_OSS005.",
        ctx.flags.i18n ? "error" : "warning",
      ),
    );
  }
  return errors;
}
