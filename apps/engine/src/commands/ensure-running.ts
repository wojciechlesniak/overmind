import { missingHook, stderr, stdout } from "../cli.ts";
import { EXIT_CODES } from "../exit-codes.ts";
import { versionInfo } from "../version.ts";

export type EnsureResult =
  | { status: "running" | "already_running"; pid: number; socket: string; detail: string | null }
  | { status: "failed" | "incompatible"; pid: null; socket: null; detail: string | null };

function validResult(value: unknown): value is EnsureResult {
  if (
    typeof value !== "object" ||
    value === null ||
    !("status" in value) ||
    !("pid" in value) ||
    !("socket" in value) ||
    !("detail" in value) ||
    (value.detail !== null && typeof value.detail !== "string")
  ) {
    return false;
  }
  return value.status === "running" || value.status === "already_running"
    ? typeof value.pid === "number" &&
        Number.isSafeInteger(value.pid) &&
        value.pid > 0 &&
        typeof value.socket === "string" &&
        value.socket.length > 0
    : (value.status === "failed" || value.status === "incompatible") &&
        value.pid === null &&
        value.socket === null;
}

async function loadService(): Promise<unknown> {
  try {
    // @ts-expect-error -- ENGINE service lifecycle owns this future module; replace with static import when it lands.
    return await import("../service/index.js");
  } catch (error) {
    if (missingHook(error, "/service/index.js")) {
      return undefined;
    }
    throw error;
  }
}
export function reportEnsureResult(result: EnsureResult, json: boolean): number {
  const info = versionInfo();
  if (json) {
    stdout(
      `${JSON.stringify({ status: result.status, pid: result.pid, socket: result.socket, version: info.version, protocol: info.protocol, detail: result.detail })}\n`,
    );
  }
  if (result.detail !== null) {
    stderr(`${result.detail}\n`);
  }
  return {
    running: EXIT_CODES.ok,
    already_running: EXIT_CODES.alreadyRunning,
    failed: EXIT_CODES.cannotStart,
    incompatible: EXIT_CODES.incompatible,
  }[result.status];
}
export async function ensureRunning(json: boolean, load = loadService): Promise<number> {
  const hook: unknown = await load();
  if (hook === undefined) {
    return reportEnsureResult(
      { status: "failed", pid: null, socket: null, detail: "engine bootstrap not implemented" },
      json,
    );
  }
  if (
    typeof hook !== "object" ||
    hook === null ||
    !("ensureRunning" in hook) ||
    typeof hook.ensureRunning !== "function"
  ) {
    throw new Error("invalid engine service hook");
  }
  const value: unknown = await (
    hook.ensureRunning as (options: { json: boolean }) => Promise<EnsureResult>
  )({ json });
  if (!validResult(value)) {
    throw new Error("invalid engine service result");
  }
  return reportEnsureResult(value, json);
}
