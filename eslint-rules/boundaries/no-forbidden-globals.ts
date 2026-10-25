// SPDX-License-Identifier: Apache-2.0
import type { JSSyntaxElement, Rule, SourceCode } from "eslint";
import { environment } from "./resolve-package.ts";

type Node = JSSyntaxElement & Readonly<Record<string, unknown>>;
type Variable = ReturnType<SourceCode["getScope"]>["variables"][number];
type Selection = string | { readonly restOffset: number };
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
  const resolves = (
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
      const values = (variable ? (writes.get(variable) ?? []) : []).flatMap((write) => {
        if (
          write.target.length &&
          select.length &&
          !write.target.every(
            (segment, index) =>
              segment === "*" || select[index] === "*" || segment === select[index],
          )
        ) {
          return [];
        }
        return resolves(write.value, [...write.select, ...select.slice(write.target.length)], next);
      });
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
      return children(node, "properties").flatMap((property) => {
        if (property.type === "SpreadElement") {
          return resolves(child(property, "argument"), select, seen);
        }
        const name = memberKey(property, "key");
        return !select.length || select[0] === "*" || name === "*" || name === select[0]
          ? resolves(child(property, "value"), select.slice(1), seen)
          : [];
      });
    }
    if (node.type === "ArrayExpression") {
      const elements = node["elements"];
      let offset = 0;
      while (typeof select[0] === "object") {
        offset += select[0].restOffset;
        select = select.slice(1);
      }
      return Array.isArray(elements)
        ? elements.flatMap((value: unknown, index) =>
            isNode(value) &&
            index >= offset &&
            (!select.length || select[0] === "*" || select[0] === String(index - offset))
              ? resolves(value, select.slice(1), seen)
              : [],
          )
        : [];
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
        while (path[1] === "prototype" && path[2] === "constructor") {
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
