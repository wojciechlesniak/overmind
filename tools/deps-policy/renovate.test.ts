import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { readBinaryLock } from "../pinned-bin/lock.parse-boundary.ts";
import { expect, it } from "vitest";
import { readRenovateConfig } from "./input.parse-boundary.ts";

const root = resolve(import.meta.dirname, "../..");
it("declares every coordinated update group and the compatible TypeScript ceiling", () => {
  const config = readRenovateConfig(root);
  const groups = new Set(config.packageRules.map((rule) => rule.groupName));
  for (const group of [
    "typescript-toolchain",
    "react",
    "tauri",
    "storybook",
    "vitest",
    "vite",
    "playwright",
    "commitlint",
    "github-actions",
    "rust-toolchain",
  ]) {
    expect(groups.has(group), group).toBe(true);
  }
  expect(
    config.packageRules.find(
      (rule) => rule.matchPackageNames?.includes("typescript") && rule.allowedVersions,
    )?.allowedVersions,
  ).toBe("<6.1.0");
  expect(
    config.packageRules.find((rule) => rule.matchFileNames?.includes("tools/pinned-bin/lock.json"))
      ?.dependencyDashboardApproval,
  ).toBe(true);
});
it.each([
  ["node", ".nvmrc", "node"],
  ["rhysd/actionlint", "tools/pinned-bin/lock.json", "actionlint"],
  ["zizmorcore/zizmor", "tools/pinned-bin/lock.json", "zizmor"],
  ["EmbarkStudios/cargo-deny", "tools/pinned-bin/lock.json", "cargo-deny"],
  ["rustsec/rustsec", "tools/pinned-bin/lock.json", "cargo-audit"],
  ["gitleaks/gitleaks", "tools/secret-scan/gitleaks.lock.json", "gitleaks"],
  ["anchore/syft", "tools/secret-scan/syft.lock.json", "syft"],
])("actual regex manager extracts the reviewed %s pin", (name, path, binary) => {
  const version =
    binary === "node"
      ? readFileSync(resolve(root, path), "utf8").trim()
      : readBinaryLock(resolve(root, path), binary).find((entry) => entry.name === binary)?.version;
  const manager = readRenovateConfig(root).customManagers.find(
    (item) => item.depNameTemplate === name,
  );
  expect(manager).toBeDefined();
  const regex = manager?.matchStrings[0];
  if (!regex) {
    throw new Error("Missing manager matcher");
  }
  expect(
    new RegExp(regex, "u").exec(readFileSync(resolve(root, path), "utf8"))?.groups?.[
      "currentValue"
    ],
  ).toBe(version);
});
