// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect } from "vitest";
import { RuleTester, Linter, type Rule } from "eslint";
import { parser } from "typescript-eslint";
import { noDisable } from "./no-disable.ts";
RuleTester.describe = describe;
RuleTester.it = it;
const other: Rule.RuleModule = {
  meta: { schema: [] },
  create() {
    return {};
  },
};
new RuleTester({ languageOptions: { parser }, plugins: { boundaries: { rules: { other } } } }).run(
  "noDisable",
  noDisable(import.meta.dirname),
  {
    valid: [
      'const text = "// eslint-disable boundaries/other";',
      "const text = `/* eslint boundaries/other: off */`;",
      "// explanation about eslint-disable boundaries/other\nexport {};",
      "// eslint-disable-next-line no-alert\nexport {};",
      "/* eslint no-alert: off */ export {};",
      '/* eslint no-restricted-syntax: ["error", {selector: "Identifier", message: "boundaries/other"}] */ export {};',
      String.raw`/* eslint "n\u006f-alert": off */ export {};`,
      "/* eslint no-alert: off -- reason mentions boundaries/other */ export {};",
    ],
    invalid: [
      {
        code: "/* eslint-disable boundaries/other */ export {};",
        errors: [{ messageId: "BOUNDARY_NO_DISABLE", line: 1, column: 1 }],
      },
      {
        code: "// eslint-disable-next-line boundaries/other\nexport {};",
        errors: [{ messageId: "BOUNDARY_NO_DISABLE", line: 1, column: 1 }],
      },
      {
        code: "export {}; // eslint-disable-line boundaries/other",
        errors: [{ messageId: "BOUNDARY_NO_DISABLE", line: 1, column: 12 }],
      },
      {
        code: "/* eslint boundaries/other: off */ export {};",
        errors: [{ messageId: "BOUNDARY_NO_DISABLE", line: 1, column: 1 }],
      },
    ],
  },
);
for (const comment of [
  String.raw`/* eslint 'bound\u0061ries/no-disable': off */`,
  String.raw`/* eslint no-alert: 0 "bound\u0061ries/no-disable": 0 */`,
  String.raw`/* eslint "bound\u0061ries/no-disable": off */`,
  "/* eslint-disable --- documented reason */",
  "/* eslint-disable -- documented reason */",
  "/* eslint-disable-next-line -- documented reason */",
  "/* eslint-disable */",
  "/* eslint-disable boundaries/no-disable */",
  "/* eslint boundaries/no-disable: off */",
]) {
  it("actual caller prevents inline bypass: " + comment, () => {
    const messages = new Linter().verify(
      comment + "\nexport {};",
      [
        {
          files: ["**/*.ts"],
          languageOptions: { parser },
          plugins: { boundaries: { rules: { "no-disable": noDisable(import.meta.dirname) } } },
          rules: { "boundaries/no-disable": "error" },
        },
      ],
      { filename: "fixture.ts", allowInlineConfig: false },
    );
    expect(
      messages.map(({ ruleId, messageId, line, column }) => ({ ruleId, messageId, line, column })),
    ).toEqual([
      { ruleId: "boundaries/no-disable", messageId: "BOUNDARY_NO_DISABLE", line: 1, column: 1 },
    ]);
  });
}

it("inline justification is data even when it names a boundary rule", () => {
  const messages = new Linter().verify(
    "/* eslint no-alert: off -- reason mentions boundaries/other */ export {};",
    [
      {
        files: ["**/*.ts"],
        languageOptions: { parser },
        plugins: { boundaries: { rules: { "no-disable": noDisable(import.meta.dirname) } } },
        rules: { "boundaries/no-disable": "error" },
      },
    ],
    { filename: "fixture.ts", allowInlineConfig: false },
  );
  expect(messages).toEqual([]);
});

it("an escaped literal backslash is not a recursively decoded rule key", () => {
  const comment = String.raw`/* eslint "bound\\u0061ries/other": off */ export {};`;
  const messages = new Linter().verify(
    comment,
    [
      {
        files: ["**/*.ts"],
        languageOptions: { parser },
        plugins: { boundaries: { rules: { "no-disable": noDisable(import.meta.dirname) } } },
        rules: { "boundaries/no-disable": "error" },
      },
    ],
    { filename: "fixture.ts", allowInlineConfig: false },
  );
  expect(messages).toEqual([]);
});
