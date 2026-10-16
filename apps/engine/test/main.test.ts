import { afterEach, expect, it, vi } from "vitest";

const hooks = vi.hoisted(() => ({
  run: vi.fn().mockResolvedValue(20),
  ensureRunning: vi.fn().mockResolvedValue(20),
  reportEnsureResult: vi.fn().mockReturnValue(20),
  version: vi.fn().mockReturnValue(0),
}));
vi.mock("../src/commands/run.ts", () => ({ run: hooks.run }));
vi.mock("../src/commands/ensure-running.ts", () => ({
  ensureRunning: hooks.ensureRunning,
  reportEnsureResult: hooks.reportEnsureResult,
}));
vi.mock("../src/commands/version.ts", () => ({ version: hooks.version }));
const args = process.argv;
const originalExit = process.exitCode;
const stdoutListeners = process.stdout.listeners("error");
const stderrListeners = process.stderr.listeners("error");
afterEach(() => {
  process.argv = args;
  process.exitCode = originalExit;
  for (const stream of [process.stdout, process.stderr]) {
    const previous = stream === process.stdout ? stdoutListeners : stderrListeners;
    for (const listener of stream.listeners("error")) {
      if (!previous.includes(listener)) {
        stream.off("error", listener as (...args: unknown[]) => void);
      }
    }
  }
  vi.restoreAllMocks();
  vi.clearAllMocks();
});
async function start(arguments_: string[], expected: number) {
  vi.resetModules();
  process.argv = [process.execPath, "main.ts", ...arguments_];
  process.exitCode = undefined;
  await import("../src/main.ts");
  await vi.waitFor(() => {
    expect(process.exitCode).toBe(expected);
  });
}
it("dispatches each parsed command and keeps usage/help in the correct channel", async () => {
  const out = vi.spyOn(process.stdout, "write").mockReturnValue(true);
  const err = vi.spyOn(process.stderr, "write").mockReturnValue(true);
  await start(["version", "--json"], 0);
  expect(hooks.version).toHaveBeenCalledWith(true);
  await start(["ensure-running", "--json"], 20);
  expect(hooks.ensureRunning).toHaveBeenCalledWith(true);
  await start(["run", "--foreground"], 20);
  expect(hooks.run).toHaveBeenCalledWith({ name: "run", foreground: true });
  await start(["--help"], 0);
  expect(out).toHaveBeenCalledWith(expect.stringContaining("Usage:"));
  await start(["--help", "--json"], 0);
  expect(err).toHaveBeenCalledWith(expect.stringContaining("Usage:"));
  await start(["unknown"], 64);
  expect(err).toHaveBeenCalledWith(expect.stringContaining("Invalid arguments."));
});
it("internal hook failures use exit70 and ensure-running receives exactly one error receipt", async () => {
  const err = vi.spyOn(process.stderr, "write").mockReturnValue(true);
  hooks.ensureRunning.mockRejectedValueOnce(new Error("service failed"));
  await start(["ensure-running", "--json"], 70);
  expect(hooks.reportEnsureResult).toHaveBeenCalledExactlyOnceWith(
    { status: "failed", pid: null, socket: null, detail: "service failed" },
    true,
  );
  hooks.run.mockRejectedValueOnce(new Error("start failed"));
  await start(["run"], 70);
  expect(err).toHaveBeenCalledExactlyOnceWith("start failed\n");
});
it("stream error policy exits0 only for version EPIPE and otherwise70", async () => {
  const exit = vi.spyOn(process, "exit").mockReturnValue(undefined as never);
  await start(["version"], 0);
  const versionListener = process.stdout.listeners("error").at(-1) as (
    error: NodeJS.ErrnoException,
  ) => void;
  versionListener(Object.assign(new Error("pipe"), { code: "EPIPE" }));
  expect(exit).toHaveBeenLastCalledWith(0);
  versionListener(Object.assign(new Error("other"), { code: "EIO" }));
  expect(exit).toHaveBeenLastCalledWith(70);
  await start(["run"], 20);
  const runListener = process.stdout.listeners("error").at(-1) as (
    error: NodeJS.ErrnoException,
  ) => void;
  runListener(Object.assign(new Error("pipe"), { code: "EPIPE" }));
  expect(exit).toHaveBeenLastCalledWith(70);
});
