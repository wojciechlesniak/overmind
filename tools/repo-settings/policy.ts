import { type Expected, type Label, record, records } from "./input.parse-boundary.ts";
import { list, type Reader, type Reply } from "./gh.ts";
export interface Row {
  setting: string;
  expected: string;
  actual: string;
  status: "pass" | "drift" | "unknown";
}
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item: unknown) => canonical(item));
  }
  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(
      Object.keys(value)
        .toSorted()
        .map((key) => [key, canonical(Reflect.get(value, key))]),
    );
  }
  return value;
}
function stable(value: unknown): string {
  return value === undefined ? "missing" : JSON.stringify(canonical(value));
}
function at(value: unknown, path: string): unknown {
  return path
    .split(".")
    .reduce<unknown>(
      (part, key) =>
        typeof part === "object" && part !== null && !Array.isArray(part)
          ? Reflect.get(part, key)
          : undefined,
      value,
    );
}
export function compare(setting: string, expected: unknown, actual: unknown): Row {
  return {
    setting,
    expected: stable(expected),
    actual: stable(actual),
    status:
      actual === undefined ? "unknown" : stable(expected) === stable(actual) ? "pass" : "drift",
  };
}
export function labelDiff(expected: Label[], actual: Label[]) {
  const byName = new Map(actual.map((label) => [label.name.toLowerCase(), label]));
  return {
    changes: expected.flatMap<{ operation: "create" | "update"; label: Label }>((label) => {
      const old = byName.get(label.name.toLowerCase());
      return old === undefined
        ? [{ operation: "create" as const, label }]
        : old.color.toLowerCase() !== label.color || old.description !== label.description
          ? [{ operation: "update" as const, label }]
          : [];
    }),
    extras: actual
      .filter(
        (label) => !expected.some((item) => item.name.toLowerCase() === label.name.toLowerCase()),
      )
      .map((label) => label.name),
  };
}
export function audit(expected: Expected, labels: Label[], reader: Reader, repo: string): Row[] {
  const rows: Row[] = [];
  const base = `repos/${repo}`;
  const cached = new Map<string, Reply>();
  const get = (path: string): Reply => {
    const cachedReply = cached.get(path);
    if (cachedReply) {
      return cachedReply;
    }
    const reply = reader.request("GET", path);
    cached.set(path, reply);
    return reply;
  };
  const check = (name: string, value: unknown, reply: Reply, path = "") => {
    const actual = reply.ok ? (path === "" ? reply.value : at(reply.value, path)) : undefined;
    const row = compare(name, value, actual);
    if ((reply.ok && actual === undefined) || (!reply.ok && reply.invalid)) {
      row.status = "drift";
      row.actual = "malformed or incomplete response";
    }
    rows.push(row);
  };
  for (const setting of expected.repository) {
    check(`repository.${setting.path}`, setting.value, get(base), setting.path);
  }
  for (const endpoint of expected.endpoints) {
    for (const setting of endpoint.settings) {
      check(
        `${endpoint.endpoint}.${setting.path}`,
        setting.value,
        get(`${base}/${endpoint.endpoint}`),
        setting.path,
      );
    }
  }
  check("dependabot.alerts", null, get(`${base}/vulnerability-alerts`));
  const rules = list(reader, `${base}/rulesets`);
  for (const policy of expected.rulesets) {
    try {
      const matches = rules.ok
        ? records(rules.value).filter((rule) => rule["name"] === policy.name)
        : [];
      const matched = matches.length === 1 ? matches[0] : undefined;
      const id = matched?.["id"];
      if (typeof id !== "number" || !Number.isSafeInteger(id) || id < 1) {
        throw new Error("Missing ruleset");
      }
      const reply = get(`${base}/rulesets/${String(id)}`);
      check(`${policy.name}.target`, policy.target, reply, "target");
      check(`${policy.name}.enforcement`, "active", reply, "enforcement");
      check(`${policy.name}.bypass_actors`, policy.bypass, reply, "bypass_actors");
      check(`${policy.name}.include`, policy.include, reply, "conditions.ref_name.include");
      check(`${policy.name}.exclude`, [], reply, "conditions.ref_name.exclude");
      const detail = reply.ok ? record(reply.value) : {};
      const defined = records(detail["rules"]);
      for (const rule of policy.rules) {
        const [kind, ...path] = rule.path.split(".");
        const found = defined.find((item) => item["type"] === kind);
        const actual = path.length ? at(found, path.join(".")) : found !== undefined;
        const contexts =
          rule.path.endsWith(".required_status_checks") && Array.isArray(actual)
            ? records(actual)
                .map((item) => item["context"])
                .toSorted()
            : actual;
        const row = compare(
          `${policy.name}.${rule.path}`,
          rule.path.endsWith(".required_status_checks")
            ? expected.requiredChecks.toSorted()
            : Array.isArray(rule.value)
              ? rule.value.toSorted()
              : rule.value,
          contexts,
        );
        if (contexts === undefined) {
          row.status = "drift";
        }
        rows.push(row);
      }
    } catch {
      rows.push(
        compare(
          `ruleset.${policy.name}`,
          "active with required rules",
          rules.ok || rules.invalid ? "missing or malformed" : undefined,
        ),
      );
    }
  }
  const environment = get(`${base}/environments/release`);
  try {
    const value = environment.ok ? record(environment.value) : {};
    const protection = records(value["protection_rules"]);
    const reviewers = protection.find((rule) => rule["type"] === "required_reviewers");
    if (typeof reviewers?.["prevent_self_review"] !== "boolean") {
      throw new Error("Incomplete reviewer protection");
    }
    const owner = records(reviewers["reviewers"]).map((reviewer) => at(reviewer, "reviewer.login"));
    rows.push(compare("release.reviewers", [expected.releaseReviewer], owner));
    rows.push(compare("release.prevent_self_review", false, reviewers["prevent_self_review"]));
    const timer = protection.find((rule) => rule["type"] === "wait_timer");
    rows.push(
      compare(
        "release.wait_timer",
        0,
        timer === undefined
          ? 0
          : typeof timer["wait_timer"] === "number"
            ? timer["wait_timer"]
            : "malformed",
      ),
    );
    check(
      "release.custom_branch_policies",
      true,
      environment,
      "deployment_branch_policy.custom_branch_policies",
    );
    check(
      "release.protected_branches",
      false,
      environment,
      "deployment_branch_policy.protected_branches",
    );
    check("release.admin_bypass", false, environment, "can_admins_bypass");
  } catch {
    rows.push(
      compare(
        "release.environment",
        "required Owner review",
        environment.ok || environment.invalid ? "malformed" : undefined,
      ),
    );
  }
  const branches = list(
    reader,
    `${base}/environments/release/deployment-branch-policies`,
    "branch_policies",
  );
  try {
    rows.push(
      compare(
        "release.tags",
        [{ name: "v*", type: "tag" }],
        branches.ok
          ? records(branches.value).map((item) => ({ name: item["name"], type: item["type"] }))
          : undefined,
      ),
    );
  } catch {
    rows.push(
      compare(
        "release.tags",
        "v* tags only",
        branches.ok || branches.invalid ? "malformed" : undefined,
      ),
    );
  }
  const environments = list(reader, `${base}/environments`, "environments");
  try {
    const knownEnvironments = environments.ok ? records(environments.value) : undefined;
    rows.push(
      compare(
        "release.listed",
        true,
        knownEnvironments?.some((value) => value["name"] === "release"),
      ),
    );
    for (const environmentValue of knownEnvironments ?? []) {
      const name = environmentValue["name"];
      if (typeof name !== "string") {
        throw new Error("Invalid environment name");
      }
      const secrets = list(
        reader,
        `${base}/environments/${encodeURIComponent(name)}/secrets`,
        "secrets",
      );
      const allowed = name === "release" ? expected.releaseSecrets : [];
      const names = secrets.ok
        ? records(secrets.value)
            .map((item) => item["name"])
            .toSorted()
        : undefined;
      rows.push(compare(`environment.${name}.secret_names`, allowed.toSorted(), names));
    }
    if (!environments.ok) {
      throw new Error("Unknown environments");
    }
  } catch {
    rows.push(
      compare(
        "environment.secrets",
        "no secrets outside release",
        environments.ok || environments.invalid
          ? "malformed or unreadable environment secrets"
          : undefined,
      ),
    );
  }
  for (const [name, endpoint, key] of [
    ["repository.secret_names", "actions/secrets", "secrets"],
    ["repository.labels", "labels", ""],
  ]) {
    if (!name || !endpoint) {
      continue;
    }
    const reply = list(reader, `${base}/${endpoint}`, key === "" ? undefined : key);
    try {
      const items = reply.ok ? records(reply.value) : undefined;
      if (endpoint === "labels") {
        for (const label of labels) {
          const found = items?.find((item) => item["name"] === label.name);
          const row = compare(
            `label.${label.name}`,
            { color: label.color, description: label.description },
            found === undefined
              ? undefined
              : {
                  color:
                    typeof found["color"] === "string"
                      ? found["color"].toLowerCase()
                      : found["color"],
                  description: found["description"] ?? "",
                },
          );
          if ((items !== undefined && found === undefined) || (!reply.ok && reply.invalid)) {
            row.status = "drift";
          }
          rows.push(row);
        }
      } else {
        rows.push(
          compare(
            name,
            expected.allowedRepositorySecrets.toSorted(),
            items?.map((item) => item["name"]).toSorted(),
          ),
        );
      }
    } catch {
      rows.push(
        compare(name, "valid metadata", reply.ok || reply.invalid ? "malformed" : undefined),
      );
    }
  }
  // Organization-only controls remain unknown for personal repositories, never a fabricated pass.
  rows.push(
    compare(
      "manual.organization-or-personal-2fa-and-writer-permissions",
      "Owner verifies least privilege and 2FA",
      undefined,
    ),
  );
  rows.push(compare("manual.dependency_graph.enabled", true, undefined));
  return rows;
}
export function exitCode(rows: Row[], allowUnknown = false): number {
  return rows.some((row) => row.status === "drift" || (row.status === "unknown" && !allowUnknown))
    ? 1
    : 0;
}
