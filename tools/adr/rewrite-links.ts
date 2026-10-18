import { basename, dirname, isAbsolute, resolve } from "node:path";
import { linkDestinations, type MarkdownSpan } from "../docs-check/markdown-destinations.ts";

interface Edit extends MarkdownSpan {
  readonly replacement: string;
}

export function rewriteAdrLinks(
  source: string,
  documentPath: string,
  before: string,
  after: string,
): string {
  const oldFile = basename(before);
  const newFile = basename(after);
  const oldNumber = oldFile.slice(0, 4);
  const newNumber = newFile.slice(0, 4);
  const edits = new Map<string, Edit>();
  const add = (span: MarkdownSpan, replacement: string): void => {
    if (source.slice(span.start, span.end) !== span.raw) {
      throw new Error("ADR link source changed during planning.");
    }
    const key = `${String(span.start)}:${String(span.end)}`;
    const previous = edits.get(key);
    if (previous && previous.replacement !== replacement) {
      throw new Error("ADR link edits conflict.");
    }
    edits.set(key, { ...span, replacement });
  };
  for (const destination of linkDestinations(source)) {
    const separator = destination.target.search(/[?#]/u);
    const file = separator < 0 ? destination.target : destination.target.slice(0, separator);
    if (!file || isAbsolute(file) || /^[a-z][a-z0-9+.-]*:/iu.test(file)) {
      continue;
    }
    if (resolve(dirname(documentPath), decodeURIComponent(file)) !== before) {
      continue;
    }
    const raw = destination.destination.raw;
    const index = raw.indexOf(oldFile);
    if (!file.endsWith(oldFile) || index < 0 || index !== raw.lastIndexOf(oldFile)) {
      throw new Error("Ambiguous ADR destination cannot be rewritten safely.");
    }
    const replacement = raw.slice(0, index) + newFile + raw.slice(index + oldFile.length);
    const expected =
      destination.target.slice(0, file.length - oldFile.length) +
      newFile +
      destination.target.slice(file.length);
    // Reparse the proposed spelling as Markdown data. This verifies that a raw
    // filename occurrence was the destination leaf, rather than a fragment decoy.
    const verification = linkDestinations(`[label](<${replacement}>)`);
    if (verification.length !== 1 || verification[0]?.target !== expected) {
      throw new Error("Ambiguous ADR destination cannot be rewritten safely.");
    }
    add(destination.destination, replacement);
    for (const label of destination.labels) {
      const matches = [...label.text.raw.matchAll(new RegExp(`\\bADR[- ]+${oldNumber}\\b`, "gu"))];
      if (matches.length && (label.text.raw.includes("<") || label.text.raw.includes("`"))) {
        throw new Error("Ambiguous ADR label cannot be rewritten safely.");
      }
      let changed = false;
      for (const match of matches) {
        const start = label.text.start + match.index;
        add({ start, end: start + match[0].length, raw: match[0] }, `ADR ${newNumber}`);
        changed = true;
      }
      if (changed && label.referenceSuffix && ["", "[]"].includes(label.referenceSuffix.raw)) {
        add(label.referenceSuffix, `[${label.text.raw}]`);
      }
    }
  }
  let rewritten = source;
  let boundary = source.length;
  for (const edit of [...edits.values()].sort(
    (left, right) => right.start - left.start || right.end - left.end,
  )) {
    if (edit.end > boundary || edit.start < 0 || edit.end < edit.start) {
      throw new Error("ADR link edits overlap.");
    }
    rewritten = rewritten.slice(0, edit.start) + edit.replacement + rewritten.slice(edit.end);
    boundary = edit.start;
  }
  return rewritten;
}
