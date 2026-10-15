import { RuleTester } from "eslint";
import { test } from "node:test";
import rule from "./no-focused-tests.mjs";

await test("focused tests are forbidden and skips require an immediately preceding task reference", () => {
  const tester = new RuleTester({
    languageOptions: { ecmaVersion: "latest", sourceType: "module" },
  });
  tester.run("no-focused-tests", rule, {
    valid: [
      "test('works', () => {});",
      "// skip: OVE_TEST001\ntest.skip('later', () => {});",
      "// skip: OVE_TEST001\ndescribe.skip('later', () => {});",
      "other.only();",
    ],
    invalid: [
      ...[
        "describe.only('x', () => {});",
        "it.only('x', () => {});",
        "test.concurrent.only('x', () => {});",
        "test['only']('x', () => {});",
        "// skip: OVE_TEST001\ntest.only('x', () => {});",
      ].map((code) => ({ code, errors: [{ messageId: "focused" }] })),
      ...[
        "test.skip('x', () => {});",
        "// skip: invalid\nit.skip('x', () => {});",
        "// skip: OVE_TEST001\n\nit.skip('x', () => {});",
      ].map((code) => ({ code, errors: [{ messageId: "skipped" }] })),
    ],
  });
});
