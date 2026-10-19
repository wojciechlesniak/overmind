// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from "vitest";
import { RuleTester, type Rule } from "eslint";
import { parser } from "typescript-eslint";
import { importNodes } from "./import-nodes.ts";
RuleTester.describe = describe;
RuleTester.it = it;
const rule: Rule.RuleModule = {
  meta: { schema: [], messages: { found: "{{specifier}}" } },
  create(context) {
    return {
      Program() {
        for (const reference of importNodes(context.sourceCode)) {
          context.report({
            node: reference.node,
            messageId: "found",
            data: { specifier: reference.specifier ?? "unknown" },
          });
        }
      },
    };
  },
};
new RuleTester({ languageOptions: { parser } }).run("independent import metadata", rule, {
  valid: [],
  invalid: [
    {
      code: 'import value from "@overmind/domain";',
      errors: [{ messageId: "found", data: { specifier: "@overmind/domain" }, line: 1, column: 1 }],
    },
  ],
});

const syntaxCases = [
  ['import "pkg";', "pkg", 1],
  ['export * from "pkg";', "pkg", 1],
  ['export { value } from "pkg";', "pkg", 1],
  ['import value = require("pkg");', "pkg", 1],
  ['type T = import("pkg").T;', "pkg", 10],
  ['type T = typeof import("pkg");', "pkg", 17],
  ['import("pkg")', "pkg", 1],
  ['require("pkg")', "pkg", 1],
  ["import(name)", "unknown", 1],
  ["require(name)", "unknown", 1],
  ["require()", "unknown", 1],
  ["import(`pkg`)", "pkg", 1],
  ["require(`pkg`)", "pkg", 1],
  ['import type { Value } from "pkg";', "pkg", 1],
  ['export type { Value } from "pkg";', "pkg", 1],
] as const;
new RuleTester({ languageOptions: { parser } }).run("all static import syntax families", rule, {
  valid: ['const text = "require(name)";', "const template = `import(name)`;"],
  invalid: syntaxCases.map(([code, specifier, column]) => ({
    code,
    filename: "fixture.generated.ts",
    errors: [{ messageId: "found", data: { specifier }, line: 1, column }],
  })),
});

it("normalizes a builtin subpath without granting an environment permission", async () => {
  const { importCapability } = await import("./import-capabilities.ts");
  expect(importCapability("node:fs/promises")).toEqual({
    kind: "builtin",
    name: "fs/promises",
    family: "fs",
  });
});

