import { expect, test } from "vitest";
import { observedNumbers, type Git } from "./ports.ts";

test("remote allocation uses DEVELOP and exact validated task commit reservations", () => {
  const base = "a".repeat(40);
  const branch = "b".repeat(40);
  const recorded: string[][] = [];
  const git: Git = {
    run(args) {
      recorded.push([...args]);
      if (args[0] === "rev-parse") {
        return base;
      }
      if (args[0] === "ls-tree") {
        return "docs/adr/0031-integrated.md\0";
      }
      if (args[0] === "ls-remote") {
        return `${branch}\trefs/heads/task/OVE_TEST001\n`;
      }
      if (args[0] === "diff") {
        return "docs/adr/0034-reserved.md\0";
      }
      return "";
    },
  };
  expect(observedNumbers(git, ["docs/adr/0032-local.md"])).toBe(35);
  expect(recorded).toContainEqual(["fetch", "--no-tags", "origin", "DEVELOP"]);
  expect(recorded).toContainEqual(["fetch", "--no-tags", "origin", branch]);
  const hostile: Git = {
    run(args) {
      return args[0] === "rev-parse"
        ? base
        : args[0] === "ls-remote"
          ? `${branch}\trefs/heads/task/../../unsafe\n`
          : "";
    },
  };
  expect(() => observedNumbers(hostile, [])).toThrow("Invalid task branch");
  expect(() =>
    observedNumbers(
      {
        run() {
          throw new Error("unavailable");
        },
      },
      [],
    ),
  ).toThrow();
});
