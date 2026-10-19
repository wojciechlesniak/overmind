// SPDX-License-Identifier: Apache-2.0
import { afterEach, describe, expect, it } from "vitest";
import { resolve } from "node:path";
import { linkSync, lstatSync, mkdirSync, realpathSync, renameSync, symlinkSync } from "node:fs";
import ts from "typescript";
import { compilerOptions } from "./compiler-options.parse-boundary.ts";
import { resolveImport } from "./ts-resolve.ts";
import { createWorkspace, type FixtureWorkspace } from "../boundaries-fixtures/workspace.ts";
import {
  readWorkspace,
  ownerOf,
  packageSpecifier,
  relativeName,
  publicTargets,
  publicEntries,
} from "./workspace.parse-boundary.ts";

const fixtures: FixtureWorkspace[] = [];
afterEach(() => {
  for (const fixture of fixtures.splice(0)) {
    fixture.cleanup();
  }
});
function workspace() {
  const fixture = createWorkspace();
  fixtures.push(fixture);
  const policies = ["packages/domain", "packages/domain2", "tools"].map((path) => ({
    id: path.split("/").at(-1)!,
    path,
    layer: 1,
    allowedImports: [],
    allowedSubpaths: {},
    forbiddenBuiltins: [],
    forbiddenGlobals: [],
    forbiddenPackages: [],
  }));
  fixture.write(
    "docs/architecture/boundaries.json",
    JSON.stringify({ version: 1, packages: policies, testOnly: [], toolsMayImportAny: true }),
  );
  return { fixture, policies };
}

describe("workspace resolution", () => {
  it("reads actual bounded manifests into sorted packages and an exact name index", () => {
    const { fixture, policies } = workspace();
    const entries = policies.map((policy) => ({
      path: resolve(fixture.root, policy.path),
      manifest: { name: `@overmind/${policy.id}`, exports: { ".": "./src/index.ts" } },
      policy,
    }));
    for (const entry of [...entries].reverse()) {
      fixture.write(`${entry.policy.path}/package.json`, JSON.stringify(entry.manifest));
    }
    expect(readWorkspace(fixture.root)).toEqual({
      root: fixture.root,
      packages: entries,
      byName: new Map(entries.map((entry) => [entry.manifest.name, entry])),
    });
  });
});

