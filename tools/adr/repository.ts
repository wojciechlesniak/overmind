import { basename, relative } from "node:path";
import { parseTask } from "../tasks/lib/index.ts";
import { Files } from "./files.ts";
import { parseAdr, parseSlugMap, type Adr } from "./input.parse-boundary.ts";
import { checkRecords, renderIndex, updateIndex } from "./model.ts";
import { checkHistory } from "./history.ts";
import type { HistoryGit } from "./ports.ts";

export function loadRecords(files: Files): Adr[] {
  return files
    .markdown("docs/adr")
    .filter((path) => !["README.md", "_template.md"].includes(basename(path)))
    .map((path) => {
      try {
        return parseAdr(relative(files.path("docs/adr"), path), files.read(path));
      } catch {
        throw new Error(
          `Invalid ADR metadata or filename: ${basename(path)}; legacy migration is required`,
        );
      }
    });
}
function referenceNumbers(text: string): number[] {
  const prose = text
    .replace(/^(```|~~~)[^\n]*\n[\s\S]*?^\1[^\n]*$/gmu, "")
    .replace(/`[^`\n]*`/gu, "")
    .replace(/<!--[\s\S]*?-->/gu, "");
  return [...prose.matchAll(/\bADR[- ]+(\d{1,4})\b/gu)].map((match) => Number(match[1]));
}
export function checkRepository(root: string, git: HistoryGit, labels: readonly string[]): void {
  const files = new Files(root);
  const records = loadRecords(files);
  const map = parseSlugMap(files.read("docs/adr/slug-map.json"));
  checkRecords(records, [...map.originals, ...map.additional]);
  checkHistory(files, git, records, map, labels);
  const ids = new Set(records.map((record) => record.meta.adr));
  for (const path of [...files.markdown("docs"), ...files.markdown("tasks")]) {
    const text = files.read(path);
    const numbers = referenceNumbers(text);
    const name = relative(files.root, path).replaceAll("\\", "/");
    if (/^tasks\/OVE_[A-Z]{2,7}\d{3}\/TASK\.md$/u.test(name)) {
      const parsed = parseTask(name, text);
      if (!parsed.ok) {
        throw new Error("Invalid task metadata while checking ADR references");
      }
      numbers.push(...parsed.value.adr_refs);
    }
    if (numbers.some((id) => !ids.has(id))) {
      throw new Error(`Unknown ADR reference in ${name}`);
    }
  }
}
export function generateIndex(root: string, check: boolean): void {
  const files = new Files(root);
  const run = () => {
    const records = loadRecords(files);
    const map = parseSlugMap(files.read("docs/adr/slug-map.json"));
    checkRecords(records, [...map.originals, ...map.additional]);
    const source = files.read("docs/adr/README.md");
    const generated = updateIndex(source, renderIndex(records));
    if (check && source !== generated) {
      throw new Error("ADR index is stale; run gen:adr-index");
    }
    if (!check && source !== generated) {
      files.write("docs/adr/README.md", generated, source);
    }
  };
  if (check) {
    run();
  } else {
    files.locked(run);
  }
}
