import { execFileSync, spawnSync } from "node:child_process";
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { relative, resolve } from "node:path";
import { expect } from "vitest";
import { isolatedGitEnvironment } from "../hooks/git-test-environment.ts";
import { parseSlugMap, renderAdr } from "./input.parse-boundary.ts";

const sourceRoot = resolve(import.meta.dirname, "../..");
export function fixture(includePublished31 = false, publishedPolishOriginal2 = false) {
  const parent = realpathSync(mkdtempSync(resolve(tmpdir(), "ove-adr-public-")));
  const root = resolve(parent, "work");
  const remote = resolve(parent, "origin.git");
  const env = {
    ...isolatedGitEnvironment(),
    HOME: resolve(parent, "home"),
    XDG_CONFIG_HOME: resolve(parent, "xdg"),
    GITHUB_EVENT_PATH: undefined,
  };
  try {
    for (const path of [
      root,
      env.HOME,
      env.XDG_CONFIG_HOME,
      resolve(root, "docs/adr"),
      resolve(root, "tasks"),
    ]) {
      mkdirSync(path, { recursive: true });
    }
    const git = (args: string[], cwd = root) =>
      execFileSync("git", args, { cwd, env, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    git(["init", "--bare", "--quiet", remote], parent);
    git(["init", "--quiet", "-b", "DEVELOP"]);
    git(["config", "user.name", "ADR fixture"]);
    git(["config", "user.email", "adr@example.invalid"]);
    const map = parseSlugMap(readFileSync(resolve(sourceRoot, "docs/adr/slug-map.json"), "utf8"));
    if (includePublished31) {
      map.additional.push({
        adr: 31,
        slug: "published-decision",
        polishOriginal: null,
        title: "Keep the published decision",
      });
    }
    for (const entry of [...map.originals, ...map.additional]) {
      const name =
        publishedPolishOriginal2 && entry.adr === 2
          ? entry.polishOriginal
          : `${String(entry.adr).padStart(4, "0")}-${entry.slug}.md`;
      if (!name) {
        throw new Error("Missing published original fixture filename");
      }
      writeFileSync(
        resolve(root, "docs/adr", name),
        renderAdr(
          {
            adr: entry.adr,
            title: entry.title,
            status: entry.adr === 1 ? "superseded" : "accepted",
            date: "2026-10-13",
            deciders: ["Owner"],
            tags: [],
            supersedes: entry.adr === 23 ? [1] : [],
            superseded_by: entry.adr === 1 ? [23] : [],
          },
          `# ${entry.title}\n\nKeep the documented decision.\n\n## Consequences\n\n- Preserve its meaning.\n`,
        ),
      );
    }
    writeFileSync(resolve(root, "docs/adr/slug-map.json"), JSON.stringify(map, null, 2) + "\n");
    copyFileSync(
      resolve(sourceRoot, "docs/adr/_template.md"),
      resolve(root, "docs/adr/_template.md"),
    );
    writeFileSync(
      resolve(root, "docs/adr/README.md"),
      "# Decisions\n\n<!-- adr-index:start -->\n<!-- adr-index:end -->\n",
    );
    git(["add", "."]);
    git(["commit", "--quiet", "-m", "docs: establish conforming decisions"]);
    git(["remote", "add", "origin", remote]);
    git(["push", "--quiet", "-u", "origin", "DEVELOP"]);
    const cli = (entry: string, args: string[] = []) => {
      const result = spawnSync(
        process.execPath,
        ["--import", import.meta.resolve("tsx"), resolve(sourceRoot, "tools/adr", entry), ...args],
        {
          cwd: root,
          env,
          encoding: "utf8",
          timeout: 3000,
          maxBuffer: 64 * 1024,
        },
      );
      expect(result.error).toBeUndefined();
      return result;
    };
    return { parent, root, remote, git, cli };
  } catch (error) {
    rmSync(parent, { recursive: true, force: true });
    throw error;
  }
}
export function snapshot(root: string): Record<string, string> {
  const files: Record<string, string> = {};
  function visit(path: string) {
    for (const entry of readdirSync(path, { withFileTypes: true })) {
      if (entry.name === ".git") {
        continue;
      }
      const child = resolve(path, entry.name);
      if (entry.isDirectory()) {
        visit(child);
      } else {
        files[relative(root, child)] = readFileSync(child).toString("hex");
      }
    }
  }
  visit(root);
  return files;
}
