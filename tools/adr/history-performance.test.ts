import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { afterEach, expect, test } from "vitest";
import { Files } from "./files.ts";
import { checkHistory } from "./history.ts";
import { parseAdr, parseSlugMap, renderAdr, type Adr } from "./input.parse-boundary.ts";
import type { HistoryGit } from "./ports.ts";

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});
const first = "1".repeat(40);
const last = "2".repeat(40);
const map = parseSlugMap(
  readFileSync(resolve(import.meta.dirname, "../../docs/adr/slug-map.json"), "utf8"),
);
function decision(id = 1, status: Adr["meta"]["status"] = "accepted", body = "Keep the decision.") {
  const entry = [...map.originals, ...map.additional].find((item) => item.adr === id);
  if (!entry) {
    throw new Error("Missing test identity");
  }
  const source = renderAdr(
    {
      adr: id,
      title: entry.title,
      status,
      date: "2026-10-13",
      deciders: ["Owner"],
      tags: [],
      supersedes: [],
      superseded_by: status === "superseded" ? [2] : [],
    },
    `# ${entry.title}\n\n${body}\n\n## Consequences\n\n- Preserve history.\n`,
  );
  return { source, record: parseAdr(`${String(id).padStart(4, "0")}-${entry.slug}.md`, source) };
}
function history(
  options: {
    head?: string;
    base?: string;
    commits?: readonly string[];
    paths?: readonly string[];
    records?: ReturnType<typeof decision>[];
    earlier?: string;
    integrated?: readonly string[];
  } = {},
) {
  const root = mkdtempSync(resolve(tmpdir(), "ove-oss016-history-"));
  roots.push(root);
  const head = options.head ?? last;
  const base = options.base ?? head;
  const records = options.records ?? [decision()];
  const paths = options.paths ?? records.map(({ record }) => `docs/adr/${record.file}`);
  const commits = options.commits ?? [first, last];
  const calls: string[][] = [];
  const batches: number[] = [];
  const source = (request: string): string => {
    const index = records.findIndex(({ record }) => request.endsWith(`:docs/adr/${record.file}`));
    const found = records[index];
    if (!found) {
      throw new Error("Unexpected history source request");
    }
    return request.startsWith(`${first}:`) ? (options.earlier ?? found.source) : found.source;
  };
  const git: HistoryGit = {
    run(args) {
      calls.push([...args]);
      switch (args[0]) {
        case undefined:
          throw new Error("Missing Git operation");
        case "rev-parse":
          return args[1] === "HEAD" ? head : base;
        case "ls-tree":
          return paths.join("\0") + "\0";
        case "log":
          return commits.join("\n");
        case "rev-list":
          return (options.integrated ?? commits).join("\n");
        case "show":
          return source(args[1] ?? "");
        default:
          throw new Error("Unexpected Git operation");
      }
    },
    readBlobs(requests) {
      batches.push(requests.length);
      return new Map(requests.map((request) => [request, source(request)]));
    },
  };
  return {
    calls,
    batches,
    check: (labels: readonly string[] = []) => {
      checkHistory(
        new Files(root),
        git,
        records.map(({ record }) => record),
        map,
        labels,
      );
    },
  };
}

test("an identical validated base needs no second history traversal for distinct ADR paths", () => {
  const current = history({ records: [decision(1), decision(2)] });
  current.check();
  expect(current.calls.filter((args) => args[0] === "log").map((args) => args.at(-1))).toEqual([
    ":(glob)docs/adr/0001-*.md",
    ":(glob)docs/adr/0002-*.md",
  ]);
  expect(current.calls.filter((args) => args[0] === "rev-list")).toEqual([]);
});

test.each(["head", "base"] as const)(
  "invalid full %s IDs fail before historical access",
  (which) => {
    for (const invalid of [
      "",
      "abc123",
      "a".repeat(39),
      "a".repeat(41),
      "z".repeat(40),
      "A".repeat(40),
    ]) {
      const current = history({ [which]: invalid });
      expect(current.check).toThrow(
        which === "head" ? "Invalid ADR history commit" : "Invalid ADR comparison base",
      );
      expect(current.calls.every((args) => args[0] === "rev-parse")).toBe(true);
    }
  },
);

test("malformed historical IDs deny before membership or source reads", () => {
  const current = history({ commits: ["not-a-commit"] });
  expect(current.check).toThrow("ADR history exceeds safe bounds");
  expect(current.calls.some((args) => args[0] === "rev-list" || args[0] === "show")).toBe(false);
});

test.each([1024, 1025])("the existing %i-commit boundary is enforced", (count) => {
  const commits = Array.from({ length: count }, (_, index) =>
    (index + 1).toString(16).padStart(40, "0"),
  );
  const current = history({ commits });
  if (count === 1024) {
    expect(current.check).not.toThrow();
  } else {
    expect(current.check).toThrow("ADR history exceeds safe bounds");
  }
});

test.each([10000, 10001])("the existing %i-path boundary is enforced", (count) => {
  const current = history({
    paths: [
      `docs/adr/${decision().record.file}`,
      ...Array.from({ length: count - 1 }, (_, index) => `docs/adr/auxiliary-${String(index)}`),
    ],
    commits: [last],
  });
  if (count === 10000) {
    expect(current.check).not.toThrow();
  } else {
    expect(current.check).toThrow("ADR history exceeds safe bounds");
  }
});

test("empty history at an identical base does not require a membership query", () => {
  const current = history({ commits: [], paths: [] });
  expect(current.check).not.toThrow();
  expect(current.calls.filter((args) => args[0] === "rev-list")).toEqual([]);
});

test("different full IDs retain membership even when all but the last digit match", () => {
  const current = history({ head: "a".repeat(39) + "1", base: "a".repeat(39) + "2" });
  current.check();
  expect(current.calls.filter((args) => args[0] === "rev-list")).toEqual([
    ["rev-list", "a".repeat(39) + "2", "--", ":(glob)docs/adr/0001-*.md"],
  ]);
});

test.each(["proposed", "superseded"] as const)(
  "identical refs still reject a historical %s violation",
  (status) => {
    const before = decision(1, status === "proposed" ? "accepted" : "superseded");
    const after = decision(1, status, "A changed decision.");
    const current = history({ records: [after], earlier: before.source });
    expect(() => {
      current.check(["adr-edit"]);
    }).toThrow(status === "proposed" ? "lifecycle" : "immutable");
  },
);

test("published accepted edits remain valid while divergent edits require authorization", () => {
  const before = decision();
  const after = decision(1, "accepted", "A reviewed decision correction.");
  const integrated = history({ records: [after], earlier: before.source });
  expect(integrated.check).not.toThrow();
  const unpublished = history({
    head: last,
    base: first,
    records: [after],
    earlier: before.source,
    integrated: [first],
  });
  expect(unpublished.check).toThrow("adr-edit");
  expect(() => {
    unpublished.check(["adr-edit"]);
  }).not.toThrow();
});
