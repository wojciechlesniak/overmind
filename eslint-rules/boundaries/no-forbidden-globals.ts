// SPDX-License-Identifier: Apache-2.0
import type { JSSyntaxElement, Rule, SourceCode } from "eslint";
import { environment } from "./resolve-package.ts";

type Node = JSSyntaxElement & Readonly<Record<string, unknown>>;
type Variable = ReturnType<SourceCode["getScope"]>["variables"][number];
type Bounds = readonly [number, number];
type Selection = string | { readonly restOffset: number } | { readonly arrayIndex: Bounds };
interface Write {
  readonly target: readonly string[];
  readonly value: Node;
  readonly select: readonly Selection[];
}
const isNode = (value: unknown): value is Node =>
  typeof value === "object" && value !== null && "type" in value && typeof value.type === "string";
const child = (node: Node, key: string): Node | undefined => {
  const value = node[key];
  return isNode(value) ? value : undefined;
};
const children = (node: Node, key: string): Node[] => {
  const value = node[key];
  return Array.isArray(value) ? value.filter(isNode) : [];
};
const wrapper = (node: Node): boolean =>
  node.type === "ChainExpression" ||
  (node.type.startsWith("TS") && child(node, "expression") !== undefined);
function unwrap(node: Node | undefined): Node | undefined {
  while (node && wrapper(node)) {
    node = child(node, "expression");
  }
  return node;
}
function key(node: Node | undefined): string {
  node = unwrap(node);
  if (node?.type === "Identifier") {
    return typeof node["name"] === "string" ? node["name"] : "*";
  }
  if (node?.type === "Literal" && ["string", "number"].includes(typeof node["value"])) {
    return String(node["value"]);
  }
  if (node?.type === "TemplateLiteral" && children(node, "expressions").length === 0) {
    const quasi = children(node, "quasis")[0]?.["value"];
    if (
      typeof quasi === "object" &&
      quasi !== null &&
      "cooked" in quasi &&
      typeof quasi.cooked === "string"
    ) {
      return quasi.cooked;
    }
  }
  return "*";
}
const memberKey = (node: Node, field = "property"): string => {
  const property = unwrap(child(node, field));
  return node["computed"] === true && property?.type === "Identifier" ? "*" : key(property);
};
const globalObjects = new Set(["globalThis", "global", "window", "self"]);

/** A spread contributes an argument only when its literal contents prove one exists. */
function suppliesArgument(node: Node): boolean {
  if (node.type !== "SpreadElement") {
    return true;
  }
  const value = unwrap(child(node, "argument"));
  const elements = value?.type === "ArrayExpression" ? value["elements"] : undefined;
  return (
    Array.isArray(elements) &&
    elements.some(
      (element: unknown) => element === null || (isNode(element) && suppliesArgument(element)),
    )
  );
}

