import { fileURLToPath } from "node:url";
import { realpathSync } from "node:fs";
import { parseSBOM, readSBOM, type SBOM } from "./input.parse-boundary.ts";
export const missingLicenseReason =
  "Lockfiles do not declare package licenses; NOASSERTION is not license approval. check:licenses is the separate policy gate.";

export function completeLicenseEvidence(document: SBOM): SBOM {
  return {
    ...document,
    components: document.components.map((component) =>
      component.licenses?.length
        ? component
        : {
            ...component,
            licenses: [{ license: { name: "NOASSERTION" } }],
            properties: [
              ...(component.properties ?? []),
              { name: "overmind:license-evidence", value: missingLicenseReason },
            ],
          },
    ),
  };
}
export function validateSBOM(raw: unknown, hasRust = false): SBOM {
  const document = parseSBOM(raw);
  for (const component of document.components) {
    if (!component.licenses?.length) {
      throw new Error("Component has no license evidence");
    }
    if (
      component.licenses.some(
        (item) =>
          ("expression" in item && item.expression === "NOASSERTION") ||
          ("license" in item &&
            (item.license.name === "NOASSERTION" || item.license.id === "NOASSERTION")),
      ) &&
      !component.properties?.some(
        (item) => item.name === "overmind:license-evidence" && item.value === missingLicenseReason,
      )
    ) {
      throw new Error("NOASSERTION requires a documented evidence reason");
    }
  }
  for (const purl of ["pkg:npm/react@", "pkg:npm/zod@", ...(hasRust ? ["pkg:cargo/tauri@"] : [])]) {
    if (!document.components.some((item) => item.purl.startsWith(purl))) {
      throw new Error(`Required SBOM component is absent: ${purl}`);
    }
  }
  return document;
}
if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const path = process.argv[2];
  if (!path) {
    throw new Error("SBOM path is required");
  }
  const document = validateSBOM(readSBOM(path), process.argv.includes("--rust"));
  console.log(`Validated ${String(document.components.length)} SBOM components`);
}
