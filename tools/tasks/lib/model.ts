import { z } from "zod";

export const taskIdPattern = /^OVE_[A-Z]{2,6}\d{3}$/u;
// BOARDUI already exists in the backlog; metadata is not command authorization.
const metadataId = z.string().regex(/^OVE_(?:[A-Z]{2,6}|BOARDUI)\d{3}$/u);
const texts = z.array(z.string().max(2048));
export const taskFrontMatterSchema = z
  .object({
    id: metadataId,
    title: z.string().min(1).max(1000),
    area: z.string().regex(/^(?:[A-Z]{2,6}|BOARDUI)$/u),
    kind: z.enum([
      "feature",
      "ui",
      "infra",
      "contract",
      "security",
      "test",
      "docs",
      "spike",
      "decision",
    ]),
    size: z.enum(["XS", "S", "M"]),
    priority: z.enum(["P0", "P1", "P2"]),
    mvp: z.boolean(),
    status: z.enum(["todo", "in_progress", "in_review", "done", "cancelled"]),
    depends_on: z.array(metadataId),
    soft_depends_on: z.array(metadataId),
    provides: texts,
    needs: texts,
    owns: texts,
    reads: texts,
    design: z.string().min(1).max(2048),
    design_source: z.string().max(2048),
    spec_refs: texts,
    adr_refs: z.array(z.number().int().positive()),
    blocks: z.array(metadataId).optional(),
  })
  .strict()
  .refine((task) => task.id.slice(4, -3) === task.area, "Task ID and area disagree");

export type TaskFrontMatter = z.infer<typeof taskFrontMatterSchema>;
export type Task = TaskFrontMatter & { path: string; text: string; body: string };
export interface ParseError {
  path: string;
  reason: string;
}
export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };
