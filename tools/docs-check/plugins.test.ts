import { mkdtemp, mkdir, writeFile, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import { runPlugins } from "./plugins.ts";
import type { Flags } from "./checker.ts";

const flags: Flags = { publish: false, i18n: true, fixToc: false, github: false, external: false };
it("discovers only tracked canonical check modules, passes flags and rejects malformed results", async () => {
  const root = await mkdtemp(join(tmpdir(), "ove-doc-plugin-"));
  try {
    await mkdir(join(root, "tools/docs-i18n"), { recursive: true });
    await mkdir(join(root, "tools/docs-invalid"), { recursive: true });
    await mkdir(join(root, "tools/docs-alias"), { recursive: true });
    await writeFile(
      join(root, "tools/docs-i18n/check.ts"),
      'export default {name:"i18n",run(ctx){return ctx.flags.i18n ? [{file:"README.md",line:1,rule:"parity",severity:"warning",message:"Parity checked."}] : []}};',
    );
    await writeFile(
      join(root, "tools/docs-invalid/check.ts"),
      'export default {name:"invalid",run(){return [{bad:true}]}};',
    );
    await symlink("../docs-i18n/check.ts", join(root, "tools/docs-alias/check.ts"));
    const result = await runPlugins({
      root,
      files: new Map(),
      paths: new Set([
        "README.md",
        "tools/docs-i18n/check.ts",
        "tools/docs-invalid/check.ts",
        "tools/docs-alias/check.ts",
      ]),
      flags,
    });
    expect(result.map((d) => d.rule)).toEqual(expect.arrayContaining(["parity", "plugin-failure"]));
    expect(result.filter((d) => d.rule === "plugin-failure")).toHaveLength(2);
    expect(
      (await runPlugins({ root, files: new Map(), paths: new Set(), flags })).map((d) => d.rule),
    ).toEqual(["i18n-unavailable"]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
