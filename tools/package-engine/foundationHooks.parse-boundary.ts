// SPDX-License-Identifier: Apache-2.0
import { lstatSync } from "node:fs";
import { posix, resolve } from "node:path";
import ts from "typescript";
import { z } from "zod";
import { readSource } from "../boundaries/policy.parse-boundary.ts";
import { safeDirectory } from "./files.ts";
import { json, metafileInputs } from "./input.parse-boundary.ts";

interface SourceSnapshot {
  readonly sources: readonly string[];
  readonly sourcesContent: readonly (string | null)[];
}
const prefix = "file:///overmind/source/";
const hookPaths = new Set(["apps/engine/src/compose/index.ts", "apps/engine/src/service/index.ts"]);
function invalid(): never {
  throw new Error("Invalid engine foundation hooks");
}
function inertMarker(source: string): boolean {
  const checked = ts.transpileModule(source, {
    reportDiagnostics: true,
    compilerOptions: { target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.ESNext },
  });
  if (checked.diagnostics?.some((item) => item.category === ts.DiagnosticCategory.Error)) {
    return false;
  }
  const file = ts.createSourceFile("foundation.ts", source, ts.ScriptTarget.Latest, true);
  const statement = file.statements[0];
  if (
    file.statements.length !== 1 ||
    !statement ||
    !ts.isVariableStatement(statement) ||
    statement.modifiers?.length !== 1 ||
    statement.modifiers[0]?.kind !== ts.SyntaxKind.ExportKeyword ||
    !(statement.declarationList.flags & ts.NodeFlags.Const) ||
    statement.declarationList.declarations.length !== 1
  ) {
    return false;
  }
  const declaration = statement.declarationList.declarations[0];
  return (
    declaration !== undefined &&
    ts.isIdentifier(declaration.name) &&
    declaration.name.getText(file) === "UNIMPLEMENTED" &&
    declaration.type === undefined &&
    declaration.exclamationToken === undefined &&
    declaration.initializer?.kind === ts.SyntaxKind.TrueKeyword
  );
}
function isHookPath(path: string): boolean {
  let decoded = path.replaceAll("\\", "/");
  try {
    decoded = decodeURIComponent(decoded);
  } catch {
    // A malformed escape cannot qualify an otherwise recognised hook path.
  }
  const candidate = decoded.toLowerCase();
  const hookDirectory = /(?:^|\/)apps\/engine\/src\/(?:compose|service)(?:\/|$)/u;
  // Normalisation only discovers candidates to deny; admission uses exact bytes below.
  return hookDirectory.test(candidate) || hookDirectory.test(posix.normalize(candidate));
}
const importsSchema = z.object({
  inputs: z.record(
    z.string().min(1),
    z.object({
      imports: z.array(
        z.object({
          path: z.string().min(1),
          original: z.string().min(1).optional(),
          external: z.boolean().optional(),
        }),
      ),
    }),
  ),
});
export function foundationInputPaths(metadata: string): string[] {
  try {
    const paths = metafileInputs(metadata);
    const included = new Set(paths);
    const graph = importsSchema.parse(json(metadata));
    for (const [importer, input] of Object.entries(graph.inputs)) {
      for (const edge of input.imports) {
        if (!edge.external && edge.original === undefined) {
          invalid();
        }
        const original = edge.original ?? edge.path;
        const requested = posix.join(posix.dirname(importer), original);
        if (!isHookPath(requested) && !isHookPath(edge.path)) {
          continue;
        }
        const canonical = requested.replace(/\.js$/u, ".ts");
        const relative = posix.relative(posix.dirname(importer), canonical);
        const specifier = relative.startsWith(".") ? relative : `./${relative}`;
        if (
          !hookPaths.has(canonical) ||
          (original !== specifier && original !== specifier.replace(/\.ts$/u, ".js")) ||
          (edge.external
            ? included.has(canonical) || edge.path !== original
            : edge.path !== canonical || !included.has(canonical))
        ) {
          invalid();
        }
      }
    }
    return paths;
  } catch {
    invalid();
  }
}
function present(root: string, path: string): boolean {
  let parent = root;
  for (const segment of path.split("/")) {
    safeDirectory(root, parent);
    const next = resolve(parent, segment);
    if (!lstatSync(next, { throwIfNoEntry: false })) {
      safeDirectory(root, parent);
      return false;
    }
    parent = next;
  }
  return true;
}
export function assertFoundationHooks(
  root: string,
  inputPaths: readonly string[],
  sourceMap: SourceSnapshot,
): void {
  try {
    if (
      sourceMap.sources.length !== sourceMap.sourcesContent.length ||
      new Set(sourceMap.sources).size !== sourceMap.sources.length
    ) {
      invalid();
    }
    const included = new Set<string>();
    for (const path of inputPaths) {
      if (!isHookPath(path)) {
        continue;
      }
      if (!hookPaths.has(path) || included.has(path)) {
        invalid();
      }
      included.add(path);
    }
    const mapped = new Map<string, string | null>();
    for (const [index, identity] of sourceMap.sources.entries()) {
      if (!isHookPath(identity)) {
        continue;
      }
      const path = identity.startsWith(prefix) ? identity.slice(prefix.length) : identity;
      if (!hookPaths.has(path) || !included.has(path)) {
        invalid();
      }
      mapped.set(path, sourceMap.sourcesContent[index] ?? null);
    }
    if (mapped.size !== included.size) {
      invalid();
    }
    for (const path of hookPaths) {
      if (present(root, path) !== included.has(path)) {
        invalid();
      }
      if (!included.has(path)) {
        continue;
      }
      const snapshot = mapped.get(path);
      if (
        typeof snapshot !== "string" ||
        readSource(root, resolve(root, path)) !== snapshot ||
        !inertMarker(snapshot)
      ) {
        invalid();
      }
    }
  } catch {
    invalid();
  }
}
