import { TaskToolError } from "./errors.ts";
import { ownsOverlap } from "./glob.ts";
import type { Task } from "./model.ts";

export function safeText(text: string): string {
  return text
    .replace(/[\p{Cc}\p{Cf}]/gu, " ")
    .replaceAll("@", "@\u200b")
    .replaceAll("`", "")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

export function taskSection(body: string, section: number): string {
  return (
    new RegExp(
      `^## ${String(section)}\\. [^\\n]*\\n([\\s\\S]*?)(?=^## \\d+\\.|$(?![\\s\\S]))`,
      "mu",
    ).exec(body)?.[1] ?? ""
  );
}

export function acceptance(task: Task): { checked: boolean; text: string }[] {
  const rows = taskSection(task.body, 11)
    .split("\n")
    .flatMap((line) => {
      const match = /^\s*- \[([ xX])\] (.+)$/u.exec(line);
      return match?.[1] && match[2]
        ? [{ checked: match[1].toLowerCase() === "x", text: safeText(match[2]) }]
        : [];
    });
  if (!rows.length || rows.length > 100) {
    throw new TaskToolError(4, "Task needs a bounded acceptance checklist");
  }
  return rows;
}

export function buildPrBody(task: Task, changedFiles: readonly string[], template: string) {
  const owned = changedFiles.filter(
    (file) => file === task.path || ownsOverlap(task.owns, [file]).length > 0,
  );
  const outside = changedFiles.filter((file) => !owned.includes(file));
  const list = (files: readonly string[]) =>
    files.map((file) => `- ${safeText(file)}`).join("\n") || "- None";
  const safeTemplate = template.split("\n").map(safeText).join("\n");
  return `${safeTemplate}\n\nTask: ${task.id} — ${safeText(task.title)}\n\n## Acceptance criteria\n\n${acceptance(
    task,
  )
    .map((row) => `- [${row.checked ? "x" : " "}] ${row.text}`)
    .join(
      "\n",
    )}\n\n## Security review\n\nReview TASK.md section 9 against the actual implementation:\n${safeText(taskSection(task.body, 9))}\n\n## New dependencies\n\nList new dependencies and justification, license, release age and alternatives, or state None.\n\n## Changed files within owns\n\n${list(owned)}\n\n## Changed files outside owns\n\n${list(outside)}\n\nOutside-owned changes need the approved integration proposal.\n`;
}
