import { expect, it } from "vitest";
import { extractLinks, headings, slug } from "./markdown.ts";

it("creates GitHub anchors for punctuation, emoji and non-ASCII text", () => {
  expect(slug("Hello, World! ☕️")).toBe("hello-world-");
  expect(slug("Zażółć gęślą — A_B-C")).toBe("zażółć-gęślą--a_b-c");
});

it("uses rendered heading text, handles global duplicate collisions and keeps front-matter line offsets", () => {
  const md =
    "---\ntitle: Metadata\n---\n# A [title](target.md) ![image](icon.png)\n\n## Same\n\n## Same-1\n\n## Same\n";
  expect(headings(md).map((h) => [h.anchor, h.line])).toEqual([
    ["a-title-", 4],
    ["same", 6],
    ["same-1", 8],
    ["same-2", 10],
  ]);
  expect(
    extractLinks("# Root\n\n[![icon](icon.png)](guide.md)\n").map((link) => link.target),
  ).toEqual(["guide.md", "icon.png"]);
});

it("extracts real links and reference images while ignoring inline and fenced examples", () => {
  const md =
    "# Title\n\n[guide](guide.md#start)\n![image][asset]\n\n[asset]: images/icon.png\n\n`[literal](ignored.md)`\n~~~md\n[fenced](missing.md)\n~~~\n";
  expect(extractLinks(md)).toEqual([
    { target: "guide.md#start", line: 3 },
    { target: "images/icon.png", line: 4 },
  ]);
});

it("extracts autolinks and ignores escaped brackets and indented code", () => {
  expect(
    extractLinks(
      "# Root\n\n<https://example.test/a>\n\\[literal](missing.md)\n\n    [code](missing.md)\n",
    ),
  ).toEqual([{ target: "https://example.test/a", line: 3 }]);
});
