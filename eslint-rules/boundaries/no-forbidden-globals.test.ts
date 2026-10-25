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
    "const holder = {}; const alias = holder; const other = alias; other.clock = Date; new holder.clock();",
    "const holder = {}; const alias = holder; alias['clock'] = Date; new holder.clock();",
    "const holder = {nested: {}}; const alias = holder.nested; alias.clock = Date; new holder.nested.clock();",
    "const holder = {nested: {}}; const {nested: alias} = holder; alias.clock = Date; new holder.nested.clock();",
    "let holder = {}; const alias = holder; holder = alias; alias.clock = Date; new holder.clock();",
    "const holder = {}; const alias = (holder as typeof holder); alias.clock = Date; new holder.clock();",
    "new Date(...[...[]]);",
    "new Date(...[...[...[]]]);",
    "new Date(...unknownArguments);",
    "Date.constructor(source);",
    "Date['constructor'](source);",
    "const D = Date; D.constructor(source);",
    "const expose = () => globalThis; consume(expose());",
    "const expose = () => ({ value: globalThis }); consume(expose());",
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
    "const holder = {}; const alias = holder; alias.clock = Date; new holder.clock(0);",
    "const holder = {}; const alias = holder; const other = alias; other.clock = Date; new holder.clock(0);",
    "const holder = {}; const alias = holder; alias['clock'] = Date; new holder.clock(0);",
    "const holder = {nested: {}}; const alias = holder.nested; alias.clock = Date; new holder.nested.clock(0);",
    "const holder = {nested: {}}; const {nested: alias} = holder; alias.clock = Date; new holder.nested.clock(0);",
    "let holder = {}; const alias = holder; holder = alias; alias.clock = Date; new holder.clock(0);",
    "const holder = {}; const alias = (holder as typeof holder); alias.clock = Date; new holder.clock(0);",
    "const box = {}; box.clock = Date; new box.clock(0);",
    "const box = {}; box.clock = Date; const alias = box; new alias.clock(0);",
    "new Date(...[...[0]]);",
    "new Date(...[,]);",
    "new Date(...([...[0]] as const));",
    "const Date = { constructor: (source: string) => source }; Date.constructor(source);",
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
  it("denies indirect Function construction when ordinary Date access is allowed", () => {
    for (const code of [
      "Date.constructor(source);",
      "Date['constructor'](source);",
      "Date[key](source);",
    ]) {
      expect(
        check(code, "packages/adapters/system/src").map((message) => message.messageId),
      ).toEqual(["BOUNDARY_FORBIDDEN_GLOBAL"]);
    }
  });
  it("reads package-specific canonical policy", () => {
    expect(check("Date.now(); Math.random();", "packages/adapters/system/src")).toEqual([]);
  });
});

