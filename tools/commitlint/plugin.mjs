import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

export function areaScopes() {
  const plan = readFileSync(new URL("../../tasks/PLAN.md", import.meta.url), "utf8");
  const table = plan.split("## 2. Area codes")[1]?.split(/^## /mu)[0];
  const areas = [...(table ?? "").matchAll(/^\| ([A-Z]{2,6}) \|/gmu)].map((match) =>
    match[1].toLowerCase(),
  );
  if (!areas.length) {
    throw new Error("Cannot read area codes from tasks/PLAN.md");
  }
  return [...areas, "deps", "release"];
}
export function currentBranch() {
  return execFileSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], { encoding: "utf8" }).trim();
}
export function taskReference(parsed, _when, branch) {
  if (parsed.type === "revert" || parsed.raw.startsWith("Merge ")) {
    return [true];
  }
  const task = /^task\/(OVE_[A-Z]{2,6}\d{3})$/u.exec(branch)?.[1];
  const paragraphs = parsed.raw.trim().split(/\r?\n\s*\r?\n/u);
  const footer = paragraphs.length > 1 ? (paragraphs.at(-1) ?? "") : "";
  const references = [...footer.matchAll(/^Refs: (OVE_[A-Z]{2,6}\d{3})$/gmu)].map(
    (match) => match[1],
  );
  return task
    ? [references.length === 1 && references[0] === task, `footer must contain Refs: ${task}`]
    : [references.length > 0, "include a Refs: OVE_XXXNNN footer when a task applies"];
}
export function commitPolicy(parsed, when = "always", options = {}) {
  if (when !== "always") {
    return [false, "commit policy supports only always"];
  }
  if (parsed.scope && !areaScopes().includes(parsed.scope)) {
    return [false, "scope must be one area from tasks/PLAN.md, deps or release"];
  }
  const subject = parsed.subject ?? "";
  if (!/^\p{Ll}/u.test(subject)) {
    return [false, "subject must start with a lower-case letter and use the imperative"];
  }
  const emoji = [...(parsed.header ?? "")].some(
    (character) =>
      !/[\u2190-\u21ff]/u.test(character) &&
      /[\p{Extended_Pictographic}\p{Emoji_Presentation}\uFE0F\u20E3]/u.test(character),
  );
  if (emoji) {
    return [false, "header must not contain emoji"];
  }
  const paragraphs = parsed.raw
    .trim()
    .split(/\r?\n\s*\r?\n/u)
    .slice(1);
  const body = paragraphs
    .flatMap((paragraph) => paragraph.split(/\r?\n/u))
    .filter((line) => line.trim() && !/^(?:[\w-]+|BREAKING CHANGE): /u.test(line));
  if (!options.titleOnly && ["feat", "fix", "security"].includes(parsed.type) && !body.length) {
    return [false, "feat, fix and security require a body explaining why"];
  }
  if (
    parsed.raw
      .split(/\r?\n/u)
      .slice(1)
      .some((line) => line.length > 100)
  ) {
    return [false, "body and footer lines must not exceed 100 characters"];
  }
  return [true];
}
export default { rules: { "task-reference": taskReference, "commit-policy": commitPolicy } };