function populated() {
  const { fixture, policies } = workspace();
  for (const policy of policies) {
    fixture.write(
      `${policy.path}/package.json`,
      JSON.stringify({ name: `@overmind/${policy.id}`, exports: { ".": "./src/index.ts" } }),
    );
    fixture.write(`${policy.path}/src/index.ts`, "export {};\n");
  }
  return fixture;
}
it.each([
  "duplicate",
  "missing",
  "malformed",
  "invalid name",
  "oversized",
  "invalid UTF8",
  "symlink",
  "dangling symlink",
  "directory",
  "hardlink",
])("rejects %s manifests with a fixed diagnostic", (kind) => {
  const fixture = populated();
  const path = resolve(fixture.root, "packages/domain2/package.json");
  if (kind === "duplicate") {
    fixture.write("packages/domain2/package.json", JSON.stringify({ name: "@overmind/domain" }));
  } else if (kind === "malformed") {
    fixture.write("packages/domain2/package.json", "{");
  } else if (kind === "invalid name") {
    fixture.write("packages/domain2/package.json", JSON.stringify({ name: "../invalid" }));
  } else if (kind === "oversized") {
    fixture.write(
      "packages/domain2/package.json",
      JSON.stringify({ name: "@overmind/domain2", padding: "x".repeat(128 * 1024) }),
    );
  } else if (kind === "invalid UTF8") {
    fixture.write("packages/domain2/package.json", new Uint8Array([0xc3, 0x28]));
  } else {
    renameSync(path, `${path}.original`);
    if (kind === "symlink") {
      symlinkSync(`${path}.original`, path);
    }
    if (kind === "dangling symlink") {
      symlinkSync(`${path}.absent`, path);
    }
    if (kind === "directory") {
      mkdirSync(path);
    }
    if (kind === "hardlink") {
      linkSync(`${path}.original`, path);
    }
  }
  expect(() => readWorkspace(fixture.root)).toThrow(/^Invalid workspace manifest\.$/u);
});
it("retains unknown actual packages without inventing a policy or absent reserved manifests", () => {
  const fixture = populated();
  fixture.write("packages/unknown/package.json", JSON.stringify({ name: "@overmind/unknown" }));
  const result = readWorkspace(fixture.root);
  expect(result.byName.get("@overmind/unknown")?.policy).toBeUndefined();
  expect(result.packages.map((entry) => entry.manifest.name)).toEqual([
    "@overmind/domain",
    "@overmind/domain2",
    "@overmind/unknown",
    "@overmind/tools",
  ]);
});
it("rejects symlinked package directories", () => {
  const fixture = populated();
  const path = resolve(fixture.root, "packages/domain2");
  renameSync(path, `${path}.original`);
  symlinkSync(`${path}.original`, path);
  expect(() => readWorkspace(fixture.root)).toThrow(/^Invalid workspace manifest\.$/u);
});
it("uses the longest segment owner and normalizes reported backslashes", () => {
  const fixture = populated();
  const ws = readWorkspace(fixture.root);
  expect(ownerOf(ws, resolve(fixture.root, "packages/domain2/src/index.ts"))).toBe(
    ws.byName.get("@overmind/domain2"),
  );
  expect(ownerOf(ws, resolve(fixture.root, "packages/domain3/src/index.ts"))).toBeUndefined();
  expect(relativeName(fixture.root, `${fixture.root}\\packages\\domain\\src\\index.ts`)).toBe(
    "packages/domain/src/index.ts",
  );
});
it.each([
  ["@overmind/domain", { name: "@overmind/domain", subpath: "." }],
  ["@overmind/contracts/ports", { name: "@overmind/contracts", subpath: "./ports" }],
  ["external/entry", { name: "external", subpath: "./entry" }],
  ["./index.ts", undefined],
  ["@incomplete", undefined],
  ["node:fs", undefined],
  ["@overmind/domain/../private", undefined],
  ["external\\entry", undefined],
])("parses package identity %s", (specifier, expected) => {
  expect(packageSpecifier(specifier)).toEqual(expected);
});
it("retains explicit root/subpath, conditional and array exports as data", () => {
  const fixture = populated();
  fixture.write(
    "packages/domain/package.json",
    JSON.stringify({
      name: "@overmind/domain",
      exports: {
        ".": {
          types: "./src/types.d.ts",
          import: ["./src/main.ts", null],
          default: "./src/index.ts",
        },
        "./ports": "./src/ports/index.ts",
        "./blocked": null,
      },
    }),
  );
  const pkg = readWorkspace(fixture.root).byName.get("@overmind/domain")!;
  expect(publicTargets(pkg)).toEqual(
    ["src/index.ts", "src/main.ts", "src/types.d.ts"].map((p) => resolve(pkg.path, p)),
  );
  expect(publicTargets(pkg, "./ports")).toEqual([resolve(pkg.path, "src/ports/index.ts")]);
  expect(publicTargets(pkg, "./blocked")).toEqual([]);
  expect(publicTargets(pkg, "./private")).toEqual([]);
  expect(publicEntries(pkg)).toEqual(
    ["src/index.ts", "src/main.ts", "src/ports/index.ts", "src/types.d.ts"].map((p) =>
      resolve(pkg.path, p),
    ),
  );
});
it.each(["../outside.ts", "/absolute.ts", "./src/../private.ts", "./src/*.ts"])(
  "rejects unsafe or non-explicit export target %s",
  (target) => {
    const fixture = populated();
    fixture.write(
      "packages/domain/package.json",
      JSON.stringify({ name: "@overmind/domain", exports: target }),
    );
    const pkg = readWorkspace(fixture.root).byName.get("@overmind/domain")!;
    expect(() => publicTargets(pkg)).toThrow(/^Invalid workspace exports\.$/u);
  },
);

