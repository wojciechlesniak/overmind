import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import { expect, test } from "vitest";
import { isolatedGitEnvironment } from "../hooks/git-test-environment.ts";
import { Files } from "./files.ts";
import { checkHistory } from "./history.ts";
import { parseAdr, parseSlugMap, renderAdr } from "./input.parse-boundary.ts";
import { nodeGit, type HistoryGit } from "./ports.ts";
import { fixture, snapshot } from "./public-cli-fixture.ts";
import { loadRecords } from "./repository.ts";

function reader(root: string, parent: string) {
  const environment = {
    ...isolatedGitEnvironment(),
    HOME: resolve(parent, "reader-home"),
    XDG_CONFIG_HOME: resolve(parent, "reader-xdg"),
  };
  mkdirSync(environment.HOME);
  mkdirSync(environment.XDG_CONFIG_HOME);
  const actual = nodeGit(root, environment);
  const calls: string[][] = [];
  const port: HistoryGit = {
    run: (args) => {
      calls.push([...args]);
      return actual.run(args);
    },
    readBlobs: (requests) => actual.readBlobs(requests),
  };
  return {
    calls,
    check: (labels: readonly string[] = []) => {
      checkHistory(
        new Files(root),
        port,
        loadRecords(new Files(root)),
        parseSlugMap(readFileSync(resolve(root, "docs/adr/slug-map.json"), "utf8")),
        labels,
      );
    },
  };
}

