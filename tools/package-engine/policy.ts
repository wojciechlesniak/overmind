export function approvedCatalogPin(name: string, version: string): boolean {
  return /^\d+\.\d+\.\d+$/u.test(version) || (name === "postject" && version === "1.0.0-alpha.6");
}

export function validateEntitlements(value: unknown): void {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    Object.keys(value).length !== 1 ||
    !("com.apple.security.cs.allow-jit" in value) ||
    value["com.apple.security.cs.allow-jit"] !== true
  ) {
    throw new Error("Engine entitlements must grant only allow-jit");
  }
}

export const stepNames = [
  "bundle",
  "fetch-runtime",
  "sea-blob",
  "inject",
  "sign",
  "verify",
  "manifest",
] as const;
export type StepName = (typeof stepNames)[number];
export function planSteps(variant: string): readonly StepName[] {
  if (variant !== "node-sea") {
    throw new Error("Unsupported engine packaging variant");
  }
  return stepNames;
}
