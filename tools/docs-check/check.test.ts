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

it.each([
  "---\nstatus: draft\n---\n# Draft\n",
  "--- \nstatus: draft\n--- \n# Draft\n",
  "---\t\nstatus: draft\n---\t\n# Draft\n",
  "\uFEFF--- \t\r\nstatus: draft\r\n--- \t\r\n\r\n# Draft\r\n",
])("rejects renderer-recognized draft front matter during publication: %j", async (source) => {
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

it.each(['+++\nstatus = "draft"\n+++\n# Draft\n', '{\n"status": "draft"\n}\n# Draft\n'])(
  "fails publication closed for recognized unsupported metadata: %j",
  async (source) => {
    const diagnostics = await checkDocuments({
      files: new Map([["README.md", source]]),
      paths: new Set(["README.md", "LICENSE"]),
      scripts: new Set(),
      config: {},
      pending: new Map(),
      flags: { publish: true, i18n: false, fixToc: false, github: false, external: false },
    });
    expect(diagnostics.map((d) => d.rule)).toContain("front-matter");
  },
);
