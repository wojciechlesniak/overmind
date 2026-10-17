import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { checkDocuments, type Flags } from "./checker.ts";
import { checkCommands, checkContent } from "./policy.ts";
import { lintConfiguration, rootScripts } from "./input.parse-boundary.ts";
import { lintMarkdown } from "./lint.ts";
import { headings } from "./markdown.ts";

const flags: Flags = { publish: false, i18n: false, fixToc: false, github: false, external: false };

it("checks 150 linked Markdown documents in under ten seconds", async () => {
  const files = new Map<string, string>([["README.md", "# Root\n\n## Start\n\nText.\n"]]);
  for (let index = 1; index < 150; index++) {
    files.set(`docs/guide-${String(index)}.md`, "# Guide\n\n[Start](../README.md#start).\n");
  }
  const start = performance.now();
  expect(
    await checkDocuments({
      files,
      paths: new Set([...files.keys(), "LICENSE"]),
      pending: new Map(),
      scripts: new Set(),
      config: {},
      flags,
    }),
  ).toEqual([]);
  expect(performance.now() - start).toBeLessThan(10_000);
});

it("checks the real README's required sections, honest status, commands and Markdown without snapshots", async () => {
  const root = new URL("../../", import.meta.url);
  const source = readFileSync(new URL("README.md", root), "utf8");
  const config = lintConfiguration(readFileSync(new URL(".markdownlint-cli2.jsonc", root), "utf8"));
  expect(source.split("\n").length).toBeLessThan(250);
  expect(headings(source).filter((heading) => heading.level < 3)).toHaveLength(14);
  for (const phrase of [
    "Pre-alpha; not usable yet",
    "macOS 26",
    "Apple silicon",
    "logs into official CLIs themselves",
    "not affiliated",
  ]) {
    expect(source).toContain(phrase);
  }
  expect(await lintMarkdown(new Map([["README.md", source]]), config)).toEqual([]);
  expect(checkContent("README.md", source)).toEqual([]);
  expect(
    checkCommands(source, rootScripts(readFileSync(new URL("package.json", root), "utf8"))),
  ).toEqual([]);
});
