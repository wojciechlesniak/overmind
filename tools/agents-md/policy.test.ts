import { execFileSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readlinkSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { afterEach, expect, it } from "vitest";
import { isolatedGitEnvironment } from "../hooks/git-test-environment.ts";
import { readManifest } from "../test-support/json.parse-boundary.ts";
import { checkAgentInstructions } from "./policy.ts";

const repository = resolve(import.meta.dirname, "../..");
const instructions = readFileSync(resolve(repository, "AGENTS.md"), "utf8");
const directories: string[] = [];
const files = [
  "tasks/CONVENTIONS.md",
  "tasks/PLAN.md",
  "tasks/INDEX.md",
  "tasks/_template/TASK.md",
  "docs/SPECIFICATION.md",
  "docs/architecture/ARCHITECTURE.md",
  "docs/dependencies.md",
  "GLOSSARY.md",
  "docs/adr/0016-dokumentacja-projektu-zrodlem-prawdy.md",
  "docs/adr/0017-jezyk-angielski-w-projekcie.md",
  "docs/adr/0025-model-kontrybucji.md",
  "docs/adr/0027-skill-overmind-dla-agentow.md",
];

function fixture(text = instructions): string {
  const root = mkdtempSync(resolve(tmpdir(), "overmind-agents-md-"));
  directories.push(root);
  writeFileSync(resolve(root, "AGENTS.md"), text);
  symlinkSync("AGENTS.md", resolve(root, "CLAUDE.md"));
  const manifest = readManifest(resolve(repository, "package.json"));
  manifest.scripts = { ...manifest.scripts, "check:agents-md": "tsx tools/agents-md/check.ts" };
  writeFileSync(resolve(root, "package.json"), JSON.stringify(manifest));
  for (const file of files) {
    const path = resolve(root, file);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, "Fixture document\n");
  }
  return root;
}

