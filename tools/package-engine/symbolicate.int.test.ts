import { parseRuntimeLedger } from "./runtimeLicenses.parse-boundary.ts";
import { copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";
import { expect, test } from "vitest";
import { type Context } from "./context.ts";
import { safeDirectory } from "./files.ts";
import { json, parseNodeLock } from "./input.parse-boundary.ts";
import { parseOptions } from "./run.ts";
import { execute, NodeRunner } from "./runner.ts";
import { fetchRuntime } from "./steps/fetch-runtime.ts";
import { inject } from "./steps/inject.ts";
import { sign } from "./steps/sign.ts";
import { symbolicateStack } from "./symbolicate.ts";

const root = resolve(import.meta.dirname, "../..");
test.skipIf(process.platform !== "darwin" || process.arch !== "arm64")(
  "a relocated signed SEA throw maps to its original TypeScript source offline",
  async () => {
    const parent = safeDirectory(root, resolve(root, "build/engine-tmp"), true);
    const work = mkdtempSync(resolve(parent, "map-"));
    try {
      const resources = safeDirectory(root, resolve(work, "Contents/Resources/engine"), true);
      const dist = safeDirectory(root, resolve(work, "dist"), true);
      safeDirectory(root, resolve(work, "Contents/MacOS"), true);
      const runner = new NodeRunner(root);
      const ctx: Context = {
        root,
        work,
        out: work,
        runner,
        options: parseOptions([]),
        resources,
        dist,
        runtime: resolve(work, "node"),
        binary: resolve(work, "Contents/MacOS/overmind-engine"),
        entitlements: resolve(work, "engine.plist"),
        licenseLedger: parseRuntimeLedger(
          json(readFileSync(resolve(root, "tools/package-engine/runtime-licenses.json"), "utf8")),
        ),
        lock: parseNodeLock(
          json(readFileSync(resolve(root, "tools/package-engine/node.lock.json"), "utf8")),
          "22.23.3",
        ),
      };
      await execute(
        runner,
        process.execPath,
        [
          "--import",
          "tsx",
          resolve(root, "tools/package-engine/run.ts"),
          "--identity",
          "-",
          "--out",
          resolve(work, "runtime-preparation"),
        ],
        { cwd: root, timeout: 110000, maxBuffer: 4 * 1024 * 1024 },
      );
      expect(await fetchRuntime.run(ctx)).toEqual({ ok: true });
      await execute(
        runner,
        resolve(root, "tools/node_modules/.bin/esbuild"),
        [
          "tools/package-engine/fixtures/mappedThrow.ts.fixture",
          "--bundle",
          "--loader:.fixture=ts",
          "--platform=node",
          "--format=cjs",
          "--sourcemap=external",
          `--outfile=${resolve(dist, "engine.cjs")}`,
        ],
        { cwd: root },
      );
      const payload = z
        .object({ sources: z.array(z.string()).length(1) })
        .loose()
        .parse(json(readFileSync(resolve(dist, "engine.cjs.map"), "utf8")));
      expect(payload.sources[0]).toMatch(
        /tools\/package-engine\/fixtures\/mappedThrow\.ts\.fixture$/u,
      );
      const map = {
        ...payload,
        sources: ["file:///overmind/source/tools/package-engine/fixtures/mappedThrow.ts.fixture"],
        sourceRoot: "",
      };
      writeFileSync(resolve(resources, "engine.cjs.map"), JSON.stringify(map));
      writeFileSync(
        resolve(work, "sea-config.json"),
        JSON.stringify({
          main: "dist/engine.cjs",
          output: "sea-prep.blob",
          disableExperimentalSEAWarning: true,
          useCodeCache: false,
          useSnapshot: false,
          execArgvExtension: "none",
        }),
      );
      await execute(runner, ctx.runtime, ["--experimental-sea-config", "sea-config.json"], {
        cwd: work,
      });
      writeFileSync(
        ctx.entitlements,
        '<plist version="1.0"><dict><key>com.apple.security.cs.allow-jit</key><true/></dict></plist>',
      );
      expect(await inject.run(ctx)).toEqual({ ok: true });
      expect(await sign.run(ctx)).toEqual({ ok: true });
      // Deploy only the executable/map pair; the runtime and original bundle stay elsewhere.
      const relocated = safeDirectory(root, resolve(work, "relocated"), true);
      const deployed = resolve(relocated, "overmind-engine");
      copyFileSync(ctx.binary, deployed);
      const result = await runner.run(deployed, [], { cwd: relocated, timeout: 5000 });
      expect(result.status).toBe(1);
      expect(result.stderr.toString()).toContain("OVE017_SOURCE_MAP_PROBE");
      const mapped = symbolicateStack(
        result.stderr.toString(),
        json(readFileSync(resolve(resources, "engine.cjs.map"), "utf8")),
      );
      expect(mapped).toMatch(
        /file:\/\/\/overmind\/source\/tools\/package-engine\/fixtures\/mappedThrow\.ts\.fixture:2:\d+/u,
      );
      writeFileSync(resolve(root, ".cache/ove014-source-map-proof.txt"), mapped);
    } finally {
      rmSync(work, { recursive: true, force: true });
    }
  },
  120000,
);
