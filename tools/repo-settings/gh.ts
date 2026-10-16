import { execFileSync } from "node:child_process";
import { parseJson } from "./input.parse-boundary.ts";
export type Reply = { ok: true; value: unknown } | { ok: false; reason: string; invalid?: true };
export interface Reader {
  request(method: string, endpoint: string): Reply;
}
export type Execute = (args: string[], input?: string) => string;
const execute: Execute = (args, input) =>
  execFileSync("gh", args, {
    encoding: "utf8",
    timeout: 30_000,
    maxBuffer: 8 * 1024 * 1024,
    stdio: [input === undefined ? "ignore" : "pipe", "pipe", "pipe"],
    ...(input === undefined ? {} : { input }),
    env: { ...process.env, GH_DEBUG: "", DEBUG: "", GH_PROMPT_DISABLED: "1", GH_PAGER: "cat" },
  });
function endpointValid(endpoint: string): boolean {
  return (
    /^repos\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_%./-]+)?(?:\?[A-Za-z0-9_=&%-]+)?$/u.test(
      endpoint,
    ) &&
    !endpoint.includes("..") &&
    !/%(?:2e|2f|5c)/iu.test(endpoint)
  );
}
export function ghReader(run: Execute = execute): Reader {
  return {
    request(method, endpoint) {
      if (method !== "GET" || !endpointValid(endpoint)) {
        throw new Error("Audit permits validated repository GET requests only");
      }
      let text: string;
      try {
        text = run([
          "api",
          "--hostname",
          "github.com",
          "--method",
          "GET",
          "-H",
          "X-GitHub-Api-Version: 2026-03-10",
          endpoint,
        ]);
      } catch {
        return { ok: false, reason: "Unavailable endpoint, permission or rate limit" };
      }
      try {
        return { ok: true, value: text.trim() === "" ? null : parseJson(text) };
      } catch {
        return { ok: false, reason: "Malformed JSON response", invalid: true };
      }
    },
  };
}
export function list(reader: Reader, endpoint: string, key?: string): Reply {
  const values: unknown[] = [];
  for (let page = 1; page <= 100; page++) {
    const reply = reader.request("GET", `${endpoint}?per_page=100&page=${String(page)}`);
    if (!reply.ok) {
      return reply;
    }
    const batch: unknown =
      key === undefined
        ? reply.value
        : typeof reply.value === "object" && reply.value !== null && !Array.isArray(reply.value)
          ? Reflect.get(reply.value, key)
          : undefined;
    if (!Array.isArray(batch)) {
      return { ok: false, reason: "Malformed paginated response", invalid: true };
    }
    values.push(...batch.map((value: unknown) => value));
    if (batch.length < 100) {
      return { ok: true, value: values };
    }
  }
  return { ok: false, reason: "Pagination limit exceeded", invalid: true };
}
export function applyLabel(
  repo: string,
  operation: "create" | "update",
  label: { name: string; color: string; description: string },
  run: Execute = execute,
): void {
  const endpoint = `repos/${repo}/labels${operation === "update" ? `/${encodeURIComponent(label.name)}` : ""}`;
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u.test(repo) || repo.includes("..")) {
    throw new Error("Invalid repository");
  }
  run(
    [
      "api",
      "--hostname",
      "github.com",
      "--method",
      operation === "create" ? "POST" : "PATCH",
      endpoint,
      "--input",
      "-",
    ],
    JSON.stringify(label),
  );
}
