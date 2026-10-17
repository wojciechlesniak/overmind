import { execFileSync, spawnSync } from "node:child_process";
import {
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { expect, test } from "vitest";
import { z } from "zod";
import { json } from "./input.parse-boundary.ts";

const cli = resolve(import.meta.dirname, "symbolicate.ts");
const map = {
  version: 3,
  sources: ["file:///overmind/source/example.ts"],
  sourcesContent: ['throw new Error("probe");'],
  names: [],
  mappings: "AAAA",
  sourceRoot: "",
};

// OVE_SETUP017: the supported macOS/Linux hosts provide POSIX named pipes.
test.skipIf(process.platform === "win32")(
  "the public symbolication CLI rejects FIFO inputs without blocking",
  () => {
    const work = mkdtempSync(resolve(realpathSync(tmpdir()), "ove017-symbolication-"));
    try {
      const mapPath = resolve(work, "map.json");
      const stackPath = resolve(work, "stack.txt");
      const pipe = resolve(work, "input.fifo");
      writeFileSync(mapPath, JSON.stringify(map));
      writeFileSync(stackPath, "Error: probe\n    at fail (engine.cjs:1:1)\n");
      execFileSync("mkfifo", [pipe], { timeout: 5000 });
      for (const [mapInput, stackInput] of [
        [pipe, stackPath],
        [mapPath, pipe],
      ]) {
        const result = spawnSync(
          process.execPath,
          ["--import", "tsx", cli, "--map", mapInput ?? "", "--stack", stackInput ?? ""],
          { encoding: "utf8", timeout: 3000, maxBuffer: 1024 * 1024 },
        );
        expect(result.error).toBeUndefined();
        expect(result.status).toBe(1);
        expect(result.stdout).toBe("");
        expect(result.stderr).toContain("Symbolication input");
      }
    } finally {
      rmSync(work, { recursive: true, force: true });
    }
  },
  12000,
);

test.each([
  ["map", "grow-metadata", 16 * 1024 * 1024],
  ["map", "replace-metadata", 16 * 1024 * 1024],
  ["map", "grow-read", 16 * 1024 * 1024],
  ["map", "replace-read", 16 * 1024 * 1024],
  ["stack", "grow-read", 1024 * 1024],
  ["stack", "replace-read", 1024 * 1024],
])("the CLI rejects %s input %s and reads no more than limit+1 bytes", (input, mutation, limit) => {
  const work = mkdtempSync(resolve(realpathSync(tmpdir()), "ove017-symbolication-"));
  try {
    const mapPath = resolve(work, "map.json");
    const stackPath = resolve(work, "stack.txt");
    const receipt = resolve(work, "receipt.json");
    writeFileSync(mapPath, JSON.stringify(map));
    writeFileSync(stackPath, "Error: probe\n    at fail (engine.cjs:1:1)\n");
    const result = spawnSync(
      process.execPath,
      [
        "--import",
        "tsx",
        "--import",
        resolve(import.meta.dirname, "fixtures/symbolication-files.mjs"),
        cli,
        "--map",
        mapPath,
        "--stack",
        stackPath,
      ],
      {
        encoding: "utf8",
        timeout: 5000,
        maxBuffer: 1024 * 1024,
        env: {
          ...process.env,
          OVE017_INPUT_TARGET: input === "map" ? mapPath : stackPath,
          OVE017_INPUT_MUTATION: mutation,
          OVE017_INPUT_LIMIT: String(limit),
          OVE017_INPUT_RECEIPT: receipt,
        },
      },
    );
    expect(result.error).toBeUndefined();
    const proof = z
      .object({ mutated: z.boolean(), bytesRead: z.number().int().nonnegative() })
      .strict()
      .parse(json(readFileSync(receipt, "utf8")));
    expect(proof).toMatchObject({ mutated: true });
    expect(proof.bytesRead).toBeLessThanOrEqual(limit + 1);
    expect(result.status).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("Symbolication input");
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
});

// OVE_SETUP017: symbolic-link fixtures require the supported POSIX hosts.
test.skipIf(process.platform === "win32")(
  "the CLI maps stable files and refuses links, directories and oversized input",
  () => {
    const work = mkdtempSync(resolve(realpathSync(tmpdir()), "ove017-symbolication-"));
    try {
      const mapPath = resolve(work, "map.json");
      const stackPath = resolve(work, "stack.txt");
      writeFileSync(mapPath, JSON.stringify(map));
      writeFileSync(stackPath, "Error: probe\n    at fail (engine.cjs:1:1)\n");
      const run = (mapInput: string, stackInput: string) =>
        spawnSync(
          process.execPath,
          ["--import", "tsx", cli, "--map", mapInput, "--stack", stackInput],
          { encoding: "utf8", timeout: 3000, maxBuffer: 1024 * 1024 },
        );
      const normal = run(mapPath, stackPath);
      expect(normal.error).toBeUndefined();
      expect(normal.status).toBe(0);
      expect(normal.stdout).toContain("file:///overmind/source/example.ts:1:1");
      const link = resolve(work, "linked-map.json");
      symlinkSync(mapPath, link);
      const oversized = resolve(work, "oversized.json");
      writeFileSync(oversized, " ".repeat(16 * 1024 * 1024 + 1));
      for (const [mapInput, stackInput] of [
        [link, stackPath],
        [work, stackPath],
        [oversized, stackPath],
        [mapPath, oversized],
      ]) {
        const result = run(mapInput ?? "", stackInput ?? "");
        expect(result.error).toBeUndefined();
        expect(result.status).toBe(1);
        expect(result.stdout).toBe("");
        expect(result.stderr).toContain("Symbolication input");
      }
    } finally {
      rmSync(work, { recursive: true, force: true });
    }
  },
);
