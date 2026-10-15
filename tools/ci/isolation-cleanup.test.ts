import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { expect, it } from "vitest";
import { readWorkflow } from "./workflow.parse-boundary.ts";
import { trustedExecutable } from "./isolation-trusted-tools.mjs";
import { isolatedGitEnvironment } from "../hooks/git-test-environment.ts";

const root = resolve(import.meta.dirname, "../..");

it("cleanup preflight rejects replaceable executables and parent directories", () => {
  expect(trustedExecutable("/bin/sh")).toMatch(/^\//u);
  expect(() => trustedExecutable("node")).toThrow();
  const fixture = mkdtempSync(resolve(tmpdir(), "overmind-cleanup-tool-"));
  try {
    const executable = resolve(fixture, "tool");
    writeFileSync(executable, "#!/bin/sh\nexit 0\n");
    chmodSync(executable, 0o755);
    expect(() => trustedExecutable(executable)).toThrow(/root-owned/u);
    chmodSync(executable, 0o644);
    expect(() => trustedExecutable(executable)).toThrow(/not executable/u);
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});

it("actual cleanup step ignores hostile PATH, shell/Node/Perl options and altered cleanup bytes", () => {
  const preflight = readWorkflow(resolve(root, ".github/workflows/isolation.yml")).jobs[
    "escape"
  ]?.steps.find((item) => item.run?.includes("node_path="))?.run;
  expect(preflight).toContain("isolation-trusted-tools.mjs /opt/overmind-ci/isolation-cleanup.mjs");
  expect(preflight).toContain('[[ "$digest" == "$expected" ]]');
  const step = readWorkflow(resolve(root, ".github/workflows/isolation.yml")).jobs[
    "escape"
  ]?.steps.find((item) => item.run?.includes("stop_container()"));
  if (!step?.run || !step.env) {
    throw new Error("Missing trusted cleanup step");
  }
  expect(step.shell).toBe("/bin/bash --noprofile --norc -e -o pipefail {0}");
  const [shell, ...shellArgs] = (step.shell ?? "").split(" ");
  if (!shell) {
    throw new Error("Missing absolute cleanup shell");
  }
  const safeEnvironment = Object.fromEntries(
    Object.entries(step.env).filter(([, value]) => !value.includes("${{")),
  );
  expect(safeEnvironment).toMatchObject({
    PATH: "/usr/bin:/bin:/usr/sbin:/sbin",
    BASH_ENV: "/dev/null",
    ENV: "/dev/null",
    NODE_OPTIONS: "",
    NODE_PATH: "",
  });
  const fixture = mkdtempSync(resolve(tmpdir(), "overmind-cleanup-step-"));
  try {
    const marker = resolve(fixture, "attacker-ran");
    const calls = resolve(fixture, "container-calls");
    const container = resolve(fixture, "trusted-container");
    const cleanup = resolve(fixture, "cleanup.mjs");
    const injected = resolve(fixture, "injected.sh");
    const script = resolve(fixture, "step.sh");
    writeFileSync(script, step.run);
    writeFileSync(injected, `printf attacked > '${marker}'\n`);
    writeFileSync(container, `#!/bin/sh\nprintf '%s\\n' "$*" >> '${calls}'\n`);
    chmodSync(container, 0o755);
    for (const name of ["bash", "node", "container", "shasum", "cut"]) {
      const path = resolve(fixture, name);
      writeFileSync(path, `#!/bin/sh\nprintf attacked > '${marker}'\nexit 0\n`);
      chmodSync(path, 0o755);
    }
    copyFileSync(resolve(root, "tools/ci/isolation-cleanup.mjs"), cleanup);
    const digest = createHash("sha256").update(readFileSync(cleanup)).digest("hex");
    const run = () =>
      spawnSync(
        shell,
        shellArgs.map((arg) => (arg === "{0}" ? script : arg)),
        {
          encoding: "utf8",
          timeout: 10000,
          env: {
            ...isolatedGitEnvironment(),
            BASH_ENV: injected,
            ENV: injected,
            NODE_OPTIONS: "--require=/missing-attacker-module",
            PERL5OPT: "-Mmissing_attacker_module",
            RUNNER_TEMP: "/attacker-temp",
            ...safeEnvironment,
            // GitHub prepends GITHUB_PATH entries after applying step.env.PATH.
            PATH: `${fixture}:${safeEnvironment["PATH"] ?? ""}`,
            EXPECTED_CLEANUP_SHA: digest,
            TRUSTED_NODE: process.execPath,
            TRUSTED_CONTAINER: container,
            TRUSTED_CLEANUP: cleanup,
            TRUSTED_HOME: fixture,
          },
        },
      );
    const result = run();
    expect(result.status, result.stderr).toBe(0);
    expect(readFileSync(calls, "utf8")).toBe(
      "list --all --quiet\nvolume list --quiet\nsystem stop\n",
    );
    expect(existsSync(marker)).toBe(false);
    writeFileSync(cleanup, `throw new Error("Tampered cleanup executed");\n`);
    const tampered = run();
    expect(tampered.status).not.toBe(0);
    expect(tampered.stderr).not.toContain("Tampered cleanup executed");
    expect(readFileSync(calls, "utf8")).toMatch(/system stop\nsystem stop\n$/u);
    expect(existsSync(marker)).toBe(false);
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
  // Two bounded external shell/Node runs can exceed Vitest's 5s default under load.
}, 25000);