// Native ESLint contexts, real files and the existing bounded repository fixture.
import { Linter } from "eslint";
import { afterAll, afterEach } from "vitest";
import { resolve } from "node:path";
import { renameSync, symlinkSync, linkSync, readFileSync } from "node:fs";
import {
  createWorkspace,
  type FixtureWorkspace,
} from "../../tools/boundaries-fixtures/workspace.ts";
import {
  environment,
  packageTarget,
  matrixAllows,
  testOnlyAllowed,
  crossAdapter,
  type Environment,
} from "./resolve-package.ts";
import { importCapability } from "./import-capabilities.ts";
const workspaces: FixtureWorkspace[] = [];
afterEach(() => {
  for (const fixture of workspaces.splice(0)) {
    fixture.cleanup();
  }
});
function repository() {
  const fixture = createWorkspace();
  workspaces.push(fixture);
  const packages = [
    ["domain", "packages/domain", ["contracts"], {}],
    ["contracts", "packages/contracts", [], {}],
    ["application", "packages/application", ["contracts", "domain"], { application: ["ports"] }],
    ["adapters/a", "packages/adapters/a", ["contracts"], { application: ["ports"] }],
    ["adapters/b", "packages/adapters/b", [], {}],
    ["testing", "packages/testing", [], {}],
    ["apps/engine", "apps/engine", ["domain"], {}],
    ["tools", "tools", [], {}],
  ] as const;
  fixture.write(
    "docs/architecture/boundaries.json",
    JSON.stringify({
      version: 1,
      packages: packages.map(([id, path, allowedImports, allowedSubpaths]) => ({
        id,
        path,
        layer: 1,
        allowedImports,
        allowedSubpaths,
        forbiddenBuiltins: ["node:fs"],
        forbiddenGlobals: ["fetch"],
        forbiddenPackages: ["@tauri-apps/*"],
      })),
      testOnly: ["testing"],
      toolsMayImportAny: true,
    }),
  );
  for (const [id, path] of packages) {
    fixture.write(
      path + "/package.json",
      JSON.stringify({
        name: "@overmind/" + id.replace("adapters/", "adapter-").replace("apps/", ""),
        exports: { ".": "./src/index.ts", "./ports": "./src/ports/index.ts" },
      }),
    );
    fixture.write(path + "/src/index.ts", "export {};\n");
    fixture.write(path + "/src/ports/index.ts", "export {};\n");
    fixture.write(
      path + "/src/private.ts",
      'throw new Error("Scanned source must never execute"); export {};\n',
    );
  }
  fixture.write(
    "tsconfig.json",
    JSON.stringify({
      compilerOptions: {
        paths: {
          "@domain": ["./packages/domain/src/index.ts"],
          "@private": ["./packages/domain/src/private.ts"],
          "@missing": ["./absent.ts"],
        },
      },
    }),
  );
  return fixture;
}
function capture<T>(
  fixture: FixtureWorkspace,
  path: string,
  use: (env: Environment, context: Rule.RuleContext) => T,
): T {
  const filename = fixture.write(path, "export {};\n");
  let result: { value: T } | undefined;
  const rule: Rule.RuleModule = {
    meta: { schema: [] },
    create(context) {
      return {
        Program() {
          result = { value: use(environment(fixture.root, context), context) };
        },
      };
    },
  };
  const messages = new Linter({ cwd: fixture.root }).verify(
    "export {};\n",
    [
      {
        files: ["**/*.ts", "**/*.tsx"],
        languageOptions: { parser },
        plugins: { fixture: { rules: { capture: rule } } },
        rules: { "fixture/capture": "error" },
      },
    ],
    { filename },
  );
  expect(messages).toEqual([]);
  if (!result) {
    throw new Error("Native ESLint context was not reached.");
  }
  return result.value;
}
it.each(["fs", "node:fs", "fs/promises", "node:fs/promises", "node:test"])(
  "classifies builtin %s without changing permissions",
  (value) => {
    const name = value.replace(/^node:/u, "");
    expect(importCapability(value)).toEqual({ kind: "builtin", name, family: name.split("/")[0] });
  },
);
it.each(["@tauri-apps/api", "@tauri-apps/api/core"])("classifies platform metadata %s", (value) => {
  expect(importCapability(value)).toEqual({ kind: "platform", name: value });
});
it.each(["external", "node:absent", "fs/absent", "@tauri-apps-pretend/api", "@tauri-apps/../api"])(
  "does not invent a capability for %s",
  (value) => {
    expect(importCapability(value)).toBeUndefined();
  },
);
it("retains workspace name, actual exports, resolved owner and public subpath", () => {
  const f = repository();
  capture(f, "packages/domain/src/importer.ts", (env) => {
    const target = packageTarget(env, "@overmind/contracts");
    expect(target).toMatchObject({
      kind: "workspace",
      subpath: ".",
      public: true,
      owner: { policy: { id: "contracts" } },
      nominalOwner: { policy: { id: "contracts" } },
      path: resolve(f.root, "packages/contracts/src/index.ts"),
    });
    expect(matrixAllows(env, target)).toBe(true);
    const ports = packageTarget(env, "@overmind/application/ports");
    expect(ports).toMatchObject({ kind: "workspace", subpath: "./ports", public: true });
    expect(matrixAllows(env, ports)).toBe(false);
  });
});
it("retains aliases and relatives instead of mistaking them for third parties", () => {
  const f = repository();
  capture(f, "packages/contracts/src/importer.ts", (env) => {
    expect(packageTarget(env, "@domain")).toMatchObject({
      kind: "workspace",
      public: true,
      subpath: ".",
      nominalOwner: undefined,
      owner: { policy: { id: "domain" } },
    });
    expect(packageTarget(env, "@private")).toMatchObject({
      kind: "workspace",
      public: false,
      subpath: undefined,
    });
    expect(packageTarget(env, "../../domain/src/private.ts")).toMatchObject({
      kind: "workspace",
      public: false,
      owner: { policy: { id: "domain" } },
    });
    expect(matrixAllows(env, packageTarget(env, "@domain"))).toBe(false);
  });
});
it("keeps nominal and resolved owners when paths disguise a governed package", () => {
  const f = repository();
  f.write(
    "tsconfig.json",
    JSON.stringify({
      compilerOptions: { paths: { "@overmind/contracts": ["./packages/domain/src/index.ts"] } },
    }),
  );
  capture(f, "packages/application/src/importer.ts", (env) => {
    expect(packageTarget(env, "@overmind/contracts")).toMatchObject({
      kind: "workspace",
      nominalOwner: { policy: { id: "contracts" } },
      owner: { policy: { id: "domain" } },
      public: false,
    });
  });
});
it("grants only the exact ports subpath and never a sibling adapter", () => {
  const f = repository();
  capture(f, "packages/adapters/a/src/importer.ts", (env) => {
    expect(matrixAllows(env, packageTarget(env, "@overmind/application/ports"))).toBe(true);
    expect(matrixAllows(env, packageTarget(env, "@overmind/application"))).toBe(false);
    const sibling = packageTarget(env, "@overmind/adapter-b");
    expect(crossAdapter(env, sibling)).toBe(true);
    expect(matrixAllows(env, sibling)).toBe(false);
  });
});
it.each([
  "packages/domain/src/value.test.ts",
  "packages/domain/src/value.test.tsx",
  "packages/domain/test/nested/check.ts",
])("adds only library matrix imports for real tests %s", (path) => {
  const f = repository();
  capture(f, path, (env) => {
    expect(env.isTest).toBe(true);
    expect(matrixAllows(env, packageTarget(env, "@overmind/application"))).toBe(true);
    expect(matrixAllows(env, packageTarget(env, "@overmind/engine"))).toBe(false);
    expect(testOnlyAllowed(env, packageTarget(env, "@overmind/testing"))).toBe(true);
    expect(env.owner?.forbiddenBuiltins).toEqual(["node:fs"]);
    expect(env.owner?.forbiddenGlobals).toEqual(["fetch"]);
  });
});
it.each([
  "packages/domain/src/test/value.ts",
  "packages/domain/src/value.test.generated.ts",
  "packages/domain/src/contest/value.ts",
])("does not infer a test from arbitrary path text %s", (path) => {
  const f = repository();
  capture(f, path, (env) => {
    expect(env.isTest).toBe(false);
    expect(matrixAllows(env, packageTarget(env, "@overmind/application"))).toBe(false);
    expect(testOnlyAllowed(env, packageTarget(env, "@overmind/testing"))).toBe(false);
  });
});
it("allows testing support without granting its production code the test matrix", () => {
  const f = repository();
  capture(f, "packages/adapters/a/test-support/nested/builder.ts", (env) => {
    expect(env.isTest).toBe(false);
    expect(testOnlyAllowed(env, packageTarget(env, "@overmind/testing"))).toBe(true);
    expect(matrixAllows(env, packageTarget(env, "@overmind/testing"))).toBe(true);
    expect(matrixAllows(env, packageTarget(env, "@overmind/application"))).toBe(false);
    expect(env.owner?.forbiddenBuiltins).toEqual(["node:fs"]);
    expect(env.owner?.forbiddenGlobals).toEqual(["fetch"]);
    expect(matrixAllows(env, packageTarget(env, "@overmind/adapter-b"))).toBe(false);
  });
});
it("retains unknown packages and unresolved governed imports as denied metadata", () => {
  const f = repository();
  f.write(
    "packages/unknown/package.json",
    JSON.stringify({ name: "@overmind/unknown", exports: "./src/index.ts" }),
  );
  f.write("packages/unknown/src/index.ts", "export {};\n");
  capture(f, "packages/domain/src/importer.ts", (env) => {
    for (const value of ["@overmind/absent", "@overmind/unknown"]) {
      const target = packageTarget(env, value);
      expect(target.kind).toBe("unknown");
      expect(matrixAllows(env, target)).toBe(false);
    }
    for (const value of [
      "@missing",
      "./absent.ts",
      "@overmind/contracts/private",
      "node:absent",
      "@overmind/contracts/../private",
    ]) {
      expect(packageTarget(env, value).kind).toBe("unresolved");
    }
    const unresolved = packageTarget(env, "@overmind/contracts/private");
    expect(unresolved).toMatchObject({
      kind: "unresolved",
      nominalOwner: { policy: { id: "contracts" } },
      subpath: "./private",
      public: false,
    });
    expect(unresolved.owner).toBeUndefined();
    expect(unresolved.path).toBeUndefined();
    expect(matrixAllows(env, unresolved)).toBe(false);
    expect(packageTarget(env, "node:fs")).toMatchObject({
      kind: "builtin",
      capability: { name: "fs" },
    });
  });
});
it.each([
  "malformed config",
  "linked config",
  "linked target",
  "hardlinked target",
  "malformed policy",
])("fails closed on %s", (kind) => {
  const f = repository();
  if (kind === "malformed config") {
    f.write("tsconfig.json", "{");
  }
  if (kind === "linked config") {
    const path = resolve(f.root, "tsconfig.json");
    renameSync(path, path + ".original");
    symlinkSync(path + ".original", path);
  }
  if (kind === "malformed policy") {
    f.write("docs/architecture/boundaries.json", "{");
  }
  if (kind.endsWith("target")) {
    const path = resolve(f.root, "packages/contracts/src/index.ts");
    if (kind === "linked target") {
      renameSync(path, path + ".original");
      symlinkSync(path + ".original", path);
    } else {
      linkSync(path, path + ".alias");
    }
  }
  if (kind.endsWith("target")) {
    capture(f, "packages/domain/src/importer.ts", (env) => {
      expect(packageTarget(env, "@overmind/contracts").kind).toBe("unresolved");
    });
  } else {
    expect(() => {
      capture(f, "packages/domain/src/importer.ts", () => undefined);
    }).toThrow();
  }
});

