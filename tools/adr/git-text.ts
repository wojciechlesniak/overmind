/** Decode Git data without replacing invalid bytes or removing an original BOM. */
export function decodeGitText(source: Uint8Array): string {
  try {
    return new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(source);
  } catch {
    throw new Error("ADR Git text is not valid UTF-8");
  }
}
