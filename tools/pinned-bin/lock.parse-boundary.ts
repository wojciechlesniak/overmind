import { readFileSync } from "node:fs";
import { z } from "zod";
const name = z.string().regex(/^[a-z][a-z0-9-]*$/u);
const asset = z.object({
  url: z.url().refine((value) => {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  }, "Binary URL must use HTTPS without credentials"),
  sha256: z.string().regex(/^[a-f0-9]{64}$/u),
});
const entry = z.object({
  name,
  version: z.string().regex(/^[0-9]+\.[0-9]+\.[0-9]+$/u),
  assets: z.record(z.string(), asset),
});
export type BinaryEntry = z.infer<typeof entry>;
export function readBinaryLock(path: string, requestedName?: string): BinaryEntry[] {
  const raw: unknown = JSON.parse(readFileSync(path, "utf8"));
  const entries = Array.isArray(raw)
    ? z.array(entry).nonempty().parse(raw)
    : [entry.parse({ ...entry.omit({ name: true }).parse(raw), name: requestedName })];
  if (new Set(entries.map((item) => item.name)).size !== entries.length) {
    throw new Error("Duplicate binary lock entries");
  }
  return entries;
}