const nativeFixture = repository();
workspaces.splice(workspaces.indexOf(nativeFixture), 1);
afterAll(() => {
  nativeFixture.cleanup();
});
const resolvedRule: Rule.RuleModule = {
  meta: { schema: [], messages: { target: "{{kind}}:{{subpath}}:{{public}}:{{matrix}}" } },
  create(context) {
    return {
      Program() {
        const env = environment(nativeFixture.root, context);
        expect(environment(nativeFixture.root + "/.", context)).toBe(env);
        for (const reference of importNodes(context.sourceCode)) {
          const target = packageTarget(env, reference.specifier ?? "");
          context.report({
            node: reference.node,
            messageId: "target",
            data: {
              kind: target.kind,
              subpath: target.subpath ?? "unknown",
              public: String(target.public ?? false),
              matrix: String(matrixAllows(env, target)),
            },
          });
        }
      },
    };
  },
};
new RuleTester({ languageOptions: { parser } }).run(
  "native package resolution including type-only ports",
  resolvedRule,
  {
    valid: [],
    invalid: [
      ['import type { Value } from "@overmind/application/ports";', "workspace:./ports:true:true"],
      ['export type { Value } from "@overmind/application";', "workspace:.:true:false"],
      ['type T = import("@private").Value;', "workspace:unknown:false:false"],
      ['import "@overmind/absent";', "unknown:.:false:false"],
    ].map(([code, message], index) => {
      if (code === undefined || message === undefined) {
        throw new Error("Missing fixture.");
      }
      return {
        code,
        filename: nativeFixture.write(`packages/adapters/a/src/native-${String(index)}.ts`, code),
        errors: [{ message }],
      };
    }),
  },
);
it("uses actual source identity and refreshes cached policy/config safely", () => {
  const f = repository();
  let previous: Environment | undefined;
  capture(f, "packages/domain/src/cache.ts", (env) => {
    previous = env;
  });
  capture(f, "packages/domain/src/cache.ts", (env) => {
    expect(env).not.toBe(previous);
    expect(env.sourceCode).not.toBe(previous?.sourceCode);
    f.write("tsconfig.json", "{");
    expect(packageTarget(env, "@overmind/contracts").kind).toBe("unresolved");
  });
});
it("rejects an unknown actual importing package", () => {
  const f = repository();
  f.write("packages/unknown/package.json", JSON.stringify({ name: "@overmind/unknown" }));
  expect(() => {
    capture(f, "packages/unknown/src/importer.ts", () => undefined);
  }).toThrow(/Invalid boundary environment/u);
});
it("resolves an actual external store declaration as metadata only", () => {
  const f = repository();
  const store = "node_modules/.pnpm/external@1/node_modules/external";
  f.write(store + "/package.json", JSON.stringify({ name: "external", types: "./index.d.ts" }));
  f.write(store + "/index.d.ts", "export declare const value: unknown;\n");
  symlinkSync(resolve(f.root, store), resolve(f.root, "node_modules/external"));
  capture(f, "packages/domain/src/importer.ts", (env) => {
    expect(packageTarget(env, "external")).toMatchObject({
      kind: "external",
      owner: undefined,
      path: resolve(f.root, store, "index.d.ts"),
    });
  });
});
it("retains real conditional export selection and denies malformed export targets", () => {
  const f = repository();
  f.write("packages/contracts/src/types.d.ts", "export declare const value: unknown;\n");
  f.write(
    "packages/contracts/package.json",
    JSON.stringify({
      name: "@overmind/contracts",
      exports: { ".": { types: "./src/types.d.ts", default: "./src/index.ts" } },
    }),
  );
  capture(f, "packages/domain/src/importer.ts", (env) => {
    expect(packageTarget(env, "@overmind/contracts")).toMatchObject({
      kind: "workspace",
      public: true,
      path: resolve(f.root, "packages/contracts/src/types.d.ts"),
    });
    f.write(
      "packages/contracts/package.json",
      JSON.stringify({ name: "@overmind/contracts", exports: "../escape.ts" }),
    );
    expect(packageTarget(env, "@overmind/contracts").kind).toBe("unresolved");
  });
});

