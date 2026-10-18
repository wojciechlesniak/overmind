import { lint } from "markdownlint/sync";
import type { MicromarkToken, Rule } from "markdownlint";
import { decodeHTMLStrict } from "entities";

// Use the approved core's public parser seam instead of interpreting Markdown
// with overlapping regular expressions. This remains deterministic and I/O-free.
export function parseMarkdown(md: string): {
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

export function flatten(tokens: readonly MicromarkToken[]): MicromarkToken[] {
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

export function stringValue(token: MicromarkToken): string {
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
