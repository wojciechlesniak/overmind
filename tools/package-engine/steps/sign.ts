import { step } from "../context.ts";
import { execute } from "../runner.ts";

export const sign = step("sign", async (ctx) => {
  if (ctx.options.skipSign) {
    return;
  }
  await execute(
    ctx.runner,
    "/usr/bin/codesign",
    [
      "--force",
      "--options",
      "runtime",
      ctx.options.identity === "-" ? "--timestamp=none" : "--timestamp",
      "--entitlements",
      ctx.entitlements,
      "--sign",
      ctx.options.identity,
      ctx.binary,
    ],
    { cwd: ctx.work },
  );
});
