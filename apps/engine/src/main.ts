import { diagnostic, parseCommand, stderr, stdout, USAGE } from "./cli.ts";
import { ensureRunning, reportEnsureResult } from "./commands/ensure-running.ts";
import { run } from "./commands/run.ts";
import { version } from "./commands/version.ts";
import { EXIT_CODES } from "./exit-codes.ts";

const command = parseCommand(process.argv.slice(2));
for (const stream of [process.stdout, process.stderr]) {
  stream.on("error", (error: NodeJS.ErrnoException) => {
    process.exit(
      error.code === "EPIPE" && command?.name === "version" ? EXIT_CODES.ok : EXIT_CODES.internal,
    );
  });
}
async function main(): Promise<number> {
  if (command === undefined) {
    stderr(`Invalid arguments.\n${USAGE}`);
    return EXIT_CODES.usage;
  }
  switch (command.name) {
    case "help":
      (command.json ? stderr : stdout)(USAGE);
      return EXIT_CODES.ok;
    case "version":
      return version(command.json);
    case "ensure-running":
      return ensureRunning(command.json);
    case "run":
      return run(command);
  }
}
void main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error: unknown) => {
    const detail = diagnostic(error);
    if (command?.name === "ensure-running") {
      reportEnsureResult({ status: "failed", pid: null, socket: null, detail }, command.json);
    } else {
      stderr(`${detail}\n`);
    }
    process.exitCode = EXIT_CODES.internal;
  });
