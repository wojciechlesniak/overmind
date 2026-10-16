import { expect, it } from "vitest";
import { ownsOverlap } from "./glob.ts";

it("reports conservative path-prefix overlaps without confusing sibling names", () => {
  expect(ownsOverlap(["apps/desktop/**"], ["apps/desktop/src/*.ts"])).toEqual(["apps/desktop/src"]);
  expect(ownsOverlap(["apps/desktop/**"], ["apps/desktopish/**"])).toEqual([]);
  expect(ownsOverlap(["docs/adr/*-driver.md"], ["docs/adr/0030-engine.md"])).toEqual([
    "docs/adr/0030-engine.md",
  ]);
  expect(ownsOverlap(["**"], ["tools/tasks/**"])).toEqual(["tools/tasks"]);
  expect(ownsOverlap(["tools/{tasks,ci}/**"], ["tools/tasks/*.ts"])).toEqual(["tools/tasks"]);
});
