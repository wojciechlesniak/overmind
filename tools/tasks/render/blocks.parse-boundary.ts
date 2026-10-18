// SPDX-License-Identifier: Apache-2.0
import { isMap, isScalar, isSeq, parseDocument } from "yaml";
import { taskFrontMatterSchema, TaskToolError } from "../lib/index.ts";

/** Locate source spans only; the existing task schema remains the sole metadata model. */
export function blockFields(text: string) {
  const fail = () => new TaskToolError(4, "Invalid blocks source ranges");
  const front = /^---\n([\s\S]*?\n)---(?:\n|$)/u.exec(text);
  if (!front?.[1] || text.includes("\r")) {
    throw fail();
  }
  const source = front[1];
  const document = parseDocument(source, {
    schema: "core",
    customTags: [],
    uniqueKeys: true,
    strict: true,
  });
  if (document.errors.length || document.warnings.length || !isMap(document.contents)) {
    throw fail();
  }
  try {
    if (!taskFrontMatterSchema.safeParse(document.toJS({ maxAliasCount: 0 })).success) {
      throw fail();
    }
  } catch {
    throw fail();
  }
  const mapping = document.contents;
  const field = (name: string) => {
    const pair = mapping.items.find((pair) => isScalar(pair.key) && pair.key.value === name);
    if (!pair) {
      return undefined;
    }
    if (!isScalar(pair.key) || !isSeq(pair.value)) {
      throw fail();
    }
    const [start, valueEnd, nodeEnd] = pair.value.range;
    const keyStart = pair.key.range[0];
    if (
      ![keyStart, start, valueEnd, nodeEnd].every(Number.isSafeInteger) ||
      keyStart < 0 ||
      keyStart >= start ||
      start > valueEnd ||
      valueEnd > nodeEnd ||
      nodeEnd > source.length
    ) {
      throw fail();
    }
    return {
      keyStart: keyStart + 4,
      valueStart: start + 4,
      valueEnd: valueEnd + 4,
      nodeEnd: nodeEnd + 4,
      flow: pair.value.flow === true,
    };
  };
  const adr = field("adr_refs");
  if (!adr) {
    throw fail();
  }
  return { adr, blocks: field("blocks") };
}
