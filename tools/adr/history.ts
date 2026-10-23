import { createHash } from "node:crypto";
import { basename } from "node:path";
import type { Files } from "./files.ts";
import { parseAdr, parseSlugMap, type Adr, type SlugMap } from "./input.parse-boundary.ts";
import { checkTransition } from "./model.ts";
import type { Git, HistoryGit } from "./ports.ts";
import { historyBlobInputLimit, historyBlobRequestLimit } from "./history-blobs.ts";

type Entry = SlugMap["originals"][number];
const numbered = /^docs\/adr\/(\d{4})-[a-z0-9]+(?:-[a-z0-9]+)*\.md$/u;
function paths(git: Git, revision: string): string[] {
  const found = git
    .run(["ls-tree", "-r", "--name-only", "-z", revision, "--", "docs/adr"])
    .split("\0")
    .filter(Boolean);
  if (found.length > 10000) {
    throw new Error("ADR history exceeds safe bounds");
  }
  return found;
}
function selectedPath(paths: readonly string[], prefix: string, priorPath: string) {
  const candidates = paths.filter((path) => path.startsWith(prefix) && numbered.test(path));
  // Keep an established identity when a separate, unmerged proposal collided.
  return candidates.includes(priorPath)
    ? priorPath
    : candidates.length === 1
      ? candidates[0]
      : undefined;
}
function identity({ adr, slug, polishOriginal }: Entry) {
  return { adr, slug, polishOriginal };
}
function preservedTranslation(
  entry: Entry | undefined,
  oldPath: string,
  oldText: string,
  record: Adr,
  read: (path: string) => string,
): boolean {
  if (
    !entry?.polishOriginal ||
    oldPath !== `docs/adr/${entry.polishOriginal}` ||
    record.meta.adr !== entry.adr ||
    record.file !== `${String(entry.adr).padStart(4, "0")}-${entry.slug}.md` ||
    record.meta.translation_of !== `docs/pl/adr/${entry.polishOriginal}`
  ) {
    return false;
  }
  const archived = read(record.meta.translation_of);
  return (
    archived === oldText &&
    createHash("sha256").update(archived).digest("hex") === record.meta.source_sha256
  );
}
function checkMap(map: SlugMap, established: SlugMap, basePaths: readonly string[]): void {
  if (
    JSON.stringify(map.originals.map(identity)) !==
    JSON.stringify(established.originals.map(identity))
  ) {
    throw new Error("The original 28 ADR identities are immutable");
  }
  for (const entry of established.additional) {
    if (!basePaths.some((path) => Number(numbered.exec(path)?.[1]) === entry.adr)) {
      continue;
    }
    const current = map.additional.filter((item) => item.adr === entry.adr);
    if (
      current.length !== 1 ||
      !current[0] ||
      JSON.stringify(identity(current[0])) !== JSON.stringify(identity(entry))
    ) {
      throw new Error("Published additional ADR identities are immutable");
    }
  }
}

