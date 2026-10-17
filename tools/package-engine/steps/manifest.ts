import { copyFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { step } from "../context.ts";
import { hashFile } from "../files.ts";
import { buildManifest } from "../manifest.ts";

export const manifest = step("manifest", (ctx) => {
  copyFileSync(resolve(ctx.dist, "engine.cjs.map"), resolve(ctx.resources, "engine.cjs.map"));
  if (ctx.options.skipSign) {
    writeFileSync(
      resolve(ctx.work, "overmind-engine.diagnostic.json"),
      JSON.stringify({
        signed: false,
        sha256Unsigned: ctx.unsignedHash,
        runtimeLicenseStatus: ctx.licenseLedger.status,
      }) + "\n",
      { flag: "wx", mode: 0o600 },
    );
    return;
  }
  writeFileSync(
    resolve(ctx.work, "overmind-engine.manifest.json"),
    buildManifest({
      version: ctx.version?.version,
      protocol: ctx.version?.protocol,
      buildSha: ctx.version?.buildSha,
      node: ctx.lock.version,
      sha256: hashFile(ctx.binary),
      sha256Unsigned: ctx.unsignedHash,
      bundleSha256: hashFile(resolve(ctx.dist, "engine.cjs")),
      inputHashes: {
        nodeArchive: ctx.lock.sha256,
        nodeLock: hashFile(resolve(ctx.root, "tools/package-engine/node.lock.json")),
        pnpmLock: hashFile(resolve(ctx.root, "pnpm-lock.yaml")),
        entitlements: hashFile(ctx.entitlements),
        runtimeLicenseLedger: hashFile(
          resolve(ctx.root, "tools/package-engine/runtime-licenses.json"),
        ),
      },
      runtimeLicenseStatus: ctx.licenseLedger.status,
      companions: ["LICENSE", "engine.cjs.map"].map((name) => ({
        path: `engine/${name}`,
        sha256: hashFile(resolve(ctx.resources, name)),
      })),
      toolVersions: { esbuild: "0.28.2", postject: "1.0.0-alpha.6", node: ctx.lock.version },
    }),
    { flag: "wx", mode: 0o600 },
  );
});
