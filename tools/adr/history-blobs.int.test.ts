import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "vitest";
import { isolatedGitEnvironment } from "../hooks/git-test-environment.ts";
import { nodeGit } from "./ports.ts";
import { fixture } from "./public-cli-fixture.ts";

function historyFixture() {
  const current = fixture();
  const environment = {
    ...isolatedGitEnvironment(),
    HOME: resolve(current.parent, "reader-home"),
    XDG_CONFIG_HOME: resolve(current.parent, "reader-xdg"),
  };
  mkdirSync(environment.HOME);
  mkdirSync(environment.XDG_CONFIG_HOME);
  return { ...current, reader: nodeGit(current.root, environment) };
}

const invalidResponse = "ADR history blob response is invalid";

test("real Git blob batching preserves UTF-8, CRLF and header-looking source bytes", () => {
  const { parent, root, git, reader } = historyFixture();
  try {
    const first = "docs/adr/0091-byte-source.md";
    const second = "docs/adr/0092-other-source.md";
    const source = Buffer.from(
      [
        "\uFEFF# Byte fixture",
        "",
        "Unicode: café, żółć, 🙂.",
        "a".repeat(40) + " blob 9",
        "",
        "",
      ].join("\r\n"),
      "utf8",
    );
    writeFileSync(resolve(root, first), source);
    writeFileSync(resolve(root, second), "# Other fixture\n\nKeep trailing spaces.  \n");
    git(["add", "."]);
    git(["commit", "--quiet", "-m", "docs: record exact source bytes"]);
    const head = git(["rev-parse", "HEAD"]).trim();
    const requests = [`${head}:${first}`, `${head}:${second}`];
    const blobs = reader.readBlobs([...requests, requests[0] ?? ""]);
    expect(blobs.size).toBe(2);
    for (const [index, path] of [first, second].entries()) {
      const request = requests[index] ?? "";
      expect(Buffer.from(blobs.get(request) ?? "", "utf8")).toEqual(
        readFileSync(resolve(root, path)),
      );
      expect(blobs.get(request)).toBe(reader.run(["show", request]));
    }
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
}, 15000);

test.each(["missing", "nonblob"])(
  "real Git blob batching safely denies a %s object",
  (kind) => {
    const { parent, root, git, reader } = historyFixture();
    try {
      const tree = "docs/adr/0093-tree.md";
      mkdirSync(resolve(root, tree));
      writeFileSync(resolve(root, tree, "entry.txt"), "Harmless tree entry.\n");
      git(["add", "."]);
      git(["commit", "--quiet", "-m", "docs: record an object-type fixture"]);
      const head = git(["rev-parse", "HEAD"]).trim();
      const path = kind === "missing" ? "docs/adr/0099-missing.md" : tree;
      const before = git(["rev-parse", "HEAD"]).trim();
      expect(() => reader.readBlobs([`${head}:${path}`])).toThrow(invalidResponse);
      expect(git(["rev-parse", "HEAD"]).trim()).toBe(before);
      expect(git(["status", "--porcelain"])).toBe("");
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  },
  15000,
);

test("batch admission keeps the original individual-show success and size denial", () => {
  const { parent, root, git, reader } = historyFixture();
  try {
    const small = "docs/adr/0094-small-source.md";
    const large = "docs/adr/0095-large-source.md";
    const excessive = "docs/adr/0096-excessive-source.md";
    const payload = "x".repeat(2 * 1024 * 1024 - 1);
    writeFileSync(resolve(root, small), "# Small fixture\n");
    writeFileSync(resolve(root, large), payload);
    writeFileSync(resolve(root, excessive), "x".repeat(2 * 1024 * 1024 + 1));
    git(["add", "."]);
    git(["commit", "--quiet", "-m", "docs: record bounded blob fixtures"]);
    const head = git(["rev-parse", "HEAD"]).trim();
    const requests = [small, large, excessive].map((path) => `${head}:${path}`);
    const blobs = reader.readBlobs(requests);
    expect(blobs.get(requests[0] ?? "")).toBe("# Small fixture\n");
    expect(blobs.has(requests[1] ?? "")).toBe(false);
    expect(blobs.has(requests[2] ?? "")).toBe(false);
    const individuallyRead = reader.run(["show", requests[1] ?? ""]);
    expect(individuallyRead === payload).toBe(true);
    expect(() => reader.run(["show", requests[2] ?? ""])).toThrow(
      "ADR Git operation is unavailable or exceeds its limits",
    );
    expect(git(["status", "--porcelain"])).toBe("");
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
}, 15000);

test("batch requests require immutable commits and canonical unambiguous ADR paths", () => {
  const { parent, git, reader } = historyFixture();
  try {
    const head = git(["rev-parse", "HEAD"]).trim();
    for (const request of [
      "HEAD:docs/adr/0091-byte-source.md",
      `${head}:docs/adr/../adr/0091-byte-source.md`,
      `${head}:docs/adr/0091-byte-source.md:extra`,
      `${head}:docs/adr/0091-byte-source.md\n${head}:docs/adr/0092-other-source.md`,
      `${head}:docs/adr/0091-byte-source.md\0`,
    ]) {
      expect(() => reader.readBlobs([request])).toThrow("Invalid ADR history blob request");
    }
    expect(git(["status", "--porcelain"])).toBe("");
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
}, 15000);
