import { configuration, localOnly, options, print, root } from "./cli.ts";
import { ghReader } from "./gh.ts";
import { compare, audit, exitCode } from "./policy.ts";
import { record } from "./input.parse-boundary.ts";
import { inventory, workflowSources } from "./workflows.parse-boundary.ts";
try {
  localOnly();
  const { repo, flag } = options(process.argv.slice(2), "audit");
  const { expected, labels } = configuration();
  const reader = ghReader();
  const local = inventory(workflowSources(root), expected.requiredChecks);
  const rows = [...audit(expected, labels, reader, repo), ...local.rows];
  const allowed = reader.request("GET", `repos/${repo}/actions/permissions/selected-actions`);
  try {
    const value = allowed.ok ? record(allowed.value) : {};
    rows.push(compare("actions.github_owned_allowed", true, value["github_owned_allowed"]));
    rows.push(compare("actions.verified_allowed", false, value["verified_allowed"]));
    const patterns = value["patterns_allowed"];
    rows.push(
      compare(
        "actions.patterns_allowed",
        local.actions,
        Array.isArray(patterns) ? patterns.toSorted() : undefined,
      ),
    );
  } catch {
    rows.push(compare("actions.selected_allowlist", local.actions, undefined));
  }
  if (allowed.ok || allowed.invalid) {
    for (const row of rows.filter((item) => item.setting.startsWith("actions."))) {
      if (row.status === "unknown") {
        row.status = "drift";
        row.actual = "malformed or incomplete response";
      }
    }
  }
  print(rows);
  process.exitCode = exitCode(rows, flag);
} catch {
  console.error(
    "Settings audit failed: invalid input, unavailable workflow inventory or CI execution",
  );
  process.exitCode = 1;
}
