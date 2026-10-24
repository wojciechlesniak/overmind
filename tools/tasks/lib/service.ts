import { createRunner } from "./git.ts";
import type { Runner } from "./git.ts";
import { parseCommand } from "./arguments.ts";
import type { Command } from "./arguments.ts";
import { repository } from "./repository.ts";
import { withTaskLock } from "./lock.ts";

interface ServiceOptions {
  root?: string;
  runner?: Runner;
}

export async function runCommand(
  command: Command,
  args: readonly string[],
  options: ServiceOptions = {},
) {
  const input = parseCommand(command, args);
  const repo = await repository(options.root ?? process.cwd(), options.runner ?? createRunner());
  return withTaskLock(repo.common, async () => {
    if (command === "claim") {
      const { claim } = await import("./claim.ts");
      return claim(repo, input);
    }
    if (command === "next") {
      const { next } = await import("./views.ts");
      return next(repo, input);
    }
    if (command === "status") {
      const { status } = await import("./views.ts");
      return status(repo, input);
    }
    if (command === "release") {
      const { release } = await import("./release.ts");
      return release(repo, input);
    }
    if (command === "cleanup") {
      const { cleanup } = await import("./cleanup.ts");
      return cleanup(repo, input);
    }
    const { finish } = await import("./finish.ts");
    return finish(repo, input);
  });
}
