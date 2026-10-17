import { z } from "zod";
import type { JsonValue, ErrorDefinition } from "./definition.ts";

// Transitional error-boundary defence; ARCH004 will own shared redaction.
// Credentials can be embedded in identifiers, so token patterns cannot rely on
// word boundaries: underscores, letters and suffixes never make a token safe.
const sensitive = [
  /\/(?:Users|home)(?:\/|$)/iu,
  /(?:^|[^\p{L}\p{N}_./-])\/\S+|[A-Za-z]:[\\/]/u,
  /\b(?:SELECT|INSERT|UPDATE|DELETE|DROP|ALTER|CREATE)\b|\b(?:Bearer|stderr)\b/iu,
  /bearer\s+[A-Za-z0-9._~+/=-]{16,}/iu,
  /(?:sk-|gh[pousr]_|github_pat_|xox[baprs]-)[A-Za-z0-9_-]+/u,
  /(?:AKIA|ASIA)[0-9A-Z]{16}/u,
  /\d{8,10}:[A-Za-z0-9_-]{35}/u,
  /api\.telegram\.org\/bot[^/\s]+/iu,
  /ovm_(?:st|at)_[A-Za-z0-9_-]{20,}/u,
  /[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]+/u,
  /eyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/u,
  /-----BEGIN|\bat\s+\S+\s*\(|\p{Cc}/u,
  /keychain:[A-Za-z0-9._/-]+/iu,
  /[?&](?:code|access_token|refresh_token|id_token)=[^&\s]+/iu,
  /[a-z][a-z0-9+.-]*:\/\/[^/\s:@]+:[^/\s@]+@/iu,
];

export function isSafeText(value: string): boolean {
  return value.length <= 240 && !sensitive.some((pattern) => pattern.test(value));
}

export const sanitisedText = z
  .string()
  .max(200)
  .transform((value) => value.replace(/\p{Cc}/gu, ""))
  .refine(isSafeText)
  .meta({ sanitised: true });

export const sanitisedRelativePath = sanitisedText
  .transform((value) => value.replaceAll("\\", "/"))
  .refine(
    (value) =>
      value.length > 0 &&
      value.split("/").every((part) => part.length > 0 && part !== "." && part !== ".."),
  )
  .meta({ sanitised: true });

function schemaObject(input: unknown): Record<string, unknown> | undefined {
  return input !== null && typeof input === "object" && !Array.isArray(input)
    ? (input as Record<string, unknown>)
    : undefined;
}

function approvedBySchema(schema: unknown, value: JsonValue): boolean {
  const node = schemaObject(schema);
  if (!node) {
    return false;
  }
  if (Array.isArray(node["anyOf"])) {
    return node["anyOf"].some((branch: unknown) => approvedBySchema(branch, value));
  }
  if (typeof value === "string") {
    return (
      node["const"] === value ||
      (Array.isArray(node["enum"]) && node["enum"].includes(value)) ||
      (node["sanitised"] === true &&
        typeof node["maxLength"] === "number" &&
        node["maxLength"] <= 200)
    );
  }
  if (Array.isArray(value)) {
    return value.every((entry) => approvedBySchema(node["items"], entry));
  }
  if (value !== null && typeof value === "object") {
    const properties = schemaObject(node["properties"]);
    return (
      properties !== undefined &&
      Object.entries(value).every(
        ([key, entry]) =>
          Object.hasOwn(properties, key) && approvedBySchema(properties[key], entry),
      )
    );
  }
  return true;
}

interface CopyBudget {
  entries: number;
  bytes: number;
  readonly seen: Set<object>;
  readonly checkStrings: boolean;
}

function spendBytes(budget: CopyBudget, bytes: number): boolean {
  budget.bytes -= bytes;
  return budget.bytes >= 0;
}

function primitiveBytes(value: null | boolean | number | string): number {
  let bytes = 0;
  for (const character of JSON.stringify(value)) {
    const point = character.codePointAt(0) ?? 0;
    bytes += point <= 0x7f ? 1 : point <= 0x7ff ? 2 : point <= 0xffff ? 3 : 4;
  }
  return bytes;
}

function jsonCopy(value: unknown, depth: number, budget: CopyBudget): JsonValue | undefined {
  budget.entries -= 1;
  if (budget.entries < 0) {
    return undefined;
  }
  if (
    value === null ||
    typeof value === "boolean" ||
    (typeof value === "number" && Number.isFinite(value)) ||
    (typeof value === "string" &&
      value.length <= 240 &&
      (!budget.checkStrings || isSafeText(value)))
  ) {
    return spendBytes(budget, primitiveBytes(value)) ? value : undefined;
  }
  if (typeof value !== "object" || depth > 8 || budget.seen.has(value)) {
    return undefined;
  }
  const array = Array.isArray(value);
  const prototype: unknown = Object.getPrototypeOf(value);
  if (
    array ? prototype !== Array.prototype : prototype !== Object.prototype && prototype !== null
  ) {
    return undefined;
  }
  const ownKeys = Reflect.ownKeys(value);
  if (ownKeys.length > (array ? 101 : 100) || ownKeys.some((key) => typeof key !== "string")) {
    return undefined;
  }
  const keys = ownKeys.filter(
    (key): key is string => typeof key === "string" && !(array && key === "length"),
  );
  if (keys.length > budget.entries) {
    return undefined;
  }
  if (array) {
    const length: unknown = Object.getOwnPropertyDescriptor(value, "length")?.value;
    if (length !== keys.length || keys.some((key, index) => key !== String(index))) {
      return undefined;
    }
  }
  let framingBytes = 2 + Math.max(0, keys.length - 1);
  for (const key of keys) {
    if (
      !/^[A-Za-z0-9_]{1,64}$/u.test(key) ||
      ["__proto__", "prototype", "constructor"].includes(key)
    ) {
      return undefined;
    }
    if (!array) {
      framingBytes += key.length + 3;
    }
  }
  if (!spendBytes(budget, framingBytes)) {
    return undefined;
  }
  budget.seen.add(value);
  const output: Record<string, JsonValue> = {};
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !descriptor.enumerable || !("value" in descriptor)) {
      return undefined;
    }
    const copied = jsonCopy(descriptor.value, depth + 1, budget);
    if (copied === undefined) {
      return undefined;
    }
    output[key] = copied;
  }
  budget.seen.delete(value);
  return array ? keys.map((key) => output[key] ?? null) : output;
}

function boundedCopy(value: unknown, checkStrings = false): JsonValue | undefined {
  return jsonCopy(value, 0, {
    entries: 512,
    bytes: 16_384,
    seen: new Set(),
    checkStrings,
  });
}

export function validateDetails(
  definition: ErrorDefinition,
  input: unknown,
): Record<string, JsonValue> | undefined {
  if (input === undefined || !definition.detailsSchema) {
    return undefined;
  }
  try {
    const copy = boundedCopy(input);
    if (!copy || typeof copy !== "object" || Array.isArray(copy)) {
      return undefined;
    }
    const parsed = definition.detailsSchema.safeParse(copy);
    if (!parsed.success) {
      return undefined;
    }
    const validated = boundedCopy(parsed.data, true);
    return validated &&
      typeof validated === "object" &&
      !Array.isArray(validated) &&
      approvedBySchema(z.toJSONSchema(definition.detailsSchema, { io: "input" }), validated)
      ? validated
      : undefined;
  } catch {
    return undefined;
  }
}
