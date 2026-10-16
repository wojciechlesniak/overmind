import { expect, it } from "vitest";
import { parseCommand } from "./arguments.ts";
import { TaskToolError } from "./errors.ts";

it("accepts frozen-install options and rejects unsafe IDs before any repository access", () => {
  const options = parseCommand("claim", [
    "OVE_FIX001",
    "--install=false",
    "--agent",
    "Fixture",
    "--json",
  ]);
  expect(options.id).toBe("OVE_FIX001");
  expect(options.install).toBe(false);
  expect(options.agent).toBe("Fixture");
  expect(options.json).toBe(true);
  for (const id of [
    "../x",
    "OVE_FIX001; touch marker",
    "OVE_X001",
    "OVE_BOARDUI001",
    "OVE_FIX001\nRefs: OVE_FIX002",
  ]) {
    try {
      parseCommand("claim", [id]);
      throw new Error("Unsafe task ID accepted");
    } catch (error) {
      expect(error).toBeInstanceOf(TaskToolError);
      expect(error).toMatchObject({ exitCode: 4 });
    }
  }
  expect(() =>
    parseCommand("claim", ["OVE_FIX001", "--agent", "Fixture\nRefs: OVE_FIX002"]),
  ).toThrow(TaskToolError);
  expect(() => parseCommand("next", ["--limit", "0"])).toThrow(TaskToolError);
  expect(() => parseCommand("release", ["OVE_FIX001", "--done"])).toThrow(TaskToolError);
});

it("normalizes numeric defaults and explicit limits to numbers", () => {
  expect(parseCommand("next", []).limit).toBe(10);
  expect(parseCommand("next", ["--limit", "5"]).limit).toBe(5);
  expect(parseCommand("status", []).staleDays).toBe(3);
});
