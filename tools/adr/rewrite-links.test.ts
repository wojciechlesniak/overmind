import { expect, test } from "vitest";
import { rewriteAdrLinks } from "./rewrite-links.ts";

const oldPath = "/fixture/docs/adr/0030-choice.md";
const newPath = "/fixture/docs/adr/0031-choice.md";
const document = "/fixture/docs/notes.md";
const rewrite = (source: string) => rewriteAdrLinks(source, document, oldPath, newPath);

test("renumber edits destinations and visible numbers while preserving reference identities", () => {
  const source = [
    '[ADR 0030](<adr/0030-choice.md> "title")',
    "[ADR 0030][pr\\*op]",
    "",
    "[pr\\*op]: adr/0030-choice.md#confirmation",
    "",
    "[ADR 0030\\*][]",
    "[ADR 0030\\*]",
    "",
    '[ADR 0030\\*]: <adr/0030-choice.md> "reference title"',
    "",
  ].join("\r\n");
  expect(rewrite(source)).toBe(
    [
      '[ADR 0031](<adr/0031-choice.md> "title")',
      "[ADR 0031][pr\\*op]",
      "",
      "[pr\\*op]: adr/0031-choice.md#confirmation",
      "",
      "[ADR 0031\\*][ADR 0030\\*]",
      "[ADR 0031\\*][ADR 0030\\*]",
      "",
      '[ADR 0030\\*]: <adr/0031-choice.md> "reference title"',
      "",
    ].join("\r\n"),
  );
});

test("preserves untouched escapes, entities, query and fragment syntax", () => {
  expect(rewrite("🙂\t[ADR 0030](adr\\/0030-choice.md#one&amp;two)\n")).toBe(
    "🙂\t[ADR 0031](adr\\/0031-choice.md#one&amp;two)\n",
  );
  expect(rewrite("[ADR 0030](a%64r/0030-choice.md?view=one#confirmation)\n")).toBe(
    "[ADR 0031](a%64r/0031-choice.md?view=one#confirmation)\n",
  );
});

test("leaves external, unrelated and non-rendered source byte-identical", () => {
  const source = [
    "[ADR 0030](https://example.invalid/0030-choice.md)",
    "[ADR 0030](other/0030-choice.md)",
    "`[ADR 0030](adr/0030-choice.md)`",
    "<!-- [ADR 0030](adr/0030-choice.md) -->",
    "~~~markdown",
    "[ADR 0030](adr/0030-choice.md)",
    "~~~",
    "",
  ].join("\n");
  expect(rewrite(source)).toBe(source);
});

test("deduplicates identical label edits for a linked image", () => {
  expect(rewrite("[![ADR 0030](adr/0030-choice.md)](adr/0030-choice.md)\n")).toBe(
    "[![ADR 0031](adr/0031-choice.md)](adr/0031-choice.md)\n",
  );
});

test("rejects ambiguous encoded filename edits instead of changing a fragment decoy", () => {
  expect(() => rewrite("[ADR 0030](adr/&#48;030-choice.md#0030-choice.md)\n")).toThrow(
    "Ambiguous ADR destination",
  );
});

test.each([
  { name: "inline code", source: "[`ADR 0030`](adr/0030-choice.md)\n" },
  { name: "an HTML comment", source: "[<!-- ADR 0030 -->visible](adr/0030-choice.md)\n" },
])("refuses ambiguous number edits inside a label containing $name", ({ source }) => {
  expect(() => rewrite(source)).toThrow("Ambiguous ADR label");
});
