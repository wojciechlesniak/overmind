import { configuration, localOnly, options } from "./cli.ts";
import { ghReader } from "./gh.ts";

import { synchronize } from "./labels.ts";
try {
  localOnly();
  const { repo, flag } = options(process.argv.slice(2), "labels");
  const { changes, extras } = synchronize(configuration().labels, ghReader(), repo, flag);
  for (const change of changes) {
    console.log(`${flag ? "apply" : "dry-run"}: ${change.operation} ${change.label.name}`);
  }
  console.log(
    `Extra labels retained: ${extras.map((name) => JSON.stringify(name)).join(", ") || "none"}`,
  );
  console.log(
    `${flag ? "Applied" : "Planned"}: ${String(changes.length)}; labels are never deleted`,
  );
} catch {
  console.error(
    "Label synchronization stopped: invalid input, unavailable metadata or insufficient permissions",
  );
  process.exitCode = 1;
}
