import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { synchronize } from "./labels.ts";
import { audit, compare, exitCode, labelDiff } from "./policy.ts";
import { applyLabel, ghReader, list, type Execute, type Reader, type Reply } from "./gh.ts";
import { configuration, localOnly, options, print } from "./cli.ts";
import { parseApiLabels, parseJson, parseLabels, record, records } from "./input.parse-boundary.ts";
import { inventory, workflowSources } from "./workflows.parse-boundary.ts";
const { expected, labels } = configuration();
const ok = (value: unknown): Reply => ({ ok: true, value });
function configured() {
  const values = new Map<string, unknown>();
  function put(target: Record<string, unknown>, path: string, value: unknown) {
    const keys = path.split(".");
    const last = keys.pop()!;
    let current = target;
    for (const key of keys) {
      current[key] ??= {};
      const nested = record(current[key]);
      current[key] = nested;
      current = nested;
    }
    current[last] = value;
  }
  const repository: Record<string, unknown> = {};
  for (const setting of expected.repository) {
    put(repository, setting.path, setting.value);
  }
  values.set("", repository);
  for (const endpoint of expected.endpoints) {
    const payload: Record<string, unknown> = {};
    for (const setting of endpoint.settings) {
      put(payload, setting.path, setting.value);
    }
    values.set(endpoint.endpoint, payload);
  }
  values.set("vulnerability-alerts", null);
  values.set(
    "rulesets",
    expected.rulesets.map((policy, index) => ({ id: index + 1, name: policy.name })),
  );
  for (const [index, policy] of expected.rulesets.entries()) {
    const rules = new Map<string, Record<string, unknown>>();
    for (const setting of policy.rules) {
      const [kind, ...path] = setting.path.split(".");
      if (!kind || (setting.value === false && path.length === 0)) {
        continue;
      }
      const rule = rules.get(kind) ?? { type: kind };
      if (path.length) {
        put(
          rule,
          path.join("."),
          setting.path.endsWith(".required_status_checks")
            ? expected.requiredChecks.map((context) => ({ context, integration_id: null }))
            : setting.value,
        );
      }
      rules.set(kind, rule);
    }
    values.set(`rulesets/${String(index + 1)}`, {
      target: policy.target,
      enforcement: "active",
      bypass_actors: policy.bypass,
      conditions: { ref_name: { include: policy.include, exclude: [] } },
      rules: [...rules.values()],
    });
  }
  values.set("environments/release", {
    can_admins_bypass: false,
    protection_rules: [
      {
        type: "required_reviewers",
        prevent_self_review: false,
        reviewers: [{ reviewer: { login: expected.releaseReviewer } }],
      },
    ],
    deployment_branch_policy: { custom_branch_policies: true, protected_branches: false },
  });
  values.set("environments/release/deployment-branch-policies", {
    branch_policies: [{ name: "v*", type: "tag" }],
  });
  values.set("environments", { environments: [{ name: "release" }, { name: "preview" }] });
  values.set("environments/release/secrets", {
    secrets: expected.releaseSecrets.map((name) => ({ name })),
  });
  values.set("environments/preview/secrets", { secrets: [] });
  values.set("actions/secrets", { secrets: [] });
  values.set("labels", labels);
  const reader: Reader = {
    request: (method, endpoint) => {
      expect(method).toBe("GET");
      const key = endpoint.replace(/^repos\/test\/repo\/?/u, "").split("?")[0]!;
      return values.has(key) ? ok(values.get(key)) : { ok: false, reason: "unavailable" };
    },
  };
  return { values, reader };
}
describe("read-only settings policy", () => {
  it("reports a configured API state with only explicitly manual controls unknown", () => {
    const rows = audit(expected, labels, configured().reader, "test/repo");
    expect(rows.filter((row) => row.status === "drift")).toEqual([]);
    expect(rows.filter((row) => row.status === "unknown").map((row) => row.setting)).toEqual([
      "manual.organization-or-personal-2fa-and-writer-permissions",
      "manual.dependency_graph.enabled",
    ]);
    expect(exitCode(rows)).toBe(1);
    expect(exitCode(rows, true)).toBe(0);
  });
  it("fails on merge drift, bypasses, missing checks and tag policies despite allow-unknown", () => {
    const { values, reader } = configured();
    values.set("", { ...record(values.get("")), allow_merge_commit: true });
    values.set("rulesets/1", {
      ...record(values.get("rulesets/1")),
      bypass_actors: [{ actor_type: "RepositoryRole", actor_id: 5, bypass_mode: "always" }],
    });
    values.set("environments/release/deployment-branch-policies", {
      branch_policies: [{ name: "v*", type: "branch" }],
    });
    const rows = audit(expected, labels, reader, "test/repo");
    expect(rows.filter((row) => row.status === "drift").map((row) => row.setting)).toEqual(
      expect.arrayContaining([
        "repository.allow_merge_commit",
        "main.bypass_actors",
        "release.tags",
      ]),
    );
    expect(exitCode(rows, true)).toBe(1);
  });
  it("denies repository and other environment secret names; never needs values", () => {
    const { values, reader } = configured();
    values.set("actions/secrets", { secrets: [{ name: "UNAPPROVED" }] });
    values.set("environments/preview/secrets", { secrets: [{ name: "FORBIDDEN" }] });
    const rows = audit(expected, labels, reader, "test/repo");
    expect(rows.find((row) => row.setting === "repository.secret_names")?.status).toBe("drift");
    expect(rows.find((row) => row.setting === "environment.preview.secret_names")?.status).toBe(
      "drift",
    );
  });
  it("does not pass errors, malformed rulesets, null metadata or duplicated names", () => {
    const { values, reader } = configured();
    values.set("rulesets", [
      { name: "main", id: 1 },
      { name: "main", id: 2 },
    ]);
    values.set("environments/release", null);
    const rows = audit(expected, labels, reader, "test/repo");
    expect(rows.find((row) => row.setting === "ruleset.main")?.status).toBe("drift");
    expect(rows.find((row) => row.setting === "release.environment")?.status).toBe("drift");
    const unavailable: Reader = { request: () => ({ ok: false, reason: "403" }) };
    expect(exitCode(audit(expected, labels, unavailable, "test/repo"))).toBe(1);
  });
  it("replays recorded real GET metadata as drift without inventing a passing live audit", () => {
    const captured = record(
      parseJson(
        readFileSync(
          resolve(import.meta.dirname, "fixtures/live-settings-2026-10-16.json"),
          "utf8",
        ),
      ),
    );
    const replies = record(captured["responses"]);
    const reader: Reader = {
      request: (_method, endpoint) => {
        const key = endpoint.replace(/^repos\/test\/repo\/?/u, "").split("?")[0]!;
        return Object.hasOwn(replies, key)
          ? ok(replies[key])
          : { ok: false, reason: "not captured" };
      },
    };
    const rows = audit(expected, labels, reader, "test/repo");
    expect(rows.find((row) => row.setting === "actions/permissions.allowed_actions")?.status).toBe(
      "drift",
    );
    expect(rows.find((row) => row.setting === "repository.default_branch")?.status).toBe("pass");
    expect(exitCode(rows, true)).toBe(1);
  });
});
it("GET guard rejects all writes, endpoint injection, host redirection and traversal before execution", () => {
  const run = vi.fn<Execute>(() => "{}");
  const reader = ghReader(run);
  for (const method of ["POST", "PATCH", "PUT", "DELETE", "get"]) {
    expect(() => reader.request(method, "repos/test/repo")).toThrow();
  }
  for (const endpoint of [
    "https://evil.invalid",
    "--hostname",
    "repos/test/repo/../secrets",
    "repos/test/repo/%2e%2e/secrets",
    "repos/test/repo?token=x\n",
  ]) {
    expect(() => reader.request("GET", endpoint)).toThrow();
  }
  expect(run).not.toHaveBeenCalled();
  expect(reader.request("GET", "repos/test/repo")).toEqual(ok({}));
  expect(run.mock.calls[0]?.[0]).toContain("GET");
});
it("sanitizes command failures rather than returning credentials or raw errors", () => {
  const reader = ghReader(() => {
    throw new Error("sensitive-credential-value");
  });
  expect(JSON.stringify(reader.request("GET", "repos/test/repo"))).not.toContain(
    "sensitive-credential-value",
  );
  expect(ghReader(() => "not json").request("GET", "repos/test/repo").ok).toBe(false);
  expect(ghReader(() => "").request("GET", "repos/test/repo/vulnerability-alerts")).toEqual(
    ok(null),
  );
});
it("paginates collections and fails closed on malformed or endlessly full pages", () => {
  let count = 0;
  const reader: Reader = {
    request: () => {
      count++;
      return ok(
        count === 1
          ? Array.from({ length: 100 }, (_, index) => ({ name: String(index) }))
          : [{ name: "last" }],
      );
    },
  };
  const reply = list(reader, "repos/test/repo/labels");
  expect(reply.ok && records(reply.value).length).toBe(101);
  expect(list({ request: () => ok({ unexpected: [] }) }, "repos/test/repo/labels").ok).toBe(false);
  expect(
    list({ request: () => ok(Array.from({ length: 100 }, () => ({}))) }, "repos/test/repo/labels")
      .ok,
  ).toBe(false);
});
it("plans label creation and metadata updates without deleting extras", () => {
  const wanted = parseLabels('[{"name":"accepted","color":"0e8a16","description":"Approved"}]');
  const existing = parseApiLabels([
    { name: "accepted", color: "AAAAAA", description: null, id: 1 },
    { name: "area:ARCH", color: "ffffff", description: "" },
  ]);
  const diff = labelDiff(wanted, existing);
  expect(diff.changes.map((change) => change.operation)).toEqual(["update"]);
  expect(diff.extras).toEqual(["area:ARCH"]);
  expect(labelDiff(wanted, []).changes[0]?.operation).toBe("create");
  const run = vi.fn<Execute>(() => "{}");
  expect(options([], "labels").flag).toBe(false);
  expect(run).not.toHaveBeenCalled();
  const label = wanted[0]!;
  applyLabel("test/repo", "create", label, run);
  applyLabel("test/repo", "update", label, run);
  expect(run.mock.calls.map((call) => call[0])).toEqual(
    expect.arrayContaining([
      expect.arrayContaining(["POST"]),
      expect.arrayContaining(["PATCH", "repos/test/repo/labels/accepted"]),
    ]),
  );
  expect(run.mock.calls.flat(2)).not.toContain("DELETE");
});
it("detects missing check jobs, unsafe action refs and excessive artifact retention", () => {
  const inventoryValue = inventory(
    [
      "jobs:\n  test:\n    name: ci-success\n    steps:\n      - uses: vendor/action@main\n      - uses: actions/upload-artifact@0123456789012345678901234567890123456789\n        with:\n          retention-days: 90\n",
    ],
    ["ci-success", "pr-gate"],
  );
  expect(
    inventoryValue.rows.filter((row) => row.status === "drift").map((row) => row.setting),
  ).toEqual(
    expect.arrayContaining([
      "workflow.required_check.pr-gate",
      "workflow.action.vendor/action@main",
      "workflow.artifacts.maximum_30_days",
    ]),
  );
  const real = inventory(
    workflowSources(resolve(import.meta.dirname, "../..")),
    expected.requiredChecks,
  );
  expect(real.rows.find((row) => row.setting === "workflow.required_check.pr-gate")?.status).toBe(
    "drift",
  );
  expect(
    real.rows
      .filter(
        (row) =>
          row.setting.startsWith("workflow.required_check.") &&
          row.setting !== "workflow.required_check.pr-gate",
      )
      .every((row) => row.status === "pass"),
  ).toBe(true);
});
it("rejects CI and unknown CLI arguments, and escapes terminal controls", () => {
  expect(() => {
    localOnly({ CI: "true" });
  }).toThrow();
  expect(() => {
    localOnly({ GITHUB_ACTIONS: "true" });
  }).toThrow();
  expect(() => options(["--apply"], "audit")).toThrow();
  expect(() => options(["--repo", "../bad"], "audit")).toThrow();
  expect(options(["--repo", "other/repo", "--allow-unknown"], "audit")).toEqual({
    repo: "other/repo",
    flag: true,
  });
  const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
  try {
    print([compare("name\u001b[31m|bad", true, false)]);
    expect(log.mock.calls.flat().join("\n")).not.toContain("\u001b");
  } finally {
    log.mockRestore();
  }
});

