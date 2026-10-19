import { homedir } from "node:os";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { diagnostic, isUnimplementedHook, missingHook, parseCommand } from "../src/cli.ts";
import * as composeFoundation from "../src/compose/index.ts";
import * as serviceFoundation from "../src/service/index.ts";
import { EXIT_CODES } from "../src/exit-codes.ts";
import { versionInfo } from "../src/version.ts";
import { version } from "../src/commands/version.ts";
import { ensureRunning, type EnsureResult } from "../src/commands/ensure-running.ts";
import { installShutdown, run } from "../src/commands/run.ts";

afterEach(() => {
  vi.restoreAllMocks();
});
describe("strict command arguments", () => {
  it.each([
    [["version"], { name: "version", json: false }],
    [["version", "--json"], { name: "version", json: true }],
    [["ensure-running", "--json"], { name: "ensure-running", json: true }],
    [
      ["run", "--foreground", "--data-dir", "/tmp/a b"],
      { name: "run", foreground: true, dataDir: "/tmp/a b" },
    ],
    [["run"], { name: "run", foreground: false }],
    [["--help", "--json"], { name: "help", json: true }],
    [["version", "-h"], { name: "help", json: false }],
  ] satisfies [string[], object][])("parses %j without touching paths", (args, expected) => {
    expect(parseCommand(args)).toEqual(expected);
  });
  it.each([
    [],
    ["unknown"],
    ["version", "extra"],
    ["version", "--wat"],
    ["run", "--json"],
    ["version", "--foreground"],
    ["ensure-running", "--data-dir", "x"],
    ["run", "--data-dir"],
    ["run", "--data-dir="],
    ["x".repeat(4097)],
  ])("rejects %j", (...args) => {
    expect(parseCommand(args)).toBeUndefined();
  });
});
it("defines stable exit codes and development version without environment data", () => {
  expect(EXIT_CODES).toEqual({
    ok: 0,
    alreadyRunning: 10,
    cannotStart: 20,
    incompatible: 30,
    usage: 64,
    internal: 70,
  });
  expect(versionInfo()).toEqual({
    version: "0.0.0-dev",
    protocol: 1,
    buildSha: "dev",
    node: process.versions.node,
    platform: process.platform,
    arch: process.arch,
  });
  const out = vi.spyOn(process.stdout, "write").mockReturnValue(true);
  expect(version(true)).toBe(0);
  expect(out).toHaveBeenCalledExactlyOnceWith(`${JSON.stringify(versionInfo())}\n`);
  out.mockClear();
  expect(version(false)).toBe(0);
  expect(out).toHaveBeenCalledExactlyOnceWith("overmind-engine 0.0.0-dev (protocol 1, dev)\n");
});
it("recognizes only the missing hook itself and redacts the home directory", () => {
  expect(
    missingHook(
      Object.assign(new Error("missing"), {
        code: "ERR_MODULE_NOT_FOUND",
        url: "file:///tmp/compose/index.js",
      }),
      "file:///tmp/compose/index.js",
    ),
  ).toBe(true);
  expect(
    missingHook(
      Object.assign(new Error("nested"), {
        code: "ERR_MODULE_NOT_FOUND",
        url: "file:///tmp/dependency.js",
      }),
      "file:///tmp/compose/index.js",
    ),
  ).toBe(false);
  expect(
    missingHook(
      Object.assign(new Error("same basename in a dependency"), {
        code: "ERR_MODULE_NOT_FOUND",
        url: "file:///tmp/nested/compose/index.js",
      }),
      "file:///tmp/compose/index.js",
    ),
  ).toBe(false);
  expect(missingHook(null, "file:///tmp/compose/index.js")).toBe(false);
  expect(diagnostic(new Error(`${homedir()}/file\nfailed`))).toBe("<home>/file failed");
  expect(diagnostic(null)).toBe("engine internal error");
});
it("absent ENGINE hook values fail with one machine-readable line", async () => {
  const out = vi.spyOn(process.stdout, "write").mockReturnValue(true);
  const err = vi.spyOn(process.stderr, "write").mockReturnValue(true);
  expect(await ensureRunning(true, () => Promise.resolve(undefined))).toBe(20);
  expect(out).toHaveBeenCalledExactlyOnceWith(
    `${JSON.stringify({ status: "failed", pid: null, socket: null, version: "0.0.0-dev", protocol: 1, detail: "engine bootstrap not implemented" })}\n`,
  );
  expect(err).toHaveBeenCalledExactlyOnceWith("engine bootstrap not implemented\n");
  expect(await run({ foreground: true }, () => Promise.resolve(undefined))).toBe(20);
});
it.each([
  [{ status: "running", pid: 1, socket: "/tmp/x", detail: null }, 0],
  [{ status: "already_running", pid: 1, socket: "/tmp/x", detail: null }, 10],
  [{ status: "failed", pid: null, socket: null, detail: "failed" }, 20],
  [{ status: "incompatible", pid: null, socket: null, detail: "mismatch" }, 30],
] satisfies [EnsureResult, number][])(
  "maps validated service status %j to exit %i",
  async (result, code) => {
    const out = vi.spyOn(process.stdout, "write").mockReturnValue(true);
    vi.spyOn(process.stderr, "write").mockReturnValue(true);
    const hook = vi.fn().mockResolvedValue(result);
    expect(await ensureRunning(false, () => Promise.resolve({ ensureRunning: hook }))).toBe(code);
    expect(hook).toHaveBeenCalledExactlyOnceWith({ json: false });
    expect(out).not.toHaveBeenCalled();
  },
);
it.each([
  null,
  {},
  { ensureRunning: 1 },
  { ensureRunning: () => ({ status: "running", pid: 0, socket: "/tmp/x", detail: null }) },
  { ensureRunning: () => ({ status: "failed", pid: 1, socket: null, detail: null }) },
  { ensureRunning: () => ({ status: "wat", pid: null, socket: null, detail: null }) },
])("rejects invalid service hooks and results %j", async (hook) => {
  await expect(ensureRunning(true, () => Promise.resolve(hook))).rejects.toThrow(
    "invalid engine service",
  );
});
it("run passes path as data and removes signal handlers after a start failure", async () => {
  const before = process.listenerCount("SIGTERM");
  const startEngine = vi.fn().mockRejectedValue(new Error("fixture failure"));
  await expect(
    run({ foreground: true, dataDir: "../untrusted" }, () =>
      Promise.resolve({ startEngine, shutdown: () => Promise.resolve() }),
    ),
  ).rejects.toThrow("fixture failure");
  expect(startEngine).toHaveBeenCalledExactlyOnceWith({
    foreground: true,
    dataDir: "../untrusted",
  });
  expect(process.listenerCount("SIGTERM")).toBe(before);
  await expect(run({ foreground: false }, () => Promise.resolve({}))).rejects.toThrow(
    "invalid engine composition hook",
  );
  await expect(
    run({ foreground: false }, () => Promise.reject(new Error("nested dependency"))),
  ).rejects.toThrow("nested dependency");
  const remove = installShutdown(() => Promise.resolve());
  expect(process.listenerCount("SIGTERM")).toBe(before + 1);
  remove();
  expect(process.listenerCount("SIGTERM")).toBe(before);
});
it.each(["completed", "failed", "hanging"] as const)(
  "shutdown plumbing handles %s hooks with bounded exit",
  async (state) => {
    vi.useFakeTimers();
    const exited = vi.spyOn(process, "exit").mockReturnValue(undefined as never);
    const err = vi.spyOn(process.stderr, "write").mockReturnValue(true);
    const shutdown = vi.fn(() =>
      state === "hanging"
        ? new Promise<void>(() => {
            /* Intentionally pending to exercise the shutdown deadline. */
          })
        : state === "failed"
          ? Promise.reject(new Error("shutdown failed"))
          : Promise.resolve(),
    );
    const remove = installShutdown(shutdown);
    try {
      const signal = process.listeners("SIGTERM").at(-1) as () => void;
      signal();
      await vi.advanceTimersByTimeAsync(0);
      expect(shutdown).toHaveBeenCalledTimes(1);
      if (state === "hanging") {
        expect(exited).not.toHaveBeenCalled();
        await vi.advanceTimersByTimeAsync(5000);
      }
      expect(exited).toHaveBeenLastCalledWith(0);
      if (state === "failed") {
        expect(err).toHaveBeenCalledExactlyOnceWith("shutdown failed\n");
      }
      exited.mockImplementationOnce(() => {
        throw new Error("immediate exit");
      });
      expect(signal).toThrow("immediate exit");
      expect(exited).toHaveBeenLastCalledWith(130);
    } finally {
      remove();
      vi.useRealTimers();
    }
  },
);
it("own production source uses no alternate runtime API or private Node binding", () => {
  function sources(directory: string): string {
    return readdirSync(directory, { withFileTypes: true })
      .map((entry) =>
        entry.isDirectory()
          ? sources(resolve(directory, entry.name))
          : readFileSync(resolve(directory, entry.name), "utf8"),
      )
      .join("\n");
  }
  expect(sources(resolve(import.meta.dirname, "../src"))).not.toMatch(
    /\b(?:Bun|Deno)\.|process\.binding|console\.log/,
  );
});

