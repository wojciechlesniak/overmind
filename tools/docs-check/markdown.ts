import { lint } from "markdownlint/sync";
import type { MicromarkToken, Rule } from "markdownlint";

export function slug(heading: string): string {
  return heading
    .toLowerCase()
    .replace(/\p{Variation_Selector}/gu, "")
    .replace(/[^\p{L}\p{M}\p{N}_ -]/gu, "")
    .replace(/ /gu, "-");
}

export interface DocLink {
  target: string;
  line: number;
}
export interface MarkdownLine {
  text: string;
  line: number;
  code?: string;
}

export function markdownLines(md: string): MarkdownLine[] {
  let fence: { marker: string; length: number; language: string } | undefined;
  let frontMatter = md.startsWith("---\n");
  const rows: MarkdownLine[] = [];
  for (const [index, text] of md.replace(/\r\n?/gu, "\n").split("\n").entries()) {
    if (frontMatter) {
      if (index > 0 && /^(?:---|\.\.\.)\s*$/u.test(text)) {
        frontMatter = false;
      }
      rows.push({ text: "", line: index + 1 });
      continue;
    }
    const match = /^ {0,3}(`{3,}|~{3,})(.*)$/u.exec(text);
    const run = match?.[1] ?? "";
    const rest = match?.[2] ?? "";
    if (fence) {
      if (run.startsWith(fence.marker) && run.length >= fence.length && /^[\t ]*$/u.test(rest)) {
        fence = undefined;
        rows.push({ text: "", line: index + 1 });
      } else {
        rows.push({ text, line: index + 1, code: fence.language });
      }
    } else if (match && (run.startsWith("~") || !rest.includes("`"))) {
      fence = {
        marker: run[0] ?? "",
        length: run.length,
        language: rest.trim().split(/\s/u)[0] ?? "",
      };
      rows.push({ text: "", line: index + 1 });
    } else {
      rows.push({ text, line: index + 1 });
    }
  }
  return rows;
}

// Use the approved core's public parser seam instead of interpreting Markdown
// with overlapping regular expressions. This remains deterministic and I/O-free.
function parseMarkdown(md: string): { tokens: MicromarkToken[]; offset: number } {
  let tokens: MicromarkToken[] = [];
  let offset = 0;
  const collect: Rule = {
    names: ["overmind-doc-data"],
    description: "Collect documentation syntax",
    tags: ["data"],
    parser: "micromark",
    function: (params) => {
      tokens = params.parsers.micromark.tokens;
      offset = params.frontMatterLines.length;
    },
  };
  lint({
    strings: { source: md },
    config: { default: false, "overmind-doc-data": true },
    customRules: [collect],
    noInlineConfig: true,
  });
  return { tokens, offset };
}

function flatten(tokens: readonly MicromarkToken[]): MicromarkToken[] {
  const all: MicromarkToken[] = [];
  const queue = [...tokens].reverse();
  while (queue.length) {
    const token = queue.pop();
    if (token) {
      all.push(token);
      queue.push(...[...token.children].reverse());
    }
  }
  return all;
}

function stringValue(token: MicromarkToken): string {
  const queue = [...token.children].reverse();
  let text = "";
  while (queue.length) {
    const child = queue.pop();
    if (!child || ["image", "reference", "resource"].includes(child.type)) {
      continue;
    }
    if (["data", "characterEscapeValue", "codeTextData"].includes(child.type)) {
      text += child.text;
    } else {
      queue.push(...[...child.children].reverse());
    }
  }
  return text;
}

export function extractLinks(md: string): DocLink[] {
  const { tokens, offset } = parseMarkdown(md);
  const all = flatten(tokens);
  const references = new Map<string, string>();
  const label = (value: string) => value.trim().replace(/\s+/gu, " ").toLowerCase();
  for (const token of all.filter((t) => t.type === "definition")) {
    const children = flatten(token.children);
    const name = children.find((child) => child.type === "definitionLabelString");
    const target = children.find((child) => child.type === "definitionDestinationString");
    if (name && target && !references.has(label(name.text))) {
      references.set(label(name.text), stringValue(target));
    }
  }
  const links: DocLink[] = [];
  for (const token of all.filter((t) => ["link", "image", "autolink"].includes(t.type))) {
    const resource = token.children.find((child) => child.type === "resource");
    const referenceToken = token.children.find((child) => child.type === "reference");
    const labelToken = token.children.find((child) => child.type === "label");
    const direct = resource
      ? flatten(resource.children).find((child) => child.type === "resourceDestinationString")
      : token.children.find((child) => child.type === "autolinkProtocol");
    const reference =
      flatten(referenceToken?.children ?? []).find((child) => child.type === "referenceString") ??
      flatten(labelToken?.children ?? []).find((child) => child.type === "labelText");
    const target = direct
      ? direct.type === "autolinkProtocol"
        ? direct.text
        : stringValue(direct)
      : references.get(label(reference?.text ?? ""));
    if (target !== undefined) {
      links.push({ target, line: token.startLine + offset });
    }
  }
  return links;
}

export function headings(
  md: string,
): { text: string; line: number; level: number; anchor: string }[] {
  const { tokens, offset } = parseMarkdown(md);
  const result: { text: string; line: number; level: number; anchor: string }[] = [];
  const used = new Set<string>();
  for (const token of flatten(tokens).filter(
    (t) => t.type === "atxHeading" || t.type === "setextHeading",
  )) {
    const textToken = token.children.find(
      (child) => child.type === "atxHeadingText" || child.type === "setextHeadingText",
    );
    if (!textToken) {
      continue;
    }
    const text = stringValue(textToken);
    const base = slug(text);
    let anchor = base;
    let count = 0;
    while (used.has(anchor)) {
      anchor = `${base}-${String(++count)}`;
    }
    used.add(anchor);
    const level =
      token.type === "atxHeading"
        ? (token.children.find((child) => child.type === "atxHeadingSequence")?.text.length ?? 1)
        : token.text.trimEnd().endsWith("=")
          ? 1
          : 2;
    result.push({ text, line: token.startLine + offset, level, anchor });
  }
  return result;
}
