import { build } from "esbuild";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import process from "node:process";
import { performance } from "node:perf_hooks";
import { chmodSync, copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, join, dirname } from "node:path";
import { installResource } from "../tools/pinned-bin/install.ts";
import { readBinaryLock } from "../tools/pinned-bin/lock.parse-boundary.ts";

const root = resolve(import.meta.dirname, "..");
const directory = resolve(root, "spike");
const outputs = resolve(directory, "dist");
const nodeAsset = readBinaryLock(resolve(directory, "runtime.lock.json"), "node").find(
  (entry) => entry.name === "node",
)?.assets["darwin-arm64"];
if (!nodeAsset) {
  throw new Error("Missing pinned Node asset");
}
const nodeArchive = await installResource("ove011-node-archive", nodeAsset);
if (!nodeArchive) {
  throw new Error("Missing verified Node archive");
}
const node = resolve(root, ".cache/ove011-node");
// The generic binary selector also matches Node's include/node/ directory.
// Use its verified resource downloader and select the exact official binary member.
writeFileSync(
  node,
  execFileSync("tar", ["-xOzf", nodeArchive, "--", "node-v22.23.3-darwin-arm64/bin/node"], {
    maxBuffer: 128 * 1024 * 1024,
  }),
  { mode: 0o700 },
);
chmodSync(node, 0o700);
const bunEntry = readBinaryLock(resolve(directory, "runtime.lock.json"), "bun").find(
  (entry) => entry.name === "bun",
);
const bunAsset = bunEntry?.assets["darwin-arm64"];
if (!bunAsset) {
  throw new Error("Missing pinned Bun asset");
}
const archive = await installResource("ove011-bun-archive", bunAsset);
if (!archive) {
  throw new Error("Missing verified Bun archive");
}
const bun = resolve(root, ".cache/ove011-bun");
writeFileSync(
  bun,
  execFileSync("/usr/bin/unzip", ["-p", archive, "bun-darwin-aarch64/bun"], {
    maxBuffer: 256 * 1024 * 1024,
  }),
  { mode: 0o700 },
);
chmodSync(bun, 0o700);
const sdk = execFileSync("/usr/bin/xcrun", ["--show-sdk-path"], { encoding: "utf8" }).trim();
mkdirSync(outputs, { recursive: true });
const extension = resolve(outputs, "noop.dylib");
execFileSync("/usr/bin/clang", [
  "-dynamiclib",
  "-arch",
  "arm64",
  "-isysroot",
  sdk,
  "-o",
  extension,
  resolve(directory, "noop.c"),
]);
execFileSync("/usr/bin/codesign", ["--force", "--sign", "-", extension], { stdio: "pipe" });
export const runtimes = { node, bun, extension };
export const hash = (path) => createHash("sha256").update(readFileSync(path)).digest("hex");
export async function buildCandidate(candidate, iteration = 0) {
  if (!["A", "B", "C"].includes(candidate)) {
    throw new Error("Unknown candidate");
  }
  const started = performance.now();
  const base = join(outputs, candidate, String(iteration));
  const executable = join(base, "Contents/MacOS/overmind-engine");
  mkdirSync(dirname(executable), { recursive: true });
  const bundle = join(base, "entry.cjs");
  const driver = { A: "node", B: "better", C: "bun" }[candidate];
  await build({
    absWorkingDir: root,
    entryPoints: ["spike/entry.ts"],
    bundle: true,
    platform: "node",
    target: "node22",
    format: "cjs",
    outfile: bundle,
    sourcemap: "inline",
    sourceRoot: "../../",
    sourcesContent: true,
    minify: false,
    legalComments: "inline",
    metafile: true,
    define: { __VERSION__: '"0.0.0-ove011"', __PROTOCOL__: "1" },
    external: ["bun:sqlite"],
    plugins: [
      {
        name: "probe-driver",
        setup(plugin) {
          plugin.onResolve({ filter: /^\.\/driver\.ts$/ }, () => ({
            path: resolve(directory, `driver-${driver}.ts`),
          }));
        },
      },
    ],
  }).then((result) => {
    writeFileSync(join(base, "metafile.json"), JSON.stringify(result.metafile, null, 2) + "\n");
  });
  if (candidate === "C") {
    execFileSync(
      bun,
      [
        "build",
        "--compile",
        "--target=bun-darwin-arm64",
        "--sourcemap=inline",
        bundle,
        "--outfile",
        executable,
      ],
      { cwd: root, stdio: "pipe", timeout: 120000 },
    );
  } else {
    const config = join(base, "sea-config.json");
    const blob = join(base, "sea-prep.blob");
    writeFileSync(
      config,
      JSON.stringify({
        main: bundle,
        output: blob,
        disableExperimentalSEAWarning: true,
        useCodeCache: false,
        useSnapshot: false,
        execArgv: ["--enable-source-maps"],
        execArgvExtension: "none",
      }),
    );
    execFileSync(node, ["--experimental-sea-config", config], { stdio: "pipe", timeout: 120000 });
    copyFileSync(node, executable);
    chmodSync(executable, 0o755);
    execFileSync("/usr/bin/codesign", ["--remove-signature", executable], { stdio: "pipe" });
    execFileSync(
      node,
      [
        resolve(directory, "node_modules/postject/dist/cli.js"),
        executable,
        "NODE_SEA_BLOB",
        blob,
        "--sentinel-fuse",
        "NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2",
        "--macho-segment-name",
        "NODE_SEA",
      ],
      { stdio: "pipe", timeout: 120000 },
    );
  }
  const unsignedHash = hash(executable);
  const companions = [];
  if (candidate === "B") {
    const addon = join(base, "Contents/Resources/engine/native/better_sqlite3.node");
    mkdirSync(dirname(addon), { recursive: true });
    copyFileSync(
      resolve(directory, "node_modules/better-sqlite3/prebuilds/darwin-arm64.node"),
      addon,
    );
    execFileSync(
      "/usr/bin/codesign",
      ["--force", "--options", "runtime", "--timestamp=none", "--sign", "-", addon],
      { stdio: "pipe" },
    );
    companions.push(addon);
  }
  execFileSync(
    "/usr/bin/codesign",
    [
      "--force",
      "--options",
      "runtime",
      "--timestamp=none",
      "--entitlements",
      resolve(directory, "engine.plist"),
      "--sign",
      "-",
      executable,
    ],
    { stdio: "pipe" },
  );
  execFileSync("/usr/bin/codesign", ["--verify", "--deep", "--strict", executable], {
    stdio: "pipe",
  });
  return {
    candidate,
    iteration,
    executable,
    companions,
    unsignedHash,
    signedHash: hash(executable),
    buildMs: performance.now() - started,
  };
}
if (process.argv.includes("--build-once")) {
  for (const candidate of ["A", "B", "C"]) {
    const result = await buildCandidate(candidate);
    try {
      process.stdout.write(
        JSON.stringify({
          ...result,
          version: execFileSync(result.executable, ["--mode", "version"], {
            encoding: "utf8",
            timeout: 5000,
          }),
        }) + "\n",
      );
    } catch (error) {
      process.stdout.write(JSON.stringify({ ...result, runtimeError: String(error) }) + "\n");
    }
  }
}
