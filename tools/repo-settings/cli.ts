import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseExpected, parseLabels } from "./input.parse-boundary.ts";
import { type Row } from "./policy.ts";
export const root = resolve(import.meta.dirname, "../..");
export function configuration() {
  return {
    expected: parseExpected(readFileSync(resolve(import.meta.dirname, "expected.json"), "utf8")),
    labels: parseLabels(readFileSync(resolve(import.meta.dirname, "labels.json"), "utf8")),
  };
}
export function options(args: string[], mode: "audit" | "labels") {
  let repo = "wojciechlesniak/overmind";
  let flag = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--repo") {
      const next = args[++i];
      if (!next || !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u.test(next) || next.includes("..")) {
        throw new Error("Expected --repo owner/name");
      }
      repo = next;
    } else if (args[i] === (mode === "audit" ? "--allow-unknown" : "--apply")) {
      flag = true;
    } else {
      throw new Error("Unknown argument");
    }
  }
  return { repo, flag };
}
export function localOnly(environment: NodeJS.ProcessEnv = process.env): void {
  if (environment["CI"] || environment["GITHUB_ACTIONS"]) {
    throw new Error("Repository settings tools are local operator commands, never CI jobs");
  }
}
export function print(rows: Row[]): void {
  const safe = (text: string) =>
    Array.from(text, (character) => {
      const code = character.codePointAt(0) ?? 0;
      return code < 32 || code === 127 || character === "|" ? "?" : character;
    })
      .join("")
      .slice(0, 400);
  console.log("setting | expected | actual | status");
  for (const row of rows) {
    console.log([row.setting, row.expected, row.actual, row.status].map(safe).join(" | "));
  }
}
