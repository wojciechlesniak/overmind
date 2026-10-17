import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  statfsSync,
  writeFileSync,
  renameSync,
} from "node:fs";
import { randomUUID } from "node:crypto";
import { basename, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { type Context, diagnostic, runSteps, type PackageOptions } from "./context.ts";
import { acquireOutputLock, safeDirectory, safeFile } from "./files.ts";
import { json, packageVersion, parseNodeLock } from "./input.parse-boundary.ts";
import { planSteps, validateEntitlements } from "./policy.ts";
import { execute, NodeRunner, rejectQuarantine, type Runner } from "./runner.ts";
import { parseRuntimeLedger, validateRuntimeLicense } from "./runtimeLicenses.parse-boundary.ts";
import { bundle } from "./steps/bundle.ts";
import { fetchRuntime } from "./steps/fetch-runtime.ts";
import { seaBlob } from "./steps/sea-blob.ts";
import { inject } from "./steps/inject.ts";
import { sign } from "./steps/sign.ts";
import { verify } from "./steps/verify.ts";
import { manifest } from "./steps/manifest.ts";

const repository = realpathSync(resolve(import.meta.dirname, "../.."));
const executableName = "overmind-engine-aarch64-apple-darwin";
const defaultOut = "apps/desktop/src-tauri/binaries";
const builtInEntitlements =
  '<?xml version="1.0" encoding="UTF-8"?><plist version="1.0"><dict><key>com.apple.security.cs.allow-jit</key><true/></dict></plist>\n';
const steps = {
  bundle,
  "fetch-runtime": fetchRuntime,
  "sea-blob": seaBlob,
  inject,
  sign,
  verify,
  manifest,
};

export function parseOptions(
  args: string[],
  environment: Readonly<Record<string, string | undefined>> = {},
): PackageOptions {
  if (args.join(" ").length > 4096 || args.some((arg) => /\p{Cc}/u.test(arg))) {
    throw new Error("Invalid packaging arguments");
  }
  const { values } = parseArgs({
    args,
    strict: true,
    options: {
      identity: { type: "string" },
      entitlements: { type: "string" },
      out: { type: "string" },
      "skip-sign": { type: "boolean" },
      "check-reproducible": { type: "boolean" },
      release: { type: "boolean" },
    },
  });
  const identity = values.identity ?? environment["OVERMIND_SIGN_IDENTITY"] ?? "-";
  if (!identity || identity.length > 256 || /\p{Cc}/u.test(identity)) {
    throw new Error("Invalid signing identity");
  }
  if (values["skip-sign"] && (values.out === undefined || values.release)) {
    throw new Error("--skip-sign requires a diagnostic --out and cannot be used for release");
  }
  if (values.out === "" || values.entitlements === "") {
    throw new Error("Empty packaging path");
  }
  return {
    identity,
    skipSign: values["skip-sign"] ?? false,
    checkReproducible: values["check-reproducible"] ?? false,
    release: values.release ?? false,
    ...(values.out === undefined ? {} : { out: values.out }),
    ...(values.entitlements === undefined ? {} : { entitlements: values.entitlements }),
  };
}

function outputs(out: string, skipSign: boolean): string[] {
  return [
    resolve(out, executableName),
    ...["LICENSE", "engine.cjs.map"].map((name) => resolve(out, "overmind-engine.resources", name)),
    resolve(out, skipSign ? "overmind-engine.diagnostic.json" : "overmind-engine.manifest.json"),
  ];
}
async function preflight(root: string, runner: Runner): Promise<void> {
  if (
    process.platform !== "darwin" ||
    process.arch !== "arm64" ||
    process.versions.node !== "22.23.3"
  ) {
    throw new Error("Packaging requires macOS arm64 and Node 22.23.3");
  }
  const host = (await execute(runner, "rustc", ["--print", "host-tuple"], { cwd: root }))
    .toString()
    .trim();
  if (host !== "aarch64-apple-darwin") {
    throw new Error("Rust host does not match the Tauri sidecar target");
  }
  const disk = statfsSync(root, { bigint: true });
  if (disk.bavail * disk.bsize < 1024n * 1024n * 1024n) {
    throw new Error("Packaging requires 1 GiB free space");
  }
  await rejectQuarantine(runner, process.execPath, root);
  await rejectQuarantine(runner, resolve(root, "node_modules/.bin/postject"), root);
  for (const [path, expected] of [
    ["node_modules/postject/package.json", "1.0.0-alpha.6"],
    ["apps/engine/node_modules/esbuild/package.json", "0.28.2"],
  ] as const) {
    const file = safeFile(root, realpathSync(resolve(root, path)));
    if (packageVersion(readFileSync(file, "utf8")) !== expected) {
      throw new Error("Installed packaging tool version differs from approved pin");
    }
  }
}
async function prepare(
  root: string,
  out: string,
  options: PackageOptions,
  runner: Runner,
): Promise<Context> {
  const parent = safeDirectory(root, resolve(root, "build/engine-tmp"), true);
  const work = mkdtempSync(resolve(parent, "build-"));
  chmodSync(work, 0o700);
  try {
    const dist = safeDirectory(root, resolve(work, "dist"), true);
    const resources = safeDirectory(root, resolve(work, "overmind-engine.resources"), true);
    const lock = parseNodeLock(
      json(
        readFileSync(safeFile(root, resolve(root, "tools/package-engine/node.lock.json")), "utf8"),
      ),
      readFileSync(safeFile(root, resolve(root, ".nvmrc")), "utf8"),
    );
    const entitlements = resolve(work, "engine.plist");
    const input =
      options.entitlements === undefined
        ? resolve(root, "build/entitlements/engine.plist")
        : resolve(root, options.entitlements);
    if (options.entitlements !== undefined || existsSync(input)) {
      await rejectQuarantine(runner, safeFile(root, input), work);
      copyFileSync(safeFile(root, input), entitlements);
    } else {
      process.stderr.write("Engine entitlement file is absent; using allow-jit only\n");
      writeFileSync(entitlements, builtInEntitlements, { flag: "wx", mode: 0o600 });
    }
    const entitlementsJson = await execute(
      runner,
      "/usr/bin/plutil",
      ["-convert", "json", "-o", "-", "--", entitlements],
      { cwd: work },
    );
    validateEntitlements(json(entitlementsJson.toString()));
    const licenseLedger = parseRuntimeLedger(
      json(
        readFileSync(
          safeFile(root, resolve(root, "tools/package-engine/runtime-licenses.json")),
          "utf8",
        ),
      ),
    );
    validateRuntimeLicense(
      licenseLedger,
      {
        version: lock.version,
        archiveSha256: lock.sha256,
        noticeSha256: licenseLedger.noticeSha256,
        extractedMembers: licenseLedger.extractedMembers,
      },
      options.release || (!options.skipSign && options.identity !== "-"),
    );
    if (licenseLedger.status !== "approved") {
      process.stderr.write(
        "Runtime license decision is pending; this ad-hoc build is technical test evidence only\n",
      );
    }
    return {
      root,
      work,
      out,
      runner,
      options,
      lock,
      licenseLedger,
      runtime: resolve(work, "node"),
      binary: resolve(work, executableName),
      dist,
      resources,
      entitlements,
    };
  } catch (error) {
    rmSync(work, { recursive: true, force: true });
    throw error;
  }
}

export async function packageEngine(
  options: PackageOptions,
  runner: Runner = new NodeRunner(repository),
): Promise<string> {
  const root = repository;
  await preflight(root, runner);
  const out = safeDirectory(root, resolve(root, options.out ?? defaultOut), true);
  if (
    options.skipSign &&
    (out === resolve(root, defaultOut) || existsSync(resolve(out, "overmind-engine.manifest.json")))
  ) {
    throw new Error("Diagnostic builds cannot publish to signed Tauri output");
  }
  safeDirectory(root, resolve(out, "overmind-engine.resources"), true);
  const destinations = outputs(out, options.skipSign);
  for (const path of [...destinations, resolve(out, ".overmind-engine.lock")]) {
    safeFile(root, path, true);
    const tracked = await execute(runner, "/usr/bin/git", ["ls-files", "--", path], { cwd: root });
    if (tracked.length) {
      throw new Error("Packaging cannot modify tracked files");
    }
  }
  const releaseOutput = acquireOutputLock(root, out);
  let ctx: Context | undefined;
  let second: Context | undefined;
  try {
    ctx = await prepare(root, out, options, runner);
    const plan = planSteps("node-sea").map((name) => steps[name]);
    await runSteps(ctx, plan.slice(0, 4));
    if (options.checkReproducible) {
      second = await prepare(root, out, options, runner);
      await runSteps(second, plan.slice(0, 4));
      if (ctx.unsignedHash !== second.unsignedHash) {
        for (const build of [ctx, second]) {
          const sections = (
            await execute(runner, "/usr/bin/otool", ["-l", build.binary], { cwd: build.work })
          )
            .toString()
            .split("\n")
            .filter((line) => /^\s*(segname|sectname|size) /u.test(line))
            .join("\n");
          process.stderr.write(`Unsigned build sections:\n${sections}\n`);
        }
        throw new Error("Unsigned engine hashes differ across independent build directories");
      }
      process.stdout.write(`Reproducible unsigned SHA-256: ${ctx.unsignedHash ?? "missing"}\n`);
    }
    await runSteps(ctx, plan.slice(4));
    for (const destination of destinations) {
      const source = destination.includes("overmind-engine.resources/")
        ? resolve(ctx.resources, basename(destination))
        : resolve(ctx.work, basename(destination));
      safeFile(root, destination, true);
      const temporary = `${destination}.${randomUUID()}.tmp`;
      try {
        writeFileSync(temporary, readFileSync(source), {
          flag: "wx",
          mode: destination.endsWith(executableName) ? 0o755 : 0o600,
        });
        renameSync(temporary, destination);
      } finally {
        rmSync(temporary, { force: true });
      }
    }
    return resolve(
      out,
      options.skipSign ? "overmind-engine.diagnostic.json" : "overmind-engine.manifest.json",
    );
  } catch (error) {
    for (const destination of destinations) {
      safeFile(root, destination, true);
      rmSync(destination, { force: true });
    }
    throw error;
  } finally {
    try {
      if (ctx) {
        rmSync(ctx.work, { recursive: true, force: true });
      }
      if (second) {
        rmSync(second.work, { recursive: true, force: true });
      }
    } finally {
      releaseOutput();
    }
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    process.stdout.write(
      `${await packageEngine(parseOptions(process.argv.slice(2), process.env))}\n`,
    );
  } catch (error) {
    process.stderr.write(`${diagnostic(error)}\n`);
    process.exitCode = 1;
  }
}