test("a published same-ADR merge and preserved rename retain all versions without duplicate traversal", () => {
  const { parent, root, git } = fixture(false, true);
  try {
    const map = parseSlugMap(readFileSync(resolve(root, "docs/adr/slug-map.json"), "utf8"));
    const entry = map.originals[1];
    if (!entry?.polishOriginal) {
      throw new Error("Missing original fixture identity");
    }
    const old = resolve(root, "docs/adr", entry.polishOriginal);
    git(["checkout", "--quiet", "-b", "fixture-side"]);
    const side = parseAdr(basename(old), readFileSync(old, "utf8"));
    writeFileSync(old, renderAdr({ ...side.meta, tags: ["tooling"] }, side.body));
    git(["add", "."]);
    git(["commit", "--quiet", "-m", "docs: update side metadata"]);
    git(["checkout", "--quiet", "DEVELOP"]);
    const main = parseAdr(basename(old), readFileSync(old, "utf8"));
    writeFileSync(old, renderAdr({ ...main.meta, date: "2026-10-14" }, main.body));
    git(["add", "."]);
    git(["commit", "--quiet", "-m", "docs: update main metadata"]);
    git([
      "merge",
      "--quiet",
      "--no-ff",
      "fixture-side",
      "-m",
      "docs: preserve both metadata histories",
    ]);
    const source = readFileSync(old);
    const record = parseAdr(basename(old), source.toString("utf8"));
    const archive = `docs/pl/adr/${entry.polishOriginal}`;
    mkdirSync(resolve(root, "docs/pl/adr"), { recursive: true });
    writeFileSync(resolve(root, archive), source);
    const canonical = resolve(root, "docs/adr", `0002-${entry.slug}.md`);
    renameSync(old, canonical);
    writeFileSync(
      canonical,
      renderAdr(
        {
          ...record.meta,
          translation_of: archive,
          source_sha256: createHash("sha256").update(source).digest("hex"),
          translated_on: "2026-10-17",
          translation_status: "reviewed",
          translator: "Fixture translator",
        },
        record.body,
      ),
    );
    git(["add", "."]);
    git(["commit", "--quiet", "-m", "docs: preserve canonical translation"]);
    git(["push", "--quiet", "origin", "DEVELOP"]);
    git(["fetch", "--quiet", "--no-tags", "origin", "DEVELOP"]);
    const head = git(["rev-parse", "HEAD"]).trim();
    expect(git(["rev-parse", "origin/DEVELOP"]).trim()).toBe(head);
    const current = reader(root, parent);
    const before = snapshot(root);
    const index = readFileSync(resolve(root, ".git/index"));
    for (const [follow, showRoot] of [
      [false, true],
      [true, true],
      [false, false],
      [true, false],
    ]) {
      git(["config", "--local", "log.follow", String(follow)]);
      git(["config", "--local", "log.showRoot", String(showRoot)]);
      const config = readFileSync(resolve(root, ".git/config"));
      expect(() => {
        current.check();
      }).not.toThrow();
      expect(readFileSync(resolve(root, ".git/config"))).toEqual(config);
    }
    expect(current.calls.filter((args) => args[0] === "rev-list")).toEqual([]);
    expect(
      current.calls.filter(
        (args) => args[0] === "log" && args.at(-1) === ":(glob)docs/adr/0002-*.md",
      ),
    ).toHaveLength(4);
    expect(snapshot(root)).toEqual(before);
    expect(readFileSync(resolve(root, ".git/index"))).toEqual(index);
    expect(git(["rev-parse", "HEAD"]).trim()).toBe(head);
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
}, 15000);

test("matching-tree reverts retain authorization across repeated checks", () => {
  const { parent, root, git } = fixture();
  try {
    const entry = parseSlugMap(readFileSync(resolve(root, "docs/adr/slug-map.json"), "utf8"))
      .originals[1];
    if (!entry) {
      throw new Error("Missing fixture identity");
    }
    const path = resolve(root, "docs/adr", `0002-${entry.slug}.md`);
    const original = readFileSync(path, "utf8");
    const current = reader(root, parent);
    current.check();
    const base = git(["rev-parse", "origin/DEVELOP"]).trim();
    writeFileSync(
      path,
      original.replace("Keep the documented decision.", "Correct the documented decision."),
    );
    git(["add", "."]);
    git(["commit", "--quiet", "-m", "docs: record unpublished correction"]);
    writeFileSync(path, original);
    git(["add", "."]);
    git(["commit", "--quiet", "-m", "docs: restore original decision"]);
    expect(git(["rev-parse", "HEAD^{tree}"]).trim()).toBe(
      git(["rev-parse", `${base}^{tree}`]).trim(),
    );
    expect(current.check).toThrow("adr-edit");
    expect(() => {
      current.check(["adr-edit"]);
    }).not.toThrow();
    const membership = current.calls.filter((args) => args[0] === "rev-list");
    expect(membership.length).toBeGreaterThan(0);
    expect(membership.every((args) => args[1] === base)).toBe(true);
    git(["push", "--quiet", "origin", "DEVELOP"]);
    git(["fetch", "--quiet", "--no-tags", "origin", "DEVELOP"]);
    current.calls.length = 0;
    expect(current.check).not.toThrow();
    expect(current.calls.filter((args) => args[0] === "rev-list")).toEqual([]);
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
}, 15000);

test("an unpublished accepted-body correction retains its exact base membership and label", () => {
  const { parent, root, git } = fixture();
  try {
    const entry = parseSlugMap(readFileSync(resolve(root, "docs/adr/slug-map.json"), "utf8"))
      .originals[1];
    if (!entry) {
      throw new Error("Missing fixture identity");
    }
    const path = resolve(root, "docs/adr", `0002-${entry.slug}.md`);
    const original = readFileSync(path, "utf8");
    const current = reader(root, parent);
    const base = git(["rev-parse", "origin/DEVELOP"]).trim();
    writeFileSync(
      path,
      original.replace("Keep the documented decision.", "Correct the documented decision."),
    );
    git(["add", "."]);
    git(["commit", "--quiet", "-m", "docs: record unpublished correction"]);
    expect(current.check).toThrow("adr-edit");
    expect(() => {
      current.check(["adr-edit"]);
    }).not.toThrow();
    const membership = current.calls.filter((args) => args[0] === "rev-list");
    expect(membership.length).toBeGreaterThan(0);
    expect(membership.every((args) => args[1] === base)).toBe(true);
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
}, 15000);
