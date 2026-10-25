// SPDX-License-Identifier: Apache-2.0
import { describe, expect, expectTypeOf, it } from "vitest";
import { z } from "zod";
import { defineRoute, type RouteDefinition } from "./define-route.ts";

function definition(): RouteDefinition {
  return {
    id: "pause.global.set",
    method: "POST",
    path: "/v1/pause/global",
    request: z.strictObject({ paused: z.boolean() }),
    response: z.object({ paused: z.boolean() }),
    errors: ["gateway.unauthenticated"],
    scope: ["owner"],
    idempotency: "natural",
    summary: "Set Global Pause",
    tags: ["pause"],
    stability: "stable",
  };
}

describe("route authoring metadata", () => {
  it("preserves literal IDs and schema inference for the future generator", () => {
    const schema = z.strictObject({ paused: z.boolean() });
    const route = defineRoute({ ...definition(), id: "pause.global.set", response: schema });
    expectTypeOf(route.contractMeta.id).toEqualTypeOf<"pause.global.set">();
    expectTypeOf<z.infer<typeof route.contractMeta.response>>().toEqualTypeOf<{
      paused: boolean;
    }>();
    expect(route.contractMeta.kind).toBe("route");
    expect(route.contractMeta.response).toBe(schema);
    expect(route.contractMeta.response.parse({ paused: true })).toEqual({ paused: true });
  });

  it("owns immutable metadata arrays without freezing or changing the schema", () => {
    const input = definition();
    const errors = [...input.errors];
    const scope: ("owner" | "agent")[] = ["owner"];
    const tags = ["pause"];
    const schemaWasFrozen = Object.isFrozen(input.response);
    const route = defineRoute({ ...input, errors, scope, tags });
    errors.push("internal.unexpected");
    scope.push("agent");
    tags.push("changed");
    expect(route.contractMeta.errors).toEqual(["gateway.unauthenticated"]);
    expect(route.contractMeta.scope).toEqual(["owner"]);
    expect(route.contractMeta.tags).toEqual(["pause"]);
    expect(Object.isFrozen(route)).toBe(true);
    expect(Object.isFrozen(route.contractMeta)).toBe(true);
    expect(Object.isFrozen(route.contractMeta.scope)).toBe(true);
    expect(Object.isFrozen(input.response)).toBe(schemaWasFrozen);
  });

  it("keeps factories independent rather than maintaining an import-time registry", () => {
    const first = defineRoute(definition());
    const second = defineRoute(definition());
    expect(first).not.toBe(second);
    expect(first.contractMeta.id).toBe(second.contractMeta.id);
  });

  it("rejects inherited metadata and accessors without invoking the getter", () => {
    const inherited: unknown = Object.create(definition());
    expect(() => defineRoute(inherited as RouteDefinition)).toThrow("Invalid route metadata.");
    let invoked = false;
    const accessor = {
      ...definition(),
      get summary() {
        invoked = true;
        return "A getter is not declarative data";
      },
    };
    expect(() => defineRoute(accessor)).toThrow("Invalid route metadata.");
    expect(invoked).toBe(false);
  });

  it("rejects symbol metadata without evaluating its accessor during copying", () => {
    let invoked = false;
    const input = {
      ...definition(),
      get [Symbol("untrusted")]() {
        invoked = true;
        return "Unexpected metadata";
      },
    };
    expect(() => defineRoute(input)).toThrow("Invalid route metadata.");
    expect(invoked).toBe(false);
  });

  it("rejects non-enumerable required metadata rather than losing it when copying", () => {
    const input = Object.defineProperty(definition(), "summary", { enumerable: false });
    expect(() => defineRoute(input)).toThrow("Invalid route metadata.");
  });

  for (const field of ["scope", "errors", "tags"] as const) {
    it(`rejects sparse ${field} without copying missing entries as undefined`, () => {
      const entries = ["owner"];
      Reflect.deleteProperty(entries, "0");
      const input: unknown = { ...definition(), [field]: entries };
      expect(() => defineRoute(input as RouteDefinition)).toThrow("Invalid route metadata.");
    });
  }

  for (const scope of [["owner"], ["agent"], ["channel:telegram"], ["system"]] as const) {
    it(`records the existing ${scope[0]} audience without granting access`, () => {
      expect(defineRoute({ ...definition(), scope }).contractMeta.scope).toEqual(scope);
    });
  }

  it("allows Owner-local permission metadata and agent-bound stable routes", () => {
    expect(
      defineRoute({ ...definition(), local: true, expandsPermissions: true }).contractMeta.local,
    ).toBe(true);
    expect(
      defineRoute({ ...definition(), scope: ["agent"], agentBinding: "own-run" }).contractMeta
        .agentBinding,
    ).toBe("own-run");
  });

  const malformed: readonly [string, unknown][] = [
    ["null", null],
    ["array", []],
    ["missing fields", {}],
    ["unknown field", { ...definition(), untrusted: true }],
    ["empty scope", { ...definition(), scope: [] }],
    ["unknown scope", { ...definition(), scope: ["administrator"] }],
    ["duplicate scope", { ...definition(), scope: ["owner", "owner"] }],
    ["experimental agent", { ...definition(), scope: ["agent"], stability: "experimental" }],
    ["remote expansion", { ...definition(), expandsPermissions: true }],
    [
      "agent expansion",
      { ...definition(), scope: ["agent"], local: true, expandsPermissions: true },
    ],
    [
      "channel expansion",
      { ...definition(), scope: ["channel:telegram"], local: true, expandsPermissions: true },
    ],
    [
      "mixed expansion",
      { ...definition(), scope: ["owner", "agent"], local: true, expandsPermissions: true },
    ],
    ["unbound audience", { ...definition(), agentBinding: "own-run" }],
    ["unknown binding", { ...definition(), scope: ["agent"], agentBinding: "any" }],
    ["non-boolean locality", { ...definition(), local: "true" }],
    ["invalid method", { ...definition(), method: "EXEC" }],
    ["invalid id", { ...definition(), id: "../route" }],
    ["unversioned path", { ...definition(), path: "/pause" }],
    ["query in path", { ...definition(), path: "/v1/pause?secret=value" }],
    ["control in path", { ...definition(), path: "/v1/pause\n" }],
    ["overlong summary", { ...definition(), summary: "x".repeat(201) }],
    ["invalid response", { ...definition(), response: {} }],
    ["invalid request", { ...definition(), request: {} }],
    ["invalid errors", { ...definition(), errors: [false] }],
    ["invalid tags", { ...definition(), tags: [null] }],
    ["unknown idempotency", { ...definition(), idempotency: "retry" }],
  ];
  for (const [name, value] of malformed) {
    it(`rejects ${name} without reflecting metadata into its diagnostic`, () => {
      expect(() => defineRoute(value as RouteDefinition)).toThrow("Invalid route metadata.");
    });
  }
});

