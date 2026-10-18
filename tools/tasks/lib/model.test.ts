import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { parseTask } from "./task.parse-boundary.ts";

const path = "tasks/OVE_FIX001/TASK.md";
const text = readFileSync(new URL("../fixtures/tasks/OVE_FIX001/TASK.md", import.meta.url), "utf8");

it("loads a typed task while refusing a task without its required title", () => {
  const parsed = parseTask(path, text);
  expect(parsed.ok).toBe(true);
  if (!parsed.ok) {
    throw new Error("Valid fixture rejected");
  }
  expect(parsed.value.id).toBe("OVE_FIX001");
  expect(parsed.value.status).toBe("todo");
  expect(parsed.value.owns).toEqual(["fixture/**"]);
  expect(parseTask(path, text.replace(/^title:.*\n/mu, "")).ok).toBe(false);
});

it.each([
  ["wrong enum", text.replace("status: todo", "status: executed")],
  ["wrong type", text.replace("mvp: true", 'mvp: "true"')],
  ["custom tag", text.replace("kind: test", "kind: !private PRIVATE_SENTINEL")],
  [
    "alias",
    text
      .replace(
        "title: Verify task tooling against a temporary repository",
        "title: &title Verify task tooling",
      )
      .replace("spec_refs: []", "spec_refs: [*title]"),
  ],
  ["duplicate key", text.replace("status: todo", "status: todo\nstatus: done")],
  ["oversized UTF-8", text + "é".repeat(140000)],
])("refuses %s without exposing untrusted task content in diagnostics", (_name, source) => {
  const result = parseTask(path, source);
  expect(result.ok).toBe(false);
  if (!result.ok) {
    expect(result.error.reason).not.toContain("PRIVATE_SENTINEL");
  }
});

it("refuses metadata whose ID does not match the task file being loaded", () => {
  expect(parseTask("tasks/OVE_FIX002/TASK.md", text).ok).toBe(false);
  expect(parseTask(path, text.replace("area: FIX", "area: FI")).ok).toBe(false);
});

it("accepts optional generated reverse edges without permitting unrelated fields", () => {
  const withBlocks = text.replace("adr_refs: []", "adr_refs: []\nblocks: [OVE_FIX002]");
  const parsed = parseTask(path, withBlocks);
  expect(parsed.ok).toBe(true);
  if (parsed.ok) {
    expect(parsed.value.blocks).toEqual(["OVE_FIX002"]);
  }
  expect(parseTask(path, text.replace("adr_refs: []", "adr_refs: []\nextra: true")).ok).toBe(false);
  expect(parseTask(path, withBlocks.replace("blocks: [OVE_FIX002]", "blocks: [invalid]")).ok).toBe(
    false,
  );
});
