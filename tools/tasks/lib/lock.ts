import { randomUUID } from "node:crypto";
import { constants, closeSync, openSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { TaskToolError } from "./errors.ts";
import { nodeFiles } from "./files.ts";
import { parseLock } from "./lock.parse-boundary.ts";

interface LockOptions {
  now?: () => number;
  isAlive?: (pid: number) => boolean;
}

function errorCode(error: unknown): string | undefined {
  return error instanceof Error && "code" in error && typeof error.code === "string"
    ? error.code
    : undefined;
}

function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return errorCode(error) !== "ESRCH";
  }
}

function createLock(path: string, text: string): boolean {
  let descriptor: number;
  try {
    descriptor = openSync(
      path,
      constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,
      0o600,
    );
  } catch (error) {
    if (errorCode(error) === "EEXIST") {
      return false;
    }
    throw new TaskToolError(4, "Cannot create task lock");
  }
  try {
    writeFileSync(descriptor, text, "utf8");
  } finally {
    closeSync(descriptor);
  }
  return true;
}

function removeOwnedLock(path: string, token: string): void {
  const owner = parseLock(nodeFiles.readText(path, 4096));
  if (owner.token !== token) {
    throw new TaskToolError(4, "Task lock ownership changed");
  }
  unlinkSync(path);
}

/** Stale records remain in place: advancing a generation cannot unlink a new owner's lock. */
export async function withTaskLock<T>(
  directory: string,
  operation: () => Promise<T>,
  options: LockOptions = {},
): Promise<T> {
  const now = options.now ?? Date.now;
  const alive = options.isAlive ?? isAlive;
  const record = { token: randomUUID(), pid: process.pid, createdAt: now() };
  const base = join(directory, "overmind-task.lock");
  for (let generation = 0; generation < 256; generation++) {
    const path = generation === 0 ? base : `${base}.${String(generation)}`;
    if (!createLock(path, JSON.stringify(record))) {
      let owner;
      try {
        owner = parseLock(nodeFiles.readText(path, 4096));
      } catch {
        throw new TaskToolError(4, "Cannot safely read task lock");
      }
      if (now() - owner.createdAt < 600000 || alive(owner.pid)) {
        throw new TaskToolError(2, "Another local task operation is active");
      }
      continue;
    }
    try {
      return await operation();
    } finally {
      removeOwnedLock(path, record.token);
    }
  }
  throw new TaskToolError(4, "Task lock generation limit reached");
}
