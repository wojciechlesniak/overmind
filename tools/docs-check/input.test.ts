import { expect, it } from "vitest";
import { lintConfiguration, translationStatus } from "./input.parse-boundary.ts";

it("recognizes front-matter end markers and fails closed on incomplete metadata", () => {
  expect(translationStatus("\uFEFF---\nstatus: draft\n...\n# Draft\n")).toBe("draft");
  expect(() => translationStatus("\uFEFF---\nstatus: draft\n")).toThrow();
});

it("accepts JSONC comments and trailing commas while preserving quoted data and denying executable config", () => {
  expect(
    lintConfiguration(
      '{/* reviewed */"config":{"MD013":false,"MD044":{"names":["https://example.test/a,b]",],},},"ignores":[],}',
    ),
  ).toEqual({ MD013: false, MD044: { names: ["https://example.test/a,b]"] } });
  expect(() =>
    lintConfiguration('{"config":{},"ignores":[],"customRules":["untrusted.js"]}'),
  ).toThrow();
  expect(() => lintConfiguration('{"config":{},"ignores":[],/*')).toThrow();
});
