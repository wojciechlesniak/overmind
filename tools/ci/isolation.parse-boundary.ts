import { readFileSync } from "node:fs";
import { z } from "zod";
const sha = z.string().regex(/^[a-f0-9]{40}$/u);
const repository = z.object({ full_name: z.string().regex(/^[\w.-]+\/[\w.-]+$/u) });
export const isolationPR = z.object({
  number: z.number().int().positive(),
  state: z.string(),
  head: z.object({ sha, repo: repository.nullable() }),
  base: z.object({ repo: repository }),
  labels: z.array(z.object({ name: z.string() })),
});
export const labelEvents = z.array(
  z.object({
    id: z.number().int().positive(),
    event: z.string(),
    created_at: z.iso.datetime(),
    actor: z.object({ login: z.string() }).nullable(),
    label: z.object({ name: z.string() }).optional(),
  }),
);
export type IsolationPR = z.infer<typeof isolationPR>;
export type LabelEvent = z.infer<typeof labelEvents>[number];
export const role = z.object({
  permission: z.enum(["admin", "maintain", "write", "triage", "read", "none"]),
});
export const commit = z.object({
  commit: z.object({ committer: z.object({ date: z.iso.datetime() }) }),
});
export function readIsolationEvent(path = process.env["GITHUB_EVENT_PATH"]) {
  if (!path) {
    throw new Error("GITHUB_EVENT_PATH is required");
  }
  const raw: unknown = JSON.parse(readFileSync(path, "utf8"));
  return z
    .object({
      repository: repository.extend({ default_branch: z.string().min(1) }),
      inputs: z.object({ pr_number: z.string().regex(/^\d*$/u).max(10).optional() }).optional(),
    })
    .parse(raw);
}
export async function githubAPI<T>(path: string, schema: z.ZodType<T>): Promise<T> {
  const token = process.env["GH_TOKEN"];
  if (!token) {
    throw new Error("GitHub gate token is unavailable");
  }
  const url = new URL(path, "https://api.github.com");
  if (url.origin !== "https://api.github.com" || url.username || url.password) {
    throw new Error("Unsafe GitHub API URL");
  }
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    redirect: "error",
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) {
    throw new Error(`GitHub gate API unavailable: HTTP ${String(response.status)}`);
  }
  const raw: unknown = await response.json();
  return schema.parse(raw);
}
