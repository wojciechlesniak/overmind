import { expect, it } from "vitest";
import { lintMarkdown } from "./lint.ts";

it("runs the actual Markdown engine and refuses inline disable instructions", async () => {
  const errors = await lintMarkdown(
    new Map([["guide.md", "# Guide\n\n<!-- markdownlint-disable -->\n\n```\nexample\n```\n"]]),
    { MD013: false },
  );
  expect(errors.map((error) => error.rule)).toContain("MD040");
  expect(await lintMarkdown(new Map([["good.md", "# Good\n\nText.\n"]]), {})).toEqual([]);
});

it("treats front-matter title as metadata while still rejecting two actual H1 headings", async () => {
  const config = { MD025: { front_matter_title: "" } };
  const source = "---\ntitle: Metadata\n---\n# One\n\nText.\n";
  expect(await lintMarkdown(new Map([["one.md", source]]), config)).toEqual([]);
  expect(
    (await lintMarkdown(new Map([["two.md", source + "\n# Two\n"]]), config)).map((d) => d.rule),
  ).toContain("MD025");
});
