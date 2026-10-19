// SPDX-License-Identifier: Apache-2.0
import { execFileSync } from "node:child_process";
import {
  fstatSync,
  linkSync,
  lstatSync,
  renameSync,
  symlinkSync,
  unlinkSync,
  utimesSync,
  writeFileSync,
} from "node:fs";
import type * as NativeFs from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createWorkspace, type FixtureWorkspace } from "../boundaries-fixtures/workspace.ts";
import { loadCatalog, readSource } from "./policy.parse-boundary.ts";

// Native operations still run. Hooks only schedule a deterministic real filesystem
// race at the open/read boundary; they never provide fabricated file metadata.
const io = vi.hoisted(() => ({
  beforeOpen: undefined as (() => void) | undefined,
  afterRead: undefined as (() => void) | undefined,
  opened: [] as number[],
}));
vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof NativeFs>();
  return {
    ...actual,
    openSync(...args: Parameters<typeof actual.openSync>) {
      io.beforeOpen?.();
      const descriptor = actual.openSync(...args);
      io.opened.push(descriptor);
      return descriptor;
    },
    readSync(...args: unknown[]) {
      const count: unknown = Reflect.apply(actual.readSync, actual, args);
      if (typeof count !== "number") {
        throw new Error("Unexpected native reader result.");
      }
      io.afterRead?.();
      return count;
    },
  };
});
const workspaces: FixtureWorkspace[] = [];
function workspace(): FixtureWorkspace {
  const fixture = createWorkspace();
  workspaces.push(fixture);
  return fixture;
}
beforeEach(() => {
  io.beforeOpen = undefined;
  io.afterRead = undefined;
  io.opened.length = 0;
});
afterEach(() => {
  io.beforeOpen = undefined;
  io.afterRead = undefined;
  for (const descriptor of io.opened) {
    expect(() => fstatSync(descriptor), "every opened input descriptor must close").toThrow();
  }
  for (const fixture of workspaces.splice(0)) {
    fixture.cleanup();
  }
});

describe("confined boundary source reader", () => {
  it("keeps fixture writes isolated even when a test introduces a directory alias", () => {
    const fixture = workspace();
    const outside = workspace();
    const marker = outside.write("marker.ts", "unchanged");
    symlinkSync(outside.root, resolve(fixture.root, "alias"));
    expect(() => fixture.write("../escape.ts", "changed")).toThrow();
    expect(() => fixture.write("alias/marker.ts", "changed")).toThrow();
    expect(readSource(outside.root, marker)).toBe("unchanged");
  });
  it("returns exact UTF-8 source as data without running it", () => {
    const fixture = workspace();
    const source = 'throw new Error("Source must remain data"); // Ω\n';
    const path = fixture.write("packages/contracts/src/input.ts", source);
    expect(readSource(fixture.root, path)).toBe(source);
  });
});

function policy() {
  const empty = {
    allowedImports: [] as string[],
    allowedSubpaths: {} as Record<string, string[]>,
    forbiddenBuiltins: [] as string[],
    forbiddenGlobals: [] as string[],
    forbiddenPackages: [] as string[],
  };
  return {
    version: 1,
    packages: [
      { id: "contracts", path: "packages/contracts", layer: 0, ...empty },
      { ...empty, id: "domain", path: "packages/domain", layer: 1, allowedImports: ["contracts"] },
    ],
    testOnly: [] as string[],
    toolsMayImportAny: false,
  };
}
function writePolicy(fixture: FixtureWorkspace, value: unknown = policy()): string {
  return fixture.write("docs/architecture/boundaries.json", JSON.stringify(value));
}

