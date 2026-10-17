import { z } from "zod";
import type { JsonValue, ErrorDefinition } from "./definition.ts";

// Transitional error-boundary defence; ARCH004 will own shared redaction.
const sensitive =
  /(?:(?:^|\s|["'(])\/\S+|[A-Za-z]:[\\/]|\b(?:SELECT|INSERT|UPDATE|DELETE|DROP|ALTER|CREATE)\b|\b(?:Bearer|stderr)\b|(?:sk-|gh[pousr]_|github_pat_|xox[baprs]-)[A-Za-z0-9_-]+|[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]+|-----BEGIN|\bat\s+\S+\s*\(|\p{Cc})/iu;

export function isSafeText(value: string): boolean {
  return value.length <= 240 && !sensitive.test(value);
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

function jsonCopy(
  value: unknown,
  depth: number,
  seen: Set<object>,
  checkStrings = false,
): JsonValue | undefined {
  if (value === null || typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : undefined;
  }
  if (typeof value === "string") {
    return value.length <= 240 && (!checkStrings || isSafeText(value)) ? value : undefined;
  }
  if (typeof value !== "object" || depth > 8 || seen.has(value)) {
    return undefined;
  }
  const prototype: unknown = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null && prototype !== Array.prototype) {
    return undefined;
  }
  seen.add(value);
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const output: Record<string, JsonValue> = {};
  const entries = Object.entries(descriptors).filter(
    ([key]) => !(Array.isArray(value) && key === "length"),
  );
  if (entries.length > 100) {
    return undefined;
  }
  for (const [key, descriptor] of entries) {
    if (
      !/^[A-Za-z0-9_]{1,64}$/u.test(key) ||
      ["__proto__", "prototype", "constructor"].includes(key) ||
      !("value" in descriptor)
    ) {
      return undefined;
    }
    const copied = jsonCopy(descriptor.value, depth + 1, seen, checkStrings);
    if (copied === undefined) {
      return undefined;
    }
    output[key] = copied;
  }
  seen.delete(value);
  if (!Array.isArray(value)) {
    return output;
  }
  const length = value.length;
  if (length !== entries.length) {
    return undefined;
  }
  return Array.from({ length }, (_, index) => output[String(index)] ?? null);
}

export function validateDetails(
  definition: ErrorDefinition,
  input: unknown,
): Record<string, JsonValue> | undefined {
  if (input === undefined || !definition.detailsSchema) {
    return undefined;
  }
  try {
    const copy = jsonCopy(input, 0, new Set());
    if (!copy || typeof copy !== "object" || Array.isArray(copy)) {
      return undefined;
    }
    const parsed = definition.detailsSchema.safeParse(copy);
    if (!parsed.success) {
      return undefined;
    }
    const validated = jsonCopy(parsed.data, 0, new Set(), true);
    return validated &&
      typeof validated === "object" &&
      !Array.isArray(validated) &&
      JSON.stringify(validated).length <= 16_384 &&
      approvedBySchema(z.toJSONSchema(definition.detailsSchema, { io: "input" }), validated)
      ? validated
      : undefined;
  } catch {
    return undefined;
  }
}
