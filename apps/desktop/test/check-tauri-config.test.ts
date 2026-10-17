import { spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
const desktop = resolve(import.meta.dirname, "..");
function probe(change?: (root: string) => void) {
  const root = mkdtempSync(resolve(tmpdir(), "ove-tauri-"));
  try {
    for (const file of ["tauri.conf.json", "capabilities", "src", "Cargo.toml"]) {
      cpSync(resolve(desktop, "src-tauri", file), resolve(root, file), { recursive: true });
    }
    change?.(root);
    return spawnSync(process.execPath, [resolve(desktop, "scripts/check-tauri-config.mjs"), root], {
      encoding: "utf8",
    });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}
function edit(root: string, file: string, from: string, to: string) {
  const path = resolve(root, file);
  const source = readFileSync(path, "utf8");
  expect(source).toContain(from);
  writeFileSync(path, source.replace(from, to));
}
describe("Tauri deny-by-default configuration", () => {
  it("accepts the actual shell configuration", () => {
    expect(probe().status).toBe(0);
  });
  it("rejects removing the macOS icon needed by real app bundling", () => {
    expect(
      probe((root) => {
        edit(root, "tauri.conf.json", '"icons/icon.png", "icons/icon.icns"', '"icons/icon.png"');
      }).status,
    ).not.toBe(0);
  });
  it.each([
    ["capabilities/main.json", '"allow-pick-directory"', '"shell:allow-execute"'],
    ["tauri.conf.json", "script-src 'self';", "script-src 'self' 'unsafe-eval';"],
    ["tauri.conf.json", '"freezePrototype": true', '"freezePrototype": true, "remote": {}'],
    ["tauri.conf.json", '"enable": false', '"enable": true'],
    [
      "tauri.conf.json",
      '"binaries/overmind-engine"',
      '"binaries/overmind-engine", "binaries/other"',
    ],
    ["tauri.conf.json", '"devtools": false', '"devtools": true'],
    ["tauri.conf.json", '"create": false', '"create": true'],
    [
      "tauri.conf.json",
      '"dangerousDisableAssetCspModification": false',
      '"dangerousDisableAssetCspModification": true',
    ],
    ["tauri.conf.json", '"label": "main"', '"label": "remote"'],
    ["tauri.conf.json", '"security": {', '"security": { "dangerousRemoteDomainIpcAccess": [],'],
    ["tauri.conf.json", '"active": true', '"active": true, "updater": {}'],
  ])("rejects unsafe mutation in %s", (file, from, to) => {
    const result = probe((root) => {
      edit(root, file, from, to);
    });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("Tauri policy:");
  });
  it("rejects missing license bundle resources", () => {
    expect(
      probe((root) => {
        edit(root, "tauri.conf.json", '"licenses/rust/"', '"elsewhere/"');
      }).status,
    ).not.toBe(0);
  });
  it.each([
    ['"engine/engine.cjs.map"', '"elsewhere/engine.cjs.map"'],
    ['"engine/LICENSE"', '"elsewhere/LICENSE"'],
    ['"binaries/overmind-engine.resources/LICENSE"', '"binaries/overmind-engine.resources/*"'],
  ])("rejects missing or broadened engine resource mapping %s", (from, to) => {
    expect(
      probe((root) => {
        edit(root, "tauri.conf.json", from, to);
      }).status,
    ).not.toBe(0);
  });
  it("rejects a second capability", () => {
    expect(
      probe((root) => {
        writeFileSync(resolve(root, "capabilities/extra.json"), "{}");
      }).status,
    ).not.toBe(0);
  });
  it("rejects undeclared Rust modules", () => {
    expect(
      probe((root) => {
        writeFileSync(resolve(root, "src/business.rs"), "");
      }).status,
    ).not.toBe(0);
  });
  it("rejects oversized Rust modules", () => {
    expect(
      probe((root) => {
        writeFileSync(resolve(root, "src/engine.rs"), "// line\n".repeat(200));
      }).status,
    ).not.toBe(0);
  });
  it.each([
    "tauri.macos.conf.json",
    "tauri.conf.json5",
    "Tauri.toml",
    "Tauri.macos.toml",
    "TAURI.MACOS.CONF.JSON",
    "TAURI.macos.conf.json",
    "TAURI.MACOS.TOML",
  ])("rejects configuration override %s", (name) => {
    expect(
      probe((root) => {
        writeFileSync(resolve(root, name), '{"app":{"security":{"csp":null}}}');
      }).status,
    ).not.toBe(0);
  });
});
