import { json, manifestSchema, type Manifest } from "./input.parse-boundary.ts";

function sorted(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sorted);
  }
  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b, "en"))
        .map(([key, item]) => [key, sorted(item)]),
    );
  }
  return value;
}
export function parseManifest(text: string): Manifest {
  return manifestSchema.parse(json(text));
}
export function buildManifest(inputs: unknown): string {
  if (typeof inputs !== "object" || inputs === null) {
    throw new Error("Invalid manifest inputs");
  }
  const manifest = manifestSchema.parse({
    ...inputs,
    schema: 1,
    name: "overmind-engine",
    target: "aarch64-apple-darwin",
    createdBy: "OVE_SETUP017",
  });
  manifest.companions.sort((a, b) => a.path.localeCompare(b.path, "en"));
  return `${JSON.stringify(sorted(manifest), null, 2)}\n`;
}
