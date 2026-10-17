import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { installResource } from "../../pinned-bin/install.ts";
import { step } from "../context.ts";
import { clearCreatedQuarantine, execute, rejectQuarantine } from "../runner.ts";
import { hashFile, safeFile } from "../files.ts";
import { validateRuntimeLicense } from "../runtimeLicenses.parse-boundary.ts";

export function createFetchRuntime(fetchBytes?: (url: string) => Promise<Uint8Array>) {
  return step("fetch-runtime", async (ctx) => {
    const archive = await installResource(
      "engine-node",
      ctx.lock,
      fetchBytes === undefined ? {} : { fetchBytes },
    );
    if (!archive) {
      throw new Error("Pinned runtime is unavailable");
    }
    safeFile(ctx.root, archive);
    await rejectQuarantine(ctx.runner, archive, ctx.work);
    for (const [member, output, mode] of [
      ["bin/node", ctx.runtime, 0o755],
      ["LICENSE", resolve(ctx.resources, "LICENSE"), 0o600],
    ] as const) {
      const bytes = await execute(
        ctx.runner,
        "/usr/bin/tar",
        ["-xOzf", archive, "--", `node-v${ctx.lock.version}-darwin-arm64/${member}`],
        { cwd: ctx.work, maxBuffer: 150 * 1024 * 1024 },
      );
      if (!bytes.length) {
        throw new Error("Runtime archive member is empty");
      }
      writeFileSync(output, bytes, { flag: "wx", mode });
      await clearCreatedQuarantine(ctx.runner, output, ctx.work);
    }
    validateRuntimeLicense(
      ctx.licenseLedger,
      {
        version: ctx.lock.version,
        archiveSha256: ctx.lock.sha256,
        noticeSha256: hashFile(resolve(ctx.resources, "LICENSE")),
        extractedMembers: [
          `node-v${ctx.lock.version}-darwin-arm64/bin/node`,
          `node-v${ctx.lock.version}-darwin-arm64/LICENSE`,
        ],
      },
      false,
    );
  });
}
export const fetchRuntime = createFetchRuntime();
