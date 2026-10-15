import { readFileSync } from "node:fs";
import { z } from "zod";
const exceptionSchema = z.object({
  package: z.string().min(1),
  license: z.literal("MPL-2.0"),
  justification: z.string().min(20),
  expires: z.iso.date(),
});
export type LicenseException = z.infer<typeof exceptionSchema>;
export function readAllowlist(path: string): Set<string> {
  const raw: unknown = JSON.parse(readFileSync(path, "utf8"));
  return new Set(z.array(z.string().min(1)).nonempty().parse(raw));
}
export function readExceptions(path: string): LicenseException[] {
  const raw: unknown = JSON.parse(readFileSync(path, "utf8"));
  return z.array(exceptionSchema).parse(raw);
}
export function parseLicenseReport(text: string) {
  const raw: unknown = JSON.parse(text);
  return z
    .record(
      z.string(),
      z.array(
        z.object({
          name: z.string().min(1),
          versions: z.array(z.string().min(1)).nonempty(),
          license: z.string().optional(),
        }),
      ),
    )
    .parse(raw);
}
