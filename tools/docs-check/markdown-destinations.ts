import type { MicromarkToken } from "markdownlint";
import { flatten, parseMarkdown, stringValue } from "./markdown-parser.ts";

export interface MarkdownSpan {
  readonly start: number;
  readonly end: number;
  readonly raw: string;
}
export interface MarkdownLinkLabel {
  readonly text: MarkdownSpan;
  readonly referenceSuffix?: MarkdownSpan;
}
export interface MarkdownDestination {
  readonly target: string;
  readonly destination: MarkdownSpan;
  readonly labels: readonly MarkdownLinkLabel[];
}
type Destination = Omit<MarkdownDestination, "labels"> & { labels: MarkdownLinkLabel[] };

function insideHtml(token: MicromarkToken): boolean {
  for (let current: MicromarkToken | null = token; current; current = current.parent) {
    if (current.type === "htmlFlow" || current.type === "htmlText") {
      return true;
    }
  }
  return false;
}

function lineStarts(source: string): number[] {
  const starts = [0];
  for (let index = 0; index < source.length; index += 1) {
    if (source[index] === "\r") {
      index += source[index + 1] === "\n" ? 1 : 0;
      starts.push(index + 1);
    } else if (source[index] === "\n") {
      starts.push(index + 1);
    }
  }
  return starts;
}

function sourceSpan(
  source: string,
  starts: readonly number[],
  offset: number,
  token: MicromarkToken,
): MarkdownSpan {
  const position = (line: number, column: number): number => {
    const row = line + offset - 1;
    const start = starts[row];
    if (!Number.isInteger(line) || !Number.isInteger(column) || column < 1 || start === undefined) {
      throw new Error("Markdown token has an invalid source position.");
    }
    const point = start + column - 1 + (row === 0 && source.startsWith("\uFEFF") ? 1 : 0);
    let end = starts[row + 1] ?? source.length;
    if (source[end - 1] === "\n") {
      end -= 1;
    }
    if (source[end - 1] === "\r") {
      end -= 1;
    }
    if (point < start || point > end) {
      throw new Error("Markdown token escapes its source line.");
    }
    return point;
  };
  const start = position(token.startLine, token.startColumn);
  const end = position(token.endLine, token.endColumn);
  const raw = source.slice(start, end);
  if (end < start || raw !== token.text) {
    throw new Error("Markdown token differs from its original source span.");
  }
  return { start, end, raw };
}

// Reference identifiers are matched exactly as micromark does: collapse only
// Markdown whitespace, then Unicode lower/upper case; do not decode key escapes.
function referenceKey(raw: string): string {
  return raw
    .replace(/[\t\n\r ]+/gu, " ")
    .replace(/^ | $/gu, "")
    .toLowerCase()
    .toUpperCase();
}

export function linkDestinations(md: string): readonly MarkdownDestination[] {
  const { tokens, offset } = parseMarkdown(md);
  const all = flatten(tokens).filter((token) => !insideHtml(token));
  const starts = lineStarts(md);
  const span = (token: MicromarkToken) => sourceSpan(md, starts, offset, token);
  const result: Destination[] = [];
  const definitions = new Map<string, Destination>();
  for (const token of all.filter((item) => item.type === "definition")) {
    const children = flatten(token.children);
    const key = children.find((item) => item.type === "definitionLabelString");
    const target = children.find((item) => item.type === "definitionDestinationString");
    if (key && target) {
      const destination: Destination = {
        target: stringValue(target),
        destination: span(target),
        labels: [],
      };
      result.push(destination);
      const normalized = referenceKey(key.text);
      if (!definitions.has(normalized)) {
        definitions.set(normalized, destination);
      }
    }
  }
  for (const token of all.filter((item) => item.type === "link" || item.type === "image")) {
    const label = token.children.find((item) => item.type === "label");
    const text = label?.children.find((item) => item.type === "labelText");
    const resource = token.children.find((item) => item.type === "resource");
    const target =
      resource &&
      flatten(resource.children).find((item) => item.type === "resourceDestinationString");
    if (target) {
      result.push({
        target: stringValue(target),
        destination: span(target),
        labels: text ? [{ text: span(text) }] : [],
      });
    } else if (!resource && label && text) {
      const reference = token.children.find((item) => item.type === "reference");
      const identifier =
        reference && flatten(reference.children).find((item) => item.type === "referenceString");
      const definition = definitions.get(referenceKey(identifier?.text ?? text.text));
      if (!definition) {
        throw new Error("Resolved Markdown reference has no matching definition.");
      }
      const end = span(label).end;
      definition.labels.push({
        text: span(text),
        referenceSuffix: reference ? span(reference) : { start: end, end, raw: "" },
      });
    }
  }
  return result.sort((left, right) => left.destination.start - right.destination.start);
}
