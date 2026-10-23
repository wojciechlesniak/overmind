import { expect, test } from "vitest";
import { parseLabels } from "./labels.parse-boundary.ts";

test("event labels retain order and the missing pull request defaults to no labels", () => {
  expect(parseLabels("{}")).toEqual([]);
  expect(
    parseLabels('{"pull_request":{"labels":[{"name":"config-change"},{"name":"adr-change"}]}}'),
  ).toEqual(["config-change", "adr-change"]);
});

test("event labels preserve the 100-label boundary", () => {
  const labels = Array.from({ length: 100 }, () => ({ name: "synthetic-label" }));
  expect(parseLabels(JSON.stringify({ pull_request: { labels } }))).toHaveLength(100);
  expect(() =>
    parseLabels(JSON.stringify({ pull_request: { labels: [...labels, labels[0]] } })),
  ).toThrow("Invalid GitHub event JSON");
});

test.each(["", "x".repeat(201), "synthetic\nlabel"])(
  "event labels reject invalid names with a fixed diagnostic",
  (name) => {
    expect(() => parseLabels(JSON.stringify({ pull_request: { labels: [{ name }] } }))).toThrow(
      "Invalid GitHub event JSON",
    );
  },
);

test.each(["null", "[]", "1", '{"synthetic-private-marker":}', '{"pull_request":{"labels":null}}'])(
  "event labels reject malformed shapes without reflecting input",
  (source) => {
    try {
      parseLabels(source);
      expect.fail("Malformed event must be denied");
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toBe("Invalid GitHub event JSON");
    }
  },
);
