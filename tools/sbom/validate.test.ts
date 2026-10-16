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
