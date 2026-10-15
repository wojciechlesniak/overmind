import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { forbiddenFiles } from "./no-forbidden-files.mjs";
it("blocks secret filename patterns, including nested and upper-case extensions", () => {
  const forbidden = [
    ".env",
    ".env.local",
    "nested/.env.example",
    "key.p12",
    "key.P8",
    "a.pem",
    "a.key",
    "id_rsa.pub",
    "nested/login.keychain-db",
  ];
  expect(forbiddenFiles([...forbidden, "ünï code.md", "file.ts", "environment.md"])).toEqual(
    forbidden,
  );
});

it("hook scripts use only Node imports and contain no network or shell execution", () => {
  for (const name of ["no-forbidden-files", "no-large-files", "prepare"]) {
    const source = readFileSync(new URL(`./${name}.mjs`, import.meta.url), "utf8");
    for (const match of source.matchAll(/from "([^"]+)"/gu)) {
      expect(match[1]).toMatch(/^node:/u);
    }
    expect(source).not.toMatch(/\bfetch\s*\(|https?:|shell:\s*true|execSync\(/u);
  }
});
