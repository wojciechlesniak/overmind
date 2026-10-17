import type { Command } from "./arguments.ts";
import { parseCommand } from "./arguments.ts";
import { TaskToolError } from "./errors.ts";
import { errorSchema, outputSchema } from "./output.ts";
import type { TaskOutput } from "./output.ts";
import { runCommand } from "./service.ts";

function display(text: string): string {
  return text.replace(/[\p{Cc}\p{Cf}]/gu, " ");
}

function human(result: TaskOutput): string {
  if (result.command === "status") {
    return [
      "Area\ttodo\tin_progress\tin_review\tdone\tcancelled",
      ...result.counts.map(
        (row) =>
          `${row.area}\t${String(row.todo)}\t${String(row.in_progress)}\t${String(row.in_review)}\t${String(row.done)}\t${String(row.cancelled)}`,
      ),
      "\nClaims (integration status remains separate):",
      ...result.claims.map(
        (row) =>
          `${row.id}\t${display(row.author)}\t${row.ageDays.toFixed(1)} days\t${row.stale ? "STALE" : row.status}\t${row.integrationStatus}${row.blockedBy.length ? ` blocked: ${row.blockedBy.join(", ")}` : ""}`,
      ),
      `\nReady and unclaimed: ${result.ready.join(", ") || "None"}`,
    ].join("\n");
  }
  if (result.command === "next") {
    return [
      "Task\tPriority\tSize\tUnblocks\tTitle / provides",
      ...result.tasks.map(
        (row) =>
          `${row.id}\t${row.priority}\t${row.size}\t${String(row.unblocks)}\t${display(row.title)} / ${row.provides.map(display).join(", ")}${row.conflicts.length ? ` [conflict-risk: ${row.conflicts.map((conflict) => `${conflict.id}:${display(conflict.path)}`).join(", ")}]` : ""}`,
      ),
    ].join("\n");
  }
  return JSON.stringify(
    result,
    (_key, value: unknown) => (typeof value === "string" ? display(value) : value),
    2,
  );
}

export async function runCli(
  command: Command,
  args: readonly string[] = process.argv.slice(2),
): Promise<void> {
  const json = args.includes("--json");
  try {
    const input = parseCommand(command, args);
    if (input.help) {
      const usage = `pnpm task:${command} [ID] [options]\nSee tools/tasks/README.md for flags and safety rules.`;
      console.log(json ? JSON.stringify({ schemaVersion: 1, command, help: true, usage }) : usage);
      return;
    }
    const result = outputSchema.parse(await runCommand(command, args));
    console.log(json ? JSON.stringify(result) : human(result));
  } catch (error) {
    const exitCode = error instanceof TaskToolError ? error.exitCode : 5;
    const message =
      error instanceof TaskToolError
        ? display(error.message)
        : "Unexpected task-tool failure; no credentials or raw subprocess output are displayed";
    const result = errorSchema.parse({
      schemaVersion: 1,
      command,
      ok: false,
      exitCode,
      error: message,
    });
    if (json) {
      console.log(JSON.stringify(result));
    } else {
      console.error(message);
    }
    process.exitCode = exitCode;
  }
}
