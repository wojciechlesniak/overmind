import { expect, it } from "vitest";
import { extractLinks, headings, slug } from "./markdown.ts";

it("creates GitHub anchors for punctuation, emoji and non-ASCII text", () => {
  // GitHub's Word filter retains combining marks, including a variation selector.
  expect(slug("Hello, World! ☕️")).toBe("hello-world-\uFE0F");
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

it("checks allowed HTML image sources so a missing README hero cannot bypass publication", () => {
  expect(
    extractLinks(
      '# Root\n\n<img src="docs/assets/readme-hero.png" alt="Preview">\n\n<!-- <img src="ignored.png"> -->\n',
    ),
  ).toEqual([{ target: "docs/assets/readme-hero.png", line: 3 }]);
});

it("does not confuse other image attributes with the actual source", () => {
  expect(
    extractLinks(
      '# Root\n\n<img alt=\' src="ignored.png"\' data-src="ignored.png" src="docs/assets/readme-hero.png">\n',
    ),
  ).toEqual([{ target: "docs/assets/readme-hero.png", line: 3 }]);
});

it("decodes numeric and named references as rendered heading data", () => {
  expect(headings("# &#65; &#x3B2; &eacute; &Alpha;\n")[0]?.anchor).toBe("a-β-é-α");
  expect(headings("# &fjlig;\n")[0]?.anchor).toBe("fj");
});

it("retains connector punctuation and inline math in GitHub anchors", () => {
  expect(headings("# A‿B\n\n## Equation $x$\n").map((h) => h.anchor)).toEqual([
    "a‿b",
    "equation-x",
  ]);
});
