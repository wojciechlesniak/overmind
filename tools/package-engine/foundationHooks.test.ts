// SPDX-License-Identifier: Apache-2.0
import { execFileSync } from "node:child_process";
import {
  existsSync,
  linkSync,
  mkdirSync,
  mkdtempSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, expect, it } from "vitest";
import { assertFoundationHooks, foundationInputPaths } from "./foundationHooks.parse-boundary.ts";

const roots: string[] = [];
const compose = "apps/engine/src/compose/index.ts";
const service = "apps/engine/src/service/index.ts";
const marker = "export const UNIMPLEMENTED = true;\n";
function fixture(files: Readonly<Record<string, string | Buffer>>) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "ove024-foundation-")));
  roots.push(root);
  for (const [path, source] of Object.entries(files)) {
    const target = join(root, path);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, source);
  }
  return root;
}
function snapshot(files: Readonly<Record<string, string>>) {
  return {
    sources: Object.keys(files).map((path) => `file:///overmind/source/${path}`),
    sourcesContent: Object.values(files),
  };
}
afterEach(() => {
  for (const root of roots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});
it("accepts only exact inert bundled markers that match safely read current source", () => {
  const files = { [compose]: marker, [service]: `// Foundation marker\n${marker}` };
  expect(() => {
    assertFoundationHooks(fixture(files), [compose, service], snapshot(files));
  }).not.toThrow();
});

it.each([
  "./apps/engine/src/service/index.ts",
  "apps/engine/src/./service/index.ts",
  "apps/engine/src/hooks/../service/index.ts",
  "APPS/ENGINE/src/SERVICE/index.ts",
  "apps\\engine\\src\\service\\index.ts",
  "/apps/engine/src/service/index.ts",
  "apps/engine/src/%73ervice/index.ts",
  "file:///overmind/source/apps/engine/src/service/index.ts",
])("does not treat aliased hook input %s as genuine absence", (path) => {
  expect(() => {
    assertFoundationHooks(fixture({}), [path], snapshot({}));
  }).toThrow(/^Invalid engine foundation hooks$/u);
});
it("rejects a dot-aliased bundled identity instead of ignoring it as an absent hook", () => {
  const files = { [service]: marker };
  const map = snapshot(files);
  map.sources.push("file:///overmind/source/apps/engine/src/./service/index.ts");
  map.sourcesContent.push(marker);
  expect(() => {
    assertFoundationHooks(fixture(files), [service], map);
  }).toThrow(/^Invalid engine foundation hooks$/u);
});

it("preserves genuine hook absence without inspecting unrelated metafile source", () => {
  const path = "apps/engine/src/main.ts";
  expect(() => {
    assertFoundationHooks(fixture({}), [path], snapshot({ [path]: "unrelated source data" }));
  }).not.toThrow();
});
it.each([
  "export const UNIMPLEMENTED = false;",
  "export const UNIMPLEMENTED = Boolean(true);",
  "export const UNIMPLEMENTED = (true);",
  "export const UNIMPLEMENTED = true as const;",
  "export const UNIMPLEMENTED: boolean = true;",
  "export const UNIMPLEMENTED! = true;",
  "export let UNIMPLEMENTED = true;",
  "export using UNIMPLEMENTED = true;",
  "export await using UNIMPLEMENTED = true;",
  "export declare const UNIMPLEMENTED = true;",
  "const UNIMPLEMENTED = true; export { UNIMPLEMENTED };",
  'export { UNIMPLEMENTED } from "./other.ts";',
  'import "./other.ts"; export const UNIMPLEMENTED = true;',
  "export const UNIMPLEMENTED = true, extra = true;",
  "export const UNIMPLEMENTED = true; export const extra = true;",
  "export const UNIMPLEMENTED = true;;",
  "export const UNIMPLEMENTED = ;",
  "/* unterminated",
  "// export const UNIMPLEMENTED = true;",
  '"export const UNIMPLEMENTED = true;";',
])("denies non-exact marker syntax %# with a fixed safe error", (source) => {
  const files = { [service]: source };
  expect(() => {
    assertFoundationHooks(fixture(files), [service], snapshot(files));
  }).toThrow(/^Invalid engine foundation hooks$/u);
});
it.each([
  "apps/engine/src/service/extra.ts",
  "apps/engine/src/service/index.js",
  "apps/engine/src/compose/main.ts",
  "apps/engine/src/service",
])("denies unknown or additional hook path %s", (path) => {
  const files = { [compose]: marker, [path]: marker };
  expect(() => {
    assertFoundationHooks(fixture(files), Object.keys(files), snapshot(files));
  }).toThrow(/^Invalid engine foundation hooks$/u);
});
it.each([
  { sources: [], sourcesContent: [] },
  { sources: [`file:///overmind/source/${service}`], sourcesContent: [] },
  { sources: [`file:///overmind/source/${service}`], sourcesContent: [null] },
  {
    sources: [`file:///overmind/source/${service}`, `file:///overmind/source/${service}`],
    sourcesContent: [marker, marker],
  },
  { sources: ["file:///overmind/source/apps/engine/src/other.ts"], sourcesContent: [marker] },
])("denies missing, mismatched or duplicate snapshot analysis %#", (map) => {
  expect(() => {
    assertFoundationHooks(fixture({ [service]: marker }), [service], map);
  }).toThrow(/^Invalid engine foundation hooks$/u);
});
it("does not treat malformed or unlisted-hook analysis as absence", () => {
  const root = fixture({});
  expect(() => {
    assertFoundationHooks(root, [], snapshot({ [service]: marker }));
  }).toThrow(/^Invalid engine foundation hooks$/u);
  expect(() => {
    assertFoundationHooks(root, [], {
      sources: ["file:///overmind/source/other.ts"],
      sourcesContent: [],
    });
  }).toThrow(/^Invalid engine foundation hooks$/u);
});
it("denies a post-build source replacement and a live snapshot replaced by an inert file", () => {
  const live = "export const UNIMPLEMENTED = false;";
  expect(() => {
    assertFoundationHooks(fixture({ [service]: live }), [service], snapshot({ [service]: marker }));
  }).toThrow(/^Invalid engine foundation hooks$/u);
  expect(() => {
    assertFoundationHooks(fixture({ [service]: marker }), [service], snapshot({ [service]: live }));
  }).toThrow(/^Invalid engine foundation hooks$/u);
});
it("never executes side-effecting source while classifying its actual snapshot", () => {
  const root = fixture({});
  const sentinel = join(root, "source-executed");
  const source = `import { writeFileSync } from "node:fs"; writeFileSync(${JSON.stringify(sentinel)}, "executed"); ${marker}`;
  const path = join(root, service);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, source);
  expect(() => {
    assertFoundationHooks(root, [service], snapshot({ [service]: source }));
  }).toThrow(/^Invalid engine foundation hooks$/u);
  expect(existsSync(sentinel)).toBe(false);
});
it.each(["file-symlink", "directory-symlink", "hardlink", "directory", "fifo", "missing"])(
  "retains confined-reader denial for %s",
  (kind) => {
    const root = fixture({ [service]: marker });
    const path = join(root, service);
    rmSync(path);
    if (kind === "file-symlink" || kind === "hardlink") {
      const target = join(root, "target.ts");
      writeFileSync(target, marker);
      if (kind === "hardlink") {
        linkSync(target, path);
      } else {
        symlinkSync(target, path);
      }
    } else if (kind === "directory-symlink") {
      rmSync(dirname(path), { recursive: true });
      const target = join(root, "linked-service");
      mkdirSync(target);
      writeFileSync(join(target, "index.ts"), marker);
      symlinkSync(target, dirname(path));
    } else if (kind === "directory") {
      mkdirSync(path);
    } else if (kind === "fifo") {
      execFileSync("mkfifo", [path], { timeout: 5000 });
    }
    expect(() => {
      assertFoundationHooks(root, [service], snapshot({ [service]: marker }));
    }).toThrow(/^Invalid engine foundation hooks$/u);
  },
);
it.each([Buffer.from([0xff]), Buffer.alloc(2 * 1024 * 1024 + 1, 32)])(
  "retains fatal UTF8 and bounded source reading %#",
  (bytes) => {
    expect(() => {
      assertFoundationHooks(
        fixture({ [service]: bytes }),
        [service],
        snapshot({ [service]: marker }),
      );
    }).toThrow(/^Invalid engine foundation hooks$/u);
  },
);