it("recognizes the exact foundation marker", () => {
  expect(isUnimplementedHook({ UNIMPLEMENTED: true })).toBe(true);
});
it("maps the exact foundation marker through both public command paths", async () => {
  const out = vi.spyOn(process.stdout, "write").mockReturnValue(true);
  const err = vi.spyOn(process.stderr, "write").mockReturnValue(true);
  const load = () => Promise.resolve({ UNIMPLEMENTED: true });
  expect(await run({ foreground: true }, load)).toBe(20);
  expect(await ensureRunning(true, load)).toBe(20);
  expect(out).toHaveBeenCalledExactlyOnceWith(
    `${JSON.stringify({ status: "failed", pid: null, socket: null, version: "0.0.0-dev", protocol: 1, detail: "engine bootstrap not implemented" })}\n`,
  );
  expect(err).toHaveBeenCalledTimes(2);
});

it("accepts foundation namespaces and compiled getter-style exports", () => {
  expect(isUnimplementedHook(composeFoundation)).toBe(true);
  expect(isUnimplementedHook(serviceFoundation)).toBe(true);
  expect(
    isUnimplementedHook(
      Object.defineProperty({}, "UNIMPLEMENTED", {
        enumerable: true,
        get: () => true,
      }),
    ),
  ).toBe(true);
});
it.each([
  ["undefined", undefined],
  ["null", null],
  ["primitive", true],
  ["function", () => true],
  ["array", Object.assign([], { UNIMPLEMENTED: true })],
  ["missing", {}],
  ["false", { UNIMPLEMENTED: false }],
  ["nonboolean", { UNIMPLEMENTED: "true" }],
  ["inherited", Object.create({ UNIMPLEMENTED: true })],
  ["nonenumerable", Object.defineProperty({}, "UNIMPLEMENTED", { value: true })],
  ["extra string", { UNIMPLEMENTED: true, other: undefined }],
  ["extra symbol", { UNIMPLEMENTED: true, [Symbol("other")]: true }],
] satisfies [string, unknown][])("rejects %s as an exact foundation marker", (_name, hook) => {
  expect(isUnimplementedHook(hook)).toBe(false);
});
it("preserves marker property access failures", () => {
  const module = Object.defineProperty({}, "UNIMPLEMENTED", {
    enumerable: true,
    get: () => {
      throw new Error("fixture marker getter failed");
    },
  });
  expect(() => isUnimplementedHook(module)).toThrow("fixture marker getter failed");
});
it("loads the actual source foundation modules lazily", async () => {
  vi.spyOn(process.stdout, "write").mockReturnValue(true);
  vi.spyOn(process.stderr, "write").mockReturnValue(true);
  expect(await run({ foreground: true })).toBe(20);
  expect(await ensureRunning(true)).toBe(20);
});
it.each([{ UNIMPLEMENTED: false }, { UNIMPLEMENTED: true, extra: true }])(
  "malformed markers preserve both real hook errors %j",
  async (hook) => {
    await expect(run({ foreground: false }, () => Promise.resolve(hook))).rejects.toThrow(
      "invalid engine composition hook",
    );
    await expect(ensureRunning(true, () => Promise.resolve(hook))).rejects.toThrow(
      "invalid engine service hook",
    );
  },
);
it("calls real hooks when their modules contain extra marker fields", async () => {
  vi.spyOn(process.stdout, "write").mockReturnValue(true);
  const ensure = vi.fn().mockResolvedValue({
    status: "running",
    pid: 1,
    socket: "/tmp/fixture",
    detail: null,
  });
  expect(
    await ensureRunning(false, () =>
      Promise.resolve({
        UNIMPLEMENTED: true,
        ensureRunning: ensure,
      }),
    ),
  ).toBe(0);
  expect(ensure).toHaveBeenCalledExactlyOnceWith({ json: false });
  const startEngine = vi.fn().mockRejectedValue(new Error("real startup failure"));
  await expect(
    run({ foreground: true }, () =>
      Promise.resolve({
        UNIMPLEMENTED: true,
        startEngine,
        shutdown: () => Promise.resolve(),
      }),
    ),
  ).rejects.toThrow("real startup failure");
  expect(startEngine).toHaveBeenCalledExactlyOnceWith({ foreground: true });
});
