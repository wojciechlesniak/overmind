import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "vitest";
import { parseRuntimeLedger, validateRuntimeLicense } from "./runtimeLicenses.parse-boundary.ts";
import { json } from "./input.parse-boundary.ts";

test("binary-only approval admits only the exact reviewed identity and denies missing decisions", () => {
  const actual = parseRuntimeLedger(
    json(readFileSync(resolve(import.meta.dirname, "runtime-licenses.json"), "utf8")),
  );
  const ledger = parseRuntimeLedger({ ...actual, status: "proposed", ownerDecision: null });
  const identity = {
    version: "22.23.3",
    archiveSha256: "23b25245dcfb9af7262f8ff142e9e2e0af025368117329e7a7458a51e5922f53",
    noticeSha256: "c738ae413cf561f174e34f6961f8ca458aae2369a73640dda6234c629b98bcc4",
    extractedMembers: ["node-v22.23.3-darwin-arm64/bin/node", "node-v22.23.3-darwin-arm64/LICENSE"],
  };
  expect(ledger.status).toBe("proposed");
  expect(() => {
    validateRuntimeLicense(ledger, identity);
  }).toThrow("Owner approval is pending");
  expect(() => {
    validateRuntimeLicense(ledger, identity, false);
  }).not.toThrow();
  const approved = parseRuntimeLedger({
    ...ledger,
    status: "approved",
    ownerDecision:
      "2026-10-17: The Owner explicitly approved this exact binary-only fixture scope.",
  });
  expect(() => {
    validateRuntimeLicense(approved, identity);
  }).not.toThrow();
  expect(actual.status).toBe("approved");
  expect(actual.ownerDecision).toContain("2026-10-17");
  expect(() => {
    validateRuntimeLicense(actual, identity);
  }).not.toThrow();
  for (const change of [
    { version: "22.23.4" },
    { archiveSha256: "a".repeat(64) },
    { noticeSha256: "b".repeat(64) },
    {
      extractedMembers: [
        ...identity.extractedMembers,
        "node-v22.23.3-darwin-arm64/lib/node_modules/npm/index.js",
      ],
    },
  ]) {
    expect(() => {
      validateRuntimeLicense(ledger, { ...identity, ...change }, false);
    }).toThrow();
    expect(() => {
      validateRuntimeLicense(approved, { ...identity, ...change });
    }).toThrow();
  }
  for (const ownerDecision of [null, undefined, ""]) {
    expect(() => parseRuntimeLedger({ ...ledger, status: "approved", ownerDecision })).toThrow();
  }
  expect(() =>
    parseRuntimeLedger({ ...approved, additionalTerms: [...approved.additionalTerms, "MIT"] }),
  ).toThrow();
});
