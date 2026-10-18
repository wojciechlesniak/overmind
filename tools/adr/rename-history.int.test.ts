import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, resolve } from "node:path";
import { expect, test } from "vitest";
import { isolatedGitEnvironment } from "../hooks/git-test-environment.ts";
import { parseAdr, parseSlugMap, renderAdr } from "./input.parse-boundary.ts";
import { nodeGit } from "./ports.ts";
import { checkRepository } from "./repository.ts";

const sourceRoot = resolve(import.meta.dirname, "../..");
function fixture(translation = false) {
  const root = realpathSync(mkdtempSync(resolve(tmpdir(), "ove-adr-rename-history-")));
  const environment = isolatedGitEnvironment();
  const git = (args: string[]) =>
    execFileSync("git", args, { cwd: root, env: environment, encoding: "utf8" });
  mkdirSync(resolve(root, "docs/adr"), { recursive: true });
  mkdirSync(resolve(root, "docs/pl/adr"), { recursive: true });
  mkdirSync(resolve(root, "tasks"));
  const map = parseSlugMap(readFileSync(resolve(sourceRoot, "docs/adr/slug-map.json"), "utf8"));
  const template = readFileSync(resolve(sourceRoot, "docs/adr/_template.md"), "utf8");
  for (const entry of [...map.originals, ...map.additional]) {
    const name =
      translation && entry.adr === 2
        ? entry.polishOriginal
        : `${String(entry.adr).padStart(4, "0")}-${entry.slug}.md`;
    if (!name) {
      throw new Error("Missing fixture source");
    }
    writeFileSync(
      resolve(root, "docs/adr", name),
      template
        .replace("status: proposed", "status: accepted")
        .replace("adr: 0", `adr: ${String(entry.adr)}`)
        .replaceAll("Choose one clear decision", entry.title),
    );
  }
  writeFileSync(resolve(root, "docs/adr/slug-map.json"), JSON.stringify(map));
  git(["init", "--quiet"]);
  git(["config", "user.name", "ADR fixture"]);
  git(["config", "user.email", "adr@example.invalid"]);
  git(["add", "."]);
  git(["commit", "--quiet", "-m", "docs: establish accepted decisions"]);
  git(["update-ref", "refs/remotes/origin/DEVELOP", "HEAD"]);
  const cli = () =>
    spawnSync(
      process.execPath,
      ["--import", import.meta.resolve("tsx"), resolve(sourceRoot, "tools/adr/check.ts")],
      {
        cwd: root,
        env: { ...environment, GITHUB_EVENT_PATH: "" },
        encoding: "utf8",
        timeout: 10000,
      },
    );
  return { root, git, map, cli };
}
function translated(source: string, archive: string, body?: string) {
  const record = parseAdr(basename(archive), source);
  return renderAdr(
    {
      ...record.meta,
      translation_of: archive,
      source_sha256: createHash("sha256").update(source).digest("hex"),
      translated_on: "2026-10-17",
      translation_status: "reviewed",
      translator: "Fixture translator",
    },
    body ?? record.body,
  );
}

test("public check cannot reset published identity or lifecycle using complete archival provenance", () => {
  const { root, map, cli, git } = fixture();
  try {
    const baseline = cli();
    expect(baseline.error).toBeUndefined();
    expect(baseline.status, baseline.stderr).toBe(0);
    const entry = map.additional.find((item) => item.adr === 30);
    if (!entry) {
      throw new Error("Missing fixture identity");
    }
    const old = `docs/adr/0030-${entry.slug}.md`;
    const source = readFileSync(resolve(root, old), "utf8");
    const archive = `docs/pl/adr/${basename(old)}`;
    const replacement = "docs/adr/0030-mapped-translation.md";
    entry.polishOriginal = basename(old);
    entry.slug = "mapped-translation";
    writeFileSync(resolve(root, archive), source);
    writeFileSync(resolve(root, "docs/adr/slug-map.json"), JSON.stringify(map));
    renameSync(resolve(root, old), resolve(root, replacement));
    const changed = translated(source, archive)
      .replace("status: accepted", "status: proposed")
      .replace("State what we decided", "Change the decision");
    writeFileSync(resolve(root, replacement), changed);
    // Commit the attack too: path-specific history must not reset at its first commit.
    git(["add", "."]);
    git(["commit", "--quiet", "-m", "docs: archive and rename decision"]);
    const result = cli();
    expect(result.error).toBeUndefined();
    expect(result.status, result.stderr).toBe(1);
    expect(result.stderr).toMatch(/identity|identities|lifecycle/u);
    writeFileSync(
      resolve(root, replacement),
      changed.replace("status: proposed", "status: accepted"),
    );
    const bodyEdit = cli();
    expect(bodyEdit.status, bodyEdit.stderr).toBe(1);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}, 20000);

test("mapped accepted translation preserves history and still needs adr-edit for its body", () => {
  const { root, git, map, cli } = fixture(true);
  try {
    const entry = map.originals[1];
    if (!entry?.polishOriginal) {
      throw new Error("Missing translation fixture");
    }
    const old = `docs/adr/${entry.polishOriginal}`;
    const source = readFileSync(resolve(root, old), "utf8");
    const archive = `docs/pl/adr/${entry.polishOriginal}`;
    const replacement = `docs/adr/0002-${entry.slug}.md`;
    writeFileSync(resolve(root, archive), source);
    renameSync(resolve(root, old), resolve(root, replacement));
    const record = parseAdr(basename(old), source);
    writeFileSync(
      resolve(root, replacement),
      translated(
        source,
        archive,
        record.body.replace("State what we decided", "Translate the decision"),
      ),
    );
    expect(() => {
      checkRepository(root, nodeGit(root), []);
    }).toThrow("adr-edit");
    expect(() => {
      checkRepository(root, nodeGit(root), ["adr-edit"]);
    }).not.toThrow();
    const result = cli();
    expect(result.status, result.stderr).toBe(1);
    expect(result.stderr).toContain("adr-edit");
    git(["add", "."]);
    git(["commit", "--quiet", "-m", "docs: translate accepted decision"]);
    expect(() => {
      checkRepository(root, nodeGit(root), ["adr-edit"]);
    }).not.toThrow();
    writeFileSync(
      resolve(root, replacement),
      readFileSync(resolve(root, replacement), "utf8").replace(
        "status: accepted",
        "status: proposed",
      ),
    );
    expect(() => {
      checkRepository(root, nodeGit(root), ["adr-edit"]);
    }).toThrow("lifecycle");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}, 20000);
