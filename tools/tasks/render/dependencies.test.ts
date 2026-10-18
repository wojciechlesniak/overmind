// SPDX-License-Identifier: Apache-2.0
import { readFileSync, writeFileSync } from "node:fs";
import { expect, it } from "vitest";
import { parseTask } from "../lib/index.ts";
import type { Task } from "../lib/index.ts";
import { renderDependencies } from "./dependencies.ts";

const parsed = parseTask(
  "tasks/OVE_FIX001/TASK.md",
  readFileSync(new URL("../fixtures/tasks/OVE_FIX001/TASK.md", import.meta.url), "utf8"),
);
if (!parsed.ok) {
  throw new Error("Invalid fixture");
}
const base = parsed.value;
function task(id: string, changes: Partial<Task> = {}): Task {
  return { ...base, id, ...changes };
}

it("renders reverse edges, waves, longest chain, cross-area diagrams and capability consumers", () => {
  const tasks = new Map([
    [
      "OVE_FIX003",
      task("OVE_FIX003", { depends_on: ["OVE_FIX002"], needs: ["ui:Button"], provides: [] }),
    ],
    [
      "OVE_FIX002",
      task("OVE_FIX002", {
        depends_on: ["OVE_ALT001"],
        soft_depends_on: ["OVE_FIX003"],
        provides: [],
      }),
    ],
    ["OVE_ALT001", task("OVE_ALT001", { area: "ALT", provides: ["ui:Button"] })],
  ]);
  const output = renderDependencies(tasks, ["FIX", "ALT"]);
  const golden = new URL("../fixtures/render/dependencies.md.golden", import.meta.url);
  if (process.env["UPDATE_TASK_RENDER_GOLDENS"] === "1") {
    writeFileSync(golden, output);
  }
  expect(output).toBe(readFileSync(golden, "utf8"));
  expect(renderDependencies(new Map([...tasks].reverse()), ["FIX", "ALT"])).toBe(output);
});

it("splits large area diagrams into bounded wave parts without dropping edges", () => {
  const tasks = new Map<string, Task>();
  for (let n = 1; n <= 152; n++) {
    const id = `OVE_FIX${String(n).padStart(3, "0")}`;
    tasks.set(
      id,
      task(id, { depends_on: n === 152 ? ["OVE_FIX001", "OVE_FIX151"] : [], provides: [] }),
    );
  }
  const output = renderDependencies(tasks);
  const diagrams = [...output.matchAll(/```mermaid\n([\s\S]*?)```/gu)];
  expect(diagrams.length).toBeGreaterThan(1);
  for (const diagram of diagrams) {
    expect(new Set(diagram[1]?.match(/OVE_FIX\d{3}/gu)).size).toBeLessThanOrEqual(150);
  }
  expect(output).toContain("Wave 1, part 1");
  expect(output).toContain("OVE_FIX151 --> OVE_FIX152");
});