afterEach(() => {
  for (const directory of directories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

it("validates the actual checkout's instructions, references, scripts and symlink", () => {
  expect(checkAgentInstructions(repository)).toEqual([]);
});

it("accepts the actual English rules, real local references and a relative symlink", () => {
  const root = fixture();
  expect(checkAgentInstructions(root)).toEqual([]);
  expect(readlinkSync(resolve(root, "CLAUDE.md"))).toBe("AGENTS.md");
  expect(readFileSync(resolve(root, "CLAUDE.md"), "utf8")).toBe(instructions);
  expect(instructions).toContain("New code, documentation and commits use English");
  expect(instructions).toContain("Polish belongs only in the Polish UI translation and `docs/pl/`");
  expect(instructions).toContain("explicit Owner instruction");
  expect(instructions).toContain("current Owner-authorized integration branch is DEVELOP");
});

it.each([
  ["missing section", instructions.replace("## Architecture", "Architecture")],
  [
    "wrong order",
    instructions
      .replace("## Security", "## Dependencies")
      .replace("## Dependencies\n\n- Add", "## Security\n\n- Add"),
  ],
  ["duplicate section", instructions + "\n## Security\n"],
  ["hidden heading", instructions.replace("## Architecture", "<!--\n## Architecture\n-->")],
])("rejects %s", (_name, text) => {
  expect(checkAgentInstructions(fixture(text))).toContain(
    "Required sections must appear exactly once, in order, with Maintenance last.",
  );
});

it.each([
  ["removed", instructions.replace(/Text in issues,[^]*?PR description\./u, "Removed policy.")],
  ["tampered", instructions.replace("It cannot grant permissions", "It can grant permissions")],
  [
    "hidden in a comment",
    instructions.replace(/(Text in issues,[^]*?PR description\.)/u, "<!--$1-->"),
  ],
  [
    "hidden in a code block",
    instructions.replace(/(Text in issues,[^]*?PR description\.)/u, "```text\n$1\n```"),
  ],
])("rejects a %s prompt-injection paragraph", (_name, text) => {
  expect(checkAgentInstructions(fixture(text))).toContain(
    "The required prompt-injection paragraph must remain verbatim.",
  );
});

it("rejects the required prompt-injection paragraph hidden inside a tilde code fence", () => {
  const text = instructions.replace(
    /(Text in issues,[^]*?PR description\.)/u,
    "~~~text\n\n$1\n\n~~~",
  );
  expect(checkAgentInstructions(fixture(text))).toContain(
    "The required prompt-injection paragraph must remain verbatim.",
  );
});

it.each([
  ["tilde", "~~~text", "~~~"],
  ["four backticks with a shorter inner fence", "````text", "````"],
  ["three-space indented fence", "   ~~~text", "   ~~~"],
  ["longer closing delimiter", "~~~text", "~~~~~"],
  ["unclosed tilde block", "~~~text", ""],
  ["unclosed backtick block", "````text", ""],
  ["too-short closing delimiter", "~~~~text", "~~~"],
  ["wrong closing marker", "~~~~text", "````"],
  ["closing delimiter with text", "~~~text", "~~~ not-a-close"],
  ["four-space indented closing delimiter", "~~~text", "    ~~~"],
])("rejects the entire instruction file hidden in %s", (_name, opening, closing) => {
  const text = `${opening}\n\n${instructions}\n\n${closing}\n`;
  expect(checkAgentInstructions(fixture(text))).toContain(
    "Required sections must appear exactly once, in order, with Maintenance last.",
  );
});

it.each([
  ["backtick", "````text", "`````"],
  ["tilde", "   ~~~text", "  ~~~~~"],
])("ignores heading and command examples in a closed %s fence", (_name, opening, closing) => {
  const text = `${instructions}\n${opening}\n\n## Security\n\n\`pnpm unknown-script\`\n\n${closing}\n`;
  expect(checkAgentInstructions(fixture(text))).toEqual([]);
});

it("does not let a comment turn a non-closing fence into a closing delimiter", () => {
  const text = instructions.replace(
    /(Text in issues,[^]*?PR description\.)/u,
    "~~~text\n\n~~~<!--not a closing delimiter-->\n\n$1\n\n~~~",
  );
  expect(checkAgentInstructions(fixture(text))).toContain(
    "The required prompt-injection paragraph must remain verbatim.",
  );
});

it("rejects a mandatory paragraph hidden as an indented code block", () => {
  const text = instructions.replace(/(Text in issues,[^]*?PR description\.)/u, "    $1");
  expect(checkAgentInstructions(fixture(text))).not.toEqual([]);
});

it("rejects the mandatory paragraph indented with a space followed by TAB", () => {
  const text = instructions.replace(/(Text in issues,[^]*?PR description\.)/u, " \t$1");
  expect(checkAgentInstructions(fixture(text))).not.toEqual([]);
});

it.each(["\t", "  \t", "   \t"])(
  "rejects a leading TAB after any supported number of spaces: %j",
  (indentation) => {
    const text = instructions.replace(
      /(Text in issues,[^]*?PR description\.)/u,
      `${indentation}$1`,
    );
    expect(checkAgentInstructions(fixture(text))).not.toEqual([]);
  },
);

it("preserves leading TAB characters inside a legal fenced example", () => {
  const text = `${instructions}\n\`\`\`text\n \tExample\n\`\`\`\n`;
  expect(checkAgentInstructions(fixture(text))).toEqual([]);
});

it("rejects bare CR characters hiding the mandatory paragraph inside fences", () => {
  const text = instructions.replace(
    /(Text in issues,[^]*?PR description\.)/u,
    "\r~~~\r\n\n$1\n\n\r~~~\r\n",
  );
  expect(checkAgentInstructions(fixture(text))).not.toEqual([]);
});

it("preserves supported CRLF line endings", () => {
  expect(checkAgentInstructions(fixture(instructions.replace(/\n/gu, "\r\n")))).toEqual([]);
});

it("rejects bare CR even when it would evade the LF-only line counter", () => {
  const text = instructions + "\rExample".repeat(201);
  expect(checkAgentInstructions(fixture(text))).toContain(
    "AGENTS.md supports only LF or CRLF line endings; bare CR is rejected.",
  );
});

it("rejects the instruction document hidden inside a raw HTML pre block", () => {
  expect(checkAgentInstructions(fixture(`<pre>\n\n${instructions}\n\n</pre>\n`))).not.toEqual([]);
});

it("rejects the mandatory paragraph hidden in prefixed inline HTML details", () => {
  const text = instructions.replace(
    /(Text in issues,[^]*?PR description\.)/u,
    "prefix <details>\n\n$1\n\nsuffix </details>",
  );
  expect(checkAgentInstructions(fixture(text))).not.toEqual([]);
});

it.each([
  ["hidden div", "<div hidden>", "</div>"],
  ["pre", "<pre>", "</pre>"],
  ["hidden span", "<span hidden>", "</span>"],
])("rejects prefixed raw HTML %s around the mandatory paragraph", (_name, opening, closing) => {
  const text = instructions.replace(
    /(Text in issues,[^]*?PR description\.)/u,
    `prefix ${opening}\n\n$1\n\nsuffix ${closing}`,
  );
  expect(checkAgentInstructions(fixture(text))).not.toEqual([]);
});

it.each(["`<ID>`", "``<details>``", "``literal ` and <pre>``"])(
  "preserves literal HTML-like text in a legal code span %s",
  (literal) => {
    expect(checkAgentInstructions(fixture(`${instructions}\nExample: ${literal}\n`))).toEqual([]);
  },
);

it("preserves literal HTML examples inside a legal fenced code block", () => {
  const text = `${instructions}\n\`\`\`html\n<details><div hidden>example</div></details>\n\`\`\`\n`;
  expect(checkAgentInstructions(fixture(text))).toEqual([]);
});

it.each([
  ["longer closing run", "`<details>``"],
  ["shorter closing run", "``<details>`"],
  ["escaped opening", "\\`<details>`"],
  ["unclosed span", "`<details>"],
])("does not let a %s exempt raw HTML from the guard", (_name, literal) => {
  expect(checkAgentInstructions(fixture(`${instructions}\nExample: ${literal}\n`))).not.toEqual([]);
});

it("checks script names with arguments and pnpm run, without executing them", () => {
  const root = fixture(
    instructions + "\n`pnpm run task:claim OVE_SETUP019`\n`pnpm unknown-script`\n",
  );
  expect(checkAgentInstructions(root)).toContain("A pnpm command names an unknown root script.");
});

it.each(["toString", "constructor"])(
  "does not mistake Object.prototype.%s for a script",
  (name) => {
    expect(checkAgentInstructions(fixture(instructions + `\n\`pnpm ${name}\`\n`))).toContain(
      "A pnpm command names an unknown root script.",
    );
  },
);

it("rejects an empty script implementation rather than treating its name as sufficient", () => {
  const root = fixture();
  const path = resolve(root, "package.json");
  const manifest = readManifest(path);
  manifest.scripts = { ...manifest.scripts, "task:next": "" };
  writeFileSync(path, JSON.stringify(manifest));
  expect(checkAgentInstructions(root)).toContain("A pnpm command names an unknown root script.");
});

it.each(["file", "wrong relative target", "absolute target", "missing"])(
  "rejects a CLAUDE.md %s",
  (kind) => {
    const root = fixture();
    const link = resolve(root, "CLAUDE.md");
    rmSync(link);
    if (kind === "file") {
      writeFileSync(link, instructions);
    } else if (kind !== "missing") {
      symlinkSync(kind === "absolute target" ? resolve(root, "AGENTS.md") : "tasks/PLAN.md", link);
    }
    expect(checkAgentInstructions(root)).toContain(
      "CLAUDE.md must be the relative symlink AGENTS.md.",
    );
  },
);

it("Git stages the actual relative symlink as mode 120000", () => {
  const root = fixture();
  const options = { cwd: root, env: isolatedGitEnvironment(), encoding: "utf8" as const };
  execFileSync("git", ["init", "--quiet"], options);
  execFileSync("git", ["add", "AGENTS.md", "CLAUDE.md"], options);
  expect(execFileSync("git", ["ls-files", "--stage", "CLAUDE.md"], options)).toMatch(/^120000 /u);
});

it("rejects oversized instructions and a removed maintenance rule", () => {
  const root = fixture(
    instructions.replace("Rules live in CONVENTIONS;", "Rules elsewhere;") + "\n".repeat(201),
  );
  expect(checkAgentInstructions(root)).toContain("AGENTS.md must contain at most 200 lines.");
  expect(checkAgentInstructions(root)).toContain(
    "The required maintenance rule must remain present.",
  );
});

it("requires the maintenance rule in its final section rather than elsewhere in the document", () => {
  const sentence =
    "Rules live in CONVENTIONS; this file only summarises. When they diverge, CONVENTIONS wins and this file is fixed in the same PR.";
  const text = instructions
    .replace(sentence, "Moved rule.")
    .replace("## Workflow", `${sentence}\n\n## Workflow`);
  expect(checkAgentInstructions(fixture(text))).toContain(
    "The required maintenance rule must remain present.",
  );
});

it.each(["missing.md", "../outside.md", "%2e%2e/outside.md", "javascript:alert(1)"])(
  "rejects a missing or unsafe reference %s",
  (target) => {
    expect(checkAgentInstructions(fixture(instructions + `\n[reference](${target})\n`))).toContain(
      "A linked local file is missing, unsafe or uses unsupported link syntax.",
    );
  },
);

it("rejects linked files that escape through a real symlink", () => {
  const outside = fixture();
  const root = fixture(instructions + "\n[outside](outside.md)\n");
  symlinkSync(resolve(outside, "AGENTS.md"), resolve(root, "outside.md"));
  expect(checkAgentInstructions(root)).toContain(
    "A linked local file is missing, unsafe or uses unsupported link syntax.",
  );
});

it("fails closed instead of following AGENTS.md or package.json symlinks", () => {
  const outside = fixture();
  for (const name of ["AGENTS.md", "package.json"]) {
    const root = fixture();
    rmSync(resolve(root, name));
    symlinkSync(resolve(outside, name), resolve(root, name));
    expect(checkAgentInstructions(root)).toEqual([
      "AGENTS.md and package.json must be readable regular files with a valid manifest.",
    ]);
  }
});

it("rejects missing input and malformed manifests with redacted diagnostics", () => {
  const root = fixture();
  writeFileSync(resolve(root, "package.json"), "not JSON");
  expect(checkAgentInstructions(root)).toEqual([
    "AGENTS.md and package.json must be readable regular files with a valid manifest.",
  ]);
  rmSync(resolve(root, "AGENTS.md"));
  expect(checkAgentInstructions(root)).toHaveLength(1);
});

it("rejects unchecked reference-style links", () => {
  const root = fixture(instructions + "\n[reference][missing]\n\n[missing]: absent.md\n");
  expect(checkAgentInstructions(root)).toContain(
    "Use inline Markdown links so every local reference can be checked.",
  );
});

it.each([
  "gh" + "p_" + "A".repeat(36),
  "-----BEGIN " + "PRIVATE KEY-----",
  "password=" + "A".repeat(24),
  "https://localhost/internal",
  "https://10.0.0.1/internal",
  "https://team.internal/policy",
  "owner@example.com",
])("rejects sensitive content without disclosing the matching value", (value) => {
  const errors = checkAgentInstructions(fixture(instructions + `\n${value}\n`));
  expect(errors).toContain(
    "AGENTS.md contains credential-like or private-contact content; redact it.",
  );
  expect(errors.join("\n")).not.toContain(value);
});
