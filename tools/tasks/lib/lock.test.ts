import { existsSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import { withTaskLock } from "./lock.ts";

it("excludes a second local operation and releases its own lock on success and failure", async () => {
  const directory = realpathSync(mkdtempSync(join(tmpdir(), "ove-task-lock-")));
  let release: () => void = () => {
    throw new Error("Lock did not start");
  };
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  let signalStarted: () => void = () => {
    throw new Error("Missing start signal");
  };
  const started = new Promise<void>((resolve) => {
    signalStarted = resolve;
  });
  try {
    const first = withTaskLock(directory, async () => {
      signalStarted();
      await held;
      return 42;
    });
    await started;
    await expect(withTaskLock(directory, () => Promise.resolve(0))).rejects.toMatchObject({
      exitCode: 2,
    });
    release();
    expect(await first).toBe(42);
    await expect(
      withTaskLock(directory, () => Promise.reject(new Error("fixture failure"))),
    ).rejects.toThrow("fixture failure");
    expect(existsSync(join(directory, "overmind-task.lock"))).toBe(false);
  } finally {
    release();
    rmSync(directory, { recursive: true, force: true });
  }
});

it("ignores a stale dead-owner lock without deleting it or stealing a live old lock", async () => {
  const directory = realpathSync(mkdtempSync(join(tmpdir(), "ove-task-stale-lock-")));
  const path = join(directory, "overmind-task.lock");
  const record = { token: "00000000-0000-4000-8000-000000000001", pid: 12345, createdAt: 1000 };
  try {
    writeFileSync(path, JSON.stringify(record), { mode: 0o600 });
    await expect(
      withTaskLock(directory, () => Promise.resolve("ok"), {
        now: () => 700000,
        isAlive: () => true,
      }),
    ).rejects.toMatchObject({ exitCode: 2 });
    expect(
      await withTaskLock(directory, () => Promise.resolve("ok"), {
        now: () => 700000,
        isAlive: () => false,
      }),
    ).toBe("ok");
    expect(existsSync(path)).toBe(true);
    expect(existsSync(path + ".1")).toBe(false);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
