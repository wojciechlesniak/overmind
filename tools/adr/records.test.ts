import { expect, test } from "vitest";
import { parseAdr, parseSlugMap, renderAdr, metadataSchema } from "./input.parse-boundary.ts";
import { checkRecords, renderIndex } from "./model.ts";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const record = `---
adr: 1
title: Choose one boundary
status: accepted
date: 2026-10-13
deciders: [Owner]
supersedes: []
superseded_by: []
tags: [architecture]
---
# Choose one boundary

We choose this boundary because the alternative weakens isolation.

## Consequences

- Keep callers behind the port.
`;

test("strict ADR parsing rejects malformed metadata and misleading Markdown structure", () => {
  expect(parseAdr("0001-choose-one-boundary.md", record).meta.adr).toBe(1);
  for (const source of [
    record.replace("adr: 1", "adr: 2"),
    record.replace("accepted", "unknown"),
    record.replace("2026-10-13", "2026-02-30"),
    record.replace("tags: [architecture]", "tags: [unsafe]"),
    record.replace("## Consequences", "## Costs"),
    record + "\n# A second decision\n",
    record.replace("title: Choose one boundary", "title: Choose something else"),
    record.replace("adr: 1", "adr: 1\nadr: 1"),
    record.replace("tags: [architecture]", "tags: &tags [architecture]\nunknown: *tags"),
  ]) {
    expect(() => parseAdr("0001-choose-one-boundary.md", source)).toThrow();
  }
  expect(() => parseAdr("0001-Upper_Case.md", record)).toThrow();
});

test.each([
  ["indented second H1", record + "\n  # An indented second decision\n"],
  [
    "Consequences only in an HTML comment",
    record.replace("## Consequences", "<!--\n## Consequences\n-->"),
  ],
  [
    "Consequences only in an indented fence",
    record.replace("## Consequences", "  ```markdown\n## Consequences\n  ```"),
  ],
] as const)("Markdown parser rejects %s", (_description, source) => {
  expect(() => parseAdr("0001-choose-one-boundary.md", source)).toThrow("Consequences");
});

test("real headings ignore H1 examples in indented fenced code and HTML comments", () => {
  expect(() =>
    parseAdr(
      "0001-choose-one-boundary.md",
      record +
        "\nExamples:\n\n  ```markdown\n# A fenced example\n  ```\n\n<!--\n# A commented example\n-->\n",
    ),
  ).not.toThrow();
});

test("the normative original map contains exactly the 28 prescribed English names", () => {
  const map = parseSlugMap(
    readFileSync(resolve(import.meta.dirname, "../../docs/adr/slug-map.json"), "utf8"),
  );
  expect(map.originals).toHaveLength(28);
  expect(map.originals.map((item) => item.slug)).toEqual([
    "single-chief-as-sole-interlocutor",
    "workflow-as-executable-program",
    "permissions-deny-by-default-and-intersection",
    "real-os-level-isolation",
    "engine-independent-of-window",
    "telegram-as-second-channel",
    "model-per-agent-and-node",
    "decision-register-append-only",
    "macos-only-first",
    "one-installation-one-owner",
    "own-task-board",
    "internet-skills-only-from-owner",
    "apache-2-license",
    "two-memory-layers",
    "chief-autonomy",
    "project-documentation-as-source-of-truth",
    "english-as-project-language",
    "stack-tauri-react-typescript-sqlite",
    "own-workflow-engine",
    "macos-isolation-virtual-machine",
    "default-approval-list",
    "official-clis-like-herdr",
    "direct-chats-with-agents",
    "mvp-scope",
    "contribution-model",
    "herdr-as-terminal-layer",
    "overmind-skill-for-agents",
    "visibility-public-private",
  ]);
  expect(() =>
    parseSlugMap(JSON.stringify({ ...map, originals: map.originals.slice(1) })),
  ).toThrow();
});

test("the complete original-28 fixture indexes ADR0001 as superseded by0023", () => {
  const map = parseSlugMap(
    readFileSync(resolve(import.meta.dirname, "../../docs/adr/slug-map.json"), "utf8"),
  );
  const records = map.originals.map((entry) => {
    const meta = metadataSchema.parse({
      adr: entry.adr,
      title: entry.title,
      status: entry.adr === 1 ? "superseded" : "accepted",
      date: "2026-10-13",
      deciders: ["Owner"],
      tags: [],
      supersedes: entry.adr === 23 ? [1] : [],
      superseded_by: entry.adr === 1 ? [23] : [],
    });
    return parseAdr(
      `${String(entry.adr).padStart(4, "0")}-${entry.slug}.md`,
      renderAdr(
        meta,
        `# ${entry.title}\n\nA conforming test decision with a reason.\n\n## Consequences\n\n- Preserve its history.\n`,
      ),
    );
  });
  expect(() => {
    checkRecords(records, map.originals);
  }).not.toThrow();
  expect(renderIndex(records)).toContain(
    "| 0001 | [Single Chief as sole interlocutor](0001-single-chief-as-sole-interlocutor.md) | superseded | 2026-10-13 |  | superseded by 0023 |",
  );
});
