import { expect, it } from "vitest";
import { updateGenerated } from "./generated.ts";

it("updates only explicit managed blocks and derives credits from inventory headings", () => {
  const source =
    "# Root\n\n<!-- docs-toc:start -->\nold\n<!-- docs-toc:end -->\n\n## Getting started\n\nKeep this exact text.\n\n<!-- docs-credits:start -->\nold\n<!-- docs-credits:end -->\n";
  const updated = updateGenerated(source, "# Dependencies\n\n### react\n\n### markdownlint\n");
  expect(updated).toContain("- [Getting started](#getting-started)");
  expect(updated).toContain("`react`, `markdownlint`");
  expect(updated).toContain("Keep this exact text.");
  expect(updateGenerated(updated, "### react\n### markdownlint\n")).toBe(updated);
  expect(() => updateGenerated("<!-- docs-toc:start -->", "")).toThrow();
});