describe("confined boundary source reader denials", () => {
  it("enforces the default two-MiB limit and an explicit byte limit", () => {
    const fixture = workspace();
    const path = fixture.write("source.ts", "x".repeat(2 * 1024 * 1024));
    expect(readSource(fixture.root, path)).toHaveLength(2 * 1024 * 1024);
    writeFileSync(path, "x".repeat(2 * 1024 * 1024 + 1));
    expect(() => readSource(fixture.root, path)).toThrow("Invalid repository source input.");
    writeFileSync(path, "Ω");
    expect(readSource(fixture.root, path, 2)).toBe("Ω");
    expect(() => readSource(fixture.root, path, 1)).toThrow("Invalid repository source input.");
  });
  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY, 1.5])(
    "denies invalid byte limit %s",
    (limit) => {
      const fixture = workspace();
      const path = fixture.write("source.ts", "x");
      expect(() => readSource(fixture.root, path, limit)).toThrow(
        "Invalid repository source input.",
      );
    },
  );
  it("denies missing, directory and out-of-root inputs", () => {
    const fixture = workspace();
    const outside = workspace();
    const path = outside.write("source.ts", "outside-private-marker");
    for (const target of [resolve(fixture.root, "missing.ts"), fixture.root, path, "source.ts"]) {
      expect(() => readSource(fixture.root, target)).toThrow("Invalid repository source input.");
    }
  });
  it("denies both leaf and ancestor symlinks, including in-root aliases", () => {
    const fixture = workspace();
    const source = fixture.write("real/source.ts", "alias-private-marker");
    const leaf = resolve(fixture.root, "leaf.ts");
    const ancestor = resolve(fixture.root, "alias");
    symlinkSync(source, leaf);
    symlinkSync(resolve(fixture.root, "real"), ancestor);
    for (const target of [
      leaf,
      resolve(ancestor, "source.ts"),
      `${fixture.root}/real/../real/source.ts`,
    ]) {
      expect(() => readSource(fixture.root, target)).toThrow("Invalid repository source input.");
    }
  });
  it("denies hard-linked source aliases", () => {
    const fixture = workspace();
    const source = fixture.write("source.ts", "alias-private-marker");
    const alias = resolve(fixture.root, "alias.ts");
    linkSync(source, alias);
    expect(lstatSync(source).nlink).toBe(2);
    expect(() => readSource(fixture.root, source)).toThrow("Invalid repository source input.");
    expect(() => readSource(fixture.root, alias)).toThrow("Invalid repository source input.");
  });
  it("denies an actual FIFO without waiting for a writer", () => {
    const fixture = workspace();
    const fifo = resolve(fixture.root, "pipe.ts");
    execFileSync("mkfifo", [fifo]);
    expect(lstatSync(fifo).isFIFO()).toBe(true);
    expect(() => readSource(fixture.root, fifo)).toThrow("Invalid repository source input.");
  });
  it.each([Buffer.from([0xc3, 0x28]), Buffer.from([0xf0, 0x9f])])(
    "denies malformed or truncated UTF-8 %s",
    (bytes) => {
      const fixture = workspace();
      const path = fixture.write("source.ts", bytes);
      expect(() => readSource(fixture.root, path)).toThrow("Invalid repository source input.");
    },
  );
  it("retains valid BOM and replacement-character source bytes", () => {
    const fixture = workspace();
    const source = "\uFEFFΩ\uFFFD";
    expect(readSource(fixture.root, fixture.write("source.ts", source))).toBe(source);
  });
  it("denies a real replacement between path admission and descriptor validation", () => {
    const fixture = workspace();
    const path = fixture.write("source.ts", "original");
    const replacement = fixture.write("replacement.ts", "replaced");
    let raced = false;
    io.beforeOpen = () => {
      io.beforeOpen = undefined;
      renameSync(replacement, path);
      raced = true;
    };
    expect(() => readSource(fixture.root, path)).toThrow("Invalid repository source input.");
    expect(raced).toBe(true);
  });
  it("denies a real same-size preserved-mtime mutation while reading", () => {
    const fixture = workspace();
    const path = fixture.write("source.ts", "original");
    utimesSync(path, 1_700_000_000, 1_700_000_000);
    const before = lstatSync(path, { bigint: true });
    let raced = false;
    io.afterRead = () => {
      io.afterRead = undefined;
      writeFileSync(path, "replaced");
      utimesSync(path, 1_700_000_000, 1_700_000_000);
      raced = true;
    };
    expect(() => readSource(fixture.root, path)).toThrow("Invalid repository source input.");
    expect(raced).toBe(true);
    const after = lstatSync(path, { bigint: true });
    expect(after.size).toBe(before.size);
    expect(after.mtimeNs).toBe(before.mtimeNs);
    expect(after.ctimeNs).not.toBe(before.ctimeNs);
  });
  it("denies a real path replacement after descriptor read", () => {
    const fixture = workspace();
    const path = fixture.write("source.ts", "original");
    const replacement = fixture.write("replacement.ts", "replaced");
    let raced = false;
    io.afterRead = () => {
      io.afterRead = undefined;
      renameSync(replacement, path);
      raced = true;
    };
    expect(() => readSource(fixture.root, path)).toThrow("Invalid repository source input.");
    expect(raced).toBe(true);
  });
});

