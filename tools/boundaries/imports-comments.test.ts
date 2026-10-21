// SPDX-License-Identifier: Apache-2.0
import ts from "typescript";
import { expect, it } from "vitest";
import { importsOf } from "./ts-imports.ts";
import { suppressionPositions } from "./ts-comments.ts";

const source = (text: string) =>
  ts.createSourceFile("sample.generated.ts", text, ts.ScriptTarget.Latest, true);
it("retains literal and unverifiable dynamic import calls at their exact AST sites", () => {
  const text = 'import("node:fs"); import(target);';
  expect(
    importsOf(source(text)).map(({ node, specifier }) => [
      node.getText(),
      node.getStart(),
      specifier,
    ]),
  ).toEqual([
    ['import("node:fs")', 0, "node:fs"],
    ["import(target)", 19, undefined],
  ]);
});

it.each([
  ['import "side";', "side", ts.SyntaxKind.ImportDeclaration],
  ['import value from "default";', "default", ts.SyntaxKind.ImportDeclaration],
  ['import type { X } from "types";', "types", ts.SyntaxKind.ImportDeclaration],
  ['export * from "star";', "star", ts.SyntaxKind.ExportDeclaration],
  ['export type { X } from "types";', "types", ts.SyntaxKind.ExportDeclaration],
  ['import legacy = require("legacy");', "legacy", ts.SyntaxKind.ImportEqualsDeclaration],
  ['type T = typeof import("query");', "query", ts.SyntaxKind.ImportType],
  ['require("required")', "required", ts.SyntaxKind.CallExpression],
  ["require(target)", undefined, ts.SyntaxKind.CallExpression],
  ["require()", undefined, ts.SyntaxKind.CallExpression],
  ["import(`literal`)", "literal", ts.SyntaxKind.CallExpression],
  ["import(`prefix${target}`)", undefined, ts.SyntaxKind.CallExpression],
] as const)("enumerates the real import family %s", (text, specifier, kind) => {
  const references = importsOf(source(text));
  expect(references).toHaveLength(1);
  expect(references[0]?.specifier).toBe(specifier);
  expect(references[0]?.node.kind).toBe(kind);
  expect(references[0]?.node.getStart()).toBe(text.startsWith("type T") ? 9 : 0);
});
it("ignores ordinary source strings and local exports without executing generated modules", () => {
  expect(
    importsOf(
      source(
        'const note = "require(target)"; export { note }; throw new Error("must not execute");',
      ),
    ),
  ).toEqual([]);
});

it.each([
  ["// eslint-disable-next-line", [0]],
  ["/* eslint-disable boundaries/no-disable */", [0]],
  ["x(); // eslint-disable-line boundaries/no-deep-imports", [5]],
  ['/* eslint "boundaries/allowed-imports": "off" */', [0]],
  ["/* eslint-disable other/rule -- boundaries/no-disable is unrelated prose */", []],
  ['const text = "// eslint-disable boundaries/no-disable";', []],
  ["const text = `/* eslint-disable */`;", []],
  ["const pattern = /eslint-disable/;", []],
  ["/* ```ts\n// eslint-disable boundaries/no-disable\n``` */", []],
] as const)("finds only real policy suppression directives: %s", (text, offsets) => {
  expect(suppressionPositions(source(text))).toEqual(offsets);
});
it("handles comments in template expression islands and trailing EOF exactly once", () => {
  const text = "const t = `${ /* eslint-disable */ 1}`;\n// eslint-disable";
  expect(suppressionPositions(source(text))).toEqual([14, 40]);
});
it.each([
  ["<div>\n// eslint-disable\n</div>", []],
  ["<div>\n/* eslint-disable */\n</div>", []],
  ["<div>{ /* eslint-disable */ 1 }</div>", [7]],
] as const)("separates JSX text from real expression comments: %s", (text, expected) => {
  const file = ts.createSourceFile(
    "sample.generated.tsx",
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  expect(suppressionPositions(file)).toEqual(expected);
});

it.each([
  ["<div>/* eslint-disable */</div>", []],
  ["<><span />/* eslint-disable */</>", []],
  ["<div>{1}/* eslint-disable */</div>", []],
  ["<div>{/* eslint-disable */}</div>", [6]],
] as const)("preserves JSX text boundaries and empty expression comments: %s", (text, expected) => {
  const file = ts.createSourceFile(
    "sample.generated.tsx",
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  expect(suppressionPositions(file)).toEqual(expected);
});

it("ignores boundary names inside unrelated inline rule options", () => {
  const text = '/* eslint "other/rule": ["error", {"message": "boundaries/no-disable"}] */';
  expect(suppressionPositions(source(text))).toEqual([]);
});

it("ignores inline rule descriptions containing boundary configuration examples", () => {
  const text = '/* eslint "other/rule": 0 -- Example, boundaries/no-disable: off */';
  expect(suppressionPositions(source(text))).toEqual([]);
});

it.each([
  [String.raw`/* eslint "\u0062oundaries/no-disable": 0 */`, [0]],
  [String.raw`/* eslint "boundaries\/no-disable": 0 */`, [0]],
  ["/* eslint boundaries/no-disable: 0 */", [0]],
  ['/* eslint "other/rule": ["error", {"message": " -- "}], "boundaries/no-disable": 0 */', [0]],
  ['/* eslint "other/rule": ["error", {"boundaries/no-disable": 0}] */', []],
  ['/* eslint "other/rule": 0 ---- Example, boundaries/no-disable: off */', []],
  ['"🧭";\n// eslint-disable boundaries/no-disable', [6]],
] as const)(
  "keeps escaped inline rule names and genuine offsets distinct from option text: %s",
  (text, expected) => {
    expect(suppressionPositions(source(text))).toEqual(expected);
  },
);

it("retains the original SourceFile node identities for static imports and reexports", () => {
  const file = source('import "input"; export * from "output";');
  const references = importsOf(file);
  expect(references).toHaveLength(2);
  expect(references[0]?.node).toBe(file.statements[0]);
  expect(references[1]?.node).toBe(file.statements[1]);
});

it.each([
  ['/* eslint-disable "" */', [0]],
  ["/* eslint-disable , , */", [0]],
  ["// eslint-disable-next-line \"\" , ''", [0]],
  ['/* eslint-disable "plain boundaries/no-disable" */', []],
  ["/* eslint-disable other/rule --- boundaries/no-disable is prose */", []],
] as const)(
  "normalizes actual disable-list rule identities before classifying directives: %s",
  (text, expected) => {
    expect(suppressionPositions(source(text))).toEqual(expected);
  },
);

it("detects a boundary setting after a comma-less inline rule", () => {
  const text = '/* eslint no-alert: 0 "boundaries/no-disable": 0 */';
  expect(suppressionPositions(source(text))).toEqual([0]);
});