it("retains absent-config defaults and parses closest real config with inherited options", () => {
  const fixture = populated();
  const filename = resolve(fixture.root, "packages/domain/src/index.ts");
  expect(compilerOptions(fixture.root, filename)).toMatchObject({
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    allowJs: true,
  });
  fixture.write("tsconfig.base.json", '{"compilerOptions":{"strict":true,"allowJs":false}}');
  fixture.write(
    "packages/domain/tsconfig.json",
    '{// TypeScript JSON comments are data\n"extends":"../../tsconfig.base.json","compilerOptions":{"resolveJsonModule":true,},}',
  );
  expect(compilerOptions(fixture.root, filename)).toMatchObject({
    strict: true,
    allowJs: false,
    resolveJsonModule: true,
  });
  fixture.write("packages/domain/src/tsconfig.json", '{"compilerOptions":{"strict":false}}');
  expect(compilerOptions(fixture.root, filename).strict).toBe(false);
});
it("reads options without enumerating or fabricating program membership", () => {
  const fixture = populated();
  const filename = resolve(fixture.root, "packages/domain/src/index.ts");
  fixture.write(
    "tsconfig.json",
    JSON.stringify({ include: ["absent/**/*.ts"], compilerOptions: { strict: true } }),
  );
  expect(compilerOptions(fixture.root, filename).strict).toBe(true);
});
it.each([
  "malformed",
  "unknown option",
  "invalid option",
  "missing extends",
  "invalid extends",
  "circular extends",
  "symlink",
  "dangling symlink",
  "symlink extends",
  "ancestor symlink",
  "oversized",
  "invalid UTF8",
  "directory",
  "hardlink",
])("rejects %s tsconfig with the safe configuration diagnostic", (kind) => {
  const fixture = populated();
  const filename = resolve(fixture.root, "packages/domain/src/index.ts");
  const config = "packages/domain/tsconfig.json";
  const absolute = resolve(fixture.root, config);
  fixture.write(config, '{"compilerOptions":{"strict":true}}');
  if (kind === "malformed") {
    fixture.write(config, "{");
  }
  if (kind === "unknown option") {
    fixture.write(config, JSON.stringify({ compilerOptions: { unknownOption: true } }));
  }
  if (kind === "invalid option") {
    fixture.write(config, JSON.stringify({ compilerOptions: { strict: "yes" } }));
  }
  if (kind === "missing extends") {
    fixture.write(config, JSON.stringify({ extends: "../../absent.json" }));
  }
  if (kind === "invalid extends") {
    fixture.write("base.json", "{");
    fixture.write(config, JSON.stringify({ extends: "../../base.json" }));
  }
  if (kind === "circular extends") {
    fixture.write(config, JSON.stringify({ extends: "./tsconfig.json" }));
  }
  if (kind === "oversized") {
    fixture.write(config, JSON.stringify({ padding: "x".repeat(512 * 1024) }));
  }
  if (kind === "invalid UTF8") {
    fixture.write(config, new Uint8Array([0xc3, 0x28]));
  }
  if (["symlink", "dangling symlink", "directory", "hardlink"].includes(kind)) {
    renameSync(absolute, `${absolute}.original`);
    if (kind === "symlink") {
      symlinkSync(`${absolute}.original`, absolute);
    }
    if (kind === "dangling symlink") {
      symlinkSync(`${absolute}.absent`, absolute);
    }
    if (kind === "directory") {
      mkdirSync(absolute);
    }
    if (kind === "hardlink") {
      linkSync(`${absolute}.original`, absolute);
    }
  }
  if (kind === "symlink extends") {
    fixture.write("base.original.json", "{}");
    symlinkSync(resolve(fixture.root, "base.original.json"), resolve(fixture.root, "base.json"));
    fixture.write(config, JSON.stringify({ extends: "../../base.json" }));
  }
  if (kind === "ancestor symlink") {
    fixture.write("configs.original/base.json", "{}");
    symlinkSync(resolve(fixture.root, "configs.original"), resolve(fixture.root, "configs"));
    fixture.write(config, JSON.stringify({ extends: "../../configs/base.json" }));
  }
  expect(() => compilerOptions(fixture.root, filename)).toThrow(
    /^Invalid TypeScript configuration\.$/u,
  );
  expect(() => resolveImport(readWorkspace(fixture.root), filename, "./index.ts")).toThrow(
    /^Invalid TypeScript configuration\.$/u,
  );
});
it("resolves declared public roots/subpaths and retains actual owner for cross-package relatives", () => {
  const fixture = populated();
  fixture.write("packages/domain/src/ports/index.ts", "export {};\n");
  fixture.write(
    "packages/domain/package.json",
    JSON.stringify({
      name: "@overmind/domain",
      exports: {
        ".": "./src/index.ts",
        "./ports": { types: "./src/ports/index.ts", default: ["./src/ports/index.ts", null] },
      },
    }),
  );
  const ws = readWorkspace(fixture.root);
  const importer = resolve(fixture.root, "tools/src/index.ts");
  const domain = ws.byName.get("@overmind/domain")!;
  expect(resolveImport(ws, importer, "@overmind/domain")).toMatchObject({
    path: resolve(domain.path, "src/index.ts"),
    owner: domain,
    nominalOwner: domain,
    subpath: ".",
  });
  expect(resolveImport(ws, importer, "@overmind/domain/ports")).toMatchObject({
    path: resolve(domain.path, "src/ports/index.ts"),
    owner: domain,
    subpath: "./ports",
  });
  expect(
    resolveImport(ws, resolve(domain.path, "src/index.ts"), "../../domain2/src/index.ts").owner,
  ).toBe(ws.byName.get("@overmind/domain2"));
});
it("retains both nominal and resolved owners when TypeScript paths disguise a workspace name", () => {
  const fixture = populated();
  fixture.write(
    "tsconfig.json",
    JSON.stringify({
      compilerOptions: {
        paths: {
          "@alias": ["./packages/domain2/src/index.ts"],
          "@overmind/domain": ["./packages/domain2/src/index.ts"],
        },
      },
    }),
  );
  const ws = readWorkspace(fixture.root);
  const filename = resolve(fixture.root, "tools/src/index.ts");
  expect(resolveImport(ws, filename, "@alias")).toMatchObject({
    owner: ws.byName.get("@overmind/domain2"),
    nominalOwner: undefined,
  });
  expect(resolveImport(ws, filename, "@overmind/domain")).toMatchObject({
    owner: ws.byName.get("@overmind/domain2"),
    nominalOwner: ws.byName.get("@overmind/domain"),
  });
});
it("resolves only a real canonical dependency-manager store without executing source", () => {
  const fixture = populated();
  const store = "node_modules/.pnpm/external@1/node_modules/external";
  fixture.write(
    `${store}/package.json`,
    JSON.stringify({ name: "external", types: "./index.d.ts", exports: { ".": "./index.d.ts" } }),
  );
  fixture.write(`${store}/index.d.ts`, "export declare const value: unknown;\n");
  symlinkSync(resolve(fixture.root, store), resolve(fixture.root, "node_modules/external"));
  const ws = readWorkspace(fixture.root);
  const filename = resolve(fixture.root, "tools/src/index.ts");
  expect(resolveImport(ws, filename, "external")).toMatchObject({
    path: resolve(fixture.root, store, "index.d.ts"),
    owner: undefined,
    nominalOwner: undefined,
  });
  fixture.write(
    "packages/domain/src/index.ts",
    'throw new Error("Source execution is forbidden"); export {};\n',
  );
  expect(resolveImport(ws, filename, "@overmind/domain").owner).toBe(
    ws.byName.get("@overmind/domain"),
  );
});
it("admits the actual installed TypeScript store as a resolution positive", () => {
  const root = realpathSync(resolve(import.meta.dirname, "../.."));
  const store = resolve(root, "node_modules/.pnpm");
  const metadata = (path: string) => {
    const file = lstatSync(path);
    return {
      links: file.nlink,
      regular: file.isFile(),
      sameDevice: file.dev === lstatSync(root).dev,
    };
  };
  expect({
    canonicalStore: realpathSync(store) === store,
    manifest: metadata(realpathSync(resolve(root, "node_modules/typescript/package.json"))),
    declaration: metadata(
      realpathSync(resolve(root, "node_modules/typescript/lib/typescript.d.ts")),
    ),
  }).toEqual({
    canonicalStore: true,
    manifest: { links: 1, regular: true, sameDevice: true },
    declaration: { links: 1, regular: true, sameDevice: true },
  });
  const ws = readWorkspace(root);
  const result = resolveImport(
    ws,
    resolve(root, "tools/boundaries/resolution.test.ts"),
    "typescript",
  );
  expect(result.path).toBe(
    realpathSync(resolve(root, "node_modules/typescript/lib/typescript.d.ts")),
  );
  expect(result.owner).toBeUndefined();
});
it.each(["@overmind/absent", "external-absent", "./absent.ts", "@overmind/domain/private"])(
  "rejects an unverifiable target %s",
  (specifier) => {
    const fixture = populated();
    const ws = readWorkspace(fixture.root);
    expect(() => resolveImport(ws, resolve(fixture.root, "tools/src/index.ts"), specifier)).toThrow(
      /^Invalid repository import\.$/u,
    );
  },
);
it.each(["source symlink", "source-to-store symlink", "store escape", "relative escape"])(
  "rejects %s without a general source-link waiver",
  (kind) => {
    const fixture = populated();
    const other = populated();
    const ws = readWorkspace(fixture.root);
    const filename = resolve(fixture.root, "packages/domain/src/index.ts");
    let specifier = "./linked.ts";
    if (kind === "source symlink") {
      symlinkSync(
        resolve(fixture.root, "packages/domain2/src/index.ts"),
        resolve(fixture.root, "packages/domain/src/linked.ts"),
      );
    }
    if (kind === "source-to-store symlink") {
      fixture.write("node_modules/.pnpm/external/index.ts", "export {};\n");
      symlinkSync(
        resolve(fixture.root, "node_modules/.pnpm/external/index.ts"),
        resolve(fixture.root, "packages/domain/src/linked.ts"),
      );
    }
    if (kind === "store escape") {
      fixture.write("node_modules/.pnpm/marker.txt", "store root");
      symlinkSync(
        resolve(other.root, "packages/domain"),
        resolve(fixture.root, "node_modules/escape"),
      );
      specifier = "escape";
    }
    if (kind === "relative escape") {
      specifier = resolve(other.root, "packages/domain/src/index.ts");
    }
    expect(() => resolveImport(ws, filename, specifier)).toThrow(/^Invalid repository import\.$/u);
  },
);

