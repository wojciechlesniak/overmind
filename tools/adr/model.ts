import type { Adr } from "./input.parse-boundary.ts";

export function slugify(title: string): string {
  if (!title.trim() || title.length > 200 || /\p{Cc}/u.test(title)) {
    throw new Error("Provide a bounded decision title");
  }
  const slug = title
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, " ")
    .trim()
    .split(/\s+/u)
    .slice(0, 6)
    .join("-")
    .slice(0, 60)
    .replace(/-$/u, "");
  if (!slug) {
    throw new Error("A title must contain ASCII slug characters");
  }
  return slug;
}
export function nextNumber(...groups: readonly (readonly number[])[]): number {
  const values = groups.flat();
  if (values.some((value) => !Number.isSafeInteger(value) || value < 1 || value >= 10000)) {
    throw new Error("Invalid ADR number");
  }
  const number = Math.max(0, ...values) + 1;
  if (number > 9999) {
    throw new Error("ADR number space exhausted");
  }
  return number;
}

export function checkRecords(
  records: readonly Adr[],
  entries: readonly { adr: number; slug: string }[],
): void {
  const ids = records.map((item) => item.meta.adr).sort((a, b) => a - b);
  if (!ids.length || ids.some((id, index) => id !== index + 1)) {
    throw new Error("ADR numbers must be unique and contiguous from 0001");
  }
  for (const record of records) {
    const meta = record.meta;
    if (
      !entries.some(
        (entry) =>
          entry.adr === meta.adr &&
          record.file === `${String(meta.adr).padStart(4, "0")}-${entry.slug}.md`,
      )
    ) {
      throw new Error("ADR filename differs from the slug map");
    }
    if ((meta.status === "superseded") !== Boolean(meta.superseded_by.length)) {
      throw new Error("Superseded status requires successors");
    }
    for (const [links, reciprocal] of [
      [meta.supersedes, "superseded_by"],
      [meta.superseded_by, "supersedes"],
    ] as const) {
      for (const id of links) {
        if (
          id === meta.adr ||
          !records.find((item) => item.meta.adr === id)?.meta[reciprocal].includes(meta.adr)
        ) {
          throw new Error("ADR supersession must be mutual and refer to existing decisions");
        }
      }
    }
  }
}
export function checkTransition(before: Adr, after: Adr, labels: readonly string[]): void {
  const old = before.meta.status;
  const next = after.meta.status;
  if (
    before.meta.adr !== after.meta.adr ||
    (old !== next &&
      !(
        (old === "proposed" && next === "accepted") ||
        (old === "accepted" && ["superseded", "deprecated"].includes(next))
      ))
  ) {
    throw new Error("Invalid ADR lifecycle transition");
  }
  if (old === "superseded" && before.body !== after.body) {
    throw new Error("Superseded ADR bodies are immutable");
  }
  if (old === "accepted" && before.body !== after.body && !labels.includes("adr-edit")) {
    throw new Error(
      "Accepted ADR body edits require the adr-edit label; write a superseding ADR for a decision change",
    );
  }
}
function escape(value: string): string {
  return value
    .replace(/&/gu, "&amp;")
    .replace(/</gu, "&lt;")
    .replace(/>/gu, "&gt;")
    .replace(/\|/gu, "&#124;")
    .replace(/`/gu, "&#96;")
    .replace(/\[/gu, "&#91;")
    .replace(/\]/gu, "&#93;")
    .replace(/\\/gu, "&#92;");
}
export function renderIndex(records: readonly Adr[]): string {
  return [
    "| # | Decision | Status | Date | Tags | Notes |",
    "| --- | --- | --- | --- | --- | --- |",
    ...[...records]
      .sort((a, b) => a.meta.adr - b.meta.adr)
      .map(({ file, meta }) => {
        const references = (ids: number[]) =>
          ids.map((id) => String(id).padStart(4, "0")).join(", ");
        const notes = [
          meta.superseded_by.length ? `superseded by ${references(meta.superseded_by)}` : "",
          meta.supersedes.length ? `supersedes ${references(meta.supersedes)}` : "",
        ]
          .filter(Boolean)
          .join("; ");
        return `| ${String(meta.adr).padStart(4, "0")} | [${escape(meta.title)}](${file}) | ${meta.status} | ${meta.date} | ${meta.tags.join(", ")} | ${notes} |`;
      }),
    "",
  ].join("\n");
}
export function updateIndex(source: string, table: string): string {
  const start = "<!-- adr-index:start -->";
  const end = "<!-- adr-index:end -->";
  if (
    source.split(start).length !== 2 ||
    source.split(end).length !== 2 ||
    source.indexOf(end) < source.indexOf(start)
  ) {
    throw new Error("ADR index markers must occur exactly once and in order");
  }
  return (
    source.slice(0, source.indexOf(start) + start.length) +
    "\n" +
    table +
    source.slice(source.indexOf(end))
  );
}
