import { z } from "zod";
import { text } from "./text-schema.ts";
import { parseDocument, stringify } from "yaml";
import { headings } from "../docs-check/markdown.ts";

const number = z.number().int().min(1).max(9999);
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/u)
  .refine((value) => {
    const stamp = Date.parse(value);
    return Number.isFinite(stamp) && new Date(stamp).toISOString().slice(0, 10) === value;
  });
const numbers = z
  .array(number)
  .max(100)
  .refine((items) => new Set(items).size === items.length);
export const metadataSchema = z
  .object({
    adr: number,
    title: text,
    status: z.enum(["proposed", "accepted", "superseded", "deprecated"]),
    date,
    deciders: z.array(text).min(1).max(20).default(["Owner"]),
    supersedes: numbers,
    superseded_by: numbers,
    tags: z
      .array(z.enum(["architecture", "security", "product", "process", "tooling", "legal"]))
      .max(6)
      .default([]),
    translation_of: z
      .string()
      .regex(/^docs\/pl\/adr\/\d{4}-[a-z0-9-]+\.md$/u)
      .optional(),
    source_sha256: z
      .string()
      .regex(/^[a-f0-9]{64}$/u)
      .optional(),
    translated_on: date.optional(),
    translation_status: z.enum(["draft", "reviewed", "owner-approved"]).optional(),
    translator: text.optional(),
  })
  .strict()
  .refine((value) => {
    const fields = [
      value.translation_of,
      value.source_sha256,
      value.translated_on,
      value.translation_status,
      value.translator,
    ];
    return (
      fields.every((field) => field === undefined) || fields.every((field) => field !== undefined)
    );
  }, "Translation provenance must be complete");
export type Metadata = z.infer<typeof metadataSchema>;
export interface Adr {
  file: string;
  meta: Metadata;
  body: string;
}
const entry = z
  .object({
    adr: number,
    slug: z
      .string()
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u)
      .max(100),
    polishOriginal: z
      .string()
      .regex(/^\d{4}-[a-z0-9-]+\.md$/u)
      .nullable(),
    title: text,
  })
  .strict()
  .refine(
    (item) =>
      item.polishOriginal === null ||
      item.polishOriginal.startsWith(`${String(item.adr).padStart(4, "0")}-`),
  );
const slugMap = z
  .object({
    schema: z.literal(1),
    originals: z.array(entry).length(28),
    additional: z.array(entry).max(9971),
  })
  .strict()
  .refine(
    (value) =>
      value.originals.every(
        (item, index) => item.adr === index + 1 && item.polishOriginal !== null,
      ) && value.additional.every((item) => item.adr > 28),
    "Original ADR identities must remain ordered 0001-0028",
  );
export type SlugMap = z.infer<typeof slugMap>;
export function parseSlugMap(source: string): SlugMap {
  try {
    return slugMap.parse(JSON.parse(source));
  } catch {
    throw new Error("Invalid ADR slug-map JSON");
  }
}
export function parseAdr(file: string, source: string): Adr {
  const name = /^(\d{4})-[a-z0-9]+(?:-[a-z0-9]+)*\.md$/u.exec(file);
  const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)([\s\S]*)$/u.exec(source);
  if (!name || !match || Buffer.byteLength(source, "utf8") > 2 * 1024 * 1024) {
    throw new Error("ADR needs a canonical filename and bounded front matter");
  }
  const document = parseDocument(match[1] ?? "", {
    schema: "core",
    customTags: [],
    uniqueKeys: true,
    strict: true,
  });
  if (document.errors.length || document.warnings.length) {
    throw new Error("Invalid ADR YAML");
  }
  const raw: unknown = document.toJS({ maxAliasCount: 0 });
  const meta = metadataSchema.parse(raw);
  const body = match[2] ?? "";
  const visibleHeadings = headings(body);
  const titles = visibleHeadings.filter((heading) => heading.level === 1);
  if (
    meta.adr !== Number(name[1]) ||
    titles.length !== 1 ||
    titles[0]?.text !== meta.title ||
    (meta.status !== "proposed" &&
      !visibleHeadings.some((heading) => heading.level === 2 && heading.text === "Consequences"))
  ) {
    throw new Error("ADR number, title or Consequences is invalid");
  }
  return { file, meta, body };
}

export function renderAdr(meta: Metadata, body: string): string {
  const metadata = metadataSchema.parse(meta);
  const titles = headings(body).filter((heading) => heading.level === 1);
  const heading = titles[0];
  if (titles.length !== 1 || !heading) {
    throw new Error("ADR body needs exactly one visible title");
  }
  if (heading.text !== metadata.title) {
    const rows = body.split(/(\r\n|\r|\n)/u);
    const index = (heading.line - 1) * 2;
    if (!/^ {0,3}#(?:[ \t]|$)/u.test(rows[index] ?? "")) {
      throw new Error("ADR template needs an editable ATX title");
    }
    const literal = metadata.title.replace(
      /[\p{P}\p{S}\s]/gu,
      (character) => `&#${String(character.codePointAt(0))};`,
    );
    rows[index] = `# ${literal}`;
    body = rows.join("");
  }
  return `---\n${stringify(metadata, { lineWidth: 0 })}---\n${body}`;
}

export { parseLabels } from "./labels.parse-boundary.ts";
