import { lstatSync, readFileSync } from "node:fs";
import { z } from "zod";
import { resolve } from "node:path";
const report = z.object({
  version: z.literal("2.1.0"),
  runs: z.array(z.object({ results: z.array(z.object({ ruleId: z.string().min(1) })) })).nonempty(),
});
export function readSecretCounts(path: string) {
  const file = lstatSync(path);
  if (!file.isFile() || file.size > 64 * 1024 * 1024) {
    throw new Error("Secret report must be a bounded regular file");
  }
  const policyRaw: unknown = JSON.parse(
    readFileSync(resolve(import.meta.dirname, "policy.json"), "utf8"),
  );
  const policy = z
    .object({ warningRule: z.literal("overmind-keychain-ref-guard") })
    .strict()
    .parse(policyRaw);
  const raw: unknown = JSON.parse(readFileSync(path, "utf8"));
  const results = report.parse(raw).runs.flatMap((run) => run.results);
  return {
    findings: results.filter((item) => item.ruleId !== policy.warningRule).length,
    warnings: results.filter((item) => item.ruleId === policy.warningRule).length,
  };
}
