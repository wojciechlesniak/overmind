import { mkdtemp, mkdir, writeFile, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import { runPlugins, type PluginContext } from "./plugins.ts";
import type { Flags } from "./checker.ts";

const flags: Flags = { publish: false, i18n: true, fixToc: false, github: false, external: false };
const parity = {
  file: "README.md",
  line: 1,
  rule: "parity",
  severity: "warning",
  message: "Parity checked.",
};
async function fixture(
  names: string[],
  check: (ctx: PluginContext) => Promise<void>,
): Promise<void> {
  const root = await mkdtemp(join(tmpdir(), "ove-doc-plugin-"));
  try {
    for (const name of names) {
      await mkdir(join(root, `tools/docs-${name}`), { recursive: true });
      await writeFile(join(root, `tools/docs-${name}/check.ts`), "export default {};\n");
    }
    await check({
      root,
      files: new Map(),
      paths: new Set(["README.md", ...names.map((name) => `tools/docs-${name}/check.ts`)]),
      flags,
    });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}
it("consumes only tracked canonical namespaces, passes flags and rejects malformed results", async () => {
  await fixture(["i18n", "invalid", "alias"], async (ctx) => {
    await rm(join(ctx.root, "tools/docs-alias/check.ts"));
    await symlink("../docs-i18n/check.ts", join(ctx.root, "tools/docs-alias/check.ts"));
    const result = await runPlugins(
      ctx,
      Object.freeze({
        "tools/docs-i18n/check.ts": {
          default: {
            name: "i18n",
            run: (input: PluginContext) => (input.flags.i18n ? [parity] : []),
          },
        },
        "tools/docs-invalid/check.ts": { default: { name: "invalid", run: () => [{ bad: true }] } },
        "tools/docs-alias/check.ts": { default: { name: "alias", run: () => [parity] } },
      }),
    );
    expect(result.map((d) => d.rule)).toEqual(expect.arrayContaining(["parity", "plugin-failure"]));
    expect(result.filter((d) => d.rule === "plugin-failure")).toHaveLength(2);
    expect(
      (await runPlugins({ ...ctx, paths: new Set() }, Object.freeze({}))).map((d) => d.rule),
    ).toEqual(["i18n-unavailable"]);
  });
});
it("executes admitted static namespaces in stable path order with frozen context and flags", async () => {
  await fixture(["alpha", "zeta"], async (ctx) => {
    const calls: string[] = [];
    const namespace = (name: string) => ({
      default: {
        name,
        run: (input: PluginContext) => {
          expect(Object.isFrozen(input)).toBe(true);
          expect(Object.isFrozen(input.flags)).toBe(true);
          expect(input.files).toBe(ctx.files);
          expect(input.paths).toBe(ctx.paths);
          calls.push(name);
          return [];
        },
      },
    });
    await runPlugins(ctx, {
      "tools/docs-zeta/check.ts": namespace("zeta"),
      "tools/docs-alpha/check.ts": namespace("alpha"),
    });
    expect(calls).toEqual(["alpha", "zeta"]);
  });
});
it("rejects untracked diagnostic targets without exposing plugin errors", async () => {
  await fixture(["invalid"], async (ctx) => {
    const result = await runPlugins(ctx, {
      "tools/docs-invalid/check.ts": {
        default: { name: "invalid", run: () => [{ ...parity, file: "private.txt" }] },
      },
    });
    expect(result.filter((d) => d.rule === "plugin-failure")).toEqual([
      {
        file: "tools/docs-invalid/check.ts",
        line: 1,
        rule: "plugin-failure",
        severity: "error",
        message: "Documentation plugin is unavailable or returned invalid diagnostics.",
      },
    ]);
    expect(JSON.stringify(result)).not.toContain("private.txt");
  });
});
it("validates unknown module exports instead of executing an invalid namespace", async () => {
  await fixture(["invalid"], async (ctx) => {
    const result = await runPlugins(ctx, {
      "tools/docs-invalid/check.ts": { default: { name: "INVALID", run: () => [parity] } },
    });
    expect(result.filter((d) => d.rule === "plugin-failure")).toHaveLength(1);
    expect(result.some((d) => d.rule === "parity")).toBe(false);
  });
});
it("keeps missing translation checks a warning by default and an error under i18n", async () => {
  await fixture([], async (ctx) => {
    expect((await runPlugins({ ...ctx, flags: { ...flags, i18n: false } }, {}))[0]?.severity).toBe(
      "warning",
    );
    expect((await runPlugins(ctx, {}))[0]?.severity).toBe("error");
  });
});
