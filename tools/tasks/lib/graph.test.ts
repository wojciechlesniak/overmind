import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { parseTask } from "./task.parse-boundary.ts";
import { readiness, topologicalLayers } from "./graph.ts";
import type { Task } from "./model.ts";

function task(id: string, changes: Partial<Task> = {}): Task {
  const parsed = parseTask(
    "tasks/OVE_FIX001/TASK.md",
    readFileSync(new URL("../fixtures/tasks/OVE_FIX001/TASK.md", import.meta.url), "utf8"),
  );
  if (!parsed.ok) {
    throw new Error("Invalid fixture");
  }
  return { ...parsed.value, id, ...changes };
}

it("requires merged hard dependencies while allowing unfinished soft dependencies", () => {
  const selected = task("OVE_FIX001", {
    depends_on: ["OVE_FIX002"],
    soft_depends_on: ["OVE_FIX003"],
  });
  const tasks = new Map([
    [selected.id, selected],
    ["OVE_FIX002", task("OVE_FIX002", { status: "in_review" })],
    ["OVE_FIX003", task("OVE_FIX003")],
  ]);
  expect(readiness(selected, tasks).ready).toBe(false);
  expect(readiness(selected, tasks).blockedBy).toEqual(["OVE_FIX002"]);
  tasks.set("OVE_FIX002", task("OVE_FIX002", { status: "done" }));
  expect(readiness(selected, tasks)).toEqual({ ready: true, blockedBy: [], reasons: [] });
});

it("groups dependency layers deterministically and refuses cycles or missing dependencies", () => {
  const tasks = new Map([
    ["OVE_FIX003", task("OVE_FIX003", { depends_on: ["OVE_FIX002"] })],
    ["OVE_FIX002", task("OVE_FIX002", { depends_on: ["OVE_FIX001"] })],
    ["OVE_FIX001", task("OVE_FIX001")],
  ]);
  expect(topologicalLayers(tasks)).toEqual([["OVE_FIX001"], ["OVE_FIX002"], ["OVE_FIX003"]]);
  tasks.set("OVE_FIX001", task("OVE_FIX001", { depends_on: ["OVE_FIX003"] }));
  expect(() => topologicalLayers(tasks)).toThrow(/cycle/iu);
  tasks.delete("OVE_FIX001");
  expect(() => topologicalLayers(tasks)).toThrow(/missing/iu);
});
