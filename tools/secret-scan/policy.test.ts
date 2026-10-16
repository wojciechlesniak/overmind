import { readFileSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { expect, it } from "vitest";
import { readBinaryLock } from "../pinned-bin/lock.parse-boundary.ts";
import { compileGitleaksConfig } from "./config.ts";
import { readSecretCounts } from "./report.parse-boundary.ts";

it("repository allow-list is only the conjunction of fake fixture path and same-line marker", () => {
  const config = readFileSync(resolve(import.meta.dirname, "../../.gitleaks.toml"), "utf8");
  expect(config.match(/^\[\[allowlists\]\]$/gmu)).toHaveLength(1);
  expect(config).not.toMatch(/(?:commits|stopwords|disabledRules)\s*=/u);
  expect(config).not.toMatch(/\[(?:rules\.)?allowlist\]/u);
  const table = config.split("[[allowlists]]")[1]?.split("[[rules]]")[0];
  expect(table).toContain('condition = "AND"');
  expect(table).toContain("paths = ['''^(?:.*/)?fixtures/secrets/.*$''']");
  expect(table).toContain('regexTarget = "line"');
  expect(table).toContain("regexes = ['''OVERMIND_FAKE_SECRET''']");
  expect(config).toContain("useDefault = true");
});
it("both security binaries have mature publisher versions and checksums for both supported platforms", () => {
  for (const name of ["gitleaks", "syft"]) {
    const entry = readBinaryLock(resolve(import.meta.dirname, `${name}.lock.json`), name)[0];
    expect(entry?.assets["linux-x64"]?.url).toMatch(/^https:\/\/github\.com\//u);
    expect(entry?.assets["darwin-arm64"]?.sha256).toMatch(/^[a-f0-9]{64}$/u);
  }
});
it("malformed scan reports fail closed and only the specific Keychain guard is warning-only", () => {
  const fixture = mkdtempSync(resolve(tmpdir(), "overmind-secret-report-"));
  const path = resolve(fixture, "report.json");
  try {
    writeFileSync(
      path,
      JSON.stringify({
        version: "2.1.0",
        runs: [
          {
            results: [
              { ruleId: "overmind-keychain-ref-guard" },
              { ruleId: "overmind-telegram-bot-token" },
            ],
          },
        ],
      }),
    );
    expect(readSecretCounts(path)).toEqual({ findings: 1, warnings: 1 });
    for (const text of [
      "not json",
      '{"version":"2.1.0","runs":[]}',
      '{"version":"2.1.0","runs":[{}]}',
    ]) {
      writeFileSync(path, text);
      expect(() => readSecretCounts(path)).toThrow();
    }
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});

it("effective configuration preserves default entropy rules while removing upstream global exclusions", () => {
  const policy = readFileSync(resolve(import.meta.dirname, "../../.gitleaks.toml"), "utf8");
  const rules =
    '[[rules]]\nid = "fixture-default"\nentropy = 3.5\n[rules.allowlist]\nregexes = ["provider-specific"]\n';
  const compiled = compileGitleaksConfig(
    '[allowlist]\npaths = ["broad-lockfiles"]\n' + rules,
    policy,
  );
  expect(compiled).toContain(rules);
  expect(compiled).not.toContain("broad-lockfiles");
  expect(compiled).not.toContain("useDefault");
  expect(compiled.match(/^\[\[allowlists\]\]$/gmu)).toHaveLength(1);
  expect(() => compileGitleaksConfig(rules + "[allowlist]\n", policy)).toThrow("global");
});
