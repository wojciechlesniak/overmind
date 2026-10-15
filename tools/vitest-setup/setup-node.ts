import { afterAll, afterEach, beforeEach, vi } from "vitest";

const originalFetch = globalThis.fetch;
let localhostAllowed = false;
export function allowLocalhost(): void {
  localhostAllowed = true;
}
function guardedFetch(
  input: Parameters<typeof fetch>[0],
  init?: Parameters<typeof fetch>[1],
): ReturnType<typeof fetch> {
  if (!localhostAllowed) {
    throw new Error("Network access is forbidden in unit tests, inject a port");
  }
  const request = new Request(input, { ...init, redirect: "error" });
  const target = new URL(request.url);
  if (
    !["http:", "https:"].includes(target.protocol) ||
    !["localhost", "127.0.0.1", "[::1]"].includes(target.hostname) ||
    target.username ||
    target.password
  ) {
    throw new Error("Network access is forbidden in unit tests, inject a port");
  }
  return originalFetch(request);
}
function unhandledRejection(reason: unknown): never {
  throw reason instanceof Error
    ? reason
    : new Error("Unhandled rejection in unit tests", { cause: reason });
}
vi.stubGlobal("fetch", guardedFetch);
process.on("unhandledRejection", unhandledRejection);
afterAll(() => {
  process.off("unhandledRejection", unhandledRejection);
});
beforeEach(() => {
  localhostAllowed = false;
  vi.stubGlobal("fetch", guardedFetch);
});
afterEach(() => {
  localhostAllowed = false;
});
