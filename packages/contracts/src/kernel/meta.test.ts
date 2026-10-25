// SPDX-License-Identifier: Apache-2.0
import { describe, expect, expectTypeOf, it } from "vitest";
import { z } from "zod";
import { defineEntity, defineEventMetadata } from "./meta.ts";

describe("pure contract metadata", () => {
  it("preserves entity schema identity, inference and literal names", () => {
    const schema = z.strictObject({ paused: z.boolean() });
    const entity = defineEntity("PauseState", schema);
    expectTypeOf(entity.contractMeta.name).toEqualTypeOf<"PauseState">();
    expectTypeOf<z.infer<typeof entity.schema>>().toEqualTypeOf<{ paused: boolean }>();
    expect(entity.schema).toBe(schema);
    expect(entity.contractMeta).toEqual({ kind: "entity", name: "PauseState", schema });
    expect(entity.contractMeta.schema).toBe(schema);
    expect(entity.schema.parse({ paused: true })).toEqual({ paused: true });
  });

  it("preserves snake_case event names and schema inference without an envelope", () => {
    const schema = z.strictObject({ approved: z.boolean() });
    const event = defineEventMetadata("access_request.granted", schema, { persisted: true });
    expectTypeOf(event.type).toEqualTypeOf<"access_request.granted">();
    expectTypeOf<z.infer<typeof event.schema>>().toEqualTypeOf<{ approved: boolean }>();
    expect(event).toEqual({
      kind: "event",
      type: "access_request.granted",
      schema,
      persisted: true,
    });
    expect(event.schema).toBe(schema);
    expect(event.schema.parse({ approved: true })).toEqual({ approved: true });
  });
});

describe("metadata ownership and validation", () => {
  for (const persisted of [false, true]) {
    it(`freezes event metadata with persisted=${String(persisted)}, preserving the schema`, () => {
      const schema = z.string().refine((value) => value.startsWith("ok"));
      const wasFrozen = Object.isFrozen(schema);
      const options = { persisted };
      const event = defineEventMetadata("run.node.started", schema, options);
      options.persisted = !persisted;
      expect(event.persisted).toBe(persisted);
      expect(Object.isFrozen(event)).toBe(true);
      expect(Object.isFrozen(schema)).toBe(wasFrozen);
      expect(event.schema.safeParse("other").success).toBe(false);
      expect(event.schema.parse("okay")).toBe("okay");
    });
  }

  it("freezes both entity containers and retains schema refinements", () => {
    const schema = z.string().min(2);
    const wasFrozen = Object.isFrozen(schema);
    const entity = defineEntity("Label", schema);
    expect(Object.isFrozen(entity)).toBe(true);
    expect(Object.isFrozen(entity.contractMeta)).toBe(true);
    expect(Object.isFrozen(schema)).toBe(wasFrozen);
    expect(entity.schema.safeParse("x").success).toBe(false);
    expect(entity.schema.parse("ok")).toBe("ok");
  });

  it("does not register names or types globally", () => {
    const schema = z.string();
    expect(defineEntity("Label", schema)).not.toBe(defineEntity("Label", schema));
    expect(defineEventMetadata("run.started", schema, { persisted: true })).not.toBe(
      defineEventMetadata("run.started", schema, { persisted: true }),
    );
  });

  for (const name of ["A", "PauseState", "State2", "A".repeat(120)]) {
    it(`accepts PascalCase entity name of length ${String(name.length)}: ${name.slice(0, 12)}`, () => {
      expect(defineEntity(name, z.string()).contractMeta.name).toBe(name);
    });
  }
  for (const name of [
    "",
    "a",
    "pauseState",
    "Pause_State",
    "Pause-State",
    "Pause.State",
    "A ",
    "A\n",
    "A".repeat(121),
    null,
    1,
  ]) {
    it(`rejects malformed entity name ${JSON.stringify(name)}`, () => {
      expect(() => defineEntity(name as string, z.string())).toThrow("Invalid entity metadata.");
    });
  }
  for (const type of [
    "a.b",
    "access_request.granted",
    "run.node.started",
    `${"a".repeat(118)}.b`,
  ]) {
    it(`accepts event type of length ${String(type.length)}: ${type.slice(0, 20)}`, () => {
      expect(defineEventMetadata(type, z.string(), { persisted: false }).type).toBe(type);
    });
  }
  for (const type of [
    "",
    "run",
    ".run",
    "run.",
    "run..started",
    "Run.started",
    "run.Started",
    "run-node.started",
    "run.node-started",
    "_run.started",
    "run_.started",
    "run__node.started",
    "run. started",
    "run.started\n",
    `${"a".repeat(119)}.b`,
    null,
    1,
  ]) {
    it(`rejects malformed event type ${JSON.stringify(type)}`, () => {
      expect(() => defineEventMetadata(type as string, z.string(), { persisted: true })).toThrow(
        "Invalid event metadata.",
      );
    });
  }
  for (const schema of [null, {}, "schema"]) {
    it(`rejects non-Zod schema ${JSON.stringify(schema)} with fixed invariant errors`, () => {
      expect(() => defineEntity("Label", schema as z.ZodType)).toThrow("Invalid entity metadata.");
      expect(() =>
        defineEventMetadata("run.started", schema as z.ZodType, { persisted: true }),
      ).toThrow("Invalid event metadata.");
    });
  }

  for (const options of [
    null,
    [],
    {},
    { persisted: undefined },
    { persisted: 1 },
    { persisted: "true" },
    { persisted: true, extra: true },
    Object.create({ persisted: true }),
  ]) {
    it(`rejects malformed event options ${JSON.stringify(options)}`, () => {
      expect(() =>
        defineEventMetadata("run.started", z.string(), options as { persisted: boolean }),
      ).toThrow("Invalid event metadata.");
    });
  }

  for (const key of ["persisted", "extra", Symbol("extra")]) {
    it(`never invokes an event option accessor at ${String(key)}`, () => {
      let calls = 0;
      const options = Object.defineProperty({ persisted: true }, key, {
        enumerable: true,
        get() {
          calls += 1;
          return true;
        },
      });
      expect(() => defineEventMetadata("run.started", z.string(), options)).toThrow(
        "Invalid event metadata.",
      );
      expect(calls).toBe(0);
    });
  }

  it("rejects symbol data and non-enumerable event metadata", () => {
    expect(() =>
      defineEventMetadata("run.started", z.string(), { persisted: true, [Symbol("extra")]: false }),
    ).toThrow("Invalid event metadata.");
    const options = Object.defineProperty({}, "persisted", { value: true });
    expect(() =>
      defineEventMetadata("run.started", z.string(), options as { persisted: boolean }),
    ).toThrow("Invalid event metadata.");
  });

  it("accepts ordinary null-prototype declarative options", () => {
    const options = Object.assign(Object.create(null) as { persisted: boolean }, {
      persisted: true,
    });
    expect(defineEventMetadata("run.started", z.string(), options).persisted).toBe(true);
  });

  it("uses the existing sanitized registration invariant", () => {
    expect(() => defineEntity("invalid", z.string())).toThrow(
      expect.objectContaining({ name: "InvariantError", message: "Invalid entity metadata." }),
    );
    expect(() => defineEventMetadata("invalid", z.string(), { persisted: true })).toThrow(
      expect.objectContaining({ name: "InvariantError", message: "Invalid event metadata." }),
    );
  });
});

