// SPDX-License-Identifier: Apache-2.0
import type { z } from "zod";
import { registrationInvariant } from "../errors/definition.ts";
import {
  boundedMetadataString,
  isMetadataSchema,
  readMetadataArray,
  readMetadataRecord,
} from "../kernel/meta.ts";

export type RouteMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD" | "OPTIONS";
export type RouteAudience = "owner" | "agent" | "channel:telegram" | "system";

/** Declarative contract data; the gateway supplies transport and authorization. */
export interface RouteDefinition {
  readonly id: string;
  readonly method: RouteMethod;
  readonly path: string;
  readonly request?: z.ZodType;
  readonly params?: z.ZodType;
  readonly query?: z.ZodType;
  readonly response: z.ZodType;
  readonly errors: readonly string[];
  readonly scope: readonly RouteAudience[];
  readonly idempotency: "none" | "key-required" | "natural";
  readonly summary: string;
  readonly tags: readonly string[];
  readonly stability: "stable" | "experimental";
  readonly local?: boolean;
  readonly agentBinding?: "own-run" | "own-workspace";
  readonly expandsPermissions?: boolean;
}

const methods = new Set<RouteMethod>(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]);
const audiences = new Set<RouteAudience>(["owner", "agent", "channel:telegram", "system"]);
const fields = new Set([
  "id",
  "method",
  "path",
  "request",
  "params",
  "query",
  "response",
  "errors",
  "scope",
  "idempotency",
  "summary",
  "tags",
  "stability",
  "local",
  "agentBinding",
  "expandsPermissions",
]);
type RouteMetadata<T extends RouteDefinition> = Readonly<Omit<T, "errors" | "scope" | "tags">> & {
  readonly kind: "route";
  readonly errors: Readonly<T["errors"]>;
  readonly scope: Readonly<T["scope"]>;
  readonly tags: Readonly<T["tags"]>;
};

/**
 * Copy metadata containers without freezing Zod's own instances or registering side effects.
 * Schema conversion, bounded wire strings, strict requests and error-catalogue membership
 * are checked by the ARCH008 generator; this factory does not claim those future gates.
 */
export function defineRoute<const T extends RouteDefinition>(
  input: T & Record<Exclude<keyof T, keyof RouteDefinition>, never>,
): { readonly contractMeta: RouteMetadata<T> } {
  const snapshot = validateRoute(input);
  const contractMeta = Object.freeze({
    ...snapshot,
    kind: "route" as const,
    errors: Object.freeze(snapshot.errors),
    scope: Object.freeze(snapshot.scope),
    tags: Object.freeze(snapshot.tags),
  });
  // Validation preserves every declared field; only owned arrays receive new containers.
  return Object.freeze({ contractMeta }) as { readonly contractMeta: RouteMetadata<T> };
}

function validateRoute(value: unknown): RouteDefinition {
  const invalid = () => registrationInvariant("Invalid route metadata.");
  const input = readMetadataRecord(value, fields);
  if (input === undefined) {
    return invalid();
  }
  const errors = readMetadataArray(input["errors"], 100);
  const tags = readMetadataArray(input["tags"], 20);
  const scope = readMetadataArray(input["scope"], audiences.size);
  if (
    !boundedMetadataString(input["id"], 120) ||
    !/^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/u.test(input["id"]) ||
    !(typeof input["method"] === "string" && methods.has(input["method"] as RouteMethod)) ||
    !boundedMetadataString(input["path"], 500) ||
    !/^\/v[1-9][0-9]*\//u.test(input["path"]) ||
    /[\s\p{Cc}?#]/u.test(input["path"]) ||
    !isMetadataSchema(input["response"]) ||
    ![input["request"], input["params"], input["query"]].every(
      (schema) => schema === undefined || isMetadataSchema(schema),
    ) ||
    errors === undefined ||
    !errors.every((entry) => boundedMetadataString(entry, 200)) ||
    tags === undefined ||
    !tags.every((entry) => boundedMetadataString(entry, 200)) ||
    !boundedMetadataString(input["summary"], 200) ||
    scope === undefined ||
    scope.length === 0 ||
    !scope.every((entry) => typeof entry === "string" && audiences.has(entry as RouteAudience)) ||
    new Set(scope).size !== scope.length ||
    !(
      typeof input["idempotency"] === "string" &&
      ["none", "key-required", "natural"].includes(input["idempotency"])
    ) ||
    !(
      typeof input["stability"] === "string" &&
      ["stable", "experimental"].includes(input["stability"])
    ) ||
    (input["local"] !== undefined && typeof input["local"] !== "boolean") ||
    (input["expandsPermissions"] !== undefined &&
      typeof input["expandsPermissions"] !== "boolean") ||
    (input["agentBinding"] !== undefined &&
      !(
        typeof input["agentBinding"] === "string" &&
        ["own-run", "own-workspace"].includes(input["agentBinding"])
      )) ||
    (input["agentBinding"] !== undefined && !scope.includes("agent")) ||
    (input["stability"] === "experimental" && scope.includes("agent")) ||
    (input["expandsPermissions"] === true &&
      (input["local"] !== true || scope.length !== 1 || scope[0] !== "owner"))
  ) {
    return invalid();
  }
  return { ...input, errors, tags, scope } as unknown as RouteDefinition;
}
