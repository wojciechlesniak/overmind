import { expect, it } from "vitest";
import { completeLicenseEvidence, validateSBOM } from "./validate.ts";
import { parseSBOM } from "./input.parse-boundary.ts";

function good() {
  return {
    bomFormat: "CycloneDX",
    specVersion: "1.6",
    components: ["react", "zod"].map((name) => ({
      name,
      version: "1.0.0",
      purl: `pkg:npm/${name}@1.0.0`,
      licenses: [{ license: { id: "MIT" } }],
    })),
  };
}
it("SBOM validation requires populated components, identity, licenses and actual ecosystem names", () => {
  expect(validateSBOM(good()).components).toHaveLength(2);
  for (const raw of [
    { ...good(), bomFormat: "unknown" },
    { ...good(), specVersion: "1.7" },
    { ...good(), components: [] },
    { ...good(), components: [{ name: "react", version: "", purl: "pkg:npm/react" }] },
    {
      ...good(),
      components: good().components.map((item) => ({
        name: item.name,
        version: item.version,
        purl: item.purl,
      })),
    },
    {
      ...good(),
      components: good().components.map((item) => ({
        ...item,
        purl: item.purl.replace("npm", "cargo"),
      })),
    },
  ]) {
    expect(() => validateSBOM(raw)).toThrow();
  }
  expect(() => validateSBOM(good(), true)).toThrow(/tauri/u);
});
it("only the exact engine manifest can supply a generic file component", () => {
  const digest = "1".repeat(64);
  const component = {
    type: "file",
    name: "overmind-engine.manifest.json",
    version: "0.0.0",
    purl: `pkg:generic/overmind-engine-manifest@0.0.0?checksum=sha256:${digest}`,
    hashes: [{ alg: "SHA-256", content: digest }],
    licenses: [{ license: { id: "Apache-2.0" } }],
    properties: [{ name: "overmind:engine-manifest", value: "{}" }],
  };
  expect(
    validateSBOM({ ...good(), components: [...good().components, component] }).components,
  ).toHaveLength(3);
  for (const change of [
    { name: "other.json" },
    { hashes: [] },
    { type: "library" },
    { purl: "pkg:npm/fake@1.0.0" },
    { hashes: [{ alg: "SHA-256", content: "2".repeat(64) }] },
  ]) {
    expect(() =>
      validateSBOM({ ...good(), components: [...good().components, { ...component, ...change }] }),
    ).toThrow();
  }
});
it("NOASSERTION is accepted only with explicit lockfile evidence, never as license permission", () => {
  const raw = {
    ...good(),
    components: good().components.map((item) => ({ ...item, licenses: [] })),
  };
  const documented = completeLicenseEvidence(parseSBOM(raw));
  expect(
    validateSBOM(documented).components.every((item) =>
      item.properties?.some((entry) => entry.value.includes("not license approval")),
    ),
  ).toBe(true);
  expect(() =>
    validateSBOM({
      ...documented,
      components: documented.components.map((item) => ({ ...item, properties: [] })),
    }),
  ).toThrow(/NOASSERTION/u);
});

it("only a verified local desktop stanza can supply a commit-qualified missing PURL", async () => {
  const { desktopWorkspaceIdentity } = await import("./input.parse-boundary.ts");
  const sha = "a".repeat(40);
  const lock =
    'version = 4\n\n[[package]]\nname = "overmind-desktop"\nversion = "0.0.0"\ndependencies = [\n "tauri",\n]\n';
  const workspace = desktopWorkspaceIdentity(lock, sha);
  expect(workspace).toEqual({ version: "0.0.0", sha });
  const local = {
    name: "overmind-desktop",
    version: "0.0.0",
    properties: [
      { name: "syft:package:foundBy", value: "rust-cargo-lock-cataloger" },
      { name: "syft:package:metadataType", value: "rust-cargo-lock-entry" },
      { name: "syft:location:0:path", value: "/apps/desktop/src-tauri/Cargo.lock" },
    ],
  };
  const raw = { ...good(), components: [...good().components, local] };
  expect(() => parseSBOM(raw)).toThrow();
  const document = completeLicenseEvidence(parseSBOM(raw, workspace));
  expect(validateSBOM(document).components.at(-1)?.purl).toBe(
    `pkg:cargo/overmind-desktop@0.0.0?vcs_url=git%2Bhttps:%2F%2Fgithub.com%2Fwojciechlesniak%2Fovermind%40${sha}#apps/desktop/src-tauri`,
  );
  const buildVersion = "0.0.0+local.1";
  const buildWorkspace = desktopWorkspaceIdentity(
    lock.replace('version = "0.0.0"', `version = "${buildVersion}"`),
    sha,
  );
  const buildDocument = parseSBOM(
    { ...raw, components: [...good().components, { ...local, version: buildVersion }] },
    buildWorkspace,
  );
  expect(buildDocument.components.at(-1)?.purl).toBe(
    `pkg:cargo/overmind-desktop@0.0.0%2Blocal.1?vcs_url=git%2Bhttps:%2F%2Fgithub.com%2Fwojciechlesniak%2Fovermind%40${sha}#apps/desktop/src-tauri`,
  );
  for (const change of [{ name: "foreign" }, { version: "9.9.9" }, { properties: [] }]) {
    expect(() =>
      parseSBOM({ ...raw, components: [...good().components, { ...local, ...change }] }, workspace),
    ).toThrow();
  }
  expect(() =>
    desktopWorkspaceIdentity(
      lock.replace(
        "dependencies = [",
        'source = "registry+https://example.invalid"\ndependencies = [',
      ),
      sha,
    ),
  ).toThrow();
  expect(() => desktopWorkspaceIdentity(lock + lock, sha)).toThrow();
  expect(() => desktopWorkspaceIdentity(lock, "invalid")).toThrow();
  expect(
    desktopWorkspaceIdentity(lock.replace("overmind-desktop", "another"), sha),
  ).toBeUndefined();
});
