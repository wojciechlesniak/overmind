import { expect, it } from "vitest";
import { checkDocuments } from "./checker.ts";

it("checks publication prerequisites, stale pending entries and malformed links without network", async () => {
  const files = new Map([
    ["README.md", "# Root\n\n[bad](missing.md)\n"],
    ["docs/pl/draft.md", "---\nstatus: draft\n---\n# Draft\n"],
  ]);
  const result = await checkDocuments({
    files,
    paths: new Set(files.keys()),
    scripts: new Set(),
    config: {},
    pending: new Map([["README.md", "OVE_OSS004"]]),
    flags: { publish: true, i18n: false, fixToc: false, github: false, external: false },
  });
  expect(result.map((d) => d.rule)).toEqual(
    expect.arrayContaining([
      "broken-link",
      "stale-pending-link",
      "pending-publication",
      "missing-license",
      "draft-translation",
    ]),
  );
});

it("rejects draft front matter after a UTF-8 BOM during actual publication checking", async () => {
  const source = "\uFEFF---\nstatus: draft\n---\n# Draft\n";
  const diagnostics = await checkDocuments({
    files: new Map([["README.md", source]]),
    paths: new Set(["README.md", "LICENSE"]),
    scripts: new Set(),
    config: {},
    pending: new Map(),
    flags: { publish: true, i18n: false, fixToc: false, github: false, external: false },
  });
  expect(diagnostics.map((d) => d.rule)).toContain("draft-translation");
});
