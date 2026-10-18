// SPDX-License-Identifier: Apache-2.0
import { topologicalLayers } from "../lib/index.ts";
import type { Task } from "../lib/index.ts";
import { escapeCell, generated, sorted, taskList } from "./index.ts";

export function reverseEdges(tasks: ReadonlyMap<string, Task>): Map<string, string[]> {
  return new Map(
    sorted(tasks).map((task) => [
      task.id,
      sorted(tasks)
        .filter((candidate) => candidate.depends_on.includes(task.id))
        .map((candidate) => candidate.id),
    ]),
  );
}
export function capabilityLinks(tasks: ReadonlyMap<string, Task>) {
  const all = sorted(tasks);
  return [...new Set(all.flatMap((task) => [...task.provides, ...task.needs]))]
    .sort()
    .map((name) => ({
      name,
      providers: all.filter((task) => task.provides.includes(name)).map((task) => task.id),
      consumers: all.filter((task) => task.needs.includes(name)).map((task) => task.id),
    }));
}
export function renderDependencies(
  tasks: ReadonlyMap<string, Task>,
  areas = [...new Set(sorted(tasks).map((task) => task.area))],
): string {
  const layers = topologicalLayers(tasks);
  const reverse = reverseEdges(tasks);
  const lines = [
    "# Task dependencies",
    "",
    generated,
    "",
    "## Dependencies",
    "",
    "| ID | depends_on | soft_depends_on | blocks |",
    "| --- | --- | --- | --- |",
  ];
  for (const task of sorted(tasks)) {
    lines.push(
      `| ${task.id} | ${taskList(task.depends_on)} | ${taskList(task.soft_depends_on)} | ${taskList(reverse.get(task.id) ?? [])} |`,
    );
  }
  lines.push("", "## Topological layers", "");
  const chains = new Map<string, string[]>();
  let longest: string[] = [];
  for (const [wave, ids] of layers.entries()) {
    lines.push(`- Wave ${String(wave)}: ${ids.join(", ")}`);
    for (const id of ids) {
      const candidates = (tasks.get(id)?.depends_on ?? [])
        .map((dependency) => chains.get(dependency) ?? [])
        .sort((a, b) => b.length - a.length || a.join().localeCompare(b.join(), "en"));
      const chain = [...(candidates[0] ?? []), id];
      chains.set(id, chain);
      if (chain.length > longest.length) {
        longest = chain;
      }
    }
  }
  lines.push("", "## Critical path", "", longest.join(" → ") || "-", "", "## Area diagrams");
  for (const area of areas) {
    const records = sorted(tasks)
      .filter((task) => task.area === area)
      .flatMap((task) => {
        const dependencies = [...new Set(task.depends_on)].sort();
        return (dependencies.length ? dependencies : [undefined]).map((dependency) => ({
          nodes: dependency ? [dependency, task.id] : [task.id],
          text: dependency ? `${dependency} --> ${task.id}` : task.id,
          wave: layers.findIndex((layer) => layer.includes(task.id)),
        }));
      });
    lines.push("", `### ${area}`);
    const diagram = (records: { text: string }[]) =>
      lines.push(
        "",
        "```mermaid",
        "flowchart LR",
        ...records.map((record) => `  ${record.text}`),
        "```",
      );
    if (new Set(records.flatMap((record) => record.nodes)).size <= 150) {
      diagram(records);
    } else {
      lines.push(
        "",
        "Split by topological wave; each part contains at most 150 nodes. All edges are retained.",
      );
      for (const wave of layers.keys()) {
        let part = 1;
        let nodes = new Set<string>();
        let chunk: typeof records = [];
        const flush = () => {
          lines.push("", `#### Wave ${String(wave)}, part ${String(part++)}`);
          diagram(chunk);
          chunk = [];
          nodes = new Set();
        };
        for (const record of records.filter((record) => record.wave === wave)) {
          if (new Set([...nodes, ...record.nodes]).size > 150) {
            flush();
          }
          record.nodes.forEach((node) => nodes.add(node));
          chunk.push(record);
        }
        if (chunk.length) {
          flush();
        }
      }
    }
  }
  lines.push(
    "",
    "## Capabilities",
    "",
    "| Capability | Provider | Consumers |",
    "| --- | --- | --- |",
  );
  for (const link of capabilityLinks(tasks)) {
    lines.push(
      `| ${escapeCell(link.name)} | ${taskList(link.providers)} | ${taskList(link.consumers)} |`,
    );
  }
  return lines.join("\n") + "\n";
}
