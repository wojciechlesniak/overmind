import { readFileSync } from "node:fs";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { Runner } from "./git.ts";
import type * as gitModule from "./git.ts";
import type { claim as claimHandler } from "./claim.ts";

const fixturePath = "tasks/OVE_FIX001/TASK.md";
const fixtureText = readFileSync(
  new URL("../fixtures/tasks/OVE_FIX001/TASK.md", import.meta.url),
  "utf8",
);

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  for (const path of ["./claim.ts", "./repository.ts", "./lock.ts", "./git.ts"]) {
    vi.doUnmock(path);
  }
  vi.resetModules();
});

it("parses public metadata and rejects invalid mutation arguments before loading claim", async () => {
  const loadClaim = vi.fn(() => {
    throw new Error("Claim handler must not load for metadata or invalid arguments");
  });
  vi.doMock("./claim.ts", loadClaim);

  const api = await import("./index.ts");
  const service = await import("./service.ts");
  expect(api.runCommand).toBe(service.runCommand);
  const parsed = api.parseTask(fixturePath, fixtureText);
  expect(parsed.ok).toBe(true);
  if (!parsed.ok) {
    throw new Error("Valid public parser fixture rejected");
  }
  expect(parsed.value.id).toBe("OVE_FIX001");
  expect(loadClaim).not.toHaveBeenCalled();

  const runner = { run: vi.fn<Runner["run"]>() };
  const rejected = api.runCommand("claim", ["../invalid"], { runner });
  await expect(rejected).rejects.toBeInstanceOf(api.TaskToolError);
  await expect(rejected).rejects.toMatchObject({
    exitCode: 4,
    message: "Invalid arguments for task:claim",
  });
  expect(runner.run).not.toHaveBeenCalled();
  expect(loadClaim).not.toHaveBeenCalled();
});

it("captures default context before yielding and delegates only after taking the lock", async () => {
  const order: string[] = [];
  const runner = { run: vi.fn<Runner["run"]>() };
  const createRunner = vi.fn(() => runner);
  vi.doMock("./git.ts", async (importOriginal) => ({
    ...(await importOriginal<typeof gitModule>()),
    createRunner,
  }));
  const repo = { common: "/synthetic/task-common" };
  const repository = vi.fn(() => {
    order.push("repository");
    return Promise.resolve(repo);
  });
  vi.doMock("./repository.ts", () => ({ repository }));
  const withTaskLock = vi.fn(async (_directory: string, operation: () => Promise<unknown>) => {
    order.push("lock");
    try {
      return await operation();
    } finally {
      order.push("unlock");
    }
  });
  vi.doMock("./lock.ts", () => ({ withTaskLock }));
  const result = {
    schemaVersion: 1 as const,
    command: "claim" as const,
    id: "OVE_FIX001",
    worktree: "/synthetic/task-worktree",
    title: "Synthetic task",
    owns: [],
    warnings: [],
    next: "Read the task",
  };
  const claim = vi.fn<typeof claimHandler>().mockResolvedValue(result);
  const loadClaim = vi.fn(() => {
    order.push("handler-load");
    return { claim };
  });
  vi.doMock("./claim.ts", loadClaim);

  const api = await import("./index.ts");
  const cwd = process.cwd();
  const pending = api.runCommand("claim", ["OVE_FIX001"]);
  expect(createRunner).toHaveBeenCalledTimes(1);
  expect(repository).toHaveBeenCalledExactlyOnceWith(cwd, runner);
  expect(loadClaim).not.toHaveBeenCalled();
  await expect(pending).resolves.toBe(result);
  expect(order).toEqual(["repository", "lock", "handler-load", "unlock"]);
  expect(withTaskLock.mock.calls[0]?.[0]).toBe(repo.common);
  expect(claim.mock.calls[0]?.[0]).toBe(repo);
  expect(claim.mock.calls[0]?.[1]).toMatchObject({ command: "claim", id: "OVE_FIX001" });

  const failure = new api.TaskToolError(2, "Claim denied by handler");
  claim.mockRejectedValueOnce(failure);
  await expect(
    api.runCommand("claim", ["OVE_FIX001"], { root: "/synthetic/root", runner }),
  ).rejects.toBe(failure);
  expect(repository).toHaveBeenLastCalledWith("/synthetic/root", runner);
  expect(createRunner).toHaveBeenCalledTimes(1);
  expect(loadClaim).toHaveBeenCalledTimes(1);
  expect(order.at(-1)).toBe("unlock");
});
