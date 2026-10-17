import { expect, test } from "vitest";
import { approvedCatalogPin, planSteps, validateEntitlements } from "./policy.ts";
import { parseNodeLock } from "./input.parse-boundary.ts";

test("only the approved postject prerelease can pass the exact catalog guard", () => {
  expect(approvedCatalogPin("postject", "1.0.0-alpha.6")).toBe(true);
  for (const [name, version] of [
    ["postject", "1.0.0-alpha.7"],
    ["another", "1.0.0-alpha.6"],
    ["postject", "^1.0.0-alpha.6"],
    ["another", "latest"],
  ]) {
    expect(approvedCatalogPin(name!, version!)).toBe(false);
  }
  expect(approvedCatalogPin("esbuild", "0.28.2")).toBe(true);
});

test("only JIT is granted and unknown packaging variants fail closed", () => {
  expect(() => {
    validateEntitlements({ "com.apple.security.cs.allow-jit": true });
  }).not.toThrow();
  for (const key of [
    "com.apple.security.cs.disable-library-validation",
    "com.apple.security.cs.allow-dyld-environment-variables",
    "com.apple.security.get-task-allow",
    "com.apple.security.cs.debugger",
    "com.apple.security.cs.allow-unsigned-executable-memory",
  ]) {
    expect(() => {
      validateEntitlements({ "com.apple.security.cs.allow-jit": true, [key]: true });
    }).toThrow();
  }
  expect(() => {
    validateEntitlements({ "com.apple.security.cs.allow-jit": false });
  }).toThrow();
  expect(planSteps("node-sea")).toEqual([
    "bundle",
    "fetch-runtime",
    "sea-blob",
    "inject",
    "sign",
    "verify",
    "manifest",
  ]);
  expect(() => planSteps("bun")).toThrow();
});

test("runtime acquisition rejects a mismatched version or unofficial URL before download", () => {
  const lock = {
    version: "22.23.3",
    target: "darwin-arm64",
    url: "https://nodejs.org/dist/v22.23.3/node-v22.23.3-darwin-arm64.tar.gz",
    sha256: "a".repeat(64),
    signerFingerprint: "5BE8A3F6C8A5C01D106C0AD820B1A390B168D356",
  };
  expect(parseNodeLock(lock, "22.23.3\n").version).toBe("22.23.3");
  expect(() => parseNodeLock(lock, "22.23.4")).toThrow();
  expect(() =>
    parseNodeLock({ ...lock, url: "https://example.com/node.tar.gz" }, "22.23.3"),
  ).toThrow();
  expect(() => parseNodeLock({ ...lock, sha256: "invalid" }, "22.23.3")).toThrow();
  expect(() => parseNodeLock({ ...lock, extra: true }, "22.23.3")).toThrow();
});