it("discovers actual manifests while leaving unrelated plain files/directories outside workspace membership", () => {
  const fixture = populated();
  fixture.write("packages/README.md", "Workspace notes\n");
  fixture.write("packages/assets/readme.txt", "Unrelated data\n");
  expect(readWorkspace(fixture.root).packages.map((entry) => entry.manifest.name)).toEqual([
    "@overmind/domain",
    "@overmind/domain2",
    "@overmind/tools",
  ]);
});

it("lets TypeScript choose export conditions instead of the first public target", () => {
  const fixture = populated();
  fixture.write("packages/domain/src/browser.ts", "export {};\n");
  fixture.write("packages/domain/src/types.d.ts", "export declare const value: unknown;\n");
  fixture.write(
    "packages/domain/package.json",
    JSON.stringify({
      name: "@overmind/domain",
      exports: {
        ".": { browser: "./src/browser.ts", types: "./src/types.d.ts", default: "./src/index.ts" },
      },
    }),
  );
  const ws = readWorkspace(fixture.root);
  const filename = resolve(fixture.root, "tools/src/index.ts");
  expect(resolveImport(ws, filename, "@overmind/domain").path).toBe(
    resolve(fixture.root, "packages/domain/src/types.d.ts"),
  );
  fixture.write(
    "tsconfig.json",
    JSON.stringify({ compilerOptions: { customConditions: ["browser"] } }),
  );
  expect(resolveImport(ws, filename, "@overmind/domain").path).toBe(
    resolve(fixture.root, "packages/domain/src/browser.ts"),
  );
});

