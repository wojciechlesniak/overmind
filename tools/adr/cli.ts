import { homedir } from "node:os";
import { basename, dirname, resolve } from "node:path";
import { parseArgs } from "node:util";
import { Files } from "./files.ts";
import { parseLabels } from "./input.parse-boundary.ts";
import { nodeGit, systemClock } from "./ports.ts";
import { checkRepository, generateIndex } from "./repository.ts";
import { createAdr, renumberAdr } from "./service.ts";

export function runCli(command: "new" | "index" | "check" | "renumber"): void {
  try {
    const args = process.argv.slice(2);
    if (args.join(" ").length > 4096 || args.some((arg) => /\p{Cc}/u.test(arg))) {
      throw new Error("Invalid ADR arguments");
    }
    const options =
      command === "index"
        ? { check: { type: "boolean" as const } }
        : command === "renumber"
          ? { apply: { type: "boolean" as const } }
          : {};
    const { values, positionals } = parseArgs({
      args,
      options,
      allowPositionals: true,
      strict: true,
    });
    const root = process.cwd();
    if (command === "new") {
      if (positionals.length !== 1) {
        throw new Error("Usage: adr:new <title>");
      }
      process.stdout.write(
        createAdr(root, positionals[0] ?? "", { git: nodeGit(root), clock: systemClock }) + "\n",
      );
    } else if (command === "renumber") {
      if (positionals.length !== 2 || positionals.some((value) => !/^[1-9]\d{0,3}$/u.test(value))) {
        throw new Error("Usage: adr:renumber <old> <new> [--apply]");
      }
      process.stdout.write(
        renumberAdr(
          root,
          Number(positionals[0]),
          Number(positionals[1]),
          values.apply === true,
        ).join("\n") + "\n",
      );
    } else {
      if (positionals.length) {
        throw new Error("Unexpected ADR positional argument");
      }
      if (command === "index") {
        generateIndex(root, values.check === true);
      } else {
        const path = process.env["GITHUB_EVENT_PATH"];
        const labels = path
          ? parseLabels(new Files(dirname(resolve(path))).read(basename(path)))
          : [];
        checkRepository(root, nodeGit(root), labels);
      }
    }
  } catch (error) {
    const message = (error instanceof Error ? error.message : "ADR operation failed")
      .replaceAll(homedir(), "<home>")
      .replace(/\p{Cc}/gu, " ")
      .slice(0, 512);
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  }
}
