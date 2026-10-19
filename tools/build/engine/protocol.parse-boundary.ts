// SPDX-License-Identifier: Apache-2.0
import { lstatSync, realpathSync, type BigIntStats } from "node:fs";
import { dirname, extname, isAbsolute, relative, resolve, sep } from "node:path";
import ts from "typescript";
import { readSource } from "../../boundaries/policy.parse-boundary.ts";

const failure = "Invalid contracts protocol version";
const sourceLimit = 256 * 1024;
interface Reference {
  path: string;
  name: string;
}
type Binding = { constant: boolean; initializer: ts.Expression | undefined } | Reference;
interface Module {
  locals: Map<string, Binding>;
  exports: Map<string, { local: string } | Reference>;
  stars: string[];
}
function invalid(): never {
  throw new Error(failure);
}
function inside(root: string, path: string): boolean {
  const distance = relative(root, path);
  return (
    !!distance && !isAbsolute(distance) && distance !== ".." && !distance.startsWith(`..${sep}`)
  );
}
function identity(info: BigIntStats): string {
  return [info.dev, info.ino, info.mode, info.mtimeNs, info.ctimeNs].join(":");
}
// ENOENT alone is insufficient: an unsafe or replaced ancestor must not manufacture absence.
function missing(root: string, path: string): boolean {
  if (!inside(root, path)) {
    return invalid();
  }
  const base = lstatSync(root, { bigint: true });
  if (!base.isDirectory() || base.isSymbolicLink() || realpathSync(root) !== root) {
    return invalid();
  }
  const ancestors = new Map([[root, identity(base)]]);
  const parts = relative(root, path).split(sep);
  let current = root;
  for (const [index, part] of parts.entries()) {
    current = resolve(current, part);
    let info: BigIntStats;
    try {
      info = lstatSync(current, { bigint: true });
    } catch (error) {
      if (!(error instanceof Error) || !("code" in error) || error.code !== "ENOENT") {
        return invalid();
      }
      for (const [ancestor, expected] of ancestors) {
        if (
          identity(lstatSync(ancestor, { bigint: true })) !== expected ||
          realpathSync(ancestor) !== ancestor
        ) {
          return invalid();
        }
      }
      try {
        lstatSync(current);
      } catch (again) {
        if (again instanceof Error && "code" in again && again.code === "ENOENT") {
          return true;
        }
      }
      return invalid();
    }
    if (
      info.isSymbolicLink() ||
      info.dev !== base.dev ||
      (index < parts.length - 1 && !info.isDirectory())
    ) {
      return invalid();
    }
    if (info.isDirectory()) {
      ancestors.set(current, identity(info));
    }
  }
  return false;
}
function literal(binding: Binding): number {
  if ("path" in binding || !binding.constant || !binding.initializer) {
    return invalid();
  }
  let node = binding.initializer;
  while (
    ts.isParenthesizedExpression(node) ||
    ts.isAsExpression(node) ||
    ts.isSatisfiesExpression(node)
  ) {
    node = node.expression;
  }
  if (!ts.isNumericLiteral(node)) {
    return invalid();
  }
  const value = Number(node.text);
  return Number.isSafeInteger(value) && value > 0 ? value : invalid();
}
function bindingNames(name: ts.BindingName): string[] {
  return ts.isIdentifier(name)
    ? [name.text]
    : name.elements.flatMap((item) => (ts.isBindingElement(item) ? bindingNames(item.name) : []));
}

function valueDeclaration(
  statement: ts.Statement,
): statement is
  ts.FunctionDeclaration | ts.ClassDeclaration | ts.EnumDeclaration | ts.ModuleDeclaration {
  return (
    ts.isFunctionDeclaration(statement) ||
    ts.isClassDeclaration(statement) ||
    ts.isEnumDeclaration(statement) ||
    ts.isModuleDeclaration(statement)
  );
}