describe("route declarative array boundary", () => {
  for (const field of ["scope", "errors", "tags"] as const) {
    it(`rejects an accessor in ${field} without invoking it`, () => {
      let calls = 0;
      const entries = Object.defineProperty(["owner"], "0", {
        enumerable: true,
        get() {
          calls += 1;
          return "owner";
        },
      });
      expect(() => defineRoute({ ...definition(), [field]: entries })).toThrow(
        "Invalid route metadata.",
      );
      expect(calls).toBe(0);
    });
  }
});

describe("route bounds and declarative ownership", () => {
  for (const method of ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"] as const) {
    it(`accepts the ${method} method`, () => {
      expect(defineRoute({ ...definition(), method }).contractMeta.method).toBe(method);
    });
  }
  const validBounds: readonly [string, Partial<RouteDefinition>][] = [
    ["one-character id", { id: "a" }],
    ["120-character id", { id: "a".repeat(120) }],
    ["dotted and hyphenated id", { id: "pause.global-set" }],
    ["minimum versioned path", { path: "/v1/" }],
    ["positive major", { path: "/v20/pause" }],
    ["500-character path", { path: "/v1/" + "x".repeat(496) }],
    ["one-character summary", { summary: "x" }],
    ["200-character summary", { summary: "x".repeat(200) }],
    ["empty errors", { errors: [] }],
    ["100 errors", { errors: Array.from({ length: 100 }, () => "error.code") }],
    ["200-character error", { errors: ["x".repeat(200)] }],
    ["one-character error", { errors: ["x"] }],
    ["empty tags", { tags: [] }],
    ["20 tags", { tags: Array.from({ length: 20 }, () => "tag") }],
    ["200-character tag", { tags: ["x".repeat(200)] }],
    ["one-character tag", { tags: ["x"] }],
    ["all four unique audiences", { scope: ["owner", "agent", "channel:telegram", "system"] }],
    ["false permission flags", { local: false, expandsPermissions: false }],
    ["experimental non-agent", { stability: "experimental", scope: ["system"] }],
    ["own-workspace agent", { scope: ["agent"], agentBinding: "own-workspace" }],
    ["key-required idempotency", { idempotency: "key-required" }],
    ["none idempotency", { idempotency: "none" }],
  ];
  for (const [name, patch] of validBounds) {
    it(`accepts ${name}`, () => {
      expect(defineRoute({ ...definition(), ...patch }).contractMeta).toMatchObject(patch);
    });
  }

  const malformedBounds: readonly [string, unknown][] = [
    ["empty id", { id: "" }],
    ["121-character id", { id: "a".repeat(121) }],
    ["uppercase id", { id: "Pause.set" }],
    ["empty id segment", { id: "pause..set" }],
    ["trailing id separator", { id: "pause-" }],
    ["wrong id type", { id: 1 }],
    ["empty path", { path: "" }],
    ["501-character path", { path: "/v1/" + "x".repeat(497) }],
    ["zero major", { path: "/v0/pause" }],
    ["padded major", { path: "/v01/pause" }],
    ["missing version slash", { path: "/v1" }],
    ["fragment path", { path: "/v1/pause#fragment" }],
    ["whitespace path", { path: "/v1/ pause" }],
    ["control path", { path: "/v1/pause\u0000" }],
    ["DEL path", { path: "/v1/pause\u007f" }],
    ["wrong path type", { path: 1 }],
    ["empty summary", { summary: "" }],
    ["wrong summary type", { summary: true }],
    ["101 errors", { errors: Array.from({ length: 101 }, () => "error.code") }],
    ["201-character error", { errors: ["x".repeat(201)] }],
    ["empty error", { errors: [""] }],
    ["21 tags", { tags: Array.from({ length: 21 }, () => "tag") }],
    ["201-character tag", { tags: ["x".repeat(201)] }],
    ["empty tag", { tags: [""] }],
    ["non-array errors", { errors: "error.code" }],
    ["non-array tags", { tags: "tag" }],
    ["non-array scope", { scope: "owner" }],
    ["non-string audience", { scope: [1] }],
    ["unknown stability", { stability: "preview" }],
    ["non-boolean expansion", { expandsPermissions: 1 }],
    ["invalid params", { params: {} }],
    ["invalid query", { query: {} }],
    ["system expansion", { scope: ["system"], local: true, expandsPermissions: true }],
  ];
  for (const [name, patch] of malformedBounds) {
    it(`rejects ${name}`, () => {
      expect(() => defineRoute({ ...definition(), ...(patch as object) })).toThrow(
        "Invalid route metadata.",
      );
    });
  }

  for (const field of ["scope", "errors", "tags"] as const) {
    it(`rejects custom iterators on ${field} without invoking them`, () => {
      let calls = 0;
      const entries = Object.defineProperty(["owner"], Symbol.iterator, {
        get() {
          calls += 1;
          return undefined;
        },
      });
      expect(() => defineRoute({ ...definition(), [field]: entries })).toThrow(
        "Invalid route metadata.",
      );
      expect(calls).toBe(0);
    });
    it(`rejects inherited, named, and non-enumerable entries in ${field}`, () => {
      const named = Object.assign(["owner"], { extra: true });
      const hidden = Object.defineProperty(["owner"], "0", { enumerable: false });
      const inherited = Object.setPrototypeOf(
        ["owner"],
        Object.create(Array.prototype) as object,
      ) as string[];
      for (const entries of [named, hidden, inherited]) {
        expect(() => defineRoute({ ...definition(), [field]: entries })).toThrow(
          "Invalid route metadata.",
        );
      }
    });
  }

  it("preserves every optional schema and its literal inference", () => {
    const request = z.strictObject({ value: z.string() });
    const params = z.strictObject({ id: z.string() });
    const query = z.strictObject({ page: z.number() });
    const route = defineRoute({ ...definition(), request, params, query });
    expect(route.contractMeta.request).toBe(request);
    expect(route.contractMeta.params).toBe(params);
    expect(route.contractMeta.query).toBe(query);
    expectTypeOf<z.infer<typeof route.contractMeta.params>>().toEqualTypeOf<{ id: string }>();
    expectTypeOf<z.infer<typeof route.contractMeta.query>>().toEqualTypeOf<{ page: number }>();
  });

  it("owns readonly arrays even when callers supply mutable variables", () => {
    const errors = ["error.code"];
    const scope: ("owner" | "agent")[] = ["owner"];
    const tags = ["tag"];
    const route = defineRoute({ ...definition(), errors, scope, tags });
    expectTypeOf(route.contractMeta.errors).toEqualTypeOf<readonly string[]>();
    expectTypeOf(route.contractMeta.scope).toEqualTypeOf<readonly ("owner" | "agent")[]>();
    expectTypeOf(route.contractMeta.tags).toEqualTypeOf<readonly string[]>();
    for (const array of [
      route.contractMeta.errors,
      route.contractMeta.scope,
      route.contractMeta.tags,
    ]) {
      expect(Object.isFrozen(array)).toBe(true);
    }
    expect(Object.isFrozen(errors)).toBe(false);
    expect(Object.isFrozen(scope)).toBe(false);
    expect(Object.isFrozen(tags)).toBe(false);
  });

  it("retains generator-owned schema checks without silently stripping refinements", () => {
    const response = z.string().refine((value) => value === "allowed");
    const route = defineRoute({ ...definition(), response });
    expect(route.contractMeta.response.safeParse("other").success).toBe(false);
    expect(route.contractMeta.response.parse("allowed")).toBe("allowed");
  });

  it("copies null-prototype route records without inheriting metadata", () => {
    const input = Object.assign(Object.create(null) as RouteDefinition, definition());
    expect(defineRoute(input).contractMeta.id).toBe("pause.global.set");
  });
});

