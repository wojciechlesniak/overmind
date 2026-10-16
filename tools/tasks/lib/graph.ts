import type { Task } from "./model.ts";
import { TaskToolError } from "./errors.ts";

export function readiness(task: Task, tasks: ReadonlyMap<string, Task>) {
  const blockedBy = task.depends_on.filter((id) => tasks.get(id)?.status !== "done").sort();
  const reasons = blockedBy.map((id) => `Dependency ${id} is not merged and done`);
  if (task.status !== "todo") {
    reasons.unshift(`Task status is ${task.status}, not todo`);
  }
  return { ready: reasons.length === 0, blockedBy, reasons };
}

export function topologicalLayers(tasks: ReadonlyMap<string, Task>): string[][] {
  for (const task of tasks.values()) {
    for (const dependency of task.depends_on) {
      if (!tasks.has(dependency)) {
        throw new TaskToolError(4, `Task ${task.id} has missing dependency ${dependency}`);
      }
    }
  }
  const remaining = new Set(tasks.keys());
  const layers: string[][] = [];
  while (remaining.size) {
    const layer = [...remaining]
      .filter((id) => tasks.get(id)?.depends_on.every((dependency) => !remaining.has(dependency)))
      .sort();
    if (!layer.length) {
      throw new TaskToolError(4, `Dependency cycle: ${[...remaining].sort().join(", ")}`);
    }
    layers.push(layer);
    for (const id of layer) {
      remaining.delete(id);
    }
  }
  return layers;
}
