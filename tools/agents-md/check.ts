import { resolve } from "node:path";
import { checkAgentInstructions } from "./policy.ts";

const errors = checkAgentInstructions(resolve(import.meta.dirname, "../.."));
if (errors.length) {
  for (const error of errors) {
    console.error(error);
  }
  process.exitCode = 1;
} else {
  console.log("Agent instructions, local references, command names and CLAUDE.md symlink passed.");
}
