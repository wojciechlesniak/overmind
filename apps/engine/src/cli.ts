import { parseArgs } from "node:util";
import { homedir } from "node:os";

export const USAGE = `Usage: overmind-engine <command> [options]
  run [--data-dir <path>] [--foreground]
  ensure-running [--json]
  version [--json]
  --help
Never pass secrets as command-line arguments.
`;
export type Command =
  | { name: "help"; json: boolean }
  | { name: "version" | "ensure-running"; json: boolean }
  | { name: "run"; dataDir?: string; foreground: boolean };

export function parseCommand(args: string[]): Command | undefined {
  if (args.reduce((length, value) => length + value.length + 1, -1) > 4096) {
    return undefined;
  }
  try {
    const { values, positionals } = parseArgs({
      args,
      strict: true,
      allowPositionals: true,
      options: {
        help: { type: "boolean", short: "h" },
        json: { type: "boolean" },
        foreground: { type: "boolean" },
        "data-dir": { type: "string" },
      },
    });
    if (positionals.length > 1) {
      return undefined;
    }
    const name = positionals[0];
    if (name !== undefined && !["run", "ensure-running", "version"].includes(name)) {
      return undefined;
    }
    if (values.help) {
      return { name: "help", json: values.json ?? false };
    }
    if (name === "run" && values.json === undefined) {
      const dataDir = values["data-dir"];
      if (dataDir === "") {
        return undefined;
      }
      return {
        name,
        foreground: values.foreground ?? false,
        ...(dataDir === undefined ? {} : { dataDir }),
      };
    }
    if (
      (name === "version" || name === "ensure-running") &&
      values.foreground === undefined &&
      values["data-dir"] === undefined
    ) {
      return { name, json: values.json ?? false };
    }
    return undefined;
  } catch {
    return undefined;
  }
}

export const stdout = (text: string): void => {
  process.stdout.write(text);
};
export const stderr = (text: string): void => {
  process.stderr.write(text);
};
export function diagnostic(error: unknown): string {
  return error instanceof Error
    ? error.message
        .replaceAll(homedir(), "<home>")
        .replace(/\p{Cc}/gu, " ")
        .slice(0, 512)
    : "engine internal error";
}
export function missingHook(error: unknown, suffix: string): boolean {
  return (
    error instanceof Error &&
    "code" in error &&
    error.code === "ERR_MODULE_NOT_FOUND" &&
    "url" in error &&
    typeof error.url === "string" &&
    error.url.endsWith(suffix)
  );
}
