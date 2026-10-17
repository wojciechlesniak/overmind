import { lint } from "markdownlint/sync";
import type { MicromarkToken, Rule } from "markdownlint";
import { decodeHTMLStrict } from "entities";

export function slug(heading: string): string {
  return heading
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}\p{Pc} -]/gu, "")
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
  const { tokens, offset } = parseMarkdown(md);
  const rows: MarkdownLine[] = md
    .replace(/\r\n?/gu, "\n")
    .split("\n")
    .map((text, index) => ({ text: index < offset ? "" : text, line: index + 1 }));
  for (const block of flatten(tokens).filter(
    (token) => token.type === "codeFenced" || token.type === "codeIndented",
  )) {
    const children = flatten(block.children);
    const language = children.find((token) => token.type === "codeFencedFenceInfo")?.text ?? "";
    for (let line = block.startLine + offset; line <= block.endLine + offset; line++) {
      rows[line - 1] = { text: "", line, code: language };
    }
    for (const value of children.filter((token) => token.type === "codeFlowValue")) {
      rows[value.startLine + offset - 1] = {
        text: value.text,
        line: value.startLine + offset,
        code: language,
      };
    }
  }
  return rows;
}

// Use the approved core's public parser seam instead of interpreting Markdown
// with overlapping regular expressions. This remains deterministic and I/O-free.
function parseMarkdown(md: string): {
  tokens: MicromarkToken[];
  offset: number;
  frontMatter: readonly string[];
} {
  let tokens: MicromarkToken[] = [];
  let frontMatter: readonly string[] = [];
  const collect: Rule = {
    names: ["overmind-doc-data"],
    description: "Collect documentation syntax",
    tags: ["data"],
    parser: "micromark",
    function: (params) => {
      tokens = params.parsers.micromark.tokens;
      frontMatter = params.frontMatterLines;
    },
  };
  lint({
    strings: { source: md },
    config: { default: false, "overmind-doc-data": true },
    customRules: [collect],
    noInlineConfig: true,
  });
  return { tokens, offset: frontMatter.length, frontMatter };
}

export function markdownFrontMatter(md: string): readonly string[] {
  return parseMarkdown(md).frontMatter;
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
    if (child.type === "characterReference") {
      text += decodeHTMLStrict(child.text);
    } else if (
      ["data", "characterEscapeValue", "codeTextData", "mathTextData"].includes(child.type)
    ) {
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
  for (const token of all.filter(
    (t) => t.type === "htmlFlow" || (t.type === "htmlText" && t.parent?.type !== "htmlFlow"),
  )) {
    const html = token.text.replace(/<!--[^]*?(?:-->|$)/gu, (comment) =>
      comment.replace(/[^\n]/gu, " "),
    );
    for (const tag of html.matchAll(/<img\b((?:"[^"]*"|'[^']*'|[^'">])*)>/giu)) {
      for (const attribute of (tag[1] ?? "").matchAll(
        /([^\s/=<>`"']+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/gu,
      )) {
        if (attribute[1]?.toLowerCase() === "src") {
          links.push({
            target: (attribute[2] ?? attribute[3] ?? attribute[4] ?? "").replace(
              /&(?:#[xX][0-9a-fA-F]+|#[0-9]+|[A-Za-z][A-Za-z0-9]+);/gu,
              (reference) => decodeHTMLStrict(reference),
            ),
            line: token.startLine + offset + html.slice(0, tag.index).split("\n").length - 1,
          });
        }
      }
    }
  }
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
  // The public parser may expose an HTML span through both flow and text views.
  // Checking an identical line/destination once also avoids duplicate requests.
  return [...new Map(links.map((link) => [`${String(link.line)}\0${link.target}`, link])).values()];
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