it("rejects C1 control characters in route paths", () => {
  expect(() => defineRoute({ ...definition(), path: "/v1/pause\u0080" })).toThrow(
    "Invalid route metadata.",
  );
});

describe("route schema candidate accessors", () => {
  for (const field of ["response", "request", "params", "query"] as const) {
    for (const stage of ["_zod", "traits", "has", "inherited _zod"] as const) {
      it(`rejects ${field} schema ${stage} accessors without invoking them`, () => {
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
        expect(() => defineRoute({ ...definition(), [field]: schema })).toThrow(
          "Invalid route metadata.",
        );
        expect(calls).toBe(0);
      });
    }
  }
});

it("sanitizes failed reflective route reads", () => {
  const input = new Proxy(definition(), {
    ownKeys() {
      throw new Error("Untrusted reflection failure");
    },
  });
  expect(() => defineRoute(input)).toThrow("Invalid route metadata.");
});
for (const field of ["scope", "errors", "tags"] as const) {
  it(`sanitizes failed reflective ${field} reads`, () => {
    const entries = new Proxy(["owner"], {
      ownKeys() {
        throw new Error("Untrusted reflection failure");
      },
    });
    expect(() => defineRoute({ ...definition(), [field]: entries })).toThrow(
      "Invalid route metadata.",
    );
  });
}
