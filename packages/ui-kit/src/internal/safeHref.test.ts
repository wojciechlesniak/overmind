// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from "vitest";
import { safeHref } from "./safeHref.ts";

describe("safeHref", () => {
  it.each([
    "https://a.b",
    "http://a.b/path?query=value#section",
    "HTTPS://a.b",
    "mailto:a@b.c",
    "MAILTO:a@b.c?subject=Hello",
    "tel:+48123456789",
    "/x",
    "/",
    "./x",
    "../x",
    "../../x",
    "#y",
    "#",
    "?query=value",
    "?",
  ])("accepts allowed reference %s", (href) => {
    expect(safeHref(href)).toBe(href);
  });

  it.each([
    undefined,
    "",
    "   ",
    "javascript:alert(1)",
    "JaVaScRiPt:alert(1)",
    "  JaVa\nScript:alert(1)",
    "java\tscript:alert(1)",
    "java\rscript:alert(1)",
    "\u0000javascript:alert(1)",
    "java\u001fscript:alert(1)",
    "vbscript:msgbox(1)",
    "data:text/html,<script></script>",
    "file:///etc/passwd",
    "ftp://a.b",
    "blob:https://a.b/id",
    "//evil.example",
    " /\n/evil.example ",
    "/\\evil.example",
    "\\\\evil.example",
    "example.com",
    "%6aavascript:alert(1)",
    "javascript%3Aalert(1)",
    "java script:alert(1)",
    "\u200bjavascript:alert(1)",
  ])("drops denied reference %s", (href) => {
    expect(safeHref(href)).toBeUndefined();
  });

  it("returns a normalized allowed URL rather than retaining hidden controls", () => {
    expect(safeHref(" \t HTTPS://a.b/path\r\n ")).toBe("HTTPS://a.b/path");
  });

  it.each(["//evil.example", "/\\evil.example", "/\n/evil.example"])(
    "rejects a reference the browser would resolve to another host: %s",
    (href) => {
      expect(new URL(href, "https://app.example/").host).toBe("evil.example");
      expect(safeHref(href)).toBeUndefined();
    },
  );
});

describe("safeHref malformed references", () => {
  it.each([
    "http:",
    "https://",
    "https:example.com",
    "https:/example.com",
    "https://[invalid",
    "https://example.com:invalid",
    "http://\u0000evil.example",
    "https://good.example\\evil",
    "/docs\ntopic",
    "mailto:",
    "tel:",
    "ma\tilto:contact@example.com",
  ])("drops malformed input %s", (href) => {
    expect(safeHref(href)).toBeUndefined();
  });
});
