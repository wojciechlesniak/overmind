// SPDX-License-Identifier: Apache-2.0
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { createWorkspace } from "../boundaries-fixtures/workspace.ts";
import {
  loadCatalog,
  readSource,
  type BoundaryCatalog,
  type BoundaryPackage,
} from "./policy.parse-boundary.ts";

// These are identities, not a duplicate permission matrix. Permissions come
// independently from the actual Markdown cells and the validated JSON data.
const columns = [
  "contracts",
  "domain",
  "application",
  "application/ports",
  "workflow-runtime",
  "gateway",
  "api-client",
  "ui-kit",
  "adapters/*",
  "testing",
];
const rows = [
  "contracts",
  "domain",
  "application",
  "workflow-runtime",
  "gateway",
  "api-client",
  "ui-kit",
  "adapters/* (not telegram)",
  "adapters/telegram",
  "apps/engine",
  "apps/desktop",
  "tests",
  "tools/",
  "testing (package)",
];
const root = resolve(import.meta.dirname, "../..");
const markdown = readSource(root, resolve(root, "docs/architecture/ARCHITECTURE.md"));
const catalog = loadCatalog(root);

function invalid(): never {
  throw new Error("Architecture matrix and catalogue disagree.");
}
function splitRow(line: string): string[] {
  const parts = line.split("|");
  if (parts.shift()?.trim() !== "" || parts.pop()?.trim() !== "") {
    invalid();
  }
  return parts.map((part) => part.trim());
}
function matrixStart(lines: string[]): number {
  const start = lines.findIndex((line) => /^\|\s*importer \/ importee\s*\|/u.test(line));
  if (start < 0) {
    invalid();
  }
  return start;
}
function parseMatrix(source: string): string[][] {
  const lines = source.split("\n");
  const start = matrixStart(lines);
  const table: string[][] = [];
  for (const line of lines.slice(start)) {
    if (!line.startsWith("|")) {
      break;
    }
    table.push(splitRow(line));
  }
  const [header, divider, ...body] = table;
  if (
    header?.length !== columns.length + 1 ||
    header.slice(1).some((cell, index) => cell !== columns[index]) ||
    divider?.length !== header.length ||
    divider.some((cell) => !/^:?-+:?$/u.test(cell)) ||
    body.length !== rows.length
  ) {
    invalid();
  }
  for (const [index, row] of body.entries()) {
    if (
      row.length !== header.length ||
      row[0] !== rows[index] ||
      row.slice(1).some((cell) => !["Y", "N", "-", "ports"].includes(cell))
    ) {
      invalid();
    }
  }
  return body.map((row) => row.slice(1));
}
function packageById(value: BoundaryCatalog, id: string): BoundaryPackage {
  const entry = value.packages.find((candidate) => candidate.id === id);
  if (!entry) {
    invalid();
  }
  return entry;
}
function adapters(value: BoundaryCatalog): BoundaryPackage[] {
  const result = value.packages.filter((entry) => entry.id.startsWith("adapters/"));
  if (!result.length) {
    invalid();
  }
  return result;
}
function sources(value: BoundaryCatalog, row: string): BoundaryPackage[] {
  if (row === "adapters/* (not telegram)") {
    const result = adapters(value).filter((entry) => entry.id !== "adapters/telegram");
    if (!result.length) {
      invalid();
    }
    return result;
  }
  const id = row === "tools/" ? "tools" : row === "testing (package)" ? "testing" : row;
  return [packageById(value, id)];
}
function rootMarker(source: BoundaryPackage, target: BoundaryPackage, column: string): string {
  if (source.id === target.id && column !== "adapters/*") {
    if (source.allowedImports.includes(target.id)) {
      invalid();
    }
    return "-";
  }
  if (source.allowedImports.includes(target.id)) {
    return "Y";
  }
  return target.id === "application" && source.allowedSubpaths["application"]?.includes("ports")
    ? "ports"
    : "N";
}
function checkCatalogueIdentities(source: string, value: BoundaryCatalog): void {
  const lines = source.split("\n");
  const start = lines.findIndex((line) => /^\|\s*Name\s*\|\s*Path\s*\|/u.test(line));
  if (start < 0) {
    invalid();
  }
  const entries: string[][] = [];
  for (const line of lines.slice(start + 2)) {
    if (!line.startsWith("|")) {
      break;
    }
    entries.push(splitRow(line));
  }
  const documented = new Map<string, string>();
  for (const entry of entries) {
    const path = entry[1];
    if (entry.length !== 6 || !path) {
      invalid();
    }
    const id = path.startsWith("packages/") ? path.slice("packages/".length) : path;
    if (documented.has(id)) {
      invalid();
    }
    documented.set(id, path);
  }
  if (
    !documented.size ||
    documented.size !== value.packages.length ||
    value.packages.some((entry) => documented.get(entry.id) !== entry.path)
  ) {
    invalid();
  }
}
function checkMatrix(source: string, value: BoundaryCatalog): number {
  checkCatalogueIdentities(source, value);
  const table = parseMatrix(source);
  const libraryIds = new Set([
    ...columns.filter((column) => column !== "application/ports" && column !== "adapters/*"),
    ...adapters(value).map((entry) => entry.id),
  ]);
  if (value.testOnly.length !== 1 || value.testOnly[0] !== "testing" || !value.toolsMayImportAny) {
    invalid();
  }
  let checked = 0;
  for (const [rowIndex, row] of rows.entries()) {
    const importers = row === "tests" ? [] : sources(value, row);
    for (const importer of importers) {
      if (
        importer.allowedImports.some((id) => !libraryIds.has(id)) ||
        Object.entries(importer.allowedSubpaths).some(
          ([id, paths]) => id !== "application" || paths.some((path) => path !== "ports"),
        )
      ) {
        invalid();
      }
    }
    for (const [columnIndex, column] of columns.entries()) {
      const targets =
        column === "adapters/*"
          ? adapters(value)
          : [packageById(value, column === "application/ports" ? "application" : column)];
      const markers =
        row === "tests"
          ? [column === "testing" && !value.testOnly.includes("testing") ? "N" : "Y"]
          : importers.flatMap((importer) =>
              column === "application/ports"
                ? [importer.allowedSubpaths["application"]?.includes("ports") ? "Y" : "N"]
                : targets.map((target) => rootMarker(importer, target, column)),
            );
      if (!markers.length || markers.some((marker) => marker !== table[rowIndex]?.[columnIndex])) {
        invalid();
      }
      checked += 1;
    }
  }
  return checked;
}
function replaceCell(source: string, row: number, column: number): string {
  const lines = source.split("\n");
  const index = matrixStart(lines) + 2 + row;
  const cells = splitRow(lines[index]!);
  cells[column + 1] = cells[column + 1] === "Y" ? "N" : "Y";
  lines[index] = `| ${cells.join(" | ")} |`;
  return lines.join("\n");
}
function mutable(value: BoundaryCatalog) {
  return {
    ...value,
    testOnly: [...value.testOnly],
    packages: value.packages.map((entry) => ({
      ...entry,
      allowedImports: [...entry.allowedImports],
      allowedSubpaths: Object.fromEntries(
        Object.entries(entry.allowedSubpaths).map(([id, paths]) => [id, [...paths]] as const),
      ),
    })),
  };
}

