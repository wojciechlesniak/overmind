import { resolve } from "node:path";
import { step } from "../context.ts";
import { execute } from "../runner.ts";

export const bundle = step("bundle", async (ctx) => {
  // The owning build command also executes SETUP016's metafile guard.
  await execute(
    ctx.runner,
    process.execPath,
    [resolve(ctx.root, "tools/build/engine/bundle.mjs"), "--out-dir", ctx.dist],
    { cwd: ctx.root },
  );
});