/** Read the protocol as bounded TypeScript data; never load contracts into the process. */
export function readProtocol(root: string): number {
  try {
    const base = realpathSync(root);
    const sourceRoot = resolve(base, "packages/contracts/src");
    const entry = resolve(sourceRoot, "index.ts");
    if (missing(base, entry)) {
      return 1;
    }
    const modules = new Map<string, Module>();
    const loading = new Set<string>();
    const resolving = new Set<string>();
    const resolved = new Map<string, ReadonlyMap<string, number>>();
    function sourcePath(from: string, specifier: string): string {
      if (!specifier.startsWith("./") && !specifier.startsWith("../")) {
        return invalid();
      }
      const parts = specifier.split("/");
      while (parts[0] === "." || parts[0] === "..") {
        parts.shift();
      }
      if (
        !parts.length ||
        parts.some((part) => !part || part === "." || part === "..") ||
        /[\\\p{Cc}?#]/u.test(specifier)
      ) {
        return invalid();
      }
      const target = resolve(dirname(from), specifier);
      if (!inside(sourceRoot, target)) {
        return invalid();
      }
      const extension = extname(target);
      const replacements: Readonly<Record<string, string>> = {
        ".js": ".ts",
        ".jsx": ".tsx",
        ".mjs": ".mts",
        ".cjs": ".cts",
      };
      const mapped = replacements[extension];
      const candidates = mapped
        ? [target.slice(0, -extension.length) + mapped, target]
        : extension
          ? [target]
          : [target + ".ts", target + ".tsx", target + ".js", resolve(target, "index.ts")];
      for (const candidate of candidates) {
        if (!/\.(?:[cm]?ts|tsx|[cm]?js|jsx)$/u.test(candidate)) {
          return invalid();
        }
        if (!missing(base, candidate)) {
          return candidate;
        }
      }
      return invalid();
    }
    function load(path: string): Module {
      if (loading.has(path)) {
        return invalid();
      }
      const existing = modules.get(path);
      if (existing) {
        return existing;
      }
      if (modules.size >= 128 || !inside(sourceRoot, path)) {
        return invalid();
      }
      const text = readSource(base, path, sourceLimit);
      const checked = ts.transpileModule(text, {
        fileName: path,
        reportDiagnostics: true,
        compilerOptions: { target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.ESNext },
      });
      if (
        checked.diagnostics?.some(
          (diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error,
        )
      ) {
        return invalid();
      }
      const file = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true);
      const module: Module = { locals: new Map(), exports: new Map(), stars: [] };
      modules.set(path, module);
      loading.add(path);
      const dependencies = new Set<string>();
      const reserved = new Set<string>();
      for (const statement of file.statements) {
        if (valueDeclaration(statement) && statement.name) {
          reserved.add(statement.name.text);
        } else if (ts.isImportDeclaration(statement)) {
          const binding = statement.importClause?.namedBindings;
          if (
            statement.importClause?.phaseModifier !== ts.SyntaxKind.TypeKeyword &&
            binding &&
            ts.isNamespaceImport(binding)
          ) {
            reserved.add(binding.name.text);
          }
        }
      }
      function exported(name: string, binding: { local: string } | Reference) {
        if (module.exports.has(name)) {
          return invalid();
        }
        module.exports.set(name, binding);
      }
      for (const statement of file.statements) {
        if (ts.isVariableStatement(statement)) {
          const constant =
            !!(statement.declarationList.flags & ts.NodeFlags.Const) &&
            !statement.modifiers?.some(
              (modifier) => modifier.kind === ts.SyntaxKind.DeclareKeyword,
            );
          const isExported = statement.modifiers?.some(
            (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword,
          );
          for (const declaration of statement.declarationList.declarations) {
            for (const name of bindingNames(declaration.name)) {
              if (module.locals.has(name) || reserved.has(name)) {
                return invalid();
              }
              module.locals.set(name, {
                constant,
                initializer: ts.isIdentifier(declaration.name)
                  ? declaration.initializer
                  : undefined,
              });
              if (isExported) {
                exported(name, { local: name });
              }
            }
          }
        } else if (ts.isExportDeclaration(statement)) {
          const target =
            statement.moduleSpecifier && ts.isStringLiteral(statement.moduleSpecifier)
              ? sourcePath(path, statement.moduleSpecifier.text)
              : undefined;
          if (target) {
            dependencies.add(target);
          }
          if (statement.isTypeOnly) {
            continue;
          }
          if (!statement.exportClause) {
            if (!target) {
              return invalid();
            }
            module.stars.push(target);
          } else if (ts.isNamedExports(statement.exportClause)) {
            for (const element of statement.exportClause.elements) {
              if (!element.isTypeOnly) {
                const name = (element.propertyName ?? element.name).text;
                exported(element.name.text, target ? { path: target, name } : { local: name });
              }
            }
          } else {
            exported(statement.exportClause.name.text, { local: "" });
          }
        } else if (
          ts.isImportDeclaration(statement) &&
          statement.importClause &&
          statement.importClause.phaseModifier !== ts.SyntaxKind.TypeKeyword &&
          ts.isStringLiteral(statement.moduleSpecifier)
        ) {
          const clause = statement.importClause;
          const specifier = statement.moduleSpecifier.text;
          const imported = (local: string, name: string) => {
            if (module.locals.has(local) || reserved.has(local)) {
              return invalid();
            }
            module.locals.set(local, {
              path: specifier,
              name,
            });
          };
          if (clause.name) {
            imported(clause.name.text, "default");
          }
          if (clause.namedBindings && ts.isNamedImports(clause.namedBindings)) {
            for (const element of clause.namedBindings.elements) {
              if (!element.isTypeOnly) {
                imported(element.name.text, (element.propertyName ?? element.name).text);
              }
            }
          }
        } else if (
          valueDeclaration(statement) &&
          statement.name &&
          statement.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword) &&
          !statement.modifiers.some((modifier) => modifier.kind === ts.SyntaxKind.DefaultKeyword)
        ) {
          const previous = module.exports.get(statement.name.text);
          if (previous && !("local" in previous && previous.local === "")) {
            return invalid();
          }
          if (!previous) {
            exported(statement.name.text, { local: "" });
          }
        }
      }
      for (const dependency of dependencies) {
        load(dependency);
      }
      loading.delete(path);
      return module;
    }
    function lookup(path: string, name: string): ReadonlyMap<string, number> {
      const key = path + "#" + name;
      if (resolving.has(key)) {
        return invalid();
      }
      const cached = resolved.get(key);
      if (cached) {
        return cached;
      }
      resolving.add(key);
      const module = load(path);
      const values = new Map<string, number>();
      const binding = module.exports.get(name);
      if (binding) {
        let candidates: ReadonlyMap<string, number>;
        if ("path" in binding) {
          candidates = lookup(binding.path, binding.name);
        } else {
          const local = module.locals.get(binding.local);
          if (!local) {
            return invalid();
          }
          candidates =
            "path" in local
              ? lookup(sourcePath(path, local.path), local.name)
              : new Map([[path + "#" + binding.local, literal(local)]]);
        }
        if (!candidates.size) {
          return invalid();
        }
        for (const [origin, value] of candidates) {
          values.set(origin, value);
        }
      }
      for (const star of module.stars) {
        for (const [origin, value] of lookup(star, name)) {
          values.set(origin, value);
        }
      }
      resolving.delete(key);
      resolved.set(key, values);
      return values;
    }
    const values = lookup(entry, "PROTOCOL_VERSION");
    if (values.size > 1) {
      return invalid();
    }
    return values.values().next().value ?? 1;
  } catch {
    return invalid();
  }
}
