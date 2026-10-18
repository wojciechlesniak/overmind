import { execFileSync, spawnSync } from "node:child_process";
import {
  copyFileSync,
  readFileSync,
  mkdirSync,
  mkdtempSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { expect, test } from "vitest";
import { isolatedGitEnvironment } from "../hooks/git-test-environment.ts";
import { parseSlugMap } from "./input.parse-boundary.ts";
import { checkRepository, generateIndex } from "./repository.ts";
import { nodeGit } from "./ports.ts";

const sourceRoot = resolve(import.meta.dirname, "../..");
function text(status = "accepted", successor = false) {
  return `---\nadr: 1\ntitle: Keep one Chief\nstatus: ${status}\ndate: 2026-10-13\ndeciders: [Owner]\nsupersedes: []\nsuperseded_by: ${successor ? "[2]" : "[]"}\ntags: [process]\n---\n# Keep one Chief\n\nKeep one Chief because it has one clear responsibility.\n\n## Consequences\n\n- Keep context coherent.\n`;
}

test("real Git history rejects deletion, accepted edits and a reverted superseded rewrite", () => {
  const root = realpathSync(mkdtempSync(resolve(tmpdir(), "ove-adr-history-")));
  const env = isolatedGitEnvironment();
  const git = (args: string[]) => execFileSync("git", args, { cwd: root, env, encoding: "utf8" });
  const file = "docs/adr/0001-single-chief-as-sole-interlocutor.md";
  try {
    mkdirSync(resolve(root, "docs/adr"), { recursive: true });
    mkdirSync(resolve(root, "tasks"));
    copyFileSync(
      resolve(sourceRoot, "docs/adr/slug-map.json"),
      resolve(root, "docs/adr/slug-map.json"),
    );
    writeFileSync(resolve(root, file), text());
    writeFileSync(
      resolve(root, "docs/adr/README.md"),
      "# Decisions\n\n<!-- adr-index:start -->\n<!-- adr-index:end -->\n",
    );
    git(["init", "--quiet"]);
    git(["config", "user.name", "ADR fixture"]);
    git(["config", "user.email", "adr@example.invalid"]);
    const secondPath = "docs/adr/0002-workflow-as-executable-program.md";
    const secondText = text()
      .replace("adr: 1", "adr: 2")
      .replaceAll("Keep one Chief", "Choose executable workflows");
    writeFileSync(resolve(root, secondPath), secondText);
    git(["add", "."]);
    git(["commit", "--quiet", "-m", "docs: initial decision"]);
    git(["update-ref", "refs/remotes/origin/DEVELOP", "HEAD"]);
    expect(() => {
      checkRepository(root, nodeGit(root), []);
    }).not.toThrow();
    expect(() => {
      generateIndex(root, true);
    }).toThrow("stale");
    generateIndex(root, false);
    expect(() => {
      generateIndex(root, true);
    }).not.toThrow();
    writeFileSync(resolve(root, "docs/notes.md"), "ADR 9999 is missing.\n");
    expect(() => {
      checkRepository(root, nodeGit(root), []);
    }).toThrow("Unknown ADR reference");
    const cli = spawnSync(
      process.execPath,
      ["--import", import.meta.resolve("tsx"), resolve(sourceRoot, "tools/adr/check.ts")],
      {
        cwd: root,
        env: { ...env, GITHUB_EVENT_PATH: "" },
        encoding: "utf8",
        timeout: 3000,
      },
    );
    expect(cli.error).toBeUndefined();
    expect(cli.status).toBe(1);
    expect(cli.stderr).toContain("Unknown ADR reference");

    rmSync(resolve(root, "docs/notes.md"));
    const mapSource = readFileSync(resolve(root, "docs/adr/slug-map.json"), "utf8");
    const changed = parseSlugMap(mapSource);
    if (!changed.originals[0]) {
      throw new Error("Missing original fixture");
    }
    changed.originals[0].polishOriginal = "0001-different-source.md";
    writeFileSync(resolve(root, "docs/adr/slug-map.json"), JSON.stringify(changed));
    expect(() => {
      checkRepository(root, nodeGit(root), []);
    }).toThrow("original 28 ADR identities are immutable");
    writeFileSync(resolve(root, "docs/adr/slug-map.json"), mapSource);
    writeFileSync(
      resolve(root, file),
      text().replace("one clear responsibility", "one revised responsibility"),
    );
    expect(() => {
      checkRepository(root, nodeGit(root), []);
    }).toThrow("adr-edit");
    expect(() => {
      checkRepository(root, nodeGit(root), ["adr-edit"]);
    }).not.toThrow();
    writeFileSync(resolve(root, file), text());
    rmSync(resolve(root, secondPath));
    expect(() => {
      checkRepository(root, nodeGit(root), ["adr-edit"]);
    }).toThrow("Deleting an ADR");
    writeFileSync(resolve(root, secondPath), secondText);
    writeFileSync(resolve(root, file), text("superseded", true));
    const next = text()
      .replace("adr: 1", "adr: 2")
      .replaceAll("Keep one Chief", "Choose executable workflows")
      .replace("supersedes: []", "supersedes: [1]");
    writeFileSync(resolve(root, "docs/adr/0002-workflow-as-executable-program.md"), next);
    git(["add", "."]);
    git(["commit", "--quiet", "-m", "docs: supersede first decision"]);
    writeFileSync(
      resolve(root, file),
      text("superseded", true).replace("clear responsibility", "rewritten responsibility"),
    );
    git(["add", "."]);
    git(["commit", "--quiet", "-m", "docs: rewrite superseded body"]);
    writeFileSync(resolve(root, file), text("superseded", true));
    git(["add", "."]);
    git(["commit", "--quiet", "-m", "docs: revert body rewrite"]);
    expect(() => {
      checkRepository(root, nodeGit(root), ["adr-edit"]);
    }).toThrow("immutable");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}, 15000);