it.each([
  [service, "export async function ensureRunning() {}"],
  ["apps/engine/src/./service/index.ts", marker],
])("denies map-only hook %s even when metadata lists no hook input", (path, source) => {
  expect(() => {
    assertFoundationHooks(fixture({}), [], snapshot({ [path]: source }));
  }).toThrow(/^Invalid engine foundation hooks$/u);
});

it.each(["regular", "file-link", "directory-link"])(
  "does not mistake an unlisted canonical %s hook for genuine absence",
  (kind) => {
    const root = fixture({ [service]: marker, "apps/engine/src/live.ts": marker });
    if (kind === "file-link") {
      rmSync(join(root, service));
      symlinkSync(join(root, "apps/engine/src/live.ts"), join(root, service));
    } else if (kind === "directory-link") {
      rmSync(dirname(join(root, service)), { recursive: true });
      symlinkSync(join(root, "apps/engine/src"), dirname(join(root, service)));
    }
    expect(() => {
      assertFoundationHooks(
        root,
        ["apps/engine/src/live.ts"],
        snapshot({ "apps/engine/src/live.ts": marker }),
      );
    }).toThrow(/^Invalid engine foundation hooks$/u);
  },
);
it.each([
  { path: "apps/engine/src/live.ts", original: "../service/index.js" },
  { path: service },
  { path: "apps/engine/src/live.ts", original: "" },
  { path: service, original: "../service/./index.js" },
  { path: service, original: "../%73ervice/index.js" },
  { path: "apps/engine/src/live.ts", original: "../service/extra.js" },
])("denies unavailable, aliased or redirected captured hook provenance %#", (edge) => {
  const metadata = JSON.stringify({
    inputs: {
      "apps/engine/src/commands/ensure-running.ts": { imports: [edge] },
      [edge.path]: { imports: [] },
    },
  });
  expect(() => {
    foundationInputPaths(metadata);
  }).toThrow(/^Invalid engine foundation hooks$/u);
});
it("accepts canonical captured provenance and genuine external-hook absence", () => {
  const importer = "apps/engine/src/commands/ensure-running.ts";
  const included = JSON.stringify({
    inputs: {
      [importer]: { imports: [{ path: service, original: "../service/index.js" }] },
      [service]: { imports: [] },
    },
  });
  const files = { [service]: marker };
  expect(() => {
    assertFoundationHooks(fixture(files), foundationInputPaths(included), snapshot(files));
  }).not.toThrow();
  const absent = JSON.stringify({
    inputs: {
      [importer]: { imports: [{ path: "../service/index.js", external: true }] },
    },
  });
  expect(() => {
    assertFoundationHooks(fixture({}), foundationInputPaths(absent), snapshot({}));
  }).not.toThrow();
});
it("denies missing captured import analysis rather than treating it as absence", () => {
  expect(() => {
    foundationInputPaths(JSON.stringify({ inputs: { "apps/engine/src/main.ts": {} } }));
  }).toThrow(/^Invalid engine foundation hooks$/u);
});

it("denies a captured internal hook edge whose target input record is missing", () => {
  const metadata = JSON.stringify({
    inputs: {
      "apps/engine/src/commands/ensure-running.ts": {
        imports: [{ path: service, original: "../service/index.js" }],
      },
    },
  });
  expect(() => {
    assertFoundationHooks(fixture({}), foundationInputPaths(metadata), snapshot({}));
  }).toThrow(/^Invalid engine foundation hooks$/u);
});

it("denies an external hook edge whose captured resolved request differs", () => {
  const metadata = JSON.stringify({
    inputs: {
      "apps/engine/src/commands/ensure-running.ts": {
        imports: [{ path: "../live.js", original: "../service/index.js", external: true }],
      },
    },
  });
  expect(() => {
    assertFoundationHooks(fixture({}), foundationInputPaths(metadata), snapshot({}));
  }).toThrow(/^Invalid engine foundation hooks$/u);
});
