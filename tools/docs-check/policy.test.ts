import { expect, it } from "vitest";
import { checkCommands, checkContent, checkLinks, checkReferences } from "./policy.ts";

it("accepts duplicate-heading anchors and reports missing anchors, escaping paths and missing files", () => {
  const files = new Map([
    [
      "README.md",
      "# Root\n\n[valid](guide.md#same-1)\n[anchor](guide.md#missing)\n[escape](../outside.md)\n[file](missing.md)\n",
    ],
    ["guide.md", "# Same\n\n## Same\n"],
  ]);
  expect(checkLinks(files).map((d) => d.rule)).toEqual([
    "broken-anchor",
    "unsafe-link",
    "broken-link",
  ]);
});

it("resolves ADR and actual numbered specification heading references", () => {
  const files = new Map([
    ["README.md", "# Root\n\nADR 0013, ADR-9999, SPEC 13, spec section 99.\n"],
    ["docs/SPECIFICATION.md", "# Spec\n\n## 13. Architecture\n"],
  ]);
  const paths = new Set([...files.keys(), "docs/adr/0013-license.md"]);
  expect(checkReferences(files, paths).map((d) => d.rule)).toEqual([
    "missing-adr",
    "missing-spec-section",
  ]);
});

it("validates pnpm Bash commands while allowing the documented install builtin", () => {
  const md =
    "# Commands\n\n```bash\npnpm install --frozen-lockfile\npnpm typecheck\npnpm run missing-script\n```\n\n```ts\npnpm not-a-command\n```\n";
  expect(checkCommands(md, new Set(["typecheck"])).map((d) => d.rule)).toEqual(["unknown-command"]);
});

it("handles documented global options and still validates explicit run script names", () => {
  const md =
    "```bash\npnpm --version\npnpm --filter @overmind/desktop dev\npnpm run install\npnpm --filter=x run missing\n```\n";
  expect(checkCommands(md, new Set(["dev"])).map((d) => d.line)).toEqual([4, 5]);
});

it("fails closed on local paths, contact details, unowned TODOs and publication markers without echoing values", () => {
  const md =
    "---\nstatus: draft\n---\n# Title\n\n/Users/someone/private\nowner@example.com\nTODO(unowned)\nTODO-OWNER\n";
  const diagnostics = checkContent("draft.md", md, true);
  expect(diagnostics.map((d) => d.rule)).toEqual([
    "private-content",
    "unowned-todo",
    "owner-marker",
    "draft-translation",
  ]);
  expect(diagnostics.map((d) => d.message).join(" ")).not.toContain("someone");
});
