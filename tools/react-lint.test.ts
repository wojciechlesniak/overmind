import { spawnSync } from "node:child_process";
import { writeFileSync, mkdtempSync, mkdirSync, copyFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { expect, it } from "vitest";
import { isolatedGitEnvironment } from "./hooks/git-test-environment.ts";
import { parseReactLintReport } from "./test-support/json.parse-boundary.ts";

const root = resolve(import.meta.dirname, "..");
function probe(
  source: string,
  path = "packages/ui-kit/src/__ove006_react_probe__.tsx",
  production = false,
) {
  const fixture = mkdtempSync(resolve(tmpdir(), "overmind-react-lint-"));
  const file = resolve(fixture, path);
  try {
    for (const directory of ["apps/desktop/src", "packages/ui-kit/src", "packages/domain/src"]) {
      mkdirSync(resolve(fixture, directory), { recursive: true });
    }
    copyFileSync(resolve(root, ".oxlintrc.json"), resolve(fixture, ".oxlintrc.json"));
    writeFileSync(file, source);
    const result = spawnSync(
      resolve(root, "node_modules/.bin/oxlint"),
      [
        "--disable-nested-config",
        "--config",
        ".oxlintrc.json",
        "--format",
        "json",
        ...(production ? ["apps/desktop", "packages/ui-kit"] : [file]),
      ],
      { cwd: fixture, env: isolatedGitEnvironment(), encoding: "utf8", timeout: 10000 },
    );
    expect(result.error).toBeUndefined();
    expect([0, 1], result.stderr).toContain(result.status);
    return { status: result.status, codes: parseReactLintReport(result.stdout) };
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
}
it("the production React lint command rejects missing dependencies and conditional hooks", () => {
  const missing = probe(
    'import {useEffect} from "react"; export function Component({value}:{value:string}) {useEffect(()=>{console.log(value)},[]);return null;}',
    undefined,
    true,
  );
  expect(missing.status).toBe(1);
  expect(missing.codes).toContain("react-hooks(exhaustive-deps)");
  const conditional = probe(
    'import {useState} from "react"; export function Component({active}:{active:boolean}) {if(active){useState(0);}return null;}',
  );
  expect(conditional.status).toBe(1);
  expect(conditional.codes).toContain("react-hooks(rules-of-hooks)");
});
it("compiler purity checks remain active and backend projects are outside React rules", () => {
  const source = "export function Component() {return <p>{Date.now()}</p>;}";
  expect(probe(source).codes).toContain("react(purity)");
  expect(probe(source, "apps/desktop/src/__ove006_react_probe__.tsx").codes).toContain(
    "react(purity)",
  );
  expect(probe(source, "packages/domain/src/__ove006_react_probe__.tsx").codes).toEqual([]);
  expect(
    probe("export function Component({value}:{value:string}) {return <p>{value}</p>;}").status,
  ).toBe(0);
});
it("malformed React sources cannot masquerade as successful rule checks", () => {
  expect(() => probe("export const =;")).toThrow();
  expect(() => parseReactLintReport('{"number_of_files":0,"diagnostics":[]}')).toThrow();
});