it("dry-run performs reads only and explicit apply stops on the first denied write", () => {
  const reader: Reader = { request: () => ok([]) };
  const write = vi.fn<typeof applyLabel>(() => undefined);
  expect(synchronize(labels, reader, "test/repo", false, write).changes).toHaveLength(
    labels.length,
  );
  expect(write).not.toHaveBeenCalled();
  synchronize(labels.slice(0, 2), reader, "test/repo", true, write);
  expect(write).toHaveBeenCalledTimes(2);
  const denied = vi.fn<typeof applyLabel>(() => {
    throw new Error("permission denied");
  });
  expect(() => synchronize(labels, reader, "test/repo", true, denied)).toThrow("permission denied");
  expect(denied).toHaveBeenCalledTimes(1);
});

it("allow-unknown cannot waive malformed JSON, missing metadata fields or incomplete rule parameters", () => {
  const { values, reader } = configured();
  values.set("actions/permissions", {});
  const rows = audit(expected, labels, reader, "test/repo");
  expect(rows.find((row) => row.setting === "actions/permissions.allowed_actions")?.status).toBe(
    "drift",
  );
  expect(exitCode(rows, true)).toBe(1);
  expect(ghReader(() => "{invalid").request("GET", "repos/test/repo")).toMatchObject({
    ok: false,
    invalid: true,
  });
});

it("missing approval labels are known drift rather than waivable unknown", () => {
  const { values, reader } = configured();
  values.set("labels", []);
  const rows = audit(expected, labels, reader, "test/repo");
  expect(rows.find((row) => row.setting === "label.config-change")?.status).toBe("drift");
  expect(exitCode(rows, true)).toBe(1);
});
