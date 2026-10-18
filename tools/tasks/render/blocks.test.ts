// SPDX-License-Identifier: Apache-2.0
import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { applyBlocks } from "./blocks.ts";

const fixture = readFileSync(
  new URL("../fixtures/tasks/OVE_FIX001/TASK.md", import.meta.url),
  "utf8",
);
it("inserts sorted reverse edges after ADR metadata and preserves every other byte", () => {
  const before = fixture.replace("adr_refs: []", "adr_refs: [] # references\n# retained comment");
  const expected = before.replace(
    "adr_refs: [] # references\n",
    "adr_refs: [] # references\nblocks: [OVE_FIX001, OVE_FIX002]\n",
  );
  const after = applyBlocks(before, ["OVE_FIX002", "OVE_FIX001", "OVE_FIX002"]);
  expect(after).toBe(expected);
  expect(applyBlocks(after, ["OVE_FIX001", "OVE_FIX002"])).toBe(after);
  const wrong = after.replace(
    "blocks: [OVE_FIX001, OVE_FIX002]",
    "blocks: [OVE_FIX999] # preserved inline comment",
  );
  expect(applyBlocks(wrong, [])).toBe(
    expected.replace("blocks: [OVE_FIX001, OVE_FIX002]", "blocks: [] # preserved inline comment"),
  );
});

it("updates existing block-style and quoted blocks while preserving comments and ADR placement", () => {
  const before = fixture.replace(
    "adr_refs: []",
    '"blocks":\n- OVE_FIX999 # retained edge comment\n# retained standalone\n"adr_refs": [9] # retained ADR comment',
  );
  const expected = fixture.replace(
    "adr_refs: []",
    '# retained standalone\n"adr_refs": [9] # retained ADR comment\nblocks: []\n# retained edge comment',
  );
  expect(applyBlocks(before, [])).toBe(expected);
  expect(applyBlocks(expected, [])).toBe(expected);
  const quoted = fixture.replace(
    "adr_refs: []",
    'adr_refs: []\n"blocks": [OVE_FIX999] # retained edge comment',
  );
  expect(applyBlocks(quoted, [])).toBe(quoted.replace("[OVE_FIX999]", "[]"));
});
