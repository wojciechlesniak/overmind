import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { expect, it, vi } from "vitest";
import { isolatedGitEnvironment } from "../hooks/git-test-environment.ts";
import { checkRustInventory } from "./rust-inventory.ts";

function fixture(run: (root: string, git: (args: string[]) => void) => void) {
  const root = mkdtempSync(resolve(tmpdir(), "ove010-cargo-inventory-"));
  const git = (args: string[]) => {
    execFileSync("git", args, { cwd: root, env: isolatedGitEnvironment(), stdio: "ignore" });
  };
  try {
    for (const key of Object.keys(process.env).filter((name) => name.startsWith("GIT_"))) {
      vi.stubEnv(key, undefined);
    }
    git(["init"]);
    for (const file of ["Cargo.toml", "Cargo.lock"]) {
      const path = resolve(root, "apps/desktop/src-tauri", file);
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, "fixture");
    }
    run(root, git);
  } finally {
    vi.unstubAllEnvs();
    rmSync(root, { recursive: true, force: true });
  }
}

it("accepts the sole checked desktop graph and ignores build caches", () => {
  fixture((root) => {
    writeFileSync(resolve(root, ".gitignore"), "cache/\n");
    mkdirSync(resolve(root, "cache"));
    writeFileSync(resolve(root, "cache/Cargo.toml"), "ignored dependency cache");
    expect(() => {
      checkRustInventory(root);
    }).not.toThrow();
  });
});

it("rejects additional root/nested and case-variant Cargo graphs", () => {
  for (const file of ["Cargo.toml", "Cargo.lock", "other/Cargo.toml", "other/cargo.LOCK"]) {
    fixture((root) => {
      const path = resolve(root, file);
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, "unapproved graph");
      expect(() => {
        checkRustInventory(root);
      }).toThrow(/outside/u);
    });
  }
});

it("rejects tracked Cargo graphs even when an ignore rule hides the directory", () => {
  fixture((root, git) => {
    mkdirSync(resolve(root, "other"));
    writeFileSync(resolve(root, "other/Cargo.lock"), "unapproved version");
    git(["add", "other/Cargo.lock"]);
    writeFileSync(resolve(root, ".gitignore"), "other/\n");
    expect(() => {
      checkRustInventory(root);
    }).toThrow(/outside/u);
  });
});
