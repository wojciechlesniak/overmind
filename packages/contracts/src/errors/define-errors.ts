import { z } from "zod";
import { createAppError } from "./create-error.ts";
import type { AppError } from "../kernel/app-error.ts";
import { registrationInvariant, type ErrorDefinition, type JsonValue } from "./definition.ts";
import { isSafeText } from "./safe-details.ts";

const areas = new Set(
  "setup oss arch sec test ds data engine perm vis box prov wfrt chief agent chat skill board disc dec mem tg notif pause backup shell tray onb wspace chatui discui wfed runui boardui decui agui skui apprui connui setui gateway validation internal provider".split(
    " ",
  ),
);
const definitionSchema = z.strictObject({
  http: z
    .number()
    .refine((value) =>
      [400, 401, 403, 404, 409, 412, 422, 423, 429, 500, 502, 503].includes(value),
    ),
  severity: z.enum(["info", "warn", "error", "fatal"]),
  retryable: z.boolean(),
  messageKey: z.string(),
  defaultMessage: z.string().min(1).refine(isSafeText),
  detailsSchema: z
    .custom<z.ZodType<Record<string, JsonValue>>>((value) => value instanceof z.ZodType)
    .optional(),
  audit: z.boolean().optional(),
  telegramSafe: z.boolean(),
  deprecated: z.boolean().optional(),
});

type Arguments<Definition> = Definition extends { detailsSchema: infer Schema extends z.ZodType }
  ? [details: z.input<Schema>]
  : [];
type Constructors<Area extends string, Table extends Record<string, ErrorDefinition>> = {
  readonly [Reason in keyof Table & string]: ((
    ...args: Arguments<Table[Reason]>
  ) => AppError<`${Area}.${Reason}`>) & {
    readonly code: `${Area}.${Reason}`;
    readonly definition: Table[Reason];
  };
};

export function defineErrors<
  const Area extends string,
  const Table extends Record<string, ErrorDefinition>,
>(area: Area, table: Table): Constructors<Area, Table> {
  if (!areas.has(area)) {
    registrationInvariant("Unknown error area.");
  }
  const constructors: Record<string, unknown> = {};
  for (const [reason, definition] of Object.entries(table)) {
    const code = `${area}.${reason}`;
    if (
      !/^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/u.test(reason) ||
      !definitionSchema.safeParse(definition).success ||
      definition.messageKey !== `errors:${code}`
    ) {
      registrationInvariant("Invalid error registration.");
    }
    const registered = Object.freeze({ ...definition });
    const factory = (details?: unknown) => createAppError(code, registered, details);
    Object.defineProperties(factory, { code: { value: code }, definition: { value: registered } });
    constructors[reason] = factory;
  }
  return Object.freeze(constructors) as Constructors<Area, Table>;
}
