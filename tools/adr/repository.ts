import { basename, relative } from "node:path";
import { createHash } from "node:crypto";
import { parseTask } from "../tasks/lib/index.ts";
import { Files } from "./files.ts";
import { parseAdr, parseSlugMap, type Adr } from "./input.parse-boundary.ts";
import { checkRecords, checkTransition, renderIndex, updateIndex } from "./model.ts";
import type { Git } from "./ports.ts";

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
function archivedTranslation(
  files: Files,
  oldPath: string,
  oldText: string,
  records: readonly Adr[],
): boolean {
  const map = parseSlugMap(files.read("docs/adr/slug-map.json"));
  const entry = [...map.originals, ...map.additional].find(
    (entry) => oldPath === `docs/adr/${entry.polishOriginal ?? ""}`,
  );
  const translated = records.find((record) => record.meta.adr === entry?.adr);
  const original = entry?.polishOriginal;
  if (!original || translated?.meta.translation_of !== `docs/pl/adr/${original}`) {
    return false;
  }
  const archived = files.read(translated.meta.translation_of);
  return (
    archived === oldText &&
    createHash("sha256").update(archived).digest("hex") === translated.meta.source_sha256
  );
}
export function checkRepository(root: string, git: Git, labels: readonly string[]): void {
  const files = new Files(root);
  const records = loadRecords(files);
  const map = parseSlugMap(files.read("docs/adr/slug-map.json"));
  checkRecords(records, [...map.originals, ...map.additional]);
  const base = git.run(["rev-parse", "origin/DEVELOP"]).trim();
  if (!/^[a-f0-9]{40}$/u.test(base)) {
    throw new Error("Invalid ADR comparison base");
  }
  const basePaths = git
    .run(["ls-tree", "-r", "--name-only", "-z", base, "--", "docs/adr"])
    .split("\0")
    .filter(Boolean);
  for (const path of basePaths.filter((path) => /^docs\/adr\/\d{4}-[^/]+\.md$/u.test(path))) {
    if (!records.some((record) => path === `docs/adr/${record.file}`)) {
      if (!archivedTranslation(files, path, git.run(["show", `${base}:${path}`]), records)) {
        throw new Error("Deleting an ADR is forbidden");
      }
    }
  }
  if (basePaths.includes("docs/adr/slug-map.json")) {
    const original = parseSlugMap(git.run(["show", `${base}:docs/adr/slug-map.json`]));
    const immutable = (value: typeof map) =>
      value.originals.map(({ adr, slug, polishOriginal }) => ({ adr, slug, polishOriginal }));
    if (JSON.stringify(immutable(map)) !== JSON.stringify(immutable(original))) {
      throw new Error("The original 28 ADR identities are immutable");
    }
  }
  for (const record of records) {
    const path = `docs/adr/${record.file}`;
    const commits = git
      .run(["log", "--format=%H", "--reverse", "HEAD", "--", path])
      .trim()
      .split("\n")
      .filter(Boolean);
    if (commits.length > 1024 || commits.some((sha) => !/^[a-f0-9]{40}$/u.test(sha))) {
      throw new Error("ADR history exceeds safe bounds");
    }
    const integrated = new Set(git.run(["rev-list", base, "--", path]).trim().split("\n"));
    let previous: Adr | undefined;
    for (const sha of commits) {
      if (!git.run(["ls-tree", "--name-only", sha, "--", path]).trim()) {
        throw new Error("ADR history contains a deletion");
      }
      const current = parseAdr(record.file, git.run(["show", `${sha}:${path}`]));
      if (previous) {
        checkTransition(previous, current, integrated.has(sha) ? ["adr-edit"] : labels);
      }
      previous = current;
    }
    if (previous) {
      checkTransition(previous, record, labels);
    }
  }
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
