import { TaskToolError } from "./errors.ts";

export function areaCodes(plan: string): Set<string> {
  const table = plan.split("## 2. Area codes")[1]?.split(/^## /mu)[0] ?? "";
  const codes = new Set(
    [...table.matchAll(/^\| ([A-Z]{2,7}) \|/gmu)]
      .map((match) => match[1] ?? "")
      .filter((code) => code.length > 0),
  );
  if (!codes.size) {
    throw new TaskToolError(4, "Cannot read area codes from tasks/PLAN.md");
  }
  return codes;
}
