import { execFileSync } from "node:child_process";
import {
  copyFileSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { expect, it } from "vitest";
import { generateSBOM } from "./generate.ts";
import { readSBOM } from "./input.parse-boundary.ts";
import { validateSBOM } from "./validate.ts";
import { isolatedGitEnvironment } from "../hooks/git-test-environment.ts";

it("real Syft catalogs only lockfiles, ignores forged installed packages and validates documented license gaps", async () => {
  const root = resolve(import.meta.dirname, "../..");
  const fixture = mkdtempSync(resolve(tmpdir(), "overmind-sbom-int-"));
  const env = isolatedGitEnvironment();
  const git = (args: string[]) => execFileSync("git", args, { cwd: fixture, env });
  try {
    git(["init", "--quiet"]);
    git(["config", "user.name", "Fixture"]);
    git(["config", "user.email", "fixture@example.invalid"]);
    git(["config", "core.hooksPath", "/dev/null"]);
    git(["commit", "--allow-empty", "--quiet", "-m", "chore: fixture"]);
    copyFileSync(resolve(root, "pnpm-lock.yaml"), resolve(fixture, "pnpm-lock.yaml"));
    git(["add", "pnpm-lock.yaml"]);
    git(["commit", "--quiet", "-m", "chore: lockfile fixture"]);
    mkdirSync(resolve(fixture, "node_modules/forged"), { recursive: true });
    writeFileSync(
      resolve(fixture, "node_modules/forged/package.json"),
      '{"name":"forged-component","version":"9.9.9"}\n',
    );
    writeFileSync(resolve(fixture, ".syft.yaml"), "not: valid: syft: config\n");
    const before = readFileSync(resolve(fixture, "pnpm-lock.yaml"), "utf8");
    const output = await generateSBOM(fixture, { gitEnv: env });
    const document = validateSBOM(readSBOM(output));
    expect(document.components.some((item) => item.name === "react")).toBe(true);
    expect(document.components.some((item) => item.name === "zod")).toBe(true);
    expect(document.components.some((item) => item.name === "forged-component")).toBe(false);
    expect(readFileSync(resolve(fixture, "pnpm-lock.yaml"), "utf8")).toBe(before);
    git(["update-index", "--assume-unchanged", "pnpm-lock.yaml"]);
    writeFileSync(
      resolve(fixture, "pnpm-lock.yaml"),
      before + "\n# altered while Git diff ignores it\n",
    );
    await expect(generateSBOM(fixture, { gitEnv: env })).rejects.toThrow("stated commit");
    writeFileSync(resolve(fixture, "pnpm-lock.yaml"), before);
    git(["update-index", "--no-assume-unchanged", "pnpm-lock.yaml"]);
    mkdirSync(resolve(fixture, "apps/desktop/src-tauri"), { recursive: true });
    writeFileSync(
      resolve(fixture, "apps/desktop/src-tauri/Cargo.lock"),
      'version = 4\n\n[[package]]\nname = "tauri"\nversion = "2.0.0"\nsource = "registry+https://github.com/rust-lang/crates.io-index"\nchecksum = "' +
        "0".repeat(64) +
        '"\n',
    );
    git(["add", "apps/desktop/src-tauri/Cargo.lock"]);
    git(["commit", "--quiet", "-m", "chore: Rust lockfile fixture"]);
    const withRust = validateSBOM(readSBOM(await generateSBOM(fixture, { gitEnv: env })), true);
    expect(withRust.components.some((item) => item.purl.startsWith("pkg:cargo/tauri@"))).toBe(true);
    const localLock = resolve(fixture, "apps/desktop/src-tauri/Cargo.lock");
    writeFileSync(
      localLock,
      readFileSync(localLock, "utf8") +
        '\n[[package]]\nname = "overmind-desktop"\nversion = "0.0.0"\ndependencies = [\n "tauri",\n]\n',
    );
    git(["add", "apps/desktop/src-tauri/Cargo.lock"]);
    git(["commit", "--quiet", "-m", "chore: local Rust workspace fixture"]);
    const localHead = execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: fixture,
      env,
      encoding: "utf8",
    }).trim();
    const localDocument = validateSBOM(
      readSBOM(await generateSBOM(fixture, { gitEnv: env })),
      true,
    );
    const desktop = localDocument.components.find((item) => item.name === "overmind-desktop");
    expect(desktop?.purl).toContain(`%40${localHead}#apps/desktop/src-tauri`);
    expect(localDocument.components.some((item) => item.purl.startsWith("pkg:cargo/tauri@"))).toBe(
      true,
    );
    const cargoPath = resolve(fixture, "apps/desktop/src-tauri/Cargo.lock");
    const cargoBytes = readFileSync(cargoPath);
    rmSync(cargoPath);
    await expect(generateSBOM(fixture, { gitEnv: env })).rejects.toThrow();
    writeFileSync(cargoPath, cargoBytes);
    rmSync(resolve(fixture, "pnpm-lock.yaml"));
    symlinkSync(resolve(root, "pnpm-lock.yaml"), resolve(fixture, "pnpm-lock.yaml"));
    git(["add", "pnpm-lock.yaml"]);
    git(["commit", "--quiet", "-m", "chore: invalid symlink fixture"]);
    await expect(generateSBOM(fixture, { gitEnv: env })).rejects.toThrow(/symlinks/u);
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
}, 60000);
