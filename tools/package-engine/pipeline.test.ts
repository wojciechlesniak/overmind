import { parseRuntimeLedger } from "./runtimeLicenses.parse-boundary.ts";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
  truncateSync,
} from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "vitest";
import { type Context, runSteps, step } from "./context.ts";
import { safeDirectory } from "./files.ts";
import { json, parseNodeLock } from "./input.parse-boundary.ts";
import { planSteps } from "./policy.ts";
import { packageEngine, parseOptions } from "./run.ts";
import { execute, type Runner } from "./runner.ts";
import { createFetchRuntime } from "./steps/fetch-runtime.ts";
import { verify } from "./steps/verify.ts";

const root = resolve(import.meta.dirname, "../..");
function fixture(runner: Runner): Context {
  const work = mkdtempSync(
    resolve(safeDirectory(root, resolve(root, "build/engine-tmp"), true), "unit-"),
  );
  const resources = resolve(work, "overmind-engine.resources");
  mkdirSync(resources);
  return {
    root,
    work,
    out: work,
    runner,
    options: parseOptions([]),
    licenseLedger: parseRuntimeLedger(
      json(readFileSync(resolve(root, "tools/package-engine/runtime-licenses.json"), "utf8")),
    ),
    lock: parseNodeLock(
      json(readFileSync(resolve(root, "tools/package-engine/node.lock.json"), "utf8")),
      "22.23.3",
    ),
    runtime: resolve(work, "node"),
    binary: resolve(work, "engine"),
    dist: resolve(work, "dist"),
    resources,
    entitlements: resolve(work, "engine.plist"),
  };
}

test("the 150 MB limit is checked before reading or executing an oversized binary", async () => {
  const ctx = fixture({
    run() {
      return Promise.reject(new Error("Must not execute"));
    },
  });
  try {
    writeFileSync(ctx.binary, "");
    truncateSync(ctx.binary, 150000001);
    expect(await verify.run(ctx)).toEqual({ ok: false, error: "verify: Engine exceeds 150 MB" });
  } finally {
    rmSync(ctx.work, { recursive: true, force: true });
  }
});

test("checksum tampering fails before extraction or execution of downloaded bytes", async () => {
  let calls = 0;
  const ctx = fixture({
    run() {
      calls++;
      return Promise.reject(new Error("No process may execute"));
    },
  });
  try {
    ctx.lock = { ...ctx.lock, sha256: "0".repeat(64) };
    const result = await createFetchRuntime(() =>
      Promise.resolve(Buffer.from("tampered runtime")),
    ).run(ctx);
    expect(result).toEqual({ ok: false, error: "fetch-runtime: Binary checksum mismatch" });
    expect(calls).toBe(0);
    expect(existsSync(ctx.runtime)).toBe(false);
  } finally {
    rmSync(ctx.work, { recursive: true, force: true });
  }
});

test("each failing step stops the composition without executing later commands", async () => {
  const names = planSteps("node-sea");
  for (let failure = 0; failure < names.length; failure++) {
    const calls: string[] = [];
    const ctx = fixture({
      run(file) {
        calls.push(file);
        return Promise.resolve({
          status: calls.length - 1 === failure ? 1 : 0,
          stdout: Buffer.alloc(0),
          stderr: Buffer.alloc(0),
        });
      },
    });
    try {
      const steps = names.map((name) =>
        step(name, async (context) => {
          await execute(context.runner, name, [], { cwd: context.work });
        }),
      );
      await expect(runSteps(ctx, steps)).rejects.toThrow(names[failure]);
      expect(calls).toEqual(names.slice(0, failure + 1));
    } finally {
      rmSync(ctx.work, { recursive: true, force: true });
    }
  }
});

test.skipIf(process.platform !== "darwin" || process.arch !== "arm64")(
  "failed build removes stale outputs and its own temporary directory",
  async () => {
    const ctx = fixture({
      run() {
        return Promise.reject(new Error("unused"));
      },
    });
    try {
      for (const name of [
        "overmind-engine-aarch64-apple-darwin",
        "overmind-engine.manifest.json",
      ]) {
        writeFileSync(resolve(ctx.out, name), "stale");
      }
      const before = readdirSync(resolve(root, "build/engine-tmp")).sort();
      const runner: Runner = {
        run(file, args) {
          if (args.includes("host-tuple")) {
            return Promise.resolve({
              status: 0,
              stdout: Buffer.from("aarch64-apple-darwin\n"),
              stderr: Buffer.alloc(0),
            });
          }
          if (file === "/usr/bin/plutil") {
            return Promise.resolve({
              status: 0,
              stdout: Buffer.from('{"com.apple.security.cs.allow-jit":true}'),
              stderr: Buffer.alloc(0),
            });
          }
          if (args.some((arg) => arg.endsWith("apps/engine/build/bundle.mjs"))) {
            return Promise.resolve({
              status: 1,
              stdout: Buffer.alloc(0),
              stderr: Buffer.from("untrusted private detail"),
            });
          }
          return Promise.resolve({ status: 0, stdout: Buffer.alloc(0), stderr: Buffer.alloc(0) });
        },
      };
      await expect(packageEngine(parseOptions(["--out", ctx.out]), runner)).rejects.toThrow(
        "bundle: Packaging command failed",
      );
      expect(existsSync(resolve(ctx.out, "overmind-engine.manifest.json"))).toBe(false);
      expect(existsSync(resolve(ctx.out, "overmind-engine-aarch64-apple-darwin"))).toBe(false);
      expect(existsSync(resolve(ctx.out, ".overmind-engine.lock"))).toBe(false);
      expect(readdirSync(resolve(root, "build/engine-tmp")).sort()).toEqual(before);
    } finally {
      rmSync(ctx.work, { recursive: true, force: true });
    }
  },
);

test.skipIf(process.platform !== "darwin" || process.arch !== "arm64")(
  "an occupied output lock prevents another build from touching artifacts",
  async () => {
    const ctx = fixture({
      run(file, args) {
        if (args.includes("host-tuple")) {
          return Promise.resolve({
            status: 0,
            stdout: Buffer.from("aarch64-apple-darwin\n"),
            stderr: Buffer.alloc(0),
          });
        }
        if (file === "/usr/bin/plutil") {
          return Promise.resolve({
            status: 0,
            stdout: Buffer.from('{"com.apple.security.cs.allow-jit":true}'),
            stderr: Buffer.alloc(0),
          });
        }
        return Promise.resolve({ status: 0, stdout: Buffer.alloc(0), stderr: Buffer.alloc(0) });
      },
    });
    try {
      writeFileSync(resolve(ctx.out, ".overmind-engine.lock"), "owned by another build");
      await expect(packageEngine(parseOptions(["--out", ctx.out]), ctx.runner)).rejects.toThrow(
        "Packaging output is already locked",
      );
      expect(readFileSync(resolve(ctx.out, ".overmind-engine.lock"), "utf8")).toBe(
        "owned by another build",
      );
    } finally {
      rmSync(ctx.work, { recursive: true, force: true });
    }
  },
);

test("diagnostic and malformed CLI modes cannot request normal signed publication", () => {
  expect(() => parseOptions(["--skip-sign"])).toThrow();
  expect(() => parseOptions(["--skip-sign", "--release", "--out", "diagnostic"])).toThrow();
  expect(() => parseOptions(["--out", ""])).toThrow();
  expect(() => parseOptions(["--unknown"])).toThrow();
  expect(() => parseOptions(["--identity", "a\nb"])).toThrow();
  expect(parseOptions([], { OVERMIND_SIGN_IDENTITY: "-" }).identity).toBe("-");
});
