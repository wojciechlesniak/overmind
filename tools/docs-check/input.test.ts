import { expect, it } from "vitest";
import { lintConfiguration, translationStatus } from "./input.parse-boundary.ts";

it("uses recognized YAML metadata and fails closed on unsupported or incomplete metadata", () => {
  expect(translationStatus("\uFEFF--- \t\r\nstatus: draft\r\n--- \t\r\n# Draft\r\n")).toBe("draft");
  expect(() => translationStatus("\uFEFF---\nstatus: draft\n...\n# Draft\n")).toThrow();
  expect(() => translationStatus("\uFEFF---\nstatus: draft\n")).toThrow();
  expect(() => translationStatus('+++\nstatus = "draft"\n+++\n# Draft\n')).toThrow();
  expect(() => translationStatus("---\nstatus: [draft]\n---\n# Draft\n")).toThrow();
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
