import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { expect, test } from "vitest";
import { createAdr, renumberAdr } from "./service.ts";
import { parseAdr, parseSlugMap } from "./input.parse-boundary.ts";
import { generateIndex, loadRecords } from "./repository.ts";
import { Files } from "./files.ts";
import { checkRecords } from "./model.ts";

const sourceRoot = resolve(import.meta.dirname, "../..");
function fixture() {
  const root = realpathSync(mkdtempSync(resolve(tmpdir(), "ove-adr-command-")));
  mkdirSync(resolve(root, "docs/adr"), { recursive: true });
  mkdirSync(resolve(root, "tasks"));
  for (const name of ["slug-map.json", "_template.md"]) {
    copyFileSync(resolve(sourceRoot, "docs/adr", name), resolve(root, "docs/adr", name));
  }
  return root;
}
test("create uses the injected Clock and three numbering sources without executing title text", () => {
  const root = fixture();
  const base = "a".repeat(40);
  try {
    writeFileSync(resolve(root, "docs/adr/0030-existing.md"), "existing");
    const path = createAdr(root, "Use X for Y", {
      clock: { today: () => "2026-10-17" },
      git: {
        run(args) {
          if (args[0] === "rev-parse") {
            return base;
          }
          return "";
        },
      },
    });
    expect(path).toBe("docs/adr/0031-use-x-for-y.md");
    const record = parseAdr("0031-use-x-for-y.md", readFileSync(resolve(root, path), "utf8"));
    expect(record.meta.date).toBe("2026-10-17");
    expect(record.meta.status).toBe("proposed");
    expect(
      parseSlugMap(readFileSync(resolve(root, "docs/adr/slug-map.json"), "utf8")).additional.at(-1)
        ?.adr,
    ).toBe(31);
    expect(existsSync(resolve(root, "docs/adr/.adr-tool.lock"))).toBe(false);
    expect(() =>
      createAdr(root, "Unsafe\ntitle", {
        clock: { today: () => "invalid" },
        git: { run: () => base },
      }),
    ).toThrow();
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("renumber defaults to a complete dry run, then fixes only the collided proposal and its links", () => {
  const root = fixture();
  try {
    const map = parseSlugMap(readFileSync(resolve(root, "docs/adr/slug-map.json"), "utf8"));
    const template = readFileSync(resolve(root, "docs/adr/_template.md"), "utf8");
    for (const entry of [...map.originals, ...map.additional]) {
      const source = template
        .replace("status: proposed", "status: accepted")
        .replace("adr: 0", `adr: ${String(entry.adr)}`)
        .replaceAll("Choose one clear decision", entry.title);
      writeFileSync(
        resolve(root, `docs/adr/${String(entry.adr).padStart(4, "0")}-${entry.slug}.md`),
        source,
      );
    }
    map.additional.push({
      adr: 30,
      slug: "proposed-change",
      polishOriginal: null,
      title: "Propose a change",
    });
    writeFileSync(resolve(root, "docs/adr/slug-map.json"), JSON.stringify(map));
    const old = "docs/adr/0030-proposed-change.md";
    writeFileSync(
      resolve(root, old),
      template
        .replace("adr: 0", "adr: 30")
        .replaceAll("Choose one clear decision", "Propose a change"),
    );
    writeFileSync(
      resolve(root, "docs/notes.md"),
      [
        "[ADR 0030](adr/0030-proposed-change.md#confirmation)",
        '[ADR 0030](adr/0030-proposed-change.md "title")',
        '[ADR 0030](<adr/0030-proposed-change.md> "title")',
        "[Existing ADR 0030](adr/0030-engine-packaging-and-sqlite-driver.md)",
        "[External](https://example.invalid/0030-proposed-change.md)",
        "[ADR 0030][proposal]",
        "",
        "[proposal]: adr/0030-proposed-change.md#confirmation",
        "",
        "[ADR 0030][]",
        "[ADR 0030]",
        "",
        '[ADR 0030]: <adr/0030-proposed-change.md> "reference title"',
        "",
        "[ADR 0030](adr\\/0030-proposed-change.md#one&amp;two)",
        "`[ADR 0030](adr/0030-proposed-change.md)`",
        "<!-- [ADR 0030](adr/0030-proposed-change.md) -->",
        "",
      ].join("\n"),
    );
    const original = readFileSync(resolve(root, "docs/notes.md"), "utf8");
    const plan = renumberAdr(root, 30, 31, false);
    expect(plan).toContain("docs/notes.md");
    expect(existsSync(resolve(root, old))).toBe(true);
    expect(readFileSync(resolve(root, "docs/notes.md"), "utf8")).toBe(original);
    renumberAdr(root, 30, 31, true);
    expect(existsSync(resolve(root, old))).toBe(false);
    expect(readFileSync(resolve(root, "docs/notes.md"), "utf8")).toBe(
      [
        "[ADR 0031](adr/0031-proposed-change.md#confirmation)",
        '[ADR 0031](adr/0031-proposed-change.md "title")',
        '[ADR 0031](<adr/0031-proposed-change.md> "title")',
        "[Existing ADR 0030](adr/0030-engine-packaging-and-sqlite-driver.md)",
        "[External](https://example.invalid/0030-proposed-change.md)",
        "[ADR 0031][proposal]",
        "",
        "[proposal]: adr/0031-proposed-change.md#confirmation",
        "",
        "[ADR 0031][ADR 0030]",
        "[ADR 0031][ADR 0030]",
        "",
        '[ADR 0030]: <adr/0031-proposed-change.md> "reference title"',
        "",
        "[ADR 0031](adr\\/0031-proposed-change.md#one&amp;two)",
        "`[ADR 0030](adr/0030-proposed-change.md)`",
        "<!-- [ADR 0030](adr/0030-proposed-change.md) -->",
        "",
      ].join("\n"),
    );
    const changed = parseSlugMap(readFileSync(resolve(root, "docs/adr/slug-map.json"), "utf8"));
    expect(() => {
      checkRecords(loadRecords(new Files(root)), [...changed.originals, ...changed.additional]);
    }).not.toThrow();
    writeFileSync(
      resolve(root, "docs/adr/README.md"),
      "# Decisions\n<!-- adr-index:start -->\n<!-- adr-index:end -->\n",
    );
    generateIndex(root, false);
    expect(() => {
      generateIndex(root, true);
    }).not.toThrow();
    expect(() => renumberAdr(root, 1, 32, true)).toThrow();
    const proposal = createAdr(root, "Preserve history", {
      clock: { today: () => "2026-10-17" },
      git: { run: (args) => (args[0] === "rev-parse" ? "a".repeat(40) : "") },
    });
    expect(proposal).toBe("docs/adr/0032-preserve-history.md");
    mkdirSync(resolve(root, "docs/pl"), { recursive: true });
    const archive = "[ADR 0032](../adr/0032-preserve-history.md)\n";
    writeFileSync(resolve(root, "docs/pl/archive.md"), archive);
    const mapBeforeDenial = readFileSync(resolve(root, "docs/adr/slug-map.json"), "utf8");
    expect(() => renumberAdr(root, 32, 33, true)).toThrow("Archived Polish originals");
    expect(readFileSync(resolve(root, "docs/pl/archive.md"), "utf8")).toBe(archive);
    expect(readFileSync(resolve(root, "docs/adr/slug-map.json"), "utf8")).toBe(mapBeforeDenial);
    expect(existsSync(resolve(root, proposal))).toBe(true);
    expect(existsSync(resolve(root, "docs/adr/0033-preserve-history.md"))).toBe(false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