export function checkHistory(
  files: Files,
  git: HistoryGit,
  records: readonly Adr[],
  map: SlugMap,
  labels: readonly string[],
): void {
  const head = git.run(["rev-parse", "HEAD"]).trim();
  if (!/^[a-f0-9]{40}$/u.test(head)) {
    throw new Error("Invalid ADR history commit");
  }
  const base = git.run(["rev-parse", "origin/DEVELOP"]).trim();
  if (!/^[a-f0-9]{40}$/u.test(base)) {
    throw new Error("Invalid ADR comparison base");
  }
  const pathsByRevision = new Map<string, readonly string[]>();
  let retainedTextBytes = 0;
  const readPaths = (revision: string): readonly string[] => {
    if (!/^[a-f0-9]{40}$/u.test(revision)) {
      throw new Error("Invalid ADR history commit");
    }
    const cached = pathsByRevision.get(revision);
    if (cached) {
      return cached;
    }
    const found = paths(git, revision);
    const textBytes = found.reduce((sum, path) => sum + path.length * 2, 0);
    if (pathsByRevision.size < 32 && textBytes <= 4 * 1024 * 1024 - retainedTextBytes) {
      pathsByRevision.set(revision, found);
      retainedTextBytes += textBytes;
    }
    return found;
  };
  const basePaths = readPaths(base);
  const established = basePaths.includes("docs/adr/slug-map.json")
    ? parseSlugMap(git.run(["show", `${base}:docs/adr/slug-map.json`]))
    : undefined;
  if (established) {
    checkMap(map, established, basePaths);
  }
  const entries = established ? [...established.originals, ...established.additional] : [];
  for (const path of basePaths.filter((path) => numbered.test(path))) {
    if (records.some((record) => path === `docs/adr/${record.file}`)) {
      continue;
    }
    const id = Number(numbered.exec(path)?.[1]);
    const record = records.find((item) => item.meta.adr === id);
    if (
      !record ||
      !preservedTranslation(
        entries.find((entry) => entry.adr === id),
        path,
        git.run(["show", `${base}:${path}`]),
        record,
        (path) => files.read(path),
      )
    ) {
      throw new Error("Deleting an ADR is forbidden");
    }
  }
  interface HistoryPlan {
    record: Adr;
    prefix: string;
    pathspec: string;
    commits: string[];
    published: string[];
    queryTextBytes: number;
  }
  const queryTextLimit = 4 * 1024 * 1024;
  const inspect = (plans: readonly HistoryPlan[]) => {
    const requests: string[] = [];
    let inputBytes = 0;
    let retainedQueryText = plans.reduce((sum, plan) => sum + plan.queryTextBytes, 0);
    for (const { record, prefix, commits, published } of plans) {
      const sha = commits[0];
      if (!sha || published.length > 1) {
        continue;
      }
      const priorPath = published[0] ?? `docs/adr/${record.file}`;
      const path = selectedPath(readPaths(sha), prefix, priorPath);
      if (!path) {
        continue;
      }
      const request = `${sha}:${path}`;
      const size = Buffer.byteLength(`${sha}^{commit}:${path}\n`, "utf8");
      const textBytes = request.length * 2;
      if (
        size > historyBlobInputLimit - inputBytes ||
        textBytes > queryTextLimit - retainedQueryText
      ) {
        continue;
      }
      requests.push(request);
      inputBytes += size;
      retainedQueryText += textBytes;
    }
    const sources = git.readBlobs(requests);
    for (const { record, prefix, pathspec, commits, published } of plans) {
      const integrated =
        head === base
          ? new Set(commits)
          : new Set(git.run(["rev-list", base, "--", pathspec]).trim().split("\n"));
      if (published.length > 1) {
        throw new Error("Published ADR identity is ambiguous");
      }
      let priorPath = published[0] ?? `docs/adr/${record.file}`;
      let previous: Adr | undefined;
      let previousSource = "";
      const entry = entries.find((item) => item.adr === record.meta.adr);
      for (const sha of commits) {
        const path = selectedPath(readPaths(sha), prefix, priorPath);
        if (!path) {
          throw new Error("ADR history contains a deletion or ambiguous rename");
        }
        const source = sources.get(`${sha}:${path}`) ?? git.run(["show", `${sha}:${path}`]);
        const current = parseAdr(basename(path), source);
        if (previous) {
          if (
            path !== priorPath &&
            !preservedTranslation(entry, priorPath, previousSource, current, (archive) =>
              git.run(["show", `${sha}:${archive}`]),
            )
          ) {
            throw new Error("ADR history contains an unpreserved identity rename");
          }
          checkTransition(previous, current, integrated.has(sha) ? ["adr-edit"] : labels);
        }
        previous = current;
        previousSource = source;
        priorPath = path;
      }
      if (previous) {
        if (
          priorPath !== `docs/adr/${record.file}` &&
          !preservedTranslation(entry, priorPath, previousSource, record, (path) =>
            files.read(path),
          )
        ) {
          throw new Error("ADR history contains an unpreserved identity rename");
        }
        checkTransition(previous, record, labels);
      }
    }
  };
  let plans: HistoryPlan[] = [];
  let queryTextBytes = 0;
  for (const record of records) {
    const prefix = `docs/adr/${String(record.meta.adr).padStart(4, "0")}-`;
    const pathspec = `:(glob)${prefix}*.md`;
    const commits = git
      .run(["log", "--format=%H", "--reverse", head, "--", pathspec])
      .trim()
      .split("\n")
      .filter(Boolean);
    if (commits.length > 1024 || commits.some((sha) => !/^[a-f0-9]{40}$/u.test(sha))) {
      throw new Error("ADR history exceeds safe bounds");
    }
    const published = basePaths.filter((path) => path.startsWith(prefix) && numbered.test(path));
    const size =
      2 *
      (prefix.length +
        pathspec.length +
        [...commits, ...published].reduce((sum, text) => sum + text.length, 0));
    if (
      plans.length &&
      (plans.length >= historyBlobRequestLimit || size > queryTextLimit - queryTextBytes)
    ) {
      inspect(plans);
      plans = [];
      queryTextBytes = 0;
    }
    const plan = { record, prefix, pathspec, commits, published, queryTextBytes: size };
    if (size > queryTextLimit) {
      // No batch admission: still run every original record/version validation.
      inspect([plan]);
    } else {
      plans.push(plan);
      queryTextBytes += size;
    }
  }
  if (plans.length) {
    inspect(plans);
  }
}
