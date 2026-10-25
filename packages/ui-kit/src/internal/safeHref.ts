// SPDX-License-Identifier: Apache-2.0
/** Validate untrusted references without navigating or evaluating them. */
export function safeHref(href: string | undefined): string | undefined {
  if (typeof href !== "string") {
    return undefined;
  }
  const candidate = href.trim();
  const malformed = Array.from(candidate).some((character) => {
    const code = character.charCodeAt(0);
    return code < 32 || code === 127 || character === "\\";
  });
  if (!candidate || malformed || candidate.startsWith("//")) {
    return undefined;
  }
  if (/^https?:\/\//iu.test(candidate)) {
    try {
      return new URL(candidate).hostname ? candidate : undefined;
    } catch {
      return undefined;
    }
  }
  if (/^(?:mailto|tel):.+/iu.test(candidate) || /^(?:\/|\.\/|\.\.\/|#|\?)/u.test(candidate)) {
    return candidate;
  }
  return undefined;
}
