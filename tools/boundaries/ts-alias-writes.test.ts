// SPDX-License-Identifier: Apache-2.0
import ts from "typescript";
import { expect, it } from "vitest";
import { aliasWritesOf } from "./ts-alias-writes.ts";

function fixture(text: string) {
  const source = ts.createSourceFile("/collector.generated.ts", text, ts.ScriptTarget.Latest, true);
  const host: ts.CompilerHost = {
    getSourceFile: (name) => (name === source.fileName ? source : undefined),
    getDefaultLibFileName: () => "/unused.d.ts",
    writeFile: () => {
      throw new Error("Collector fixtures must not emit");
    },
    getCurrentDirectory: () => "/",
    getDirectories: () => [],
    fileExists: (name) => name === source.fileName,
    readFile: (name) => (name === source.fileName ? text : undefined),
    getCanonicalFileName: (name) => name,
    useCaseSensitiveFileNames: () => true,
    getNewLine: () => "\n",
  };
  const program = ts.createProgram({
    rootNames: [source.fileName],
    options: { noLib: true, noEmit: true },
    host,
  });
  const checker = program.getTypeChecker();
  const nodes: ts.Node[] = [];
  const visit = (node: ts.Node) => {
    nodes.push(node);
    ts.forEachChild(node, visit);
  };
  visit(source);
  function node<T extends ts.Node>(guard: (value: ts.Node) => value is T, text: string): T {
    const found = nodes.find((value) => guard(value) && value.getText(source) === text);
    if (!found || !guard(found)) {
      throw new Error("Missing collector fixture node");
    }
    return found;
  }
  const symbol = (name: string) => {
    const value = checker.getSymbolAtLocation(node(ts.isIdentifier, name));
    if (!value) {
      throw new Error("Missing collector fixture symbol");
    }
    return value;
  };
  return { source, checker, node, symbol };
}

it("retains initializer and ordered assignment expressions at their original symbols", () => {
  const f = fixture(
    "let carrier = 1; function update(input = carrier) { carrier = input; carrier += 2; }",
  );
  const facts = aliasWritesOf(f.source, f.checker);
  const writes = facts.writes.get(f.symbol("carrier"));
  expect(writes?.map((value) => value.getText(f.source))).toEqual(["1", "input", "2"]);
  expect(writes?.[0]).toBe(f.node(ts.isNumericLiteral, "1"));
  expect(writes?.[1]).toBe(f.node(ts.isBinaryExpression, "carrier = input").right);
  expect(writes?.[2]).toBe(f.node(ts.isNumericLiteral, "2"));
  expect(facts.writes.get(f.symbol("input"))?.[0]).toBe(
    f.node(ts.isParameter, "input = carrier").initializer,
  );
});

it("keeps actual binding symbols through renamed, defaulted, omitted and rest declarations", () => {
  const f = fixture(
    "const { item: selected = 2, ...rest } = {}; const [,tail,...remaining] = []; function decode({slot: param = 4} = {}) {}",
  );
  const facts = aliasWritesOf(f.source, f.checker);
  expect([...facts.bindings].map((value) => value.getName()).sort()).toEqual([
    "param",
    "remaining",
    "rest",
    "selected",
    "tail",
  ]);
  for (const name of ["selected", "rest", "tail", "remaining", "param"]) {
    expect(facts.bindings.has(f.symbol(name))).toBe(true);
  }
});

it("preserves nested selection segments, defaults, rest and exact assignment targets", () => {
  const f = fixture(
    "let picked, alias, leftovers, defaults, object; ({deep:{leaf:picked = defaults}, alias, ...leftovers} = object); [, picked, ...leftovers] = object; ({ picked = defaults } = object);",
  );
  const facts = aliasWritesOf(f.source, f.checker);
  const selected = facts.selections.get(f.symbol("picked"));
  expect(selected?.map((value) => value.segments)).toEqual([["deep", "leaf"], ["1"], ["picked"]]);
  expect(selected?.[0]?.object).toBe(
    f.node(ts.isBinaryExpression, "{deep:{leaf:picked = defaults}, alias, ...leftovers} = object")
      .right,
  );
  expect(selected?.[1]?.object).toBe(
    f.node(ts.isBinaryExpression, "[, picked, ...leftovers] = object").right,
  );
  expect(facts.selections.get(f.symbol("alias"))?.map((value) => value.segments)).toEqual([
    ["alias"],
  ]);
  expect(facts.selections.get(f.symbol("leftovers"))?.map((value) => value.segments)).toEqual([
    [],
    ["*"],
  ]);
  const target = f.node(ts.isBinaryExpression, "picked = defaults").left;
  expect(ts.isIdentifier(target) && facts.assignmentTargets.has(target)).toBe(true);
  const shorthand = f.node(ts.isShorthandPropertyAssignment, "picked = defaults");
  expect(facts.symbolOf(shorthand.name)).toBe(f.symbol("picked"));
  expect(facts.assignmentTargets.has(shorthand.name)).toBe(true);
  expect(facts.writes.get(f.symbol("picked"))?.map((value) => value.getText(f.source))).toEqual([
    "defaults",
    "defaults",
  ]);
});

