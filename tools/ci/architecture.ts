import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
const tools = [
  ["check:boundaries", "tools/check-boundaries/run.ts", "OVE_ARCH002"],
  ["check:contracts", "tools/gen-contracts/check-additive.ts", "OVE_ARCH009"],
  ["check:deps", "tools/deps-policy/run.ts", "OVE_SETUP008", "tools/deps-policy/run.int.test.ts"],
  ["check:headers", "tools/check-headers/run.ts", "OVE_OSS001"],
  ["check:docs", "tools/docs-check/run.ts", "OVE_OSS002"],
  ["check:tasks", "tools/tasks/lint.ts", "OVE_SETUP013"],
];
const missing: string[] = [];
for (const [script, file, owner, integration] of tools) {
  if (!script || !file || !owner) {
    throw new Error("Invalid architecture tool registry");
  }
  if (existsSync(file)) {
    execFileSync("pnpm", [script], { stdio: "inherit", shell: false });
    if (integration) {
      if (!existsSync(integration)) {
        throw new Error(`Required integration evidence is missing: ${owner}`);
      }
      execFileSync(
        "pnpm",
        ["exec", "vitest", "run", "--config", "vitest.int.config.ts", integration],
        { stdio: "inherit", shell: false },
      );
    }
  } else {
    missing.push(`${script} (${owner})`);
  }
}
if ((process.env["CI_BRANCH"] ?? "").startsWith("task/")) {
  if (existsSync("tools/tasks/check-owns.ts")) {
    execFileSync("pnpm", ["check:owns", "--base", process.env["CI_BASE"] ?? "origin/main"], {
      stdio: "inherit",
      shell: false,
    });
  } else {
    missing.push("check:owns (OVE_SETUP013)");
  }
}
if (missing.length) {
  console.warn(`Foundation tools not yet merged: ${missing.join(", ")}`);
  if (process.env["CI_STRICT_TOOLS"] === "true") {
    process.exitCode = 1;
  }
}
