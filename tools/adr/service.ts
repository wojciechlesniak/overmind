import { relative } from "node:path";
import { lstatSync } from "node:fs";
import { Files } from "./files.ts";
import { metadataSchema, parseSlugMap, renderAdr } from "./input.parse-boundary.ts";
import { slugify } from "./model.ts";
import { observedNumbers, type Clock, type Git } from "./ports.ts";
import { loadRecords } from "./repository.ts";
import { rewriteAdrLinks } from "./rewrite-links.ts";

export function createAdr(root: string, title: string, ports: { clock: Clock; git: Git }): string {
  const files = new Files(root);
  const slug = slugify(title);
  return files.locked(() => {
    const source = files.read("docs/adr/slug-map.json");
    const map = parseSlugMap(source);
    const local = files
      .markdown("docs/adr")
      .map((path) => relative(files.root, path).replaceAll("\\", "/"));
    const adr = observedNumbers(ports.git, local);
    if ([...map.originals, ...map.additional].some((entry) => entry.adr === adr)) {
      throw new Error("ADR number is already mapped");
    }
    const template = files.read("docs/adr/_template.md");
    if (template.trim().split("\n").length >= 60) {
      throw new Error("ADR template must be shorter than 60 lines");
    }
    const body = template.replace(/^---\n[\s\S]*?\n---\n/u, "");
    const content = renderAdr(
      metadataSchema.parse({
        adr,
        title,
        status: "proposed",
        date: ports.clock.today(),
        deciders: ["Owner"],
        supersedes: [],
        superseded_by: [],
        tags: [],
      }),
      body,
    );
    const path = `docs/adr/${String(adr).padStart(4, "0")}-${slug}.md`;
    files.write(path, content);
    try {
      map.additional.push({ adr, slug, polishOriginal: null, title });
      files.write("docs/adr/slug-map.json", JSON.stringify(map, null, 2) + "\n", source);
    } catch (error) {
      files.remove(path, content);
      throw error;
    }
    return path;
  });
}
export function renumberAdr(root: string, old: number, next: number, apply = false): string[] {
  const files = new Files(root);
  if (
    !Number.isSafeInteger(old) ||
    !Number.isSafeInteger(next) ||
    old <= 28 ||
    next <= 28 ||
    old > 9999 ||
    next > 9999 ||
    old === next
  ) {
    throw new Error("Only a new ADR proposal may be renumbered");
  }
  return files.locked(() => {
    const records = loadRecords(files);
    const candidates = records.filter(
      (record) => record.meta.adr === old && record.meta.status === "proposed",
    );
    if (candidates.length !== 1 || records.some((record) => record.meta.adr === next)) {
      throw new Error("Renumber needs exactly one proposal and a free target number");
    }
    const record = candidates[0];
    if (!record || record.meta.supersedes.length || record.meta.superseded_by.length) {
      throw new Error("Supersession references need an explicit migration before renumbering");
    }
    const before = `docs/adr/${record.file}`;
    const after = `docs/adr/${String(next).padStart(4, "0")}-${record.file.slice(5)}`;
    if (lstatSync(files.path(after, true), { throwIfNoEntry: false })) {
      throw new Error("Renumber target already exists");
    }
    const mapSource = files.read("docs/adr/slug-map.json");
    const map = parseSlugMap(mapSource);
    if ([...map.originals, ...map.additional].some((item) => item.adr === next)) {
      throw new Error("Renumber target is already mapped");
    }
    const entry = map.additional.find(
      (item) =>
        item.adr === old && `${String(old).padStart(4, "0")}-${item.slug}.md` === record.file,
    );
    if (!entry) {
      throw new Error("Proposal is absent from the slug map");
    }
    entry.adr = next;
    const changes: { path: string; before: string; after: string }[] = [];
    for (const path of [...files.markdown("docs"), ...files.markdown("tasks")]) {
      if (path === files.path(before)) {
        continue;
      }
      const source = files.read(path);
      const rewritten = rewriteAdrLinks(source, path, files.path(before), files.path(after, true));
      if (
        rewritten !== source &&
        relative(files.root, path).replaceAll("\\", "/").startsWith("docs/pl/")
      ) {
        throw new Error("Archived Polish originals cannot be rewritten by renumbering");
      }
      if (rewritten !== source) {
        changes.push({ path: relative(files.root, path), before: source, after: rewritten });
      }
    }
    const original = record.source;
    if (files.read(before) !== original) {
      throw new Error("ADR renumber input changed during planning");
    }
    const body = rewriteAdrLinks(
      record.body,
      files.path(before),
      files.path(before),
      files.path(after, true),
    );
    const content = renderAdr({ ...record.meta, adr: next }, body);
    const plan = [
      `${before} -> ${after}`,
      "docs/adr/slug-map.json",
      ...changes.map((change) => change.path),
    ].sort();
    if (apply) {
      for (const change of changes) {
        if (files.read(change.path) !== change.before) {
          throw new Error("ADR link input changed during planning");
        }
      }
      files.write(after, content);
      files.write("docs/adr/slug-map.json", JSON.stringify(map, null, 2) + "\n", mapSource);
      for (const change of changes) {
        files.write(change.path, change.after, change.before);
      }
      files.remove(before, original);
    }
    return plan;
  });
}