it("groups member writes by the actual receiver symbol and preserves selection objects", () => {
  const f = fixture(
    'const box = {inner:{}}; let label; box.named = 1; box["text"] = 2; box[3] = 4; box[label] = 5; ({nested: box.slot} = 6); box.inner.value = 7;',
  );
  const facts = aliasWritesOf(f.source, f.checker);
  const members = facts.propertyWrites.get(f.symbol("box"));
  expect([...(members?.keys() ?? [])]).toEqual(["named", "text", "3", "*", "slot"]);
  expect(members?.get("named")?.[0]?.object).toBe(f.node(ts.isNumericLiteral, "1"));
  expect(members?.get("text")?.[0]?.object).toBe(f.node(ts.isNumericLiteral, "2"));
  expect(members?.get("3")?.[0]?.object).toBe(f.node(ts.isNumericLiteral, "4"));
  expect(members?.get("*")?.[0]?.object).toBe(f.node(ts.isNumericLiteral, "5"));
  expect(members?.get("slot")?.[0]?.segments).toEqual(["nested"]);
  expect(members?.get("slot")?.[0]?.object).toBe(f.node(ts.isNumericLiteral, "6"));
  const receiver = f.checker.getSymbolAtLocation(
    f.node(ts.isPropertyAccessExpression, "box.inner"),
  );
  if (!receiver) {
    throw new Error("Missing receiver fixture symbol");
  }
  expect(facts.propertyWrites.get(receiver)?.get("value")?.[0]?.object).toBe(
    f.node(ts.isNumericLiteral, "7"),
  );
});

it("shares literal/computed key and shorthand value-symbol semantics", () => {
  const f = fixture(
    'let label = 0; const props = {label, plain:1, ["slot"]:2, [label]:3, [4]:5}; const text = `slot`;',
  );
  const facts = aliasWritesOf(f.source, f.checker);
  expect(facts.key(f.node(ts.isIdentifier, "label"))).toBe("label");
  expect(facts.elementKey(f.node(ts.isIdentifier, "label"))).toBe("*");
  expect(facts.key(f.node(ts.isComputedPropertyName, '["slot"]'))).toBe("slot");
  expect(facts.key(f.node(ts.isComputedPropertyName, "[label]"))).toBe("*");
  expect(facts.key(f.node(ts.isComputedPropertyName, "[4]"))).toBe("4");
  expect(facts.elementKey(f.node(ts.isStringLiteralLike, "`slot`"))).toBe("slot");
  expect(facts.key(f.source)).toBe("*");
  expect(facts.symbolOf(f.node(ts.isShorthandPropertyAssignment, "label").name)).toBe(
    f.symbol("label"),
  );
});

it("returns fresh facts per invocation while retaining original checker and node identities", () => {
  const f = fixture(
    "let item = 1, selected; const box = {}; box.slot = item; ({value:selected} = box); const {slot: bound} = box;",
  );
  const first = aliasWritesOf(f.source, f.checker);
  const second = aliasWritesOf(f.source, f.checker);
  expect(first.writes).not.toBe(second.writes);
  expect(first.selections).not.toBe(second.selections);
  expect(first.propertyWrites).not.toBe(second.propertyWrites);
  expect(first.bindings).not.toBe(second.bindings);
  expect(first.assignmentTargets).not.toBe(second.assignmentTargets);
  expect(first.writes.get(f.symbol("item"))).not.toBe(second.writes.get(f.symbol("item")));
  expect(first.writes.get(f.symbol("item"))?.[0]).toBe(f.node(ts.isNumericLiteral, "1"));
  expect(second.writes.get(f.symbol("item"))?.[0]).toBe(f.node(ts.isNumericLiteral, "1"));
  expect(first.selections.get(f.symbol("selected"))).not.toBe(
    second.selections.get(f.symbol("selected")),
  );
  expect(first.propertyWrites.get(f.symbol("box"))).not.toBe(
    second.propertyWrites.get(f.symbol("box")),
  );
  expect(first.bindings.has(f.symbol("bound"))).toBe(true);
});

it("leaves empty and unresolved syntax without invented symbols or assignment targets", () => {
  for (const text of [
    "",
    "missing = unknown; missing.slot = unknown; ({piece: missing} = unknown);",
  ]) {
    const f = fixture(text);
    const facts = aliasWritesOf(f.source, f.checker);
    expect([
      facts.writes.size,
      facts.selections.size,
      facts.propertyWrites.size,
      facts.bindings.size,
      facts.assignmentTargets.size,
    ]).toEqual([0, 0, 0, 0, 0]);
  }
});

it("collects source containing a throwing statement without executing or emitting it", () => {
  const f = fixture("throw 123; const held = 8;");
  const facts = aliasWritesOf(f.source, f.checker);
  expect(facts.writes.get(f.symbol("held"))?.[0]).toBe(f.node(ts.isNumericLiteral, "8"));
});
