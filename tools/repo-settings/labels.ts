import { type Label, parseApiLabels } from "./input.parse-boundary.ts";
import { type Reader, applyLabel, list } from "./gh.ts";
import { labelDiff } from "./policy.ts";
export function synchronize(
  expected: Label[],
  reader: Reader,
  repo: string,
  apply = false,
  write: typeof applyLabel = applyLabel,
) {
  const reply = list(reader, `repos/${repo}/labels`);
  if (!reply.ok) {
    throw new Error("Label metadata unavailable");
  }
  const plan = labelDiff(expected, parseApiLabels(reply.value));
  if (apply) {
    for (const change of plan.changes) {
      write(repo, change.operation, change.label);
    }
  }
  return plan;
}