const keyWrappers = [
  (value: string) => `(${value})`,
  (value: string) => `(${value} as const)`,
  (value: string) => `(<string>${value})`,
  (value: string) => `(${value}!)`,
  (value: string) => `(${value} satisfies string)`,
];
describe("OVE_ARCH020: computed key precision", () => {
  for (const wrap of keyWrappers) {
    const allowed = [
      `Math[${wrap('"floor"')}](1.5);`,
      `globalThis[${wrap('"Math"')}].floor(1.5);`,
      `const { [${wrap('"floor"')}]: floor } = Math; floor(1.5);`,
      `const box = {[${wrap('"clock"')}]: Date}; new box.clock(0);`,
    ];
    for (const code of allowed) {
      it(`retains precise deterministic computed key ${code}`, () => {
        expect(check(code)).toEqual([]);
      });
    }
    const denied = [
      `Math[${wrap('"random"')}]();`,
      `globalThis[${wrap('"Math"')}].random();`,
      `const { [${wrap('"random"')}]: draw } = Math; draw();`,
      `const box = {[${wrap('"clock"')}]: Date}; new box.clock();`,
      `const method = "floor"; Math[${wrap("method")}](1.5);`,
    ];
    for (const code of denied) {
      it(`retains denied computed capability ${code}`, () => {
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
  }
});

describe("OVE_ARCH020: review regression cases", () => {
  const cases = [
    {
      code: "const [...ctors] = [Date]; new ctors[0]();",
      allowed: false,
      path: "packages/domain/src",
    },
    {
      code: "const [...ctors] = [Date]; new ctors[0](0);",
      allowed: true,
      path: "packages/domain/src",
    },
    {
      code: "const [,...ctors] = [LocalDate,Date]; new ctors[0]();",
      allowed: false,
      path: "packages/domain/src",
    },
    {
      code: "const [,...ctors] = [LocalDate,Date]; new ctors[0](0);",
      allowed: true,
      path: "packages/domain/src",
    },
    {
      code: "let ctors; [...ctors] = [Date]; new ctors[0]();",
      allowed: false,
      path: "packages/domain/src",
    },
    {
      code: "let ctors; [...ctors] = [Date]; new ctors[0](0);",
      allowed: true,
      path: "packages/domain/src",
    },
    {
      code: "const [...ctors] = [Date]; const D = ctors[0]; new D();",
      allowed: false,
      path: "packages/domain/src",
    },
    {
      code: "const [...ctors] = [Date]; const D = ctors[0]; new D(0);",
      allowed: true,
      path: "packages/domain/src",
    },
    {
      code: "function fixed(D = Date) { return new D(0); } fixed();",
      allowed: true,
      path: "packages/domain/src",
    },
    {
      code: "function fixed(D = Date) { return new D(); } fixed();",
      allowed: false,
      path: "packages/domain/src",
    },
    {
      code: "function fixed(D = globalThis.Date) { return new D(0); } fixed();",
      allowed: true,
      path: "packages/domain/src",
    },
    {
      code: "function fixed(D = globalThis.Date) { return new D(); } fixed();",
      allowed: false,
      path: "packages/domain/src",
    },
    {
      code: "const fixed = (D = Date) => new D(0); fixed();",
      allowed: true,
      path: "packages/domain/src",
    },
    {
      code: "const fixed = (D = Date) => new D(); fixed();",
      allowed: false,
      path: "packages/domain/src",
    },
    {
      code: "function clock(D = Date) { return D.now(); } clock();",
      allowed: false,
      path: "packages/domain/src",
    },
    {
      code: "function local(Date: {new(v?:number): unknown}, D = Date) { return new D(); }",
      allowed: true,
      path: "packages/domain/src",
    },
    {
      code: "function local(D = class {}) { return new D(); } local();",
      allowed: true,
      path: "packages/domain/src",
    },
    {
      code: "Date.now.constructor(source);",
      allowed: false,
      path: "packages/adapters/system/src",
    },
    {
      code: 'Date["now"]["constructor"](source);',
      allowed: false,
      path: "packages/adapters/system/src",
    },
    {
      code: "const clock = Date.now; clock.constructor(source);",
      allowed: false,
      path: "packages/adapters/system/src",
    },
    {
      code: 'const {now: clock} = Date; clock["constructor"](source);',
      allowed: false,
      path: "packages/adapters/system/src",
    },
    {
      code: "const {constructor: build} = Date.now; build(source);",
      allowed: false,
      path: "packages/adapters/system/src",
    },
    {
      code: "Date.parse.constructor(source);",
      allowed: false,
      path: "packages/adapters/system/src",
    },
    {
      code: "Date.UTC.constructor(source);",
      allowed: false,
      path: "packages/adapters/system/src",
    },
    {
      code: "const Date = {now: {constructor: (value: string) => value}}; Date.now.constructor(source);",
      allowed: true,
      path: "packages/adapters/system/src",
    },
    {
      code: 'Date.now(); Date.parse("2020-01-01"); Date.UTC(2020,0,1);',
      allowed: true,
      path: "packages/adapters/system/src",
    },
    {
      code: "const clock = Date.now; clock();",
      allowed: true,
      path: "packages/adapters/system/src",
    },
  ] as const;
  for (const { code, allowed, path } of cases) {
    it(`${allowed ? "permits deterministic or local" : "denies ambient"} review regression ${code}`, () => {
      const messages = check(code, path);
      if (allowed) {
        expect(messages).toEqual([]);
      } else {
        expect(messages.length).toBeGreaterThan(0);
        expect(messages.every((message) => message.messageId === "BOUNDARY_FORBIDDEN_GLOBAL")).toBe(
          true,
        );
        expect(
          new Set(messages.map((message) => `${String(message.line)}:${String(message.column)}`))
            .size,
        ).toBe(messages.length);
      }
    });
  }
});

describe("OVE_ARCH020: review rest precision controls", () => {
  for (const code of [
    "const [,...ctors] = [Date,LocalDate]; new ctors[0]();",
    "const [...ctors] = [Date,LocalDate]; new ctors[1]();",
  ]) {
    it(`preserves the exact copied rest element ${code}`, () => {
      expect(check(code)).toEqual([]);
    });
  }
  for (const method of ["call", "apply", "bind"]) {
    it(`denies Date method intrinsic ${method} constructor`, () => {
      expect(
        check(`Date.now.${method}.constructor(source);`, "packages/adapters/system/src").map(
          (message) => message.messageId,
        ),
      ).toEqual(["BOUNDARY_FORBIDDEN_GLOBAL"]);
    });
  }
});

describe("OVE_ARCH020: Date prototype identity", () => {
  const denied = [
    "new Date.prototype.constructor();",
    "Date.prototype.constructor(0);",
    'new Date["prototype"]["constructor"]();',
    "new (globalThis.Date.prototype.constructor)();",
    "const D = Date.prototype.constructor; new D();",
    "const {constructor: D} = Date.prototype; new D();",
    "new Date.prototype.constructor.prototype.constructor();",
    "const D = Date.prototype.constructor.bind(null); new D();",
    "Date.prototype.constructor.now();",
    "const box = {D: Date.prototype.constructor}; new box.D();",
  ];
  for (const code of denied) {
    it(`denies the known ambient identity ${code}`, () => {
      expect(check(code).map((message) => message.messageId)).toEqual([
        "BOUNDARY_FORBIDDEN_GLOBAL",
      ]);
    });
  }
  for (const code of [
    "Date.prototype.constructor.constructor(source);",
    "Date.prototype.constructor.now.constructor(source);",
  ]) {
    it(`denies intrinsic Function access where ordinary time is allowed ${code}`, () => {
      expect(
        check(code, "packages/adapters/system/src").map((message) => message.messageId),
      ).toEqual(["BOUNDARY_FORBIDDEN_GLOBAL"]);
    });
  }
  const allowed = [
    "new Date.prototype.constructor(0);",
    'new Date["prototype"]["constructor"]("2020-01-01");',
    "const D = Date.prototype.constructor; new D(0);",
    "new Date.prototype.constructor.prototype.constructor(0);",
    "new Date.prototype.constructor(...[0]);",
    "Date.prototype.constructor.parse('2020-01-01');",
    "const Date = {prototype: {constructor: class Local {}}}; new Date.prototype.constructor();",
    "function local(Date: {prototype: {constructor: new () => unknown}}) { new Date.prototype.constructor(); }",
  ];
  for (const code of allowed) {
    it(`preserves deterministic arguments or a runtime shadow ${code}`, () => {
      expect(check(code)).toEqual([]);
    });
  }
  it("preserves the existing System time permission", () => {
    expect(check("new Date.prototype.constructor();", "packages/adapters/system/src")).toEqual([]);
  });
});

describe("OVE_ARCH020: runtime spread positions and computed prototype origins", () => {
  const cases = [
    ["spread:inline", "const list = [...[Date]]; new list[0]();", true, "packages/domain/src"],
    [
      "spread:empty-before",
      "const list = [...[], Date]; new list[0]();",
      true,
      "packages/domain/src",
    ],
    [
      "spread:empty-control",
      "class LocalDate {} const list = [...[], Date, LocalDate]; new list[1]();",
      false,
      "packages/domain/src",
    ],
    ["spread:prefix", "const list = [0, ...[Date]]; new list[1]();", true, "packages/domain/src"],
    [
      "spread:prefix-control",
      "const list = [0, ...[Date]]; new list[0]();",
      false,
      "packages/domain/src",
    ],
    ["spread:suffix", "const list = [...[0], Date]; new list[1]();", true, "packages/domain/src"],
    [
      "spread:suffix-control",
      "const list = [...[0], Date]; new list[0]();",
      false,
      "packages/domain/src",
    ],
    ["spread:nested", "const list = [...[...[Date]]]; new list[0]();", true, "packages/domain/src"],
    ["spread:hole", "const list = [...[, Date]]; new list[1]();", true, "packages/domain/src"],
    [
      "spread:hole-control",
      "const list = [...[, Date]]; new list[0]();",
      false,
      "packages/domain/src",
    ],
    ["spread:fixed", "const list = [...[Date]]; new list[0](0);", false, "packages/domain/src"],
    [
      "spread:shadow",
      "function local(Date) { const list = [...[Date]]; new list[0](); }",
      false,
      "packages/domain/src",
    ],
    [
      "spread:named",
      "const source = [Date]; const list = [...source]; new list[0]();",
      true,
      "packages/domain/src",
    ],
    [
      "spread:alias",
      "const source = [Date]; const alias = source; const list = [...alias]; new list[0]();",
      true,
      "packages/domain/src",
    ],
    [
      "spread:named-offset",
      "const source = [0, Date]; const list = [...source]; new list[1]();",
      true,
      "packages/domain/src",
    ],
    [
      "spread:named-offset-control",
      "const source = [0, Date]; const list = [...source]; new list[0]();",
      false,
      "packages/domain/src",
    ],
    [
      "spread:twice",
      "const source = [Date]; const list = [...source, ...source]; new list[1]();",
      true,
      "packages/domain/src",
    ],
    [
      "spread:gap-control",
      "const source = [Date]; const list = [...source, 0, ...source]; new list[1]();",
      false,
      "packages/domain/src",
    ],
    [
      "spread:gap-after",
      "const source = [Date]; const list = [...source, 0, ...source]; new list[2]();",
      true,
      "packages/domain/src",
    ],
    [
      "spread:named-empty",
      "const source = []; const list = [...source, Date]; new list[0]();",
      true,
      "packages/domain/src",
    ],
    [
      "spread:named-suffix-control",
      "const source = [0]; const list = [...source, Date]; new list[0]();",
      false,
      "packages/domain/src",
    ],
    [
      "spread:named-suffix",
      "const source = [0]; const list = [...source, Date]; new list[1]();",
      true,
      "packages/domain/src",
    ],
    [
      "spread:member-write",
      "const box = {}; box.source = [Date]; const list = [...box.source]; new list[0]();",
      true,
      "packages/domain/src",
    ],
    [
      "spread:member-literal",
      "const box = { source: [Date] }; const list = [...box.source]; new list[0]();",
      true,
      "packages/domain/src",
    ],
    [
      "spread:member-alias",
      "const box = {}; const alias = box; alias.source = [Date]; const list = [...box.source]; new list[0]();",
      true,
      "packages/domain/src",
    ],
    [
      "spread:member-selection",
      "const box = {}; ({ source: box.source } = { source: [Date] }); const list = [...box.source]; new list[0]();",
      true,
      "packages/domain/src",
    ],
    [
      "spread:nested-selection",
      "const box = [[Date]]; const list = [...box[0]]; new list[0]();",
      true,
      "packages/domain/src",
    ],
    [
      "spread:different-receiver",
      "const box = {}; const other = {}; other.source = [Date]; const list = [...box.source]; new list[0]();",
      false,
      "packages/domain/src",
    ],
    ["spread:unknown", "const list = [...unknown]; new list[0]();", false, "packages/domain/src"],
    [
      "spread:unknown-prefix",
      "const list = [...unknown, Date]; new list[0]();",
      true,
      "packages/domain/src",
    ],
    [
      "spread:unknown-before-known",
      "const source = [0, Date]; const list = [...unknown, ...source]; new list[0]();",
      false,
      "packages/domain/src",
    ],
    [
      "spread:unknown-before-known-offset",
      "const source = [0, Date]; const list = [...unknown, ...source]; new list[1]();",
      true,
      "packages/domain/src",
    ],
    [
      "spread:trailing-unknown",
      "const list = [Date, ...unknown]; new list[0]();",
      true,
      "packages/domain/src",
    ],
    [
      "spread:cycle-empty",
      "let source = []; source = [...source]; const list = [...source]; new list[0]();",
      false,
      "packages/domain/src",
    ],
    [
      "spread:cycle-known",
      "let source = [Date]; source = [...source]; const list = [...source]; new list[0]();",
      true,
      "packages/domain/src",
    ],
    [
      "spread:noncanonical",
      'const list = [...[0, Date]]; new list["01"]();',
      false,
      "packages/domain/src",
    ],
    [
      "spread:rest-preservation",
      "const [, ...list] = [0, ...[Date]]; new list[0]();",
      true,
      "packages/domain/src",
    ],
    [
      "spread:rest-control",
      "const [, ...list] = [Date, ...[0]]; new list[0]();",
      false,
      "packages/domain/src",
    ],
    [
      "spread:compact-graph",
      "const a0 = [Date]; const a1 = [...a0, ...a0]; const a2 = [...a1, ...a1]; const a3 = [...a2, ...a2]; const a4 = [...a3, ...a3]; const a5 = [...a4, ...a4]; const a6 = [...a5, ...a5]; const a7 = [...a6, ...a6]; const a8 = [...a7, ...a7]; const a9 = [...a8, ...a8]; const a10 = [...a9, ...a9]; const a11 = [...a10, ...a10]; const a12 = [...a11, ...a11]; const a13 = [...a12, ...a12]; const a14 = [...a13, ...a13]; const a15 = [...a14, ...a14]; const a16 = [...a15, ...a15]; const a17 = [...a16, ...a16]; const a18 = [...a17, ...a17]; const a19 = [...a18, ...a18]; const a20 = [...a19, ...a19]; const a21 = [...a20, ...a20]; const a22 = [...a21, ...a21]; const a23 = [...a22, ...a22]; const a24 = [...a23, ...a23]; const a25 = [...a24, ...a24]; const a26 = [...a25, ...a25]; const a27 = [...a26, ...a26]; const a28 = [...a27, ...a27]; const a29 = [...a28, ...a28]; const a30 = [...a29, ...a29]; const a31 = [...a30, ...a30]; const a32 = [...a31, ...a31]; const a33 = [...a32, ...a32]; const a34 = [...a33, ...a33]; const a35 = [...a34, ...a34]; const a36 = [...a35, ...a35]; new a36[4294967294]();",
      true,
      "packages/domain/src",
    ],
    [
      "prototype:dynamic",
      'const key = "constructor"; new (Date.prototype[key] as typeof Date)();',
      true,
      "packages/domain/src",
    ],
    [
      "prototype:fixed",
      'const key = "constructor"; new (Date.prototype[key] as typeof Date)(0);',
      false,
      "packages/domain/src",
    ],
    ["prototype:alias", "const D = Date.prototype[key]; new D();", true, "packages/domain/src"],
    [
      "prototype:alias-fixed",
      "const D = Date.prototype[key]; new D(0);",
      false,
      "packages/domain/src",
    ],
    ["prototype:call", "Date.prototype[key](0);", true, "packages/domain/src"],
    [
      "prototype:shadow",
      "function local(Date) { new Date.prototype[key](); }",
      false,
      "packages/domain/src",
    ],
    [
      "prototype:local-object",
      "const Date = {prototype:{constructor:class {}}}; new Date.prototype[key]();",
      false,
      "packages/domain/src",
    ],
    ["prototype:not-class", "new Date.prototype();", false, "packages/domain/src"],
    ["prototype:known-method", 'new Date.prototype["getTime"]();', false, "packages/domain/src"],
    [
      "prototype:system-permitted",
      "new Date.prototype[key]();",
      false,
      "packages/adapters/system/src",
    ],
    [
      "prototype:system-Function",
      'Date.prototype[key].constructor("fixture");',
      true,
      "packages/adapters/system/src",
    ],
    [
      "spread:wrapped-parenthesis",
      "const list = [...([Date])]; new list[0]();",
      true,
      "packages/domain/src",
    ],
    ["prototype:wrapped-parenthesis", "new (Date.prototype[key])();", true, "packages/domain/src"],
    [
      "spread:wrapped-as",
      "const list = [...([Date] as unknown)]; new list[0]();",
      true,
      "packages/domain/src",
    ],
    [
      "prototype:wrapped-as",
      "new (Date.prototype[key] as unknown)();",
      true,
      "packages/domain/src",
    ],
    [
      "spread:wrapped-assertion",
      "const list = [...(<unknown>[Date])]; new list[0]();",
      true,
      "packages/domain/src",
    ],
    [
      "prototype:wrapped-assertion",
      "new (<unknown>Date.prototype[key])();",
      true,
      "packages/domain/src",
    ],
    [
      "spread:wrapped-non-null",
      "const list = [...([Date]!)]; new list[0]();",
      true,
      "packages/domain/src",
    ],
    ["prototype:wrapped-non-null", "new (Date.prototype[key]!)();", true, "packages/domain/src"],
    [
      "spread:wrapped-satisfies",
      "const list = [...([Date] satisfies unknown)]; new list[0]();",
      true,
      "packages/domain/src",
    ],
    [
      "prototype:wrapped-satisfies",
      "new (Date.prototype[key] satisfies unknown)();",
      true,
      "packages/domain/src",
    ],
    [
      "spread:numeric-member-write",
      "const source = []; source[0] = Date; const list = [...source]; new list[0]();",
      true,
      "packages/domain/src",
    ],
    [
      "spread:numeric-member-control",
      "const source = []; source[0] = Date; const list = [...source]; new list[1]();",
      false,
      "packages/domain/src",
    ],
    [
      "spread:nonnumeric-member-control",
      'const source = []; source["01"] = Date; const list = [...source]; new list[0]();',
      false,
      "packages/domain/src",
    ],
    [
      "spread:nested-numeric-write",
      "const box = { source: [] }; box.source[0] = Date; const list = [...box.source]; new list[0]();",
      true,
      "packages/domain/src",
    ],
    [
      "width:named-alias-negative",
      "const source = [0]; const alias = source; const list = [...alias, Date]; new list[0]();",
      false,
      "packages/domain/src",
    ],
    [
      "width:named-alias-suffix",
      "const source = [0]; const alias = source; const list = [...alias, Date]; new list[1]();",
      true,
      "packages/domain/src",
    ],
    [
      "width:written-member-negative",
      "const box = {}; box.source = [0]; const list = [...box.source, Date]; new list[0]();",
      false,
      "packages/domain/src",
    ],
    [
      "width:written-member-suffix",
      "const box = {}; box.source = [0]; const list = [...box.source, Date]; new list[1]();",
      true,
      "packages/domain/src",
    ],
    [
      "width:written-receiver-alias-negative",
      "const box = {}; const alias = box; alias.source = [0]; const list = [...box.source, Date]; new list[0]();",
      false,
      "packages/domain/src",
    ],
    [
      "width:known-empty-member",
      "const box = {}; box.source = []; const list = [...box.source, Date]; new list[0]();",
      true,
      "packages/domain/src",
    ],
    [
      "width:unknown-source",
      "function local(unknown) { let source = [0]; source = unknown; const list = [...source, Date]; new list[0](); }",
      true,
      "packages/domain/src",
    ],
  ] as const;
  for (const [label, code, denied, path] of cases) {
    it(`preserves runtime spread and computed prototype origin ${label}`, () => {
      const messages = check(code, path);
      if (denied) {
        expect(messages.length, label).toBeGreaterThan(0);
        expect(
          messages.every((message) => message.messageId === "BOUNDARY_FORBIDDEN_GLOBAL"),
          label,
        ).toBe(true);
        expect(
          new Set(messages.map((message) => `${String(message.line)}:${String(message.column)}`))
            .size,
          label,
        ).toBe(messages.length);
      } else {
        expect(messages, label).toEqual([]);
      }
    });
  }
});

describe("OVE_ARCH020: intrinsic bound Date arguments", () => {
  const cases = [
    ["direct:named-zero", "const D = Date.bind(null); new D();", true, "packages/domain/src"],
    ["direct:named-fixed", "const D = Date.bind(null, 0); new D();", false, "packages/domain/src"],
    ["direct:immediate-zero", "new (Date.bind(null))();", true, "packages/domain/src"],
    ["direct:immediate-fixed", "new (Date.bind(null, 0))();", false, "packages/domain/src"],
    ["computed:named-zero", 'const D = Date["bind"](null); new D();', true, "packages/domain/src"],
    [
      "computed:named-fixed",
      'const D = Date["bind"](null, 0); new D();',
      false,
      "packages/domain/src",
    ],
    ["computed:immediate-zero", 'new (Date["bind"](null))();', true, "packages/domain/src"],
    ["computed:immediate-fixed", 'new (Date["bind"](null, 0))();', false, "packages/domain/src"],
    [
      "global:named-zero",
      "const D = globalThis.Date.bind(null); new D();",
      true,
      "packages/domain/src",
    ],
    [
      "global:named-fixed",
      "const D = globalThis.Date.bind(null, 0); new D();",
      false,
      "packages/domain/src",
    ],
    ["global:immediate-zero", "new (globalThis.Date.bind(null))();", true, "packages/domain/src"],
    [
      "global:immediate-fixed",
      "new (globalThis.Date.bind(null, 0))();",
      false,
      "packages/domain/src",
    ],
    [
      "prototype:named-zero",
      "const D = Date.prototype.constructor.bind(null); new D();",
      true,
      "packages/domain/src",
    ],
    [
      "prototype:named-fixed",
      "const D = Date.prototype.constructor.bind(null, 0); new D();",
      false,
      "packages/domain/src",
    ],
    [
      "prototype:immediate-zero",
      "new (Date.prototype.constructor.bind(null))();",
      true,
      "packages/domain/src",
    ],
    [
      "prototype:immediate-fixed",
      "new (Date.prototype.constructor.bind(null, 0))();",
      false,
      "packages/domain/src",
    ],
    ["this-is-not-date", "const D = Date.bind(0); new D();", true, "packages/domain/src"],
    ["outer-fixed", "new (Date.bind(null))(0);", false, "packages/domain/src"],
    [
      "named-rebind-fixed-first",
      "const D = Date.bind(null, 0); const E = D.bind(null); new E();",
      false,
      "packages/domain/src",
    ],
    [
      "named-rebind-fixed-later",
      "const D = Date.bind(null); const E = D.bind(null, 0); new E();",
      false,
      "packages/domain/src",
    ],
    [
      "immediate-rebind-fixed-first",
      "new (Date.bind(null, 0).bind(null))();",
      false,
      "packages/domain/src",
    ],
    [
      "immediate-rebind-fixed-later",
      "new (Date.bind(null).bind(null, 0))();",
      false,
      "packages/domain/src",
    ],
    ["immediate-rebind-zero", "new (Date.bind(null).bind(null))();", true, "packages/domain/src"],
    ["bound-call-still-time", "const D = Date.bind(null, 0); D();", true, "packages/domain/src"],
    ["prefix-empty-spread", "new (Date.bind(...[], null, 0))();", false, "packages/domain/src"],
    ["literal-spread-fixed", "new (Date.bind(...[null, 0]))();", false, "packages/domain/src"],
    ["literal-spread-only-this", "new (Date.bind(...[null]))();", true, "packages/domain/src"],
    ["unknown-spread-one-known", "new (Date.bind(...unknown, 0))();", true, "packages/domain/src"],
    [
      "unknown-spread-two-known",
      "new (Date.bind(...unknown, null, 0))();",
      false,
      "packages/domain/src",
    ],
    [
      "local-shadow",
      "function local(Date) { new (Date.bind(null))(); }",
      false,
      "packages/domain/src",
    ],
    [
      "local-object",
      "const Date = {bind(){return class {}}}; new (Date.bind(null))();",
      false,
      "packages/domain/src",
    ],
    [
      "named-container",
      "const box = {D: Date.bind(null, 0)}; const [D] = [box.D]; new D();",
      false,
      "packages/domain/src",
    ],
    [
      "global-alias",
      "const root = globalThis; const D = root.Date.bind(null,0); new D();",
      false,
      "packages/domain/src",
    ],
    ["wrapped-immediate", "new ((Date.bind(null)) as typeof Date)();", true, "packages/domain/src"],
    ["static-method-denied", "Date.now.bind(null, 0)();", true, "packages/domain/src"],
    ["Function-denied", 'new (Function.bind(null, "fixture"))();', true, "packages/domain/src"],
  ] as const;
  for (const [label, code, denied, path] of cases) {
    it(`preserves bound Date argument facts ${label}`, () => {
      const messages = check(code, path);
      if (denied) {
        expect(messages.length, label).toBeGreaterThan(0);
        expect(
          messages.every((message) => message.messageId === "BOUNDARY_FORBIDDEN_GLOBAL"),
          label,
        ).toBe(true);
        expect(
          new Set(messages.map((message) => `${String(message.line)}:${String(message.column)}`))
            .size,
          label,
        ).toBe(messages.length);
      } else {
        expect(messages, label).toEqual([]);
      }
    });
  }
});

describe("OVE_ARCH020: intrinsic Date call and apply invocations", () => {
  const cases = [
    ["direct:call", "Date.call(null, 0);", true, "packages/domain/src"],
    ["direct:computed-call", 'Date["call"](null, 0);', true, "packages/domain/src"],
    ["direct:apply", "Date.apply(null, [0]);", true, "packages/domain/src"],
    ["direct:computed-apply", 'Date["apply"](null, [0]);', true, "packages/domain/src"],
    ["global:call", "globalThis.Date.call(null, 0);", true, "packages/domain/src"],
    ["global:computed-call", 'globalThis.Date["call"](null, 0);', true, "packages/domain/src"],
    ["global:apply", "globalThis.Date.apply(null, [0]);", true, "packages/domain/src"],
    ["global:computed-apply", 'globalThis.Date["apply"](null, [0]);', true, "packages/domain/src"],
    ["prototype:call", "Date.prototype.constructor.call(null, 0);", true, "packages/domain/src"],
    [
      "prototype:computed-call",
      'Date.prototype.constructor["call"](null, 0);',
      true,
      "packages/domain/src",
    ],
    [
      "prototype:apply",
      "Date.prototype.constructor.apply(null, [0]);",
      true,
      "packages/domain/src",
    ],
    [
      "prototype:computed-apply",
      'Date.prototype.constructor["apply"](null, [0]);',
      true,
      "packages/domain/src",
    ],
    ["bound:call", "const D = Date.bind(null, 0); D.call(null, 0);", true, "packages/domain/src"],
    [
      "bound:computed-call",
      'const D = Date.bind(null, 0); D["call"](null, 0);',
      true,
      "packages/domain/src",
    ],
    [
      "bound:apply",
      "const D = Date.bind(null, 0); D.apply(null, [0]);",
      true,
      "packages/domain/src",
    ],
    [
      "bound:computed-apply",
      'const D = Date.bind(null, 0); D["apply"](null, [0]);',
      true,
      "packages/domain/src",
    ],
    ["zero-bound-call", "const D = Date.bind(null); D.call(null);", true, "packages/domain/src"],
    [
      "rebound-call",
      "const D = Date.bind(null, 0); const E = D.bind(null); E.call(null);",
      true,
      "packages/domain/src",
    ],
    [
      "rebound-apply",
      "const D = Date.bind(null); const E = D.bind(null, 0); E.apply(null, []);",
      true,
      "packages/domain/src",
    ],
    ["immediate-bound-call", "Date.bind(null, 0).call(null);", true, "packages/domain/src"],
    ["immediate-bound-apply", "Date.bind(null, 0).apply(null, []);", true, "packages/domain/src"],
    [
      "container-call",
      "const box = {D: Date.bind(null, 0)}; box.D.call(null);",
      true,
      "packages/domain/src",
    ],
    ["call-chain", "Date.call.call(Date, null);", true, "packages/domain/src"],
    ["apply-call-chain", "Date.apply.call(Date, null, []);", true, "packages/domain/src"],
    ["call-apply-chain", "Date.call.apply(Date, [null]);", true, "packages/domain/src"],
    ["fixed-new-direct", "new Date(0);", false, "packages/domain/src"],
    ["fixed-new-bound", "const D = Date.bind(null, 0); new D();", false, "packages/domain/src"],
    [
      "fixed-new-rebound",
      "const D = Date.bind(null, 0); const E = D.bind(null); new E();",
      false,
      "packages/domain/src",
    ],
    [
      "local-shadow",
      "function local(Date) { Date.call(null); Date.apply(null, []); }",
      false,
      "packages/domain/src",
    ],
    [
      "local-object",
      "const Date = {call(){},apply(){}}; Date.call(null); Date.apply(null,[]);",
      false,
      "packages/domain/src",
    ],
    [
      "local-alias",
      "const D = function local() {}; D.call(null); D.apply(null, []);",
      false,
      "packages/domain/src",
    ],
    [
      "bare-escape-pure-bind-call",
      "const D = Date.bind.call(Date, null, 0);",
      true,
      "packages/domain/src",
    ],
    [
      "bare-escape-pure-bind-apply",
      "const D = Date.bind.apply(Date, [null, 0]);",
      true,
      "packages/domain/src",
    ],
    ["static-now-call", "Date.now.call(null);", true, "packages/domain/src"],
    ["intrinsic-Function", 'Date.call.constructor("fixture");', true, "packages/domain/src"],
    [
      "wrapped-known-call",
      "const D = Date.bind(null,0); (D.call as unknown)(null);",
      true,
      "packages/domain/src",
    ],
  ] as const;
  for (const [label, code, denied, path] of cases) {
    it(`preserves intrinsic Date invocation facts ${label}`, () => {
      const messages = check(code, path);
      if (denied) {
        expect(messages.length, label).toBeGreaterThan(0);
        expect(
          messages.every((message) => message.messageId === "BOUNDARY_FORBIDDEN_GLOBAL"),
          label,
        ).toBe(true);
        expect(
          new Set(messages.map((message) => `${String(message.line)}:${String(message.column)}`))
            .size,
          label,
        ).toBe(messages.length);
      } else {
        expect(messages, label).toEqual([]);
      }
    });
  }
});

describe("OVE_ARCH020: guaranteed named Date arguments", () => {
  const cases = [
    ["direct", "new Date(...[0]);", false, "packages/domain/src"],
    ["named", "const args = [0] as const; new Date(...args);", false, "packages/domain/src"],
    [
      "alias",
      "const args = [0] as const; const alias = args; new Date(...alias);",
      false,
      "packages/domain/src",
    ],
    [
      "wrapped",
      "const args = ([0] satisfies readonly [number]); new Date(...(args as readonly [number]));",
      false,
      "packages/domain/src",
    ],
    [
      "typed-initializer",
      "const args: readonly [number] = [0]; new Date(...args);",
      false,
      "packages/domain/src",
    ],
    ["member", "const box = {args:[0]}; new Date(...box.args);", false, "packages/domain/src"],
    ["empty", "const args = [] as const; new Date(...args);", true, "packages/domain/src"],
    [
      "unknown",
      "function local(args: readonly number[]) { new Date(...args); }",
      true,
      "packages/domain/src",
    ],
    [
      "fixed-bind-args",
      "const args = [null,0] as const; const D = Date.bind(...args); new D();",
      false,
      "packages/domain/src",
    ],
    [
      "shadow",
      "function local(Date) { const args = [0] as const; new Date(...args); }",
      false,
      "packages/domain/src",
    ],
    [
      "named-empty-alias",
      "const args = [] as const; const alias = args; new Date(...alias);",
      true,
      "packages/domain/src",
    ],
    ["known-hole", "const args = [,] as const; new Date(...args);", false, "packages/domain/src"],
    [
      "conditional-maybe-empty",
      "const args = flag ? [] : [0]; new Date(...args);",
      true,
      "packages/domain/src",
    ],
    [
      "conditional-always-fixed",
      "const args = flag ? [0] : [1]; new Date(...args);",
      false,
      "packages/domain/src",
    ],
    [
      "named-bind-this-only",
      "const args = [null] as const; const D = Date.bind(...args); new D();",
      true,
      "packages/domain/src",
    ],
    [
      "named-bind-empty-prefix",
      "const args = [] as const; const D = Date.bind(...args, 0); new D();",
      true,
      "packages/domain/src",
    ],
  ] as const;
  for (const [label, code, denied, path] of cases) {
    it(`preserves guaranteed Date argument facts ${label}`, () => {
      const messages = check(code, path);
      if (denied) {
        expect(messages.length, label).toBeGreaterThan(0);
        expect(
          messages.every((message) => message.messageId === "BOUNDARY_FORBIDDEN_GLOBAL"),
          label,
        ).toBe(true);
        expect(
          new Set(messages.map((message) => `${String(message.line)}:${String(message.column)}`))
            .size,
          label,
        ).toBe(messages.length);
      } else {
        expect(messages, label).toEqual([]);
      }
    });
  }
});

describe("OVE_ARCH020: array length argument guarantees", () => {
  const cases = [
    [
      "empty-length",
      "const args=[0]; const empty: []=[]; args.length=empty.length; new Date(...args);",
      true,
      "packages/domain/src",
    ],
    [
      "direct-zero",
      "const args=[0]; args.length=0; new Date(...args);",
      true,
      "packages/domain/src",
    ],
    [
      "computed-zero",
      "const args=[0]; args['length']=0; new Date(...args);",
      true,
      "packages/domain/src",
    ],
    [
      "aliased-zero",
      "const args=[0]; const alias=args; alias.length=0; new Date(...args);",
      true,
      "packages/domain/src",
    ],
    [
      "named-empty-length",
      "const args=[0]; const empty: []=[]; const zero=empty.length; args.length=zero; new Date(...args);",
      true,
      "packages/domain/src",
    ],
    [
      "computed-empty-length",
      "const args=[0]; const empty: []=[]; args['length']=empty['length']; new Date(...args);",
      true,
      "packages/domain/src",
    ],
    [
      "aliased-empty-length",
      "const args=[0]; const empty: []=[]; const alias=args; alias.length=empty.length; new Date(...args);",
      true,
      "packages/domain/src",
    ],
    [
      "unknown-length",
      "function use(length: number) { const args=[0]; args.length=length; new Date(...args); }",
      true,
      "packages/domain/src",
    ],
    [
      "unknown-key",
      "function use(key: string) { const args=[0]; args[key]=0; new Date(...args); }",
      true,
      "packages/domain/src",
    ],
    [
      "unchanged-nonempty",
      "const args=[0] as const; new Date(...args);",
      false,
      "packages/domain/src",
    ],
    ["unchanged-empty", "const args=[] as const; new Date(...args);", true, "packages/domain/src"],
    [
      "nonempty-length",
      "const args=[0]; const other=[1]; args.length=other.length; new Date(...args);",
      false,
      "packages/domain/src",
    ],
    [
      "bound-empty-length",
      "const args=[null,0]; const empty: []=[]; args.length=empty.length; const D=Date.bind(...args); new D();",
      true,
      "packages/domain/src",
    ],
    [
      "bound-nonempty",
      "const args=[null,0] as const; const D=Date.bind(...args); new D();",
      false,
      "packages/domain/src",
    ],
    [
      "literal-nonempty",
      "const args=[0]; args.length=1; new Date(...args);",
      false,
      "packages/domain/src",
    ],
    [
      "named-nonempty-length",
      "const args=[0]; const other=[1]; const one=other.length; args.length=one; new Date(...args);",
      false,
      "packages/domain/src",
    ],
    [
      "nested-empty",
      "const box={args:[0]}; const empty=[]; box.args.length=empty.length; new Date(...box.args);",
      true,
      "packages/domain/src",
    ],
    [
      "nested-nonempty",
      "const box={args:[0]}; const other=[1]; box.args.length=other.length; new Date(...box.args);",
      false,
      "packages/domain/src",
    ],
    [
      "bound-truncated-one",
      "const args=[null,0]; args.length=1; const D=Date.bind(...args); new D();",
      true,
      "packages/domain/src",
    ],
    [
      "bound-preserved-two",
      "const args=[null,0]; const other=[1,2]; args.length=other.length; const D=Date.bind(...args); new D();",
      false,
      "packages/domain/src",
    ],
    [
      "coerced-zero-array",
      "const args=[0]; args.length=[0]; new Date(...args);",
      true,
      "packages/domain/src",
    ],
    [
      "named-coerced-zero-array",
      "const args=[0]; const zero=[0]; args.length=zero; new Date(...args);",
      true,
      "packages/domain/src",
    ],
    [
      "unknown-computed-rhs",
      "const args=[0]; const empty=[]; args.length=empty[key]; new Date(...args);",
      true,
      "packages/domain/src",
    ],
    [
      "local-shadow",
      "function local(Date){const args=[0];const empty=[];args.length=empty.length;new Date(...args);}",
      false,
      "packages/domain/src",
    ],
  ] as const;
  for (const [label, code, denied, path] of cases) {
    it(`preserves array length argument facts ${label}`, () => {
      const messages = check(code, path);
      if (denied) {
        expect(messages.length, label).toBeGreaterThan(0);
        expect(
          messages.every((message) => message.messageId === "BOUNDARY_FORBIDDEN_GLOBAL"),
          label,
        ).toBe(true);
        expect(
          new Set(messages.map((message) => `${String(message.line)}:${String(message.column)}`))
            .size,
          label,
        ).toBe(messages.length);
      } else {
        expect(messages, label).toEqual([]);
      }
    });
  }
});
