import { createRunner } from "./git.ts";
import type { Runner } from "./git.ts";
import { parseCommand } from "./arguments.ts";
import type { Command } from "./arguments.ts";
import { repository } from "./repository.ts";
import { withTaskLock } from "./lock.ts";
import { claim } from "./claim.ts";
import { next, status } from "./views.ts";
import { release } from "./release.ts";
import { cleanup } from "./cleanup.ts";
import { finish } from "./finish.ts";

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
      return claim(repo, input);
    }
    if (command === "next") {
      return next(repo, input);
    }
    if (command === "status") {
      return status(repo, input);
    }
    if (command === "release") {
      return release(repo, input);
    }
    if (command === "cleanup") {
      return cleanup(repo, input);
    }
    return finish(repo, input);
  });
}
