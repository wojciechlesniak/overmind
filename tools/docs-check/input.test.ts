import { expect, it } from "vitest";
import { lintConfiguration } from "./input.parse-boundary.ts";

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
