import { z } from "zod";
import { TaskToolError } from "./errors.ts";

const oid = z.string().regex(/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/u);
const mergedPrs = z
  .array(
    z.object({
      headRefOid: oid,
      baseRefName: z.string(),
      mergeCommit: z.object({ oid }).nullable(),
    }),
  )
  .max(100);
const pr = z.object({
  url: z.url().refine((value) => {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash &&
      /\/pull\/\d+$/u.test(url.pathname)
    );
  }),
  body: z.string().max(256 * 1024),
  headRefOid: oid,
  baseRefName: z.string(),
  statusCheckRollup: z
    .array(
      z.object({
        name: z.string().optional(),
        context: z.string().optional(),
        status: z.string().optional(),
        conclusion: z.string().nullable().optional(),
        state: z.string().optional(),
      }),
    )
    .max(200)
    .nullable(),
});

export function parsePr(text: string): z.infer<typeof pr> {
  try {
    const value: unknown = JSON.parse(text);
    const result = pr.safeParse(value);
    if (result.success) {
      return result.data;
    }
  } catch {
    // No unchecked JSON crosses the GitHub boundary.
  }
  throw new TaskToolError(4, "Invalid PR response");
}

export function parseMergedPrs(text: string): z.infer<typeof mergedPrs> {
  try {
    const value: unknown = JSON.parse(text);
    const result = mergedPrs.safeParse(value);
    if (result.success) {
      return result.data;
    }
  } catch {
    // Malformed or unavailable evidence denies cleanup.
  }
  throw new TaskToolError(4, "Invalid merged PR response");
}