describe("schema candidate accessors", () => {
  for (const stage of ["_zod", "traits", "has", "inherited _zod"] as const) {
    for (const factory of ["entity", "event"] as const) {
      it(`rejects ${factory} schema ${stage} accessors without invoking them`, () => {
        let calls = 0;
        const getter = {
          get() {
            calls += 1;
            return undefined;
          },
        };
        const traits = new Set<string>();
        const internals =
          stage === "traits" ? Object.defineProperty({}, "traits", getter) : { traits };
        if (stage === "has") {
          Object.defineProperty(traits, "has", getter);
        }
        const schema: unknown =
          stage === "_zod"
            ? Object.defineProperty({}, "_zod", getter)
            : stage === "inherited _zod"
              ? Object.create(Object.defineProperty({}, "_zod", getter))
              : { _zod: internals };
        if (factory === "entity") {
          expect(() => defineEntity("Label", schema as z.ZodType)).toThrow(
            "Invalid entity metadata.",
          );
        } else {
          expect(() =>
            defineEventMetadata("run.started", schema as z.ZodType, { persisted: true }),
          ).toThrow("Invalid event metadata.");
        }
        expect(calls).toBe(0);
      });
    }
  }

  for (const traits of [null, {}, new WeakSet(), new Proxy(new Set(), {})]) {
    it("fails closed on invalid or proxied Zod trait sets", () => {
      const schema = { _zod: { traits } } as unknown as z.ZodType;
      expect(() => defineEntity("Label", schema)).toThrow("Invalid entity metadata.");
      expect(() => defineEventMetadata("run.started", schema, { persisted: true })).toThrow(
        "Invalid event metadata.",
      );
    });
  }

  it("preserves the official trait classification without calling a candidate has method", () => {
    const schema = z.string();
    const traits = Object.getOwnPropertyDescriptor(schema, "_zod")?.value as {
      traits: Set<string>;
    };
    let calls = 0;
    Object.defineProperty(traits.traits, "has", {
      get() {
        calls += 1;
        return undefined;
      },
    });
    expect(defineEntity("Label", schema).schema).toBe(schema);
    expect(defineEventMetadata("run.started", schema, { persisted: false }).schema).toBe(schema);
    expect(calls).toBe(0);
  });
});

it("sanitizes failed reflective event option reads", () => {
  const options = new Proxy(
    { persisted: true },
    {
      ownKeys() {
        throw new Error("Untrusted reflection failure");
      },
    },
  );
  expect(() => defineEventMetadata("run.started", z.string(), options)).toThrow(
    "Invalid event metadata.",
  );
});