it("preserves a literal native backslash in actual package ownership", () => {
  const fixture = populated();
  fixture.write(
    "packages/domain\\hidden/package.json",
    JSON.stringify({ name: "@overmind/hidden" }),
  );
  const filename = fixture.write("packages/domain\\hidden/src/index.ts", "export {};\n");
  const ws = readWorkspace(fixture.root);
  const actualOwner = ws.byName.get("@overmind/hidden");
  expect(actualOwner).toBeDefined();
  expect(actualOwner?.policy).toBeUndefined();
  expect(ownerOf(ws, filename)).toBe(actualOwner);
});

it.each(["manifest", "declaration"])(
  "denies a hardlinked %s inside the canonical dependency store",
  (kind) => {
    const fixture = populated();
    const outside = populated();
    const store = "node_modules/.pnpm/external@1/node_modules/external";
    fixture.write(
      `${store}/package.json`,
      JSON.stringify({ name: "external", types: "./index.d.ts", exports: { ".": "./index.d.ts" } }),
    );
    fixture.write(`${store}/index.d.ts`, "export declare const value: unknown;\n");
    symlinkSync(resolve(fixture.root, store), resolve(fixture.root, "node_modules/external"));
    const target = resolve(
      fixture.root,
      store,
      kind === "manifest" ? "package.json" : "index.d.ts",
    );
    linkSync(target, resolve(outside.root, "aliased-store-input"));
    expect(lstatSync(target).nlink).toBe(2);
    expect(() =>
      resolveImport(
        readWorkspace(fixture.root),
        resolve(fixture.root, "tools/src/index.ts"),
        "external",
      ),
    ).toThrow(/^Invalid repository import\.$/u);
    expect(lstatSync(target).nlink).toBe(2);
  },
);
