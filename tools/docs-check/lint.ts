import { lint } from "markdownlint/promise";
import type { Configuration } from "markdownlint";
import { diagnostic, type Diagnostic } from "./policy.ts";

export async function lintMarkdown(
  files: ReadonlyMap<string, string>,
  config: Configuration,
): Promise<Diagnostic[]> {
  const results = await lint({ strings: Object.fromEntries(files), config, noInlineConfig: true });
  return Object.entries(results).flatMap(([file, errors]) =>
    errors.map((error) =>
      diagnostic(
        file,
        error.lineNumber,
        error.ruleNames[0] ?? "markdownlint",
        error.ruleDescription,
      ),
    ),
  );
}
