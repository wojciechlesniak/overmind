import { expect, test } from "vitest";
import { symbolicateStack } from "./symbolicate.ts";

test("offline symbolication returns canonical TypeScript locations without reading source paths", () => {
  const map = {
    version: 3,
    sources: ["file:///overmind/source/example.ts"],
    sourcesContent: ['throw new Error("probe");'],
    names: [],
    mappings: "AAAA",
    sourceRoot: "",
  };
  expect(symbolicateStack("Error: probe\n    at fail (dist/engine.cjs:1:1)\n", map)).toContain(
    "file:///overmind/source/example.ts:1:1",
  );
  expect(() =>
    symbolicateStack("stack", { ...map, sources: ["file:///Users/private/example.ts"] }),
  ).toThrow();
});
