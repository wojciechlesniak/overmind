// SPDX-License-Identifier: Apache-2.0
import { generate } from "./render/generate.ts";
import { taskFrontMatterSchema, TaskToolError } from "./lib/index.ts";

try {
  process.exitCode = await generate(process.cwd(), process.argv.slice(2));
} catch (error) {
  let diagnostic = "Task index generation failed";
  if (error instanceof TaskToolError) {
    const missing = /^Task (\S+) has missing dependency (\S+)$/u.exec(error.message);
    const ids = missing
      ? missing.slice(1)
      : error.message.startsWith("Dependency cycle: ")
        ? error.message.slice(18).split(", ")
        : [];
    if (
      (ids.length && taskFrontMatterSchema.shape.depends_on.safeParse(ids).success) ||
      error.message === "Unix line endings required"
    ) {
      diagnostic = error.message;
    }
  }
  console.error(diagnostic);
  process.exitCode = 1;
}
