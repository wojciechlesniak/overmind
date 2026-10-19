// SPDX-License-Identifier: Apache-2.0
import {
  existsSync,
  linkSync,
  mkdtempSync,
  mkdirSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { afterEach, expect, it } from "vitest";
import { readProtocol } from "./protocol.parse-boundary.ts";

const roots: string[] = [];
function fixture(files: Readonly<Record<string, string | Buffer>>): string {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "overmind-protocol-")));
  roots.push(root);
  for (const [path, source] of Object.entries(files)) {
    const target = join(root, "packages/contracts/src", path);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, source);
  }
  return root;
}
afterEach(() => {
  for (const root of roots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

it("reads the exported numeric literal without evaluating source", () => {
  const root = fixture({ "index.ts": "export const PROTOCOL_VERSION = 7;" });
  expect(readProtocol(root)).toBe(7);
});

it("follows star and named aliases to a wrapped local const in throwing source", () => {
  const root = fixture({
    "index.ts": 'export * from "./barrel.js";',
    "barrel.ts": 'export { version as PROTOCOL_VERSION } from "./version.ts";',
    "version.ts":
      'throw new Error("Source must remain data"); const local = ((19 as const) satisfies number); export { local as version };',
  });
  expect(readProtocol(root)).toBe(19);
});

it("preserves protocol one only when the contracts entry is genuinely absent", () => {
  expect(readProtocol(fixture({}))).toBe(1);
});

it.each([
  ["local alias", "const version = 11; export { version as PROTOCOL_VERSION };", 11],
  [
    "parentheses and assertions",
    "export const PROTOCOL_VERSION = ((0x20 as const) satisfies number);",
    32,
  ],
  ["safe integer maximum", "export const PROTOCOL_VERSION = 9007199254740991;", 9007199254740991],
  ["numeric separators", "export const PROTOCOL_VERSION = 1_024;", 1024],
])("reads %s", (_label, source, expected) => {
  expect(readProtocol(fixture({ "index.ts": source }))).toBe(expected);
});

it("follows an imported named alias without executing its module", () => {
  const root = fixture({
    "index.ts":
      'import { version as local } from "./nested/bridge.js"; export { local as PROTOCOL_VERSION };',
    "nested/bridge.ts": 'export { version } from "../version.js";',
    "version.ts": 'export const version = 41; throw new Error("Never execute");',
  });
  expect(readProtocol(root)).toBe(41);
});

it("deduplicates two export paths to the same declaration", () => {
  const root = fixture({
    "index.ts": 'export * from "./left.ts"; export * from "./right.ts";',
    "left.ts": 'export { version as PROTOCOL_VERSION } from "./version.ts";',
    "right.ts": 'export { version as PROTOCOL_VERSION } from "./version.ts";',
    "version.ts": "const version = 29; export { version };",
  });
  expect(readProtocol(root)).toBe(29);
});

it("validates the graph before accepting genuine export absence", () => {
  const root = fixture({
    "index.ts": 'export * from "./other.ts";',
    "other.ts": "throw new Error('Never execute'); export const other = 3;",
  });
  expect(readProtocol(root)).toBe(1);
  writeFileSync(join(root, "packages/contracts/src/other.ts"), "export const other = ;");
  expect(() => readProtocol(root)).toThrow(/^Invalid contracts protocol version$/u);
});

it.each([
  ["mutable let", "export let PROTOCOL_VERSION = 2;"],
  ["mutable var", "export var PROTOCOL_VERSION = 2;"],
  ["ambient constant", "export declare const PROTOCOL_VERSION: number;"],
  ["computed number", "export const PROTOCOL_VERSION = 1 + 1;"],
  ["call expression", "export const PROTOCOL_VERSION = Number(2);"],
  ["identifier initializer", "const version = 2; export const PROTOCOL_VERSION = version;"],
  ["zero", "export const PROTOCOL_VERSION = 0;"],
  ["negative", "export const PROTOCOL_VERSION = -2;"],
  ["fractional", "export const PROTOCOL_VERSION = 2.5;"],
  ["unsafe integer", "export const PROTOCOL_VERSION = 9007199254740992;"],
  ["infinity", "export const PROTOCOL_VERSION = 1e999;"],
  ["bigint", "export const PROTOCOL_VERSION = 2n;"],
  ["text", 'export const PROTOCOL_VERSION = "2";'],
  ["non-null assertion", "export const PROTOCOL_VERSION = 2!;"],
  ["malformed syntax", "export const PROTOCOL_VERSION = ;"],
  ["duplicate binding", "export const PROTOCOL_VERSION = 2; const PROTOCOL_VERSION = 2;"],
  [
    "duplicate export",
    "const value = 2; export { value as PROTOCOL_VERSION }; export { value as PROTOCOL_VERSION };",
  ],
  ["function", "export function PROTOCOL_VERSION() { return 2; }"],
  ["class", "export class PROTOCOL_VERSION {}"],
  ["destructuring", "export const { PROTOCOL_VERSION } = { PROTOCOL_VERSION: 2 };"],
  ["unresolved local alias", "export { missing as PROTOCOL_VERSION };"],
  ["unresolved relative source", 'export { version as PROTOCOL_VERSION } from "./missing.ts";'],
  ["nonrelative source", 'export { version as PROTOCOL_VERSION } from "outside";'],
  ["self cycle", 'export * from "./index.ts";'],
])("denies %s with the fixed diagnostic", (_label, source) => {
  const root = fixture({ "index.ts": source });
  expect(() => readProtocol(root)).toThrow(/^Invalid contracts protocol version$/u);
});

it("rejects competing origins even when their literal values agree", () => {
  const root = fixture({
    "index.ts": 'export * from "./left.ts"; export * from "./right.ts";',
    "left.ts": "export const PROTOCOL_VERSION = 5;",
    "right.ts": "export const PROTOCOL_VERSION = 5;",
  });
  expect(() => readProtocol(root)).toThrow(/^Invalid contracts protocol version$/u);
});

it("rejects cycles reached through imported aliases", () => {
  const root = fixture({
    "index.ts": 'import { value } from "./other.ts"; export { value as PROTOCOL_VERSION };',
    "other.ts": 'export { PROTOCOL_VERSION as value } from "./index.ts";',
  });
  expect(() => readProtocol(root)).toThrow(/^Invalid contracts protocol version$/u);
});

it("rejects an unresolved named export and an absent intermediate source", () => {
  const root = fixture({
    "index.ts": 'export { missing as PROTOCOL_VERSION } from "./other.ts";',
    "other.ts": "export const other = 7;",
  });
  expect(() => readProtocol(root)).toThrow(/^Invalid contracts protocol version$/u);
  writeFileSync(join(root, "packages/contracts/src/other.ts"), 'export * from "./absent.ts";');
  expect(() => readProtocol(root)).toThrow(/^Invalid contracts protocol version$/u);
});

it.each([
  "entry symlink",
  "ancestor symlink",
  "hardlink",
  "directory",
  "UTF8",
  "oversized",
  "escape",
  "hidden symlink",
])("denies unsafe %s input", (kind) => {
  const root = fixture({ "index.ts": "export const PROTOCOL_VERSION = 23;" });
  const src = join(root, "packages/contracts/src");
  const entry = join(src, "index.ts");
  const outside = join(root, "outside.ts");
  writeFileSync(outside, "export const PROTOCOL_VERSION = 99;");
  if (kind === "entry symlink" || kind === "hardlink" || kind === "directory") {
    rmSync(entry);
    if (kind === "entry symlink") {
      symlinkSync(outside, entry);
    } else if (kind === "hardlink") {
      linkSync(outside, entry);
    } else {
      mkdirSync(entry);
    }
  } else if (kind === "ancestor symlink") {
    rmSync(src, { recursive: true });
    symlinkSync(join(root, "missing"), src);
  } else if (kind === "UTF8") {
    writeFileSync(entry, Buffer.from([0xff]));
  } else if (kind === "oversized") {
    writeFileSync(entry, " ".repeat(256 * 1024 + 1));
  } else if (kind === "escape") {
    writeFileSync(entry, 'export * from "../../../outside.ts";');
  } else {
    symlinkSync(root, join(src, "nested"));
    writeFileSync(entry, 'export * from "./nested/../outside.ts";');
  }
  expect(() => readProtocol(root)).toThrow(/^Invalid contracts protocol version$/u);
});

it("accepts a source at the byte limit and observes a changed source on the next call", () => {
  const prefix = "export const PROTOCOL_VERSION = 31;";
  const root = fixture({ "index.ts": prefix + " ".repeat(256 * 1024 - prefix.length) });
  expect(readProtocol(root)).toBe(31);
  writeFileSync(
    join(root, "packages/contracts/src/index.ts"),
    "export const PROTOCOL_VERSION = 37;",
  );
  expect(readProtocol(root)).toBe(37);
});

function chain(count: number): Record<string, string> {
  const files: Record<string, string> = {};
  for (let index = 0; index < count; index += 1) {
    files[index === 0 ? "index.ts" : `m${String(index)}.ts`] =
      index === count - 1
        ? "export const PROTOCOL_VERSION = 73;"
        : `export * from "./m${String(index + 1)}.ts";`;
  }
  return files;
}
it("admits exactly 128 source files and denies a 129th", () => {
  expect(readProtocol(fixture(chain(128)))).toBe(73);
  expect(() => readProtocol(fixture(chain(129)))).toThrow(/^Invalid contracts protocol version$/u);
});

it("does not execute side effects in an otherwise valid contracts file", () => {
  const root = fixture({ "index.ts": "" });
  const marker = join(root, "executed-marker");
  writeFileSync(
    join(root, "packages/contracts/src/index.ts"),
    `import { writeFileSync } from "node:fs"; writeFileSync(${JSON.stringify(marker)}, "executed"); throw new Error("Never execute"); export const PROTOCOL_VERSION = 43;`,
  );
  expect(readProtocol(root)).toBe(43);
  expect(existsSync(marker)).toBe(false);
});

it("preserves the actual current contracts export-absence fallback", () => {
  expect(readProtocol(resolve(import.meta.dirname, "../../.."))).toBe(1);
});

it("rejects an exported namespace rather than manufacturing export absence", () => {
  const root = fixture({
    "index.ts": "export namespace PROTOCOL_VERSION { export const value = 2; }",
  });
  expect(() => readProtocol(root)).toThrow(/^Invalid contracts protocol version$/u);
});

it("validates referenced type-only source before an export-absence fallback", () => {
  const root = fixture({ "index.ts": 'export type { Shape } from "./shape.ts";' });
  expect(() => readProtocol(root)).toThrow(/^Invalid contracts protocol version$/u);
  const target = join(root, "packages/contracts/src/shape.ts");
  writeFileSync(target, "export interface Shape { value: number }");
  expect(readProtocol(root)).toBe(1);
  writeFileSync(target, "export interface Shape {");
  expect(() => readProtocol(root)).toThrow(/^Invalid contracts protocol version$/u);
});

it("rejects colliding local and imported protocol bindings", () => {
  for (const source of [
    'const local = 2; import { version as local } from "./value.ts"; export { local as PROTOCOL_VERSION };',
    'import { version as local, other as local } from "./value.ts"; export { local as PROTOCOL_VERSION };',
    'import { version as local } from "./value.ts"; const local = 2; export { local as PROTOCOL_VERSION };',
  ]) {
    const root = fixture({
      "index.ts": source,
      "value.ts": "export const version = 4; export const other = 8;",
    });
    expect(() => readProtocol(root)).toThrow(/^Invalid contracts protocol version$/u);
  }
});
