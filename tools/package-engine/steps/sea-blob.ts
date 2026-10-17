import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { step } from "../context.ts";
import { execute } from "../runner.ts";
import { json, versionSchema } from "../input.parse-boundary.ts";

export const seaBlob = step("sea-blob", async (ctx) => {
  const output = await execute(
    ctx.runner,
    ctx.runtime,
    [resolve(ctx.dist, "engine.cjs"), "version", "--json"],
    { cwd: ctx.work, timeout: 5000 },
  );
  ctx.version = versionSchema.parse(json(output.toString()));
  writeFileSync(
    resolve(ctx.work, "sea-config.json"),
    JSON.stringify({
      main: "dist/engine.cjs",
      output: "sea-prep.blob",
      disableExperimentalSEAWarning: true,
      useCodeCache: false,
      useSnapshot: false,
      execArgvExtension: "none",
    }),
    { flag: "wx", mode: 0o600 },
  );
  await execute(ctx.runner, ctx.runtime, ["--experimental-sea-config", "sea-config.json"], {
    cwd: ctx.work,
  });
});
