import { z } from "zod";

const id = z.string().regex(/^OVE_[A-Z]{2,7}\d{3}$/u);
const statuses = z.enum(["todo", "in_progress", "in_review", "done", "cancelled"]);
const version = { schemaVersion: z.literal(1) };
const claim = z
  .object({
    ...version,
    command: z.literal("claim"),
    id,
    worktree: z.string(),
    title: z.string(),
    owns: z.array(z.string()),
    warnings: z.array(z.string()),
    next: z.string(),
  })
  .strict();
const next = z
  .object({
    ...version,
    command: z.literal("next"),
    tasks: z.array(
      z
        .object({
          id,
          title: z.string(),
          area: z.string(),
          priority: z.enum(["P0", "P1", "P2"]),
          size: z.enum(["XS", "S", "M"]),
          layer: z.number().int().nonnegative(),
          unblocks: z.number().int().nonnegative(),
          provides: z.array(z.string()),
          conflicts: z.array(z.object({ id, path: z.string() }).strict()),
        })
        .strict(),
    ),
  })
  .strict();
const status = z
  .object({
    ...version,
    command: z.literal("status"),
    counts: z.array(
      z
        .object({
          area: z.string(),
          todo: z.number().int().nonnegative(),
          in_progress: z.number().int().nonnegative(),
          in_review: z.number().int().nonnegative(),
          done: z.number().int().nonnegative(),
          cancelled: z.number().int().nonnegative(),
        })
        .strict(),
    ),
    ready: z.array(id),
    claims: z.array(
      z
        .object({
          id,
          author: z.string(),
          committedAt: z.number().int().nonnegative(),
          ageDays: z.number().nonnegative(),
          stale: z.boolean(),
          status: statuses,
          integrationStatus: z.union([statuses, z.literal("missing")]),
          blockedBy: z.array(id),
        })
        .strict(),
    ),
  })
  .strict();
const release = z
  .object({ ...version, command: z.literal("release"), id, worktree: z.string() })
  .strict();
const cleanup = z
  .object({
    ...version,
    command: z.literal("cleanup"),
    removed: z.array(id),
    refused: z.array(z.object({ id, reason: z.string() }).strict()),
    message: z.string(),
  })
  .strict();
const finish = z
  .object({
    ...version,
    command: z.literal("finish"),
    id,
    status: z.enum(["in_review", "done"]),
    bodyPath: z.string(),
    pr: z.url().nullable(),
  })
  .strict();
export const outputSchema = z.discriminatedUnion("command", [
  claim,
  next,
  status,
  release,
  cleanup,
  finish,
]);
export type TaskOutput = z.infer<typeof outputSchema>;
export const errorSchema = z
  .object({
    ...version,
    command: z.enum(["claim", "next", "status", "release", "cleanup", "finish"]),
    ok: z.literal(false),
    exitCode: z.union([z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
    error: z.string(),
  })
  .strict();