it.each(["config", "policy", "source link"])(
  "does not classify builtins from a stale environment after unsafe %s",
  (kind) => {
    const f = repository();
    capture(f, "packages/domain/src/importer.ts", (env) => {
      if (kind === "config") {
        f.write("tsconfig.json", "{");
      }
      if (kind === "policy") {
        f.write("docs/architecture/boundaries.json", "{");
      }
      if (kind === "source link") {
        renameSync(env.filename, env.filename + ".original");
        symlinkSync(env.filename + ".original", env.filename);
      }
      expect(packageTarget(env, "node:fs").kind).toBe("unresolved");
    });
  },
);

it("refreshes the same native source context after a valid policy rewrite", () => {
  const f = repository();
  capture(f, "packages/domain/src/importer.ts", (old, context) => {
    const text = readFileSync(resolve(f.root, "docs/architecture/boundaries.json"), "utf8");
    f.write("docs/architecture/boundaries.json", text + "\n");
    const refreshed = environment(f.root, context);
    expect(packageTarget(refreshed, "@overmind/contracts").kind).toBe("workspace");
    expect(refreshed).not.toBe(old);
    expect(packageTarget(old, "@overmind/contracts").kind).toBe("unresolved");
  });
});
it("retains a governed nominal owner when an alias resolves to an external store", () => {
  const f = repository();
  const store = "node_modules/.pnpm/external@1/node_modules/external";
  f.write(store + "/package.json", JSON.stringify({ name: "external", types: "./index.d.ts" }));
  f.write(store + "/index.d.ts", "export declare const value: unknown;\n");
  f.write(
    "tsconfig.json",
    JSON.stringify({
      compilerOptions: { paths: { "@overmind/contracts": ["./" + store + "/index.d.ts"] } },
    }),
  );
  capture(f, "packages/domain/src/importer.ts", (env) => {
    const target = packageTarget(env, "@overmind/contracts");
    expect(target).toMatchObject({
      kind: "unresolved",
      nominalOwner: { policy: { id: "contracts" } },
      owner: undefined,
      path: resolve(f.root, store, "index.d.ts"),
      public: false,
    });
    expect(matrixAllows(env, target)).toBe(false);
  });
});

it.each(["packages/domain/test", "packages/adapters/a/test-support"])(
  "does not derive test permissions from a literal POSIX backslash in %s",
  (prefix) => {
    const f = repository();
    const path = prefix + String.fromCharCode(92) + "ordinary.ts";
    capture(f, path, (env) => {
      expect(env.isTest).toBe(false);
      expect(env.isTestSupport).toBe(false);
      expect(matrixAllows(env, packageTarget(env, "@overmind/application"))).toBe(false);
      expect(testOnlyAllowed(env, packageTarget(env, "@overmind/testing"))).toBe(false);
    });
  },
);
