// SPDX-License-Identifier: Apache-2.0
import { describe, expect, expectTypeOf, it } from "vitest";
import { z } from "zod";
import { entityId, parseEntityId, parseIdPrefixes, initialIdPrefixes } from "../index.ts";
import type { EntityId } from "../index.ts";

const suffix = "01JC8Z3Q7M5V9K2X4T6W8Y0ABC";
describe("entity IDs", () => {
  it("retains prefix-specific types and parses through the public API", () => {
    const value = entityId("run").parse(`run_${suffix}`);
    expectTypeOf(value).toEqualTypeOf<EntityId<"run">>();
    expect(parseEntityId("run", value)).toEqual({ ok: true, value });
    for (const prefix of initialIdPrefixes) {
      expect(entityId(prefix).safeParse(`${prefix}_${suffix}`).success).toBe(true);
    }
  });
  it.each(
    [
      `agt_${suffix}`,
      `run_${suffix.toLowerCase()}`,
      `run_${suffix.slice(1)}`,
      `run_${suffix}0`,
      `run_8${suffix.slice(1)}`,
      `run_Z${suffix.slice(1)}`,
      `run_${suffix}\n`,
      ...["I", "L", "O", "U", "i", "l", "o", "u"].map(
        (letter) => `run_${suffix.slice(0, -1)}${letter}`,
      ),
      null,
      undefined,
      1,
      {},
      [],
    ].map((input) => ({ input })),
  )("denies malformed ID input without echoing it: %#", ({ input }) => {
    const parsed = parseEntityId("run", input);
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(parsed.error.code).toBe("validation.invalid_input");
      expect(parsed.error.message).toBe("The input is invalid.");
      if (typeof input === "string" && input.length > 0) {
        expect(JSON.stringify(parsed.error)).not.toContain(input);
      }
    }
  });
  it.each(["ws", "RUN", "run_", "r.n", "", "rrrr", "run\n"])(
    "denies malformed prefix %j",
    (prefix) => {
      expect(parseEntityId(prefix, `run_${suffix}`).ok).toBe(false);
    },
  );
  it("preserves a native string schema for JSON Schema conversion", () => {
    const schema = z.toJSONSchema(entityId("run"));
    expect(schema.type).toBe("string");
    expect(schema.minLength).toBe(30);
    expect(schema.maxLength).toBe(30);
    expect(schema.pattern).toContain("run_");
  });
  it("accepts the maximal representable ULID and rejects 129-bit overflow", () => {
    expect(entityId("run").safeParse(`run_7${"Z".repeat(25)}`).success).toBe(true);
    expect(entityId("run").safeParse(`run_8${"0".repeat(25)}`).success).toBe(false);
  });
});
describe("prefix registry", () => {
  it("preserves every reserved initial prefix exactly once", () => {
    expect(initialIdPrefixes).toEqual([
      "wsp",
      "agt",
      "run",
      "nex",
      "wfl",
      "wfv",
      "tsk",
      "lan",
      "brd",
      "dsc",
      "dec",
      "msg",
      "amg",
      "cnv",
      "apr",
      "acr",
      "aud",
      "evt",
      "skl",
      "skv",
      "art",
      "con",
      "ntf",
      "req",
      "rul",
    ]);
    expect(parseIdPrefixes(initialIdPrefixes).ok).toBe(true);
  });
  it("accepts initial and per-area definitions without mutating inputs", () => {
    const prefixes = [...initialIdPrefixes, "abc"];
    const result = parseIdPrefixes(prefixes);
    expect(result).toEqual({ ok: true, value: prefixes });
    if (result.ok) {
      expect(Object.isFrozen(result.value)).toBe(true);
    }
    expect(prefixes.at(-1)).toBe("abc");
  });
  it.each(
    [[], ["run", "run"], ["ws"], ["Run"], ["ru1"], ["run\n"], [null], null, {}].map((registry) => ({
      registry,
    })),
  )("denies invalid or duplicate registry: %#", ({ registry }) => {
    const result = parseIdPrefixes(registry);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("validation.invalid_input");
    }
  });
});
