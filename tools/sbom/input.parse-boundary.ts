import { lstatSync, readFileSync } from "node:fs";
import { z } from "zod";
const property = z.object({ name: z.string(), value: z.string() });
const license = z.union([
  z.object({ expression: z.string().min(1) }),
  z.object({
    license: z
      .object({ id: z.string().min(1).optional(), name: z.string().min(1).optional() })
      .loose()
      .refine((item) => Boolean(item.id ?? item.name)),
  }),
]);
const component = z
  .object({
    name: z.string().min(1),
    version: z.string().min(1),
    purl: z.string().regex(/^pkg:(?:npm|cargo)\//u),
    licenses: z.array(license).optional(),
    properties: z.array(property).optional(),
  })
  .loose();
const document = z
  .object({
    bomFormat: z.literal("CycloneDX"),
    specVersion: z.literal("1.6"),
    components: z.array(component).nonempty(),
  })
  .loose();
export type SBOM = z.infer<typeof document>;
export function parseSBOM(raw: unknown): SBOM {
  return document.parse(raw);
}
export function readSBOM(path: string): SBOM {
  const file = lstatSync(path);
  if (!file.isFile() || file.size > 64 * 1024 * 1024) {
    throw new Error("SBOM must be a bounded regular file");
  }
  const raw: unknown = JSON.parse(readFileSync(path, "utf8"));
  return parseSBOM(raw);
}
