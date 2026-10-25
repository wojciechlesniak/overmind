// SPDX-License-Identifier: Apache-2.0
import { describe, expect, expectTypeOf, it } from "vitest";
import { z } from "zod";
import * as contracts from "@overmind/contracts";
import {
  defineEntity,
  defineEventMetadata,
  defineRoute,
  idPrefixSchema,
  map,
  ok,
  type RouteAudience,
  type RouteDefinition,
  type RouteMethod,
} from "@overmind/contracts";

describe("public contract metadata seed", () => {
  it("preserves the entity schema and literal name through the package entry", () => {
    const schema = z.strictObject({ paused: z.boolean() });
    const entity = defineEntity("PauseState", schema);
    expectTypeOf(entity.contractMeta.name).toEqualTypeOf<"PauseState">();
    expectTypeOf<z.infer<typeof entity.schema>>().toEqualTypeOf<{ paused: boolean }>();
    expect(entity.schema).toBe(schema);
    expect(entity.contractMeta.schema).toBe(schema);
    expect(entity.schema.parse({ paused: true })).toEqual({ paused: true });
  });

  it("exposes event metadata without adding an event envelope or changing the schema", () => {
    const schema = z.strictObject({ approved: z.boolean() });
    const event = defineEventMetadata("access_request.granted", schema, { persisted: true });
    expectTypeOf(event.type).toEqualTypeOf<"access_request.granted">();
    expectTypeOf<z.infer<typeof event.schema>>().toEqualTypeOf<{ approved: boolean }>();
    expect(event.schema).toBe(schema);
    expect(event).toEqual({
      kind: "event",
      type: "access_request.granted",
      schema,
      persisted: true,
    });
  });

  it("preserves route inference and immutable metadata through public types", () => {
    const schema = z.strictObject({ paused: z.boolean() });
    const method: RouteMethod = "POST";
    const audience: RouteAudience = "owner";
    const definition = {
      id: "runs.pause",
      method,
      path: "/v1/runs/pause",
      response: schema,
      errors: [],
      scope: [audience],
      idempotency: "natural",
      summary: "Pause a Run",
      tags: ["runs"],
      stability: "stable",
    } as const satisfies RouteDefinition;
    const route = defineRoute(definition);
    expectTypeOf(route.contractMeta.id).toEqualTypeOf<"runs.pause">();
    expectTypeOf(route.contractMeta.scope).toEqualTypeOf<readonly ["owner"]>();
    expectTypeOf<z.infer<typeof route.contractMeta.response>>().toEqualTypeOf<{
      paused: boolean;
    }>();
    expect(route.contractMeta.response).toBe(schema);
    expect(route.contractMeta.scope).not.toBe(definition.scope);
    expect(Object.isFrozen(route.contractMeta.scope)).toBe(true);
    expect(route.contractMeta.kind).toBe("route");
  });

  it("keeps existing exports available and validation internals private", () => {
    expect(map(ok(2), (value) => value + 1)).toEqual({ ok: true, value: 3 });
    expect(idPrefixSchema.parse("run")).toBe("run");
    for (const name of [
      "readMetadataRecord",
      "readMetadataArray",
      "boundedMetadataString",
      "isMetadataSchema",
    ]) {
      expect(Object.hasOwn(contracts, name)).toBe(false);
    }
  });
});

describe("public metadata array descriptor reads", () => {
  for (const field of ["errors", "tags", "scope"] as const) {
    const definition = () => ({
      id: "probe.route",
      method: "GET" as const,
      path: "/v1/probe",
      response: z.string(),
      errors: [],
      scope: ["owner"] as const,
      idempotency: "none" as const,
      summary: "Probe route",
      tags: [],
      stability: "stable" as const,
    });

    it(`rejects extra ${field} metadata without reading a proxy length property`, () => {
      let calls = 0;
      const entries = new Proxy(Object.assign(["owner"], { extra: true }), {
        get(target, key, receiver): unknown {
          if (key === "length") {
            calls += 1;
          }
          return Reflect.get(target, key, receiver);
        },
      });
      expect(() => defineRoute({ ...definition(), [field]: entries })).toThrow(
        "Invalid route metadata.",
      );
      expect(calls).toBe(0);
    });

    it(`copies valid ${field} through descriptors without reading proxy properties`, () => {
      let calls = 0;
      const entries = new Proxy(["owner"], {
        get() {
          calls += 1;
          throw new Error("Ordinary property access is not declarative validation");
        },
      });
      const route = defineRoute({ ...definition(), [field]: entries });
      expect(route.contractMeta[field]).toEqual(["owner"]);
      expect(Object.is(route.contractMeta[field], entries)).toBe(false);
      expect(Object.isFrozen(route.contractMeta[field])).toBe(true);
      expect(calls).toBe(0);
    });
  }
});