/** Decide capabilities from ESLint's own lexical scopes, independently of standalone analysis. */
export function noForbiddenGlobals(root: string): Rule.RuleModule {
  return {
    meta: {
      schema: [],
      messages: {
        BOUNDARY_FORBIDDEN_GLOBAL: "Inject a port instead of using an ambient runtime capability.",
      },
    },
    create(context) {
      return {
        Program() {
          const env = environment(root, context);
          for (const node of capabilityUses(
            context.sourceCode,
            env.owner?.forbiddenGlobals ?? [],
          )) {
            context.report({ node, messageId: "BOUNDARY_FORBIDDEN_GLOBAL" });
          }
        },
      };
    },
  };
}
function capabilityUses(source: SourceCode, forbidden: readonly string[]): readonly Node[] {
  if (!forbidden.length) {
    return [];
  }
  const patterns = forbidden.map((entry) => ({
    constructor: entry.startsWith("new "),
    zero: entry.endsWith("()"),
    path: entry.replace(/^new /u, "").replace(/\(\)$/u, "").split("."),
  }));
  const roots = new Set(patterns.map((pattern) => pattern.path[0]));
  if (roots.has("Function")) {
    roots.add("Date"); // Date.constructor is the intrinsic Function constructor.
  }
  const nodes: Node[] = [];
  const visit = (node: Node) => {
    nodes.push(node);
    for (const field of source.visitorKeys[node.type] ?? []) {
      const value = node[field];
      if (isNode(value)) {
        visit(value);
      } else if (Array.isArray(value)) {
        value.filter(isNode).forEach(visit);
      }
    }
  };
  if (!isNode(source.ast)) {
    throw new Error("Invalid capability syntax.");
  }
  visit(source.ast);
  const lookup = (node: Node): Variable | undefined => {
    if (node.type !== "Identifier" || typeof node["name"] !== "string") {
      return undefined;
    }
    let scope: ReturnType<SourceCode["getScope"]> | null = source.getScope(
      node as Parameters<SourceCode["getScope"]>[0],
    );
    while (scope) {
      const variable = scope.set.get(node["name"]);
      if (variable) {
        return variable;
      }
      scope = scope.upper;
    }
    return undefined;
  };
  const ambient = (node: Node | undefined): boolean =>
    node !== undefined &&
    (node["declare"] === true ||
      node["importKind"] === "type" ||
      ["TSTypeAliasDeclaration", "TSInterfaceDeclaration", "TSDeclareFunction"].includes(
        node.type,
      ) ||
      ambient(child(node, "parent")));
  const runtime = (variable: Variable | undefined): boolean =>
    variable?.defs.some((definition) => isNode(definition.node) && !ambient(definition.node)) ??
    false;
  const writes = new Map<Variable, Write[]>();
  const add = (
    target: Node,
    value: Node,
    select: readonly Selection[] = [],
    path: readonly string[] = [],
  ) => {
    if (wrapper(target)) {
      const expression = child(target, "expression");
      if (expression) {
        add(expression, value, select, path);
      }
    } else if (target.type === "Identifier") {
      const variable = lookup(target);
      if (variable) {
        writes.set(variable, [...(writes.get(variable) ?? []), { target: path, value, select }]);
      }
    } else if (target.type === "MemberExpression") {
      const object = child(target, "object");
      if (object) {
        add(object, value, select, [memberKey(target), ...path]);
      }
    } else if (target.type === "AssignmentPattern") {
      const left = child(target, "left");
      const fallback = child(target, "right");
      if (left) {
        add(left, value, select, path);
        if (fallback) {
          add(left, fallback, [], path);
        }
      }
    } else if (target.type === "ObjectPattern") {
      for (const property of children(target, "properties")) {
        const binding = child(property, property.type === "RestElement" ? "argument" : "value");
        if (binding) {
          add(
            binding,
            value,
            property.type === "RestElement" ? select : [...select, memberKey(property, "key")],
            path,
          );
        }
      }
    } else if (target.type === "ArrayPattern") {
      const elements = target["elements"];
      if (Array.isArray(elements)) {
        elements.forEach((element: unknown, index) => {
          if (isNode(element)) {
            const binding = element.type === "RestElement" ? child(element, "argument") : element;
            if (binding) {
              add(
                binding,
                value,
                [...select, element.type === "RestElement" ? { restOffset: index } : String(index)],
                path,
              );
            }
          }
        });
      }
    }
  };
  for (const node of nodes) {
    const target = child(node, node.type === "VariableDeclarator" ? "id" : "left");
    const value = child(node, node.type === "VariableDeclarator" ? "init" : "right");
    if (
      ["VariableDeclarator", "AssignmentExpression", "AssignmentPattern"].includes(node.type) &&
      target &&
      value
    ) {
      add(target, value);
    }
  }
  const directWrites = new Set(writes.keys());
  // Receiver aliases share slots; resolution's visited set bounds the reverse edges.
  for (const [variable, values] of [...writes]) {
    const binding = variable.identifiers[0];
    if (isNode(binding)) {
      for (const alias of values.filter((value) => value.target.length === 0)) {
        const path = alias.select.filter(
          (segment): segment is string => typeof segment === "string",
        );
        if (path.length === alias.select.length) {
          add(alias.value, binding, [], path);
        }
      }
    }
  }
  interface ValueSelection {
    readonly value: Node;
    readonly select: readonly Selection[];
  }
  const arrayIndex = (segment: string): number | undefined => {
    const index = Number(segment);
    return Number.isInteger(index) && index >= 0 && index < 2 ** 32 - 1 && String(index) === segment
      ? index
      : undefined;
  };
  const selectionMatches = (segment: string, selected: Selection | undefined): boolean => {
    if (segment === "*" || selected === "*" || segment === selected) {
      return true;
    }
    const index = arrayIndex(segment);
    return (
      typeof selected === "object" &&
      "arrayIndex" in selected &&
      index !== undefined &&
      index >= selected.arrayIndex[0] &&
      index <= selected.arrayIndex[1]
    );
  };
  const writtenValues = (
    variable: Variable | undefined,
    select: readonly Selection[],
  ): ValueSelection[] =>
    (variable ? (writes.get(variable) ?? []) : [])
      .filter(
        (write) =>
          !write.target.length ||
          !select.length ||
          write.target.every((segment, index) => selectionMatches(segment, select[index])),
      )
      .map((write) => ({
        value: write.value,
        select: [...write.select, ...select.slice(write.target.length)],
      }));
  const objectValues = (node: Node, select: readonly Selection[]): ValueSelection[] =>
    children(node, "properties").flatMap((property) => {
      const spread = property.type === "SpreadElement";
      const value = child(property, spread ? "argument" : "value");
      const name = memberKey(property, "key");
      return value &&
        (spread || !select.length || select[0] === "*" || name === "*" || name === select[0])
        ? [{ value, select: spread ? select : select.slice(1) }]
        : [];
    });
  const variableIds = new Map(
    source.scopeManager.scopes
      .flatMap((scope) => scope.variables)
      .map((variable, index) => [variable, index]),
  );
  const widthCache = new Map<Node, Map<string, Bounds>>();
  function arrayBounds(
    node: Node | undefined,
    select: readonly Selection[] = [],
    seen = new Set<Variable>(),
  ): Bounds | undefined {
    node = unwrap(node);
    if (!node) {
      return [0, Infinity];
    }
    const cacheKey = JSON.stringify([
      select,
      [...seen].map((variable) => variableIds.get(variable)),
    ]);
    const cached = widthCache.get(node)?.get(cacheKey);
    if (cached) {
      return cached;
    }
    let choices: (Bounds | undefined)[] = [[0, Infinity]];
    if (node.type === "MemberExpression") {
      choices = [arrayBounds(child(node, "object"), [memberKey(node), ...select], seen)];
    } else if (node.type === "Identifier") {
      const variable = lookup(node);
      if (variable && seen.has(variable)) {
        return undefined; // A reverse alias edge adds no width fact of its own.
      }
      const next = new Set(seen);
      if (variable) {
        next.add(variable);
      }
      choices = writtenValues(variable, select).map(({ value, select: selected }) =>
        arrayBounds(value, selected, next),
      );
      if (
        !variable ||
        !directWrites.has(variable) ||
        variable.defs.some((definition) => definition.type === "Parameter")
      ) {
        choices.push([0, Infinity]);
      }
    } else if (node.type === "ObjectExpression" && select.length) {
      choices = objectValues(node, select).map(({ value, select: selected }) =>
        arrayBounds(value, selected, seen),
      );
    } else if (node.type === "ArrayExpression") {
      if (select.length) {
        choices = arrayValues(node, select, seen).map(({ value, select: selected }) =>
          arrayBounds(value, selected, seen),
        );
      } else {
        let min = 0;
        let max = 0;
        const elements = node["elements"];
        if (Array.isArray(elements)) {
          for (const value of elements) {
            const width: Bounds =
              isNode(value) && value.type === "SpreadElement"
                ? (arrayBounds(child(value, "argument"), [], seen) ?? [0, Infinity])
                : [1, 1];
            min += width[0];
            max += width[1];
          }
          choices = [[min, max]];
        }
      }
    } else if (
      ["ConditionalExpression", "LogicalExpression", "AssignmentExpression"].includes(node.type)
    ) {
      choices = ["consequent", "alternate", "left", "right"].flatMap((field) => {
        const value = child(node, field);
        return value ? [arrayBounds(value, select, seen)] : [];
      });
    } else if (node.type === "SequenceExpression") {
      choices = [arrayBounds(children(node, "expressions").at(-1), select, seen)];
    }
    // An absent property or a visited alias is no fact, unlike a genuinely unknown value.
    const known = choices.filter((choice): choice is Bounds => choice !== undefined);
    const bounds: Bounds | undefined = known.length
      ? [Math.min(...known.map(([min]) => min)), Math.max(...known.map(([, max]) => max))]
      : undefined;
    if (bounds && Number.isFinite(bounds[1])) {
      const cache = widthCache.get(node) ?? new Map<string, Bounds>();
      cache.set(cacheKey, bounds);
      widthCache.set(node, cache);
    }
    return bounds;
  }
  function arrayValues(
    node: Node,
    select: readonly Selection[],
    seen: Set<Variable>,
  ): ValueSelection[] {
    let restOffset = 0;
    while (typeof select[0] === "object" && "restOffset" in select[0]) {
      restOffset += select[0].restOffset;
      select = select.slice(1);
    }
    const head = select[0];
    let range: Bounds | undefined = restOffset ? [restOffset, Infinity] : undefined;
    if (typeof head === "object" && "arrayIndex" in head) {
      range = [head.arrayIndex[0] + restOffset, head.arrayIndex[1] + restOffset];
    } else if (typeof head === "string" && head !== "*") {
      const index = arrayIndex(head);
      if (index === undefined) {
        return [];
      }
      range = [index + restOffset, index + restOffset];
    }
    const elements = node["elements"];
    const selected: ValueSelection[] = [];
    let min = 0;
    let max = 0;
    if (Array.isArray(elements)) {
      for (const value of elements) {
        if (isNode(value) && value.type === "SpreadElement") {
          const argument = child(value, "argument");
          const relative: Bounds | undefined = range
            ? [Math.max(0, range[0] - max), range[1] - min]
            : undefined;
          if (argument && (!relative || relative[1] >= 0)) {
            selected.push({
              value: argument,
              select: relative ? [{ arrayIndex: relative }, ...select.slice(1)] : select,
            });
          }
          const width = arrayBounds(argument, [], seen) ?? [0, Infinity];
          min += width[0];
          max += width[1];
        } else {
          if (isNode(value) && (!range || (range[0] <= max && range[1] >= min))) {
            selected.push({ value, select: select.slice(1) });
          }
          min += 1;
          max += 1;
        }
      }
    }
    return selected;
  }
  const resolutionCache = new Map<Node, Map<string, string[][]>>();
  const resolves = (
    node: Node | undefined,
    select: readonly Selection[] = [],
    seen = new Set<Variable>(),
  ): string[][] => {
    if (!node) {
      return [];
    }
    const cacheKey = JSON.stringify([
      select,
      [...seen].map((variable) => variableIds.get(variable)),
    ]);
    const cache = resolutionCache.get(node) ?? new Map<string, string[][]>();
    const cached = cache.get(cacheKey);
    if (cached) {
      return cached;
    }
    const paths = [
      ...new Map(
        resolveNode(node, select, seen).map((path) => [JSON.stringify(path), path]),
      ).values(),
    ];
    cache.set(cacheKey, paths);
    resolutionCache.set(node, cache);
    return paths;
  };
  const resolveNode = (
    node: Node | undefined,
    select: readonly Selection[] = [],
    seen = new Set<Variable>(),
  ): string[][] => {
    if (!node) {
      return [];
    }
    if (wrapper(node)) {
      return resolves(child(node, "expression"), select, seen);
    }
    if (node.type === "MemberExpression") {
      return resolves(child(node, "object"), [memberKey(node), ...select], seen);
    }
    if (node.type === "Identifier") {
      const variable = lookup(node);
      if (variable && seen.has(variable)) {
        return [];
      }
      const next = new Set(seen);
      if (variable) {
        next.add(variable);
      }
      const values = writtenValues(variable, select).flatMap(({ value, select: selected }) =>
        resolves(value, selected, next),
      );
      if (!runtime(variable)) {
        const name = node["name"];
        const path = select.map((segment) => (typeof segment === "string" ? segment : "*"));
        if (typeof name === "string" && globalObjects.has(name)) {
          values.push(path);
        } else if (typeof name === "string" && roots.has(name)) {
          values.push([name, ...path]);
        }
      }
      return values;
    }
    if (node.type === "ObjectExpression") {
      return objectValues(node, select).flatMap(({ value, select: selected }) =>
        resolves(value, selected, seen),
      );
    }
    if (node.type === "ArrayExpression") {
      return arrayValues(node, select, seen).flatMap(({ value, select: selected }) =>
        resolves(value, selected, seen),
      );
    }
    if (
      ["ConditionalExpression", "LogicalExpression", "AssignmentExpression"].includes(node.type)
    ) {
      return ["consequent", "alternate", "left", "right"].flatMap((field) =>
        resolves(child(node, field), select, seen),
      );
    }
    if (node.type === "SequenceExpression") {
      return resolves(children(node, "expressions").at(-1), select, seen);
    }
    if (node.type === "CallExpression") {
      const callee = child(node, "callee");
      if (callee?.type === "MemberExpression" && memberKey(callee) === "bind") {
        return resolves(child(callee, "object"), select, seen);
      }
    }
    return [];
  };
  const aliasSource = (node: Node): boolean => {
    const parent = child(node, "parent");
    if (!parent) {
      return false;
    }
    if (parent.type === "VariableDeclarator") {
      return child(parent, "init") === node;
    }
    if (parent.type === "AssignmentExpression" || parent.type === "AssignmentPattern") {
      return (
        child(parent, "right") === node ||
        (child(parent, "left") === node && parent["operator"] === "=")
      );
    }
    return (
      !["CallExpression", "NewExpression", "ReturnStatement", "ExpressionStatement"].includes(
        parent.type,
      ) &&
      parent.type !== "ArrowFunctionExpression" &&
      aliasSource(parent)
    );
  };
  const reported = new Set<Node>();
  for (const scope of source.scopeManager.scopes) {
    for (const reference of scope.references) {
      if (!reference.isRead() || !isNode(reference.identifier)) {
        continue;
      }
      let use: Node = reference.identifier;
      let parent = child(use, "parent");
      while (
        parent &&
        ((parent.type === "MemberExpression" && child(parent, "object") === use) || wrapper(parent))
      ) {
        use = parent;
        parent = child(use, "parent");
      }
      const call =
        parent &&
        ["NewExpression", "CallExpression"].includes(parent.type) &&
        child(parent, "callee") === use
          ? parent
          : undefined;
      const paths = resolves(use).map((path) => {
        if (path[0] !== "Date") {
          return path;
        }
        // The intrinsic prototype constructor is Date itself; preserve its remaining path.
        while (path[1] === "prototype" && ["constructor", "*"].includes(path[2] ?? "")) {
          path = ["Date", ...path.slice(3)];
        }
        // Date and its static methods are intrinsic functions even where time is permitted.
        let index = ["now", "parse", "UTC"].includes(path[1] ?? "") ? 2 : 1;
        while (["call", "apply", "bind"].includes(path[index] ?? "")) {
          index++;
        }
        return path[index] === "constructor" || path[index] === "*"
          ? ["Function", ...path.slice(index + 1)]
          : path;
      });
      const denied = paths.some((path) =>
        patterns.some((pattern) => {
          if (!path.length) {
            return !aliasSource(use);
          }
          const match = pattern.path.every(
            (segment, index) => path[index] === segment || path[index] === "*",
          );
          if (pattern.constructor && pattern.zero) {
            return (
              match &&
              path.length === 1 &&
              (call
                ? call.type === "CallExpression" ||
                  !children(call, "arguments").some(suppliesArgument)
                : !aliasSource(use))
            );
          }
          if (match) {
            return true;
          }
          return path.length === 1 && path[0] === pattern.path[0] && !call && !aliasSource(use);
        }),
      );
      if (denied && !reported.has(use)) {
        reported.add(use);
      }
    }
  }
  return [...reported];
}
