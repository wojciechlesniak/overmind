// SPDX-License-Identifier: Apache-2.0
import type { z } from "zod";
import { registrationInvariant } from "../errors/definition.ts";

/** Internal validation shared by the metadata factories, not wire-schema validation. */
export function readMetadataRecord(
  value: unknown,
  fields: ReadonlySet<string>,
): Record<string, unknown> | undefined {
  try {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      return undefined;
    }
    const prototype: unknown = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      return undefined;
    }
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const keys = Reflect.ownKeys(descriptors);
    if (
      keys.some((key) => {
        const descriptor = Object.getOwnPropertyDescriptor(value, key);
        return (
          typeof key !== "string" ||
          !fields.has(key) ||
          descriptor === undefined ||
          !descriptor.enumerable ||
          !("value" in descriptor)
        );
      })
    ) {
      return undefined;
    }
    const snapshot = Object.create(null) as Record<string, unknown>;
    for (const key of Object.keys(descriptors)) {
      snapshot[key] = descriptors[key]?.value;
    }
    return snapshot;
  } catch {
    return undefined;
  }
}

/** Read dense plain arrays through data descriptors, without calling input iterators/getters. */
export function readMetadataArray(value: unknown, maximum: number): readonly unknown[] | undefined {
  try {
    if (
      !Array.isArray(value) ||
      Object.getPrototypeOf(value) !== Array.prototype ||
      value.length > maximum
    ) {
      return undefined;
    }
    const descriptors = Object.getOwnPropertyDescriptors(value);
    if (
      Reflect.ownKeys(descriptors).length !== value.length + 1 ||
      Array.from({ length: value.length }, (_, index) => descriptors[String(index)]).some(
        (descriptor) =>
          descriptor === undefined || !descriptor.enumerable || !("value" in descriptor),
      )
    ) {
      return undefined;
    }
    return Array.from(
      { length: value.length },
      (_, index): unknown => descriptors[String(index)]?.value,
    );
  } catch {
    return undefined;
  }
}

export const boundedMetadataString = (value: unknown, maximum: number): value is string =>
  typeof value === "string" && value.length > 0 && value.length <= maximum;

/** Match pinned Zod4's trait classification without its accessor-reading Symbol.hasInstance. */
export function isMetadataSchema(value: unknown): value is z.ZodType {
  try {
    if ((typeof value !== "object" && typeof value !== "function") || value === null) {
      return false;
    }
    const internals: unknown = Object.getOwnPropertyDescriptor(value, "_zod")?.value;
    if (typeof internals !== "object" || internals === null) {
      return false;
    }
    const traits: unknown = Object.getOwnPropertyDescriptor(internals, "traits")?.value;
    // The native method checks its receiver and does not call a candidate's own has property.
    return traits instanceof Set && Set.prototype.has.call(traits, "ZodType");
  } catch {
    return false;
  }
}

/** Preserve the original schema; the later generator owns wire and duplicate-export checks. */
export function defineEntity<const Name extends string, S extends z.ZodType>(
  name: Name,
  schema: S,
) {
  if (
    !boundedMetadataString(name, 120) ||
    !/^[A-Z][A-Za-z0-9]*$/u.test(name) ||
    !isMetadataSchema(schema)
  ) {
    return registrationInvariant("Invalid entity metadata.");
  }
  return Object.freeze({
    schema,
    contractMeta: Object.freeze({ kind: "entity" as const, name, schema }),
  });
}

const eventOptionFields = new Set(["persisted"]);

/** Metadata only: ARCH010 supplies the complete event factory, envelope and event bus. */
export function defineEventMetadata<const Type extends string, S extends z.ZodType>(
  type: Type,
  schema: S,
  options: { readonly persisted: boolean },
) {
  const record = readMetadataRecord(options, eventOptionFields);
  if (
    !boundedMetadataString(type, 120) ||
    !/^[a-z][a-z0-9]*(?:_[a-z0-9]+)*(?:\.[a-z][a-z0-9]*(?:_[a-z0-9]+)*)+$/u.test(type) ||
    !isMetadataSchema(schema) ||
    record === undefined ||
    typeof record["persisted"] !== "boolean"
  ) {
    return registrationInvariant("Invalid event metadata.");
  }
  return Object.freeze({ kind: "event" as const, type, schema, persisted: record["persisted"] });
}
