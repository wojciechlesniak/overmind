import { parseArgs } from "node:util";
import { z } from "zod";
import { taskIdPattern } from "./model.ts";
import { TaskToolError } from "./errors.ts";

export const commands = ["claim", "next", "status", "release", "finish", "cleanup"] as const;
export type Command = (typeof commands)[number];
const optionsByCommand: Record<Command, Record<string, { type: "string" | "boolean" }>> = {
  claim: { install: { type: "string" }, agent: { type: "string" } },
  next: { area: { type: "string" }, limit: { type: "string" } },
  status: { mine: { type: "boolean" }, "stale-days": { type: "string" } },
  release: { "force-owner": { type: "boolean" } },
  finish: { done: { type: "boolean" } },
  cleanup: { merged: { type: "boolean" } },
};
const positive = z
  .string()
  .regex(/^[1-9]\d{0,4}$/u)
  .transform(Number);
const schema = z
  .object({
    command: z.enum(commands),
    id: z.string().regex(taskIdPattern).optional(),
    json: z.boolean().default(false),
    help: z.boolean().default(false),
    install: z
      .enum(["true", "false"])
      .default("true")
      .transform((value) => value === "true"),
    agent: z
      .string()
      .min(1)
      .max(80)
      .refine(
        (value) =>
          !Array.from(value).some(
            (character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127,
          ),
      )
      .optional(),
    area: z
      .string()
      .regex(/^(?:[A-Z]{2,6}|BOARDUI)$/u)
      .optional(),
    limit: positive.default(10),
    mine: z.boolean().default(false),
    "stale-days": positive.default(3),
    "force-owner": z.boolean().default(false),
    done: z.boolean().default(false),
    merged: z.boolean().default(false),
  })
  .strict();

export function parseCommand(command: Command, args: readonly string[]) {
  try {
    const parsed = parseArgs({
      args: [...args],
      options: {
        json: { type: "boolean" },
        help: { type: "boolean" },
        ...optionsByCommand[command],
      },
      allowPositionals: true,
      strict: true,
    });
    const values: Record<string, string | boolean | undefined> = parsed.values;
    const needsId = command === "claim" || command === "release" || command === "finish";
    const acceptsId = needsId || command === "cleanup";
    if (
      !parsed.values.help &&
      ((needsId && parsed.positionals.length !== 1) ||
        (!acceptsId && parsed.positionals.length !== 0) ||
        parsed.positionals.length > 1 ||
        (command === "cleanup" && parsed.positionals.length && values["merged"]))
    ) {
      throw new Error("Invalid positionals");
    }
    const data = schema.parse({ ...parsed.values, command, id: parsed.positionals[0] });
    const { ["stale-days"]: staleDays, ["force-owner"]: forceOwner, ...options } = data;
    return { ...options, staleDays, forceOwner };
  } catch {
    throw new TaskToolError(4, `Invalid arguments for task:${command}`);
  }
}

export type CommandInput = ReturnType<typeof parseCommand>;
