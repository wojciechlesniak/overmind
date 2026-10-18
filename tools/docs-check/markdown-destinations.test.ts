import { expect, it } from "vitest";
import { linkDestinations } from "./markdown-destinations.ts";

function checked(source: string) {
  const destinations = linkDestinations(source);
  for (const destination of destinations) {
    for (const span of [
      destination.destination,
      ...destination.labels.flatMap((label) =>
        label.referenceSuffix ? [label.text, label.referenceSuffix] : [label.text],
      ),
    ]) {
      expect(source.slice(span.start, span.end)).toBe(span.raw);
    }
  }
  return destinations;
}

it("maps original UTF-16 spans through BOM, front matter, tabs, Unicode and CRLF", () => {
  const source =
    '\uFEFF---\r\ntitle: Fixture\r\n---\r\n🙂\t[ADR 0030](<adr/0030-choice.md#confirmation> "Keep title")\r\n';
  const target = "adr/0030-choice.md#confirmation";
  const result = checked(source);
  expect(result).toEqual([
    {
      target,
      destination: {
        start: source.indexOf(target),
        end: source.indexOf(target) + target.length,
        raw: target,
      },
      labels: [
        {
          text: {
            start: source.indexOf("ADR 0030"),
            end: source.indexOf("ADR 0030") + "ADR 0030".length,
            raw: "ADR 0030",
          },
        },
      ],
    },
  ]);
});

it("keeps raw destination escapes and entities alongside the decoded target", () => {
  const source = '[ADR 0030](adr\\/0030-choice.md#one&amp;two "title")\n';
  const [destination] = checked(source);
  expect(destination?.target).toBe("adr/0030-choice.md#one&two");
  expect(destination?.destination.raw).toBe("adr\\/0030-choice.md#one&amp;two");
  expect(destination?.labels[0]?.text.raw).toBe("ADR 0030");
});

it("accounts for an initial BOM without front matter", () => {
  const source = "\uFEFF🙂\t[ADR 0030](adr/0030-choice.md)\n";
  const [destination] = checked(source);
  expect(destination?.destination.start).toBe(source.indexOf("adr/0030-choice.md"));
  expect(destination?.labels[0]?.text.start).toBe(source.indexOf("ADR 0030"));
});

it("emits a definition once and associates full, collapsed and shortcut uses", () => {
  const source =
    '[first][ADR 0030]\r\n[ADR 0030][]\r\n[ADR 0030]\r\n\r\n[ADR 0030]: <adr/0030-choice.md> "title"\r\n\r\n[last][adr 0030]\r\n';
  const result = checked(source);
  expect(result).toHaveLength(1);
  expect(result[0]?.labels.map((label) => [label.text.raw, label.referenceSuffix?.raw])).toEqual([
    ["first", "[ADR 0030]"],
    ["ADR 0030", "[]"],
    ["ADR 0030", ""],
    ["last", "[adr 0030]"],
  ]);
});

it("preserves escaped reference keys instead of decoding or guessing their spelling", () => {
  const source = "[ADR 0030][pr\\*op]\n\n[pr\\*op]: adr/0030-choice.md\n";
  const [destination] = checked(source);
  expect(destination?.labels[0]?.referenceSuffix?.raw).toBe("[pr\\*op]");
  expect(destination?.target).toBe("adr/0030-choice.md");
});

it("matches reference identifiers using the parser's Unicode case folding", () => {
  const source = "[ADR 0030][STRASSE]\n\n[Straße]: adr/0030-choice.md\n";
  const [destination] = checked(source);
  expect(destination?.labels[0]?.referenceSuffix?.raw).toBe("[STRASSE]");
});

it("uses the first definition for reference labels and retains other explicit destinations", () => {
  const source = "[ADR 0030][proposal]\n\n[proposal]: adr/0030-choice.md\n[proposal]: other.md\n";
  const result = checked(source);
  expect(result.map((destination) => [destination.target, destination.labels.length])).toEqual([
    ["adr/0030-choice.md", 1],
    ["other.md", 0],
  ]);
});

it("returns inline image destinations and preserves mixed line endings", () => {
  const source = "[first](one.md)\r![ADR 0030](adr/0030-choice.md)\n[third](three.md)\r\n";
  expect(checked(source).map((destination) => destination.destination.raw)).toEqual([
    "one.md",
    "adr/0030-choice.md",
    "three.md",
  ]);
});

it("ignores code, comments, HTML source, escaped pseudo-links and undefined references", () => {
  const source = [
    "`[code](ignored.md)`",
    "",
    "  ~~~markdown",
    "[fenced](ignored.md)",
    "  ~~~",
    "",
    "    [indented](ignored.md)",
    "",
    "<!-- [comment](ignored.md) -->",
    "",
    "<div>",
    "[html](ignored.md)",
    "</div>",
    "",
    "\\[escaped](ignored.md)",
    "[undefined][missing]",
    "",
  ].join("\n");
  expect(checked(source)).toEqual([]);
});
