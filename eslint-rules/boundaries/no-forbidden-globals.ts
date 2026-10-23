// SPDX-License-Identifier: Apache-2.0
import type { JSSyntaxElement, Rule, SourceCode } from "eslint";
import { environment } from "./resolve-package.ts";

type Node = JSSyntaxElement & Readonly<Record<string, unknown>>;
type Variable = ReturnType<SourceCode["getScope"]>["variables"][number];
interface Write {
  readonly target: readonly string[];
  readonly value: Node;
  readonly select: readonly string[];
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
function key(node: Node | undefined): string {
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
const memberKey = (node: Node): string =>
  node["computed"] === true && child(node, "property")?.type === "Identifier"
    ? "*"
    : key(child(node, "property"));
const globalObjects = new Set(["globalThis", "global", "window", "self"]);
const wrapper = (node: Node): boolean =>
  node.type === "ChainExpression" ||
  (node.type.startsWith("TS") && child(node, "expression") !== undefined);

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
    select: readonly string[] = [],
    path: readonly string[] = [],
  ) => {
    if (target.type === "Identifier") {
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
            property.type === "RestElement"
              ? select
              : [...select, property["computed"] === true ? "*" : key(child(property, "key"))],
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
                [...select, element.type === "RestElement" ? "*" : String(index)],
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
      (node.type === "VariableDeclarator" || node.type === "AssignmentExpression") &&
      target &&
      value
    ) {
      add(target, value);
    }
  }
  const resolves = (
    node: Node | undefined,
    select: readonly string[] = [],
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
        if (typeof name === "string" && globalObjects.has(name)) {
          values.push([...select]);
        } else if (typeof name === "string" && roots.has(name)) {
          values.push([name, ...select]);
        }
      }
      return values;
    }
    if (node.type === "ObjectExpression") {
      return children(node, "properties").flatMap((property) => {
        if (property.type === "SpreadElement") {
          return resolves(child(property, "argument"), select, seen);
        }
        const name = property["computed"] === true ? "*" : key(child(property, "key"));
        return !select.length || select[0] === "*" || name === "*" || name === select[0]
          ? resolves(child(property, "value"), select.slice(1), seen)
          : [];
      });
    }
    if (node.type === "ArrayExpression") {
      const elements = node["elements"];
      return Array.isArray(elements)
        ? elements.flatMap((value: unknown, index) =>
            isNode(value) && (!select.length || select[0] === "*" || select[0] === String(index))
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
    if (parent.type === "AssignmentExpression") {
      return child(parent, "right") === node;
    }
    return (
      !["CallExpression", "NewExpression", "ReturnStatement", "ExpressionStatement"].includes(
        parent.type,
      ) && aliasSource(parent)
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
      const paths = resolves(use);
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
                  children(call, "arguments").every(
                    (argument) =>
                      argument.type === "SpreadElement" &&
                      !children(child(argument, "argument") ?? argument, "elements").length,
                  )
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
