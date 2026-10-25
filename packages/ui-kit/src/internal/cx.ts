// SPDX-License-Identifier: Apache-2.0
/** Join explicitly provided class names without adding a runtime dependency. */
export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter((part): part is string => typeof part === "string" && part !== "").join(" ");
}
