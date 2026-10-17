import { expect, test } from "vitest";
import { buildManifest, parseManifest } from "./manifest.ts";

const inputs = {
  version: "0.0.0",
  protocol: 1,
  buildSha: "123456789abc",
  node: "22.23.3",
  sha256: "1".repeat(64),
  sha256Unsigned: "2".repeat(64),
  bundleSha256: "3".repeat(64),
  companions: [
    { path: "engine/LICENSE", sha256: "4".repeat(64) },
    { path: "engine/engine.cjs.map", sha256: "5".repeat(64) },
  ],
  toolVersions: { esbuild: "0.28.2", node: "22.23.3", postject: "1.0.0-alpha.6" },
  runtimeLicenseStatus: "proposed",
  inputHashes: {
    runtimeLicenseLedger: "e".repeat(64),
    nodeArchive: "6".repeat(64),
    nodeLock: "7".repeat(64),
    pnpmLock: "8".repeat(64),
    entitlements: "9".repeat(64),
  },
};
test("manifest is deterministic, timestamp-free and rejects unsafe companion paths", () => {
  const output = buildManifest(inputs);
  const value = parseManifest(output);
  expect(value.schema).toBe(1);
  expect(value.createdBy).toBe("OVE_SETUP017");
  expect(value.target).toBe("aarch64-apple-darwin");
  expect(output.startsWith('{\n  "buildSha":')).toBe(true);
  expect(output).not.toContain("timestamp");
  expect(buildManifest({ ...inputs, companions: [...inputs.companions].reverse() })).toBe(output);
  expect(() =>
    buildManifest({ ...inputs, companions: [{ path: "../outside", sha256: "4".repeat(64) }] }),
  ).toThrow();
  expect(() => parseManifest(output.replace('"schema": 1', '"schema": 2'))).toThrow();
});
