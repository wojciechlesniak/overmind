// SPDX-License-Identifier: Apache-2.0
import { readFileSync, writeFileSync } from "node:fs";
import { expect, it } from "vitest";
import { parseTask } from "../lib/index.ts";
import type { Task } from "../lib/index.ts";
import { renderIndex } from "./index.ts";

it("renders area order, static counts, cancelled tasks and inert table metadata", () => {
  const parsed = parseTask(
    "tasks/OVE_FIX001/TASK.md",
    readFileSync(new URL("../fixtures/tasks/OVE_FIX001/TASK.md", import.meta.url), "utf8"),
  );
  if (!parsed.ok) {
    throw new Error("Invalid fixture");
  }
  const tasks = new Map<string, Task>([
    [
      "OVE_ALT001",
      {
        ...parsed.value,
        id: "OVE_ALT001",
        area: "ALT",
        title: "Alternative",
        priority: "P1" as const,
        size: "XS" as const,
      },
    ],
    [
      "OVE_FIX003",
      { ...parsed.value, id: "OVE_FIX003", title: "Old task", status: "cancelled" as const },
    ],
    [
      "OVE_FIX001",
      { ...parsed.value, title: "UI | `code` <img> & [link](x)", status: "in_progress" as const },
    ],
  ]);
  const output = renderIndex(tasks, ["FIX", "ALT"]);
  const golden = new URL("../fixtures/render/index.md.golden", import.meta.url);
  if (process.env["UPDATE_TASK_RENDER_GOLDENS"] === "1") {
    writeFileSync(golden, output);
  }
  expect(output).toBe(readFileSync(golden, "utf8"));
  expect(renderIndex(new Map([...tasks].reverse()), ["FIX", "ALT"])).toBe(output);
  tasks.set("OVE_FIX001", { ...tasks.get("OVE_FIX001")!, status: "done" });
  expect(renderIndex(tasks, ["FIX", "ALT"])).toBe(output);
});
