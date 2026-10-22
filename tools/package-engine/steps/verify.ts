import { chmodSync, mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";
import { step } from "../context.ts";
import { safeFile } from "../files.ts";
import { assertFoundationHooks, foundationInputPaths } from "../foundationHooks.parse-boundary.ts";
import { execute } from "../runner.ts";
import { json, sourceMapSchema, versionSchema } from "../input.parse-boundary.ts";
import { sentinel } from "./inject.ts";

const receiptSchema = z
  .object({
    status: z.enum(["running", "already_running", "failed", "incompatible"]),
    pid: z.number().int().positive().nullable(),
    socket: z.string().nullable(),
    version: z.string(),
    protocol: z.number().int().positive(),
    detail: z.string().nullable(),
  })
  .strict();
export const verify = step("verify", async (ctx) => {
  const size = statSync(ctx.binary).size;
  if (size > 150000000) {
    throw new Error("Engine exceeds 150 MB");
  }
  if (size > 100000000) {
    process.stderr.write("Engine exceeds 100 MB\n");
  }
  const executable = readFileSync(ctx.binary);
  if (
    !executable.includes(`${sentinel}:1`) ||
    !executable.includes(readFileSync(resolve(ctx.work, "sea-prep.blob")))
  ) {
    throw new Error("SEA fuse or injected blob is missing");
  }
  const libraries = (
    await execute(ctx.runner, "/usr/bin/otool", ["-L", ctx.binary], { cwd: ctx.work })
  )
    .toString()
    .trim()
    .split("\n")
    .slice(1);
  if (
    !libraries.length ||
    libraries.some(
      (line) =>
        !/^\s+(?:\/usr\/lib\/|\/System\/Library\/)[^\s]+ \(compatibility version /u.test(line),
    )
  ) {
    throw new Error("Engine links a non-system library");
  }
  const metadata = readFileSync(resolve(ctx.dist, "engine.meta.json"), "utf8");
  const sourceMap = sourceMapSchema.parse(
    json(
      readFileSync(
        safeFile(ctx.root, resolve(ctx.dist, "engine.cjs.map"), false, 16000000),
        "utf8",
      ),
    ),
  );
  if (/\.node(?:["'\s]|$)/u.test(metadata)) {
    throw new Error("Unlisted native addon is forbidden");
  }
  assertFoundationHooks(ctx.root, foundationInputPaths(metadata), sourceMap);
  if (ctx.options.skipSign) {
    return;
  }
  await execute(
    ctx.runner,
    "/usr/bin/codesign",
    ["--verify", "--strict", "--verbose=2", ctx.binary],
    { cwd: ctx.work },
  );
  const actual = versionSchema.parse(
    json(
      (
        await execute(ctx.runner, ctx.binary, ["version", "--json"], {
          cwd: ctx.work,
          timeout: 5000,
        })
      ).toString(),
    ),
  );
  if (JSON.stringify(actual) !== JSON.stringify(ctx.version)) {
    throw new Error("Packaged engine version differs from bundled input");
  }
  const data = mkdtempSync(resolve(ctx.work, "verify-data-"));
  chmodSync(data, 0o700);
  try {
    if ((statSync(data).mode & 0o777) !== 0o700) {
      throw new Error("Engine verification data directory is not owner-only");
    }
    const result = await ctx.runner.run(ctx.binary, ["ensure-running", "--json"], {
      cwd: ctx.work,
      timeout: 5000,
      env: { OVERMIND_DATA_DIR: data },
    });
    const text = result.stdout.toString();
    if (text.trim().split("\n").length !== 1) {
      throw new Error("Engine receipt must be one JSON line");
    }
    const receipt = receiptSchema.parse(json(text));
    if (
      receipt.version !== actual.version ||
      receipt.protocol !== actual.protocol ||
      !(
        (result.status === 20 &&
          receipt.status === "failed" &&
          receipt.pid === null &&
          receipt.socket === null) ||
        ([0, 10].includes(result.status) &&
          ["running", "already_running"].includes(receipt.status) &&
          receipt.pid !== null &&
          receipt.socket === resolve(data, "engine.sock"))
      )
    ) {
      throw new Error("Engine startup verification failed");
    }
    // A live lifecycle needs a bounded stop contract before it can be verified here.
    if (receipt.pid !== null) {
      throw new Error("Live engine verification requires the ENGINE stop contract");
    }
  } finally {
    rmSync(data, { recursive: true, force: true });
  }
});
