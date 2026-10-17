import { lstatSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { hashFile, safeFile } from "./files.ts";
import { parseManifest } from "./manifest.ts";
import { json, parseNodeLock } from "./input.parse-boundary.ts";
import { parseRuntimeLedger, validateRuntimeLicense } from "./runtimeLicenses.parse-boundary.ts";

export function readEngineComponent(root: string, sha: string) {
  const out = resolve(root, "apps/desktop/src-tauri/binaries");
  const path = resolve(out, "overmind-engine.manifest.json");
  if (!lstatSync(path, { throwIfNoEntry: false })) {
    return undefined;
  }
  safeFile(root, path);
  if (lstatSync(path).size > 64 * 1024) {
    throw new Error("Engine manifest exceeds limit");
  }
  const manifest = parseManifest(readFileSync(path, "utf8"));
  const nodePath = safeFile(root, resolve(root, "tools/package-engine/node.lock.json"));
  const ledgerPath = safeFile(root, resolve(root, "tools/package-engine/runtime-licenses.json"));
  for (const [file, expected] of [
    [nodePath, manifest.inputHashes.nodeLock],
    [ledgerPath, manifest.inputHashes.runtimeLicenseLedger],
    [safeFile(root, resolve(root, "pnpm-lock.yaml")), manifest.inputHashes.pnpmLock],
  ] as const) {
    if (hashFile(file) !== expected) {
      throw new Error("Engine manifest input hash differs from current source");
    }
  }
  const lock = parseNodeLock(json(readFileSync(nodePath, "utf8")), manifest.node);
  const ledger = parseRuntimeLedger(json(readFileSync(ledgerPath, "utf8")));
  validateRuntimeLicense(
    ledger,
    {
      version: manifest.node,
      archiveSha256: manifest.inputHashes.nodeArchive,
      noticeSha256:
        manifest.companions.find((item) => item.path === "engine/LICENSE")?.sha256 ?? "",
      extractedMembers: [
        `node-v${lock.version}-darwin-arm64/bin/node`,
        `node-v${lock.version}-darwin-arm64/LICENSE`,
      ],
    },
    false,
  );
  if (
    manifest.inputHashes.nodeArchive !== lock.sha256 ||
    manifest.runtimeLicenseStatus !== ledger.status
  ) {
    throw new Error("Engine manifest runtime policy differs from current source");
  }
  if (
    !/^[a-f0-9]{40}$/u.test(sha) ||
    manifest.buildSha === "dev" ||
    !sha.startsWith(manifest.buildSha)
  ) {
    throw new Error("Engine manifest is stale for the SBOM commit");
  }
  if (
    hashFile(safeFile(root, resolve(out, "overmind-engine-aarch64-apple-darwin"))) !==
    manifest.sha256
  ) {
    throw new Error("Engine binary hash differs from manifest");
  }
  for (const entry of manifest.companions) {
    const file = safeFile(
      root,
      resolve(out, "overmind-engine.resources", entry.path.slice("engine/".length)),
      false,
      16000000,
    );
    if (hashFile(file) !== entry.sha256) {
      throw new Error("Engine resource hash differs from manifest");
    }
  }
  const digest = hashFile(path);
  return {
    type: "file" as const,
    name: "overmind-engine.manifest.json" as const,
    version: manifest.version,
    purl: `pkg:generic/overmind-engine-manifest@${manifest.version}?checksum=sha256:${digest}`,
    hashes: [{ alg: "SHA-256" as const, content: digest }],
    licenses: [{ license: { id: "Apache-2.0" as const } }],
    properties: [{ name: "overmind:engine-manifest", value: JSON.stringify(manifest) }],
  };
}
