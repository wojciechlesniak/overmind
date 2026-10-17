import { z } from "zod";
import { hashSchema } from "./input.parse-boundary.ts";

const ledgerSchema = z
  .object({
    schema: z.literal(1),
    scope: z.literal("official-node-runtime-only"),
    status: z.enum(["proposed", "approved"]),
    ownerDecision: z.string().min(20).max(1000).nullable(),
    version: z.literal("22.23.3"),
    target: z.literal("darwin-arm64"),
    archiveSha256: hashSchema,
    noticeSha256: hashSchema,
    extractedMembers: z.tuple([
      z.literal("node-v22.23.3-darwin-arm64/bin/node"),
      z.literal("node-v22.23.3-darwin-arm64/LICENSE"),
    ]),
    additionalTerms: z.tuple([
      z.literal("Unicode-3.0"),
      z.literal("ICU"),
      z.literal("IPADIC"),
      z.literal("Zlib"),
      z.literal("LicenseRef-Public-Domain-SQLite"),
      z.literal("LicenseRef-Public-Domain-SipHash"),
      z.literal("LicenseRef-Public-Domain-TZDB"),
    ]),
    noticeDestination: z.literal("Contents/Resources/engine/LICENSE"),
  })
  .strict()
  .refine(
    (value) =>
      value.status === "proposed" ? value.ownerDecision === null : value.ownerDecision !== null,
    "Approved runtime requires the recorded explicit Owner decision",
  );
export type RuntimeLedger = z.infer<typeof ledgerSchema>;
export function parseRuntimeLedger(value: unknown): RuntimeLedger {
  return ledgerSchema.parse(value);
}
export interface RuntimeIdentity {
  version: string;
  archiveSha256: string;
  noticeSha256: string;
  extractedMembers: readonly string[];
}
export function validateRuntimeLicense(
  ledger: RuntimeLedger,
  identity: RuntimeIdentity,
  requireApproved = true,
): void {
  if (
    identity.version !== ledger.version ||
    identity.archiveSha256 !== ledger.archiveSha256 ||
    identity.noticeSha256 !== ledger.noticeSha256 ||
    JSON.stringify(identity.extractedMembers) !== JSON.stringify(ledger.extractedMembers)
  ) {
    throw new Error("Runtime differs from the exact binary-only license ledger");
  }
  if (requireApproved && ledger.status !== "approved") {
    throw new Error("Runtime license Owner approval is pending");
  }
}
