// SPDX-License-Identifier: Apache-2.0
import { execFileSync, spawnSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";
import { isolatedGitEnvironment } from "../../hooks/git-test-environment.ts";

it("runs the actual architecture gate against the actual generator and rejects stale overviews", () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "ove-index-architecture-")));
  const cli = fileURLToPath(new URL("../gen-index.ts", import.meta.url));
  const architecture = fileURLToPath(new URL("../../ci/architecture.ts", import.meta.url));
  const fixture = readFileSync(
    new URL("../fixtures/tasks/OVE_FIX001/TASK.md", import.meta.url),
    "utf8",
  );
  const quote = (text: string) => "'" + text.replaceAll("'", "'\\''") + "'";
  try {
    mkdirSync(join(root, "home"));
    mkdirSync(join(root, "tasks/OVE_FIX001"), { recursive: true });
    mkdirSync(join(root, "tools/tasks"), { recursive: true });
    symlinkSync(cli, join(root, "tools/tasks/gen-index.ts"));
    writeFileSync(join(root, "tasks/PLAN.md"), "## 2. Area codes\n\n| FIX | Fixture | 1 |\n");
    writeFileSync(join(root, "tasks/OVE_FIX001/TASK.md"), fixture);
    writeFileSync(
      join(root, "package.json"),
      JSON.stringify({
        private: true,
        type: "module",
        scripts: {
          "gen:task-index": [process.execPath, "--import", import.meta.resolve("tsx"), cli]
            .map(quote)
            .join(" "),
        },
      }),
    );
    const env = {
      ...isolatedGitEnvironment(),
      HOME: join(root, "home"),
      XDG_CONFIG_HOME: join(root, "home"),
      CI_STRICT_TOOLS: "false",
      CI_BRANCH: "",
    };
    execFileSync(process.execPath, ["--import", import.meta.resolve("tsx"), cli], {
      cwd: root,
      env,
    });
    const run = () =>
      spawnSync(process.execPath, ["--import", import.meta.resolve("tsx"), architecture], {
        cwd: root,
        env,
        encoding: "utf8",
      });
    expect(run().status).toBe(0);
    writeFileSync(
      join(root, "tasks/OVE_FIX001/TASK.md"),
      fixture.replace(
        "title: Verify task tooling against a temporary repository",
        "title: Changed title",
      ),
    );
    const stale = run();
    expect(stale.status).not.toBe(0);
    expect(stale.stdout).toContain("--- tasks/INDEX.md");
    expect(readFileSync(join(root, "tasks/INDEX.md"), "utf8")).not.toContain("Changed title");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
