import { copyFileSync } from "node:fs";
import { resolve } from "node:path";
import { step } from "../context.ts";
import { hashFile } from "../files.ts";
import { clearCreatedQuarantine, execute } from "../runner.ts";

export const sentinel = "NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2";
export const inject = step("inject", async (ctx) => {
  copyFileSync(ctx.runtime, ctx.binary);
  await execute(ctx.runner, "/usr/bin/codesign", ["--remove-signature", ctx.binary], {
    cwd: ctx.work,
  });
  const commands = await execute(ctx.runner, "/usr/bin/otool", ["-l", ctx.binary], {
    cwd: ctx.work,
  });
  if (commands.includes("LC_CODE_SIGNATURE")) {
    throw new Error("Runtime signature removal failed");
  }
  await execute(
    ctx.runner,
    resolve(ctx.root, "node_modules/.bin/postject"),
    [
      ctx.binary,
      "NODE_SEA_BLOB",
      resolve(ctx.work, "sea-prep.blob"),
      "--sentinel-fuse",
      sentinel,
      "--macho-segment-name",
      "NODE_SEA",
    ],
    { cwd: ctx.work },
  );
  await clearCreatedQuarantine(ctx.runner, ctx.binary, ctx.work);
  ctx.unsignedHash = hashFile(ctx.binary);
});