describe("validated boundary policy", () => {
  it("loads canonical version1 data and reuses an unchanged validated catalogue", () => {
    const fixture = workspace();
    writePolicy(fixture);
    const first = loadCatalog(fixture.root);
    expect(first).toEqual(policy());
    expect(loadCatalog(fixture.root)).toBe(first);
    expect(loadCatalog(`${fixture.root}/.`)).toBe(first);
  });
  it("accepts the documented inclusive identity, path, layer and list bounds", () => {
    const fixture = workspace();
    const value = policy();
    const entry = value.packages[0]!;
    entry.id = "a".repeat(128);
    entry.path = "p".repeat(256);
    entry.layer = 4;
    entry.forbiddenGlobals = Array.from({ length: 512 }, (_, index) =>
      index === 0 ? "g".repeat(256) : `global-${String(index)}`,
    );
    value.packages = [entry];
    writePolicy(fixture, value);
    expect(loadCatalog(fixture.root)).toEqual(value);
    value.packages = Array.from({ length: 512 }, (_, index) => ({
      ...entry,
      id: `package-${String(index)}`,
      path: `packages/package-${String(index)}`,
      layer: -1,
      forbiddenGlobals: [],
    }));
    writePolicy(fixture, value);
    expect(loadCatalog(fixture.root).packages).toHaveLength(512);
  });
  it("revalidates a same-size edit with exactly preserved mtime", () => {
    const fixture = workspace();
    const path = writePolicy(fixture);
    utimesSync(path, 1_700_000_000, 1_700_000_000);
    const first = loadCatalog(fixture.root);
    const before = lstatSync(path, { bigint: true });
    const changed = policy();
    changed.packages[1]!.id = "unsafe";
    writePolicy(fixture, changed);
    utimesSync(path, 1_700_000_000, 1_700_000_000);
    const second = loadCatalog(fixture.root);
    expect(second.packages[1]!.id).toBe("unsafe");
    expect(second).not.toBe(first);
    const after = lstatSync(path, { bigint: true });
    expect(after.size).toBe(before.size);
    expect(after.mtimeNs).toBe(before.mtimeNs);
    expect(after.ctimeNs).not.toBe(before.ctimeNs);
  });
  it("never returns a prior success after invalid, missing or restored input", () => {
    const fixture = workspace();
    const path = writePolicy(fixture);
    const first = loadCatalog(fixture.root);
    writeFileSync(path, "{private-source-marker");
    expect(() => loadCatalog(fixture.root)).toThrow("Invalid boundary policy.");
    unlinkSync(path);
    expect(() => loadCatalog(fixture.root)).toThrow("Invalid boundary policy.");
    writePolicy(fixture);
    expect(loadCatalog(fixture.root)).not.toBe(first);
  });
  it("denies a policy symlink and a policy above the 512-KiB limit", () => {
    const fixture = workspace();
    const path = writePolicy(fixture);
    const target = fixture.write("policy.json", JSON.stringify(policy()));
    unlinkSync(path);
    symlinkSync(target, path);
    expect(() => loadCatalog(fixture.root)).toThrow("Invalid boundary policy.");
    unlinkSync(path);
    writeFileSync(path, JSON.stringify(policy()).padEnd(512 * 1024 + 1, " "));
    expect(() => loadCatalog(fixture.root)).toThrow("Invalid boundary policy.");
  });
  it("denies malformed UTF-8 and malformed JSON without exposing source bytes", () => {
    const fixture = workspace();
    const path = writePolicy(fixture);
    for (const bytes of [Buffer.from([0xc3, 0x28]), Buffer.from('{"private-policy-marker":')]) {
      writeFileSync(path, bytes);
      expect(() => loadCatalog(fixture.root)).toThrow(/^Invalid boundary policy\.$/u);
    }
  });
  it.each([
    ["unknown root key", (value: ReturnType<typeof policy>) => ({ ...value, unsafe: true })],
    [
      "unknown package key",
      (value: ReturnType<typeof policy>) => ({
        ...value,
        packages: [{ ...value.packages[0], unsafe: true }],
      }),
    ],
    ["unsupported version", (value: ReturnType<typeof policy>) => ({ ...value, version: 2 })],
    ["empty packages", (value: ReturnType<typeof policy>) => ({ ...value, packages: [] })],
    [
      "duplicate IDs",
      (value: ReturnType<typeof policy>) => ({
        ...value,
        packages: [value.packages[0], { ...value.packages[1], id: "contracts" }],
      }),
    ],
    [
      "duplicate paths",
      (value: ReturnType<typeof policy>) => ({
        ...value,
        packages: [value.packages[0], { ...value.packages[1], path: "packages/contracts" }],
      }),
    ],
    [
      "unknown root import",
      (value: ReturnType<typeof policy>) => ({
        ...value,
        packages: [{ ...value.packages[0], allowedImports: ["missing"] }],
      }),
    ],
    [
      "unknown subpath import",
      (value: ReturnType<typeof policy>) => ({
        ...value,
        packages: [{ ...value.packages[0], allowedSubpaths: { missing: ["ports"] } }],
      }),
    ],
    [
      "unknown test-only ID",
      (value: ReturnType<typeof policy>) => ({ ...value, testOnly: ["missing"] }),
    ],
    [
      "nonboolean Tools flag",
      (value: ReturnType<typeof policy>) => ({ ...value, toolsMayImportAny: "true" }),
    ],
    [
      "uppercase ID",
      (value: ReturnType<typeof policy>) => ({
        ...value,
        packages: [{ ...value.packages[0], id: "Contracts" }],
      }),
    ],
    [
      "oversized ID",
      (value: ReturnType<typeof policy>) => ({
        ...value,
        packages: [{ ...value.packages[0], id: "a".repeat(129) }],
      }),
    ],
    [
      "parent path",
      (value: ReturnType<typeof policy>) => ({
        ...value,
        packages: [{ ...value.packages[0], path: "packages/../private" }],
      }),
    ],
    [
      "empty path segment",
      (value: ReturnType<typeof policy>) => ({
        ...value,
        packages: [{ ...value.packages[0], path: "packages//contracts" }],
      }),
    ],
    [
      "absolute path",
      (value: ReturnType<typeof policy>) => ({
        ...value,
        packages: [{ ...value.packages[0], path: "/packages/contracts" }],
      }),
    ],
    [
      "oversized path",
      (value: ReturnType<typeof policy>) => ({
        ...value,
        packages: [{ ...value.packages[0], path: "a".repeat(257) }],
      }),
    ],
    [
      "invalid layer",
      (value: ReturnType<typeof policy>) => ({
        ...value,
        packages: [{ ...value.packages[0], layer: 5 }],
      }),
    ],
    [
      "noninteger layer",
      (value: ReturnType<typeof policy>) => ({
        ...value,
        packages: [{ ...value.packages[0], layer: 0.5 }],
      }),
    ],
    [
      "empty forbidden string",
      (value: ReturnType<typeof policy>) => ({
        ...value,
        packages: [{ ...value.packages[0], forbiddenGlobals: [""] }],
      }),
    ],
    [
      "oversized forbidden string",
      (value: ReturnType<typeof policy>) => ({
        ...value,
        packages: [{ ...value.packages[0], forbiddenPackages: ["a".repeat(257)] }],
      }),
    ],
    [
      "oversized forbidden list",
      (value: ReturnType<typeof policy>) => ({
        ...value,
        packages: [
          {
            ...value.packages[0],
            forbiddenBuiltins: Array.from(
              { length: 513 },
              (_, index) => `node:item${String(index)}`,
            ),
          },
        ],
      }),
    ],
    [
      "oversized package list",
      (value: ReturnType<typeof policy>) => ({
        ...value,
        packages: Array.from({ length: 513 }, (_, index) => ({
          ...value.packages[0],
          id: `package-${String(index)}`,
          path: `packages/package-${String(index)}`,
        })),
      }),
    ],
  ])("denies %s", (_name, mutate) => {
    const fixture = workspace();
    writePolicy(fixture, mutate(policy()));
    expect(() => loadCatalog(fixture.root)).toThrow(/^Invalid boundary policy\.$/u);
  });
});
