// SPDX-License-Identifier: Apache-2.0
import { afterAll, describe, expect, it } from "vitest";
import { Linter } from "eslint";
import { parser } from "typescript-eslint";
import { structuralWorkspace } from "./structuralWorkspace.ts";
import { noForbiddenGlobals } from "./no-forbidden-globals.ts";
const fixture = structuralWorkspace();
afterAll(() => {
  fixture.cleanup();
});
let counter = 0;
function check(code: string, path = "packages/domain/src", test = false) {
  const filename = fixture.write(
    `${path}/global-${String(counter++)}${test ? ".test" : ""}.ts`,
    code,
  );
  return new Linter({ cwd: fixture.root }).verify(
    code,
    [
      {
        files: ["**/*.ts"],
        languageOptions: { parser },
        plugins: { boundaries: { rules: { capability: noForbiddenGlobals(fixture.root) } } },
        rules: { "boundaries/capability": "error" },
      },
    ],
    { filename, allowInlineConfig: false },
  );
}
describe("OVE_ARCH020: forbidden ambient capabilities", () => {
  const denied = [
    "const [,D] = [,Date]; new D();",
    "const holder = {}; const alias = holder; alias.clock = Date; new holder.clock();",
    "new Date(...[]);",

    "Date.now();",
    "new Date();",
    "Date();",
    "Math.random();",
    "process.env;",
    "fetch('fixture');",
    "console.log('fixture');",
    "setTimeout(task, 0);",
    "setInterval(task, 0);",
    "eval('fixture');",
    "new Function('fixture');",
    "Function('fixture');",
    "globalThis.Date.now();",
    "window.Math.random();",
    "self.fetch('fixture');",
    "global.process.env;",
    "globalThis['Date']['now']();",
    "new globalThis['Date']();",
    "new globalThis['Function']('fixture');",
    "Math[name]();",
    "globalThis[name]();",
    "const D = Date; new D();",
    "const M = Math; M.random();",
    "let M; M = Math; M.random();",
    "const { random: draw } = Math; draw();",
    "const { Date: D } = globalThis; new D();",
    "let draw; ({random: draw} = Math); draw();",
    "const [{now: clock}] = [Date]; clock();",
    "const box = { clock: Date }; new box.clock();",
    "const box = {}; box.clock = Date; new box.clock();",
    "const box = { nested: { clock: Date } }; new box.nested.clock();",
    "const g = globalThis; const h = g; h.Math.random();",
    "const D = Date.bind(null); new D();",
    "const D = flag ? Date : LocalDate; new D();",
    "declare const Math: { random(): number }; Math.random();",
    "declare const Date: { now(): number }; Date.now();",
    "declare namespace console { function log(v: string): void; } console.log('fixture');",
    "import type { Date } from 'fixture'; new Date();",
    "type Math = {}; Math.random();",
    "consume(globalThis);",
    "consume(Math);",
    "consume(process);",
    "const o = { value: globalThis }; consume(o);",
    "const value = { Math }; value.Math.random();",
    "const { ...M } = Math; M.random();",
    "const box = {}; box.clock = Date; const alias = box; new alias.clock();",
    "const g = globalThis; g?.Date.now();",
  ];
  for (const code of denied) {
    it(`denies ${code}`, () => {
      const messages = check(code);
      expect(messages.length).toBeGreaterThan(0);
      expect(messages.every((message) => message.messageId === "BOUNDARY_FORBIDDEN_GLOBAL")).toBe(
        true,
      );
      expect(
        new Set(messages.map((message) => `${String(message.line)}:${String(message.column)}`))
          .size,
      ).toBe(messages.length);
    });
  }
  for (const code of [
    "new (<DateConstructor>Date)(0);",
    "const [,D] = [,Date]; new D(0);",
    "new Date('2020-01-01');",
    "new Date(0);",
    "const D = Date; new D(0);",
    "const D = Date.bind(null); new D(0);",
    "Math.floor(1.5);",
    "function run(Date: { now(): number }) { Date.now(); }",
    "const Math = { random: () => 0 }; Math.random();",
    "const fetch = () => 0; fetch();",
    "function run(console: { log(): void }) { console.log(); }",
    "const process = { env: {} }; process.env;",
    "function run(globalThis: { fetch(): void }) { globalThis.fetch(); }",
    "const value = { fetch() {} }; value.fetch();",
    "const value = { now: 1, random: 2, console: 3 }; value.now;",
    "class Date { static now() { return 1; } } Date.now();",
    "const value = 'Math.random()';",
    "type X = { Date: string; random: string };",
    "const {random: local} = {random: () => 1}; local();",
  ]) {
    it(`preserves local or deterministic use ${code}`, () => {
      expect(check(code)).toEqual([]);
    });
  }
  it("a runtime binding in another source file cannot hide an ambient reference", () => {
    fixture.write("packages/domain/src/other.ts", "const Math = { random: () => 0 };\n");
    expect(check("Math.random();").map((message) => message.messageId)).toEqual([
      "BOUNDARY_FORBIDDEN_GLOBAL",
    ]);
  });
  it("does not exempt tests from ambient capability policy", () => {
    expect(
      check("Date.now();", "packages/domain/src", true).map((message) => message.messageId),
    ).toEqual(["BOUNDARY_FORBIDDEN_GLOBAL"]);
  });
  it("does not duplicate a member-name diagnostic", () => {
    expect(
      check("console.log('fixture');").map((message) => [message.messageId, message.column]),
    ).toEqual([["BOUNDARY_FORBIDDEN_GLOBAL", 1]]);
  });
  it("reads package-specific canonical policy", () => {
    expect(check("Date.now(); Math.random();", "packages/adapters/system/src")).toEqual([]);
  });
});
