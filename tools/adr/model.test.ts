import { expect, test } from "vitest";
import {
  nextNumber,
  slugify,
  checkRecords,
  checkTransition,
  renderIndex,
  updateIndex,
} from "./model.ts";

test("allocation uses all observed numbers and creates a bounded ASCII filename slug", () => {
  expect(nextNumber([1, 28, 30], [29, 31], [34, 32])).toBe(35);
  expect(slugify("Use X for Y")).toBe("use-x-for-y");
  expect(slugify("Use alpha beta gamma delta epsilon zeta eta")).toBe(
    "use-alpha-beta-gamma-delta-epsilon",
  );
  expect(slugify("A".repeat(100))).toHaveLength(60);
  for (const title of ["", "!!!", "unsafe\ntitle", "x".repeat(201)]) {
    expect(() => slugify(title)).toThrow();
  }
  expect(() => nextNumber([9999], [], [])).toThrow();
  expect(() => nextNumber([1.5], [], [])).toThrow();
});

test("lifecycle and index preserve supersession, escaped titles and append-only bodies", () => {
  const first = {
    file: "0001-old.md",
    meta: {
      adr: 1,
      title: "Old | `choice` <unsafe>",
      status: "superseded" as const,
      date: "2026-10-13",
      deciders: ["Owner"],
      tags: ["process" as const],
      supersedes: [],
      superseded_by: [2],
    },
    body: "old decision",
  };
  const second = {
    file: "0002-new.md",
    meta: {
      ...first.meta,
      adr: 2,
      title: "New choice",
      status: "accepted" as const,
      supersedes: [1],
      superseded_by: [],
    },
    body: "new decision",
  };
  const entries = [
    { adr: 1, slug: "old" },
    { adr: 2, slug: "new" },
  ];
  expect(() => {
    checkRecords([first, second], entries);
  }).not.toThrow();
  expect(() => {
    checkRecords([first, { ...second, meta: { ...second.meta, supersedes: [] } }], entries);
  }).toThrow();
  expect(() => {
    checkRecords([first, first], entries);
  }).toThrow();
  expect(() => {
    checkRecords([second], entries);
  }).toThrow();
  expect(() => {
    checkRecords([first, { ...second, file: "0002-wrong.md" }], entries);
  }).toThrow();
  const accepted = {
    ...first,
    meta: { ...first.meta, status: "accepted" as const, superseded_by: [] },
  };
  expect(() => {
    checkTransition(accepted, { ...accepted, body: "typo fix" }, []);
  }).toThrow();
  expect(() => {
    checkTransition(accepted, { ...accepted, body: "typo fix" }, ["adr-edit"]);
  }).not.toThrow();
  expect(() => {
    checkTransition(first, { ...first, body: "rewritten" }, ["adr-edit"]);
  }).toThrow();
  expect(() => {
    checkTransition(second, { ...second, meta: { ...second.meta, status: "proposed" } }, []);
  }).toThrow();
  expect(renderIndex([second, first])).toBe(`| # | Decision | Status | Date | Tags | Notes |
| --- | --- | --- | --- | --- | --- |
| 0001 | [Old &#124; &#96;choice&#96; &lt;unsafe&gt;](0001-old.md) | superseded | 2026-10-13 | process | superseded by 0002 |
| 0002 | [New choice](0002-new.md) | accepted | 2026-10-13 | process | supersedes 0001 |
`);
  const intro = "# Decisions\n\n<!-- adr-index:start -->\nstale\n<!-- adr-index:end -->\n";
  expect(updateIndex(intro, renderIndex([first, second]))).toContain(
    "# Decisions\n\n<!-- adr-index:start -->\n| #",
  );
  expect(() => updateIndex(intro + intro, "table")).toThrow();
});