describe("independent architecture matrix consistency", () => {
  it("compares every one of the actual 140 Markdown/JSON cells", () => {
    expect(checkMatrix(markdown, catalog)).toBe(140);
  });
  it("rejects an independent Markdown-only change to each of the 140 cells", () => {
    let mutations = 0;
    for (const [rowIndex, row] of rows.entries()) {
      for (const [columnIndex, column] of columns.entries()) {
        expect(
          () => checkMatrix(replaceCell(markdown, rowIndex, columnIndex), catalog),
          `${row} -> ${column}`,
        ).toThrow("Architecture matrix and catalogue disagree.");
        mutations += 1;
      }
    }
    expect(mutations).toBe(140);
  });
  it("rejects every distinct independent JSON root/subpath permission mutation", () => {
    const seen = new Set<string>();
    for (const row of rows.filter((name) => name !== "tests")) {
      for (const importer of sources(catalog, row)) {
        for (const column of columns) {
          const targets =
            column === "adapters/*"
              ? adapters(catalog)
              : [packageById(catalog, column === "application/ports" ? "application" : column)];
          for (const target of targets) {
            const key = `${importer.id}:${target.id}:${column === "application/ports" ? "ports" : "root"}`;
            if (seen.has(key)) {
              continue;
            }
            seen.add(key);
            const changed = mutable(catalog);
            const entry = changed.packages.find((item) => item.id === importer.id)!;
            if (column === "application/ports") {
              entry.allowedSubpaths["application"] = entry.allowedSubpaths["application"]?.includes(
                "ports",
              )
                ? []
                : ["ports"];
            } else {
              entry.allowedImports = entry.allowedImports.includes(target.id)
                ? entry.allowedImports.filter((id) => id !== target.id)
                : [...entry.allowedImports, target.id];
            }
            expect(() => checkMatrix(markdown, changed), key).toThrow(
              "Architecture matrix and catalogue disagree.",
            );
          }
        }
      }
    }
    expect(seen.size).toBeGreaterThan(140);
  });
  it.each(["extra", "missing", "renamed"] as const)(
    "rejects JSON-only %s catalogue identities after actual policy admission",
    (mode) => {
      const fixture = createWorkspace();
      try {
        const changed = mutable(catalog);
        if (mode === "extra") {
          changed.packages.push({
            ...changed.packages[0]!,
            id: "unmapped",
            path: "packages/unmapped",
          });
        } else if (mode === "missing") {
          changed.packages = changed.packages.filter((entry) => entry.id !== "skills/overmind");
        } else {
          changed.packages.find((entry) => entry.id === "skills/overmind")!.id = "skills/renamed";
        }
        fixture.write("docs/architecture/boundaries.json", JSON.stringify(changed));
        const admitted = loadCatalog(fixture.root);
        expect(admitted.packages).toHaveLength(changed.packages.length);
        expect(() => checkMatrix(markdown, admitted)).toThrow(
          "Architecture matrix and catalogue disagree.",
        );
      } finally {
        fixture.cleanup();
      }
    },
  );
  it("keeps adapter wildcard membership extensible when both catalogues agree", () => {
    const changed = mutable(catalog);
    const example = {
      ...changed.packages.find((entry) => entry.id === "adapters/sqlite")!,
      id: "adapters/example",
      path: "packages/adapters/example",
    };
    changed.packages.push(example);
    for (const id of ["apps/engine", "tools"]) {
      changed.packages.find((entry) => entry.id === id)!.allowedImports.push(example.id);
    }
    const line = markdown
      .split("\n")
      .find((item) => /^\| @overmind\/adapter-sqlite\s*\|/u.test(item))!;
    const documented = markdown.replace(
      line,
      `${line}\n| @overmind/adapter-example | packages/adapters/example | L3 | Fixture only | . | node |`,
    );
    expect(checkMatrix(documented, changed)).toBe(140);
  });
  it("rejects a partial engine adapter wildcard and a single differing generic adapter", () => {
    const partial = mutable(catalog);
    const engine = partial.packages.find((entry) => entry.id === "apps/engine")!;
    engine.allowedImports = engine.allowedImports.filter((id) => id !== "adapters/telegram");
    expect(() => checkMatrix(markdown, partial)).toThrow();
    const differing = mutable(catalog);
    differing.packages
      .find((entry) => entry.id === "adapters/sqlite")!
      .allowedImports.push("gateway");
    expect(() => checkMatrix(markdown, differing)).toThrow();
  });
  it("keeps tests, the testing package and Tools flag/list agreement separate", () => {
    const noOverlay = mutable(catalog);
    noOverlay.testOnly = [];
    expect(() => checkMatrix(markdown, noOverlay)).toThrow();
    const broadTesting = mutable(catalog);
    broadTesting.packages
      .find((entry) => entry.id === "testing")!
      .allowedImports.push("application");
    expect(() => checkMatrix(markdown, broadTesting)).toThrow();
    const noToolsFlag = { ...catalog, toolsMayImportAny: false };
    expect(() => checkMatrix(markdown, noToolsFlag)).toThrow();
    const partialTools = mutable(catalog);
    partialTools.packages.find((entry) => entry.id === "tools")!.allowedImports = [];
    expect(() => checkMatrix(markdown, partialTools)).toThrow();
  });
  it("rejects missing, extra or renamed matrix rows and columns", () => {
    const original = markdown.split("\n");
    const start = matrixStart(original);
    const missing = [...original];
    missing.splice(start + 2, 1);
    const extra = [...original];
    extra.splice(start + 2, 0, original[start + 2]!);
    const renamedRow = [...original];
    renamedRow[start + 2] = renamedRow[start + 2]!.replace("contracts", "unknown");
    const renamedColumn = [...original];
    renamedColumn[start] = renamedColumn[start]!.replace("contracts", "unknown");
    const missingColumn = [...original];
    const header = splitRow(missingColumn[start]!);
    header.splice(1, 1);
    missingColumn[start] = `| ${header.join(" | ")} |`;
    const extraColumn = [...original];
    extraColumn[start] = extraColumn[start]!.replace("| contracts", "| extra | contracts");
    for (const changed of [missing, extra, renamedRow, renamedColumn, missingColumn, extraColumn]) {
      expect(() => checkMatrix(changed.join("\n"), catalog)).toThrow();
    }
  });
});
