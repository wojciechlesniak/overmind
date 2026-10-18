import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "vitest";
import { parseSlugMap } from "./input.parse-boundary.ts";
import { fixture, snapshot } from "./public-cli-fixture.ts";

test.each(["check.ts", "gen-index.ts"])(
  "public %s rejects duplicate unpublished map identities without modifying inputs",
  (entry) => {
    const { parent, root, git, cli } = fixture();
    try {
      expect(cli("new.ts", ["Keep an unpublished identity"]).status).toBe(0);
      const path = resolve(root, "docs/adr/slug-map.json");
      const map = parseSlugMap(readFileSync(path, "utf8"));
      const proposal = map.additional.find((item) => item.adr === 31);
      if (!proposal) {
        throw new Error("Missing unpublished identity fixture");
      }
      map.additional.push({ ...proposal });
      const source = JSON.stringify(map, null, 2) + "\n";
      expect(() => parseSlugMap(source)).not.toThrow();
      writeFileSync(path, source);
      const before = snapshot(root);
      const head = git(["rev-parse", "HEAD"]);
      const index = readFileSync(resolve(root, ".git/index"));
      const config = readFileSync(resolve(root, ".git/config"));
      const result = cli(entry);
      expect(result.status, result.stderr).toBe(1);
      expect(result.stderr).toContain("ADR slug map identities must be unique");
      expect(snapshot(root)).toEqual(before);
      expect(git(["rev-parse", "HEAD"])).toBe(head);
      expect(readFileSync(resolve(root, ".git/index"))).toEqual(index);
      expect(readFileSync(resolve(root, ".git/config"))).toEqual(config);
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  },
  15000,
);

test("public renumber refuses a mapped but absent target in dry-run and apply", () => {
  const { parent, root, git, cli } = fixture();
  try {
    expect(cli("new.ts", ["Keep a proposal"]).status).toBe(0);
    const path = resolve(root, "docs/adr/slug-map.json");
    const map = parseSlugMap(readFileSync(path, "utf8"));
    map.additional.push({
      adr: 32,
      slug: "reserved-target",
      polishOriginal: null,
      title: "Keep the target reservation",
    });
    writeFileSync(path, JSON.stringify(map, null, 2) + "\n");
    const before = snapshot(root);
    const head = git(["rev-parse", "HEAD"]);
    const index = readFileSync(resolve(root, ".git/index"));
    const config = readFileSync(resolve(root, ".git/config"));
    const dryRun = cli("renumber.ts", ["31", "32"]);
    const afterDryRun = snapshot(root);
    const apply = cli("renumber.ts", ["31", "32", "--apply"]);
    expect([dryRun.status, apply.status]).toEqual([1, 1]);
    for (const result of [dryRun, apply]) {
      expect(result.stderr).toContain("Renumber target is already mapped");
    }
    expect(afterDryRun).toEqual(before);
    expect(snapshot(root)).toEqual(before);
    expect(git(["rev-parse", "HEAD"])).toBe(head);
    expect(readFileSync(resolve(root, ".git/index"))).toEqual(index);
    expect(readFileSync(resolve(root, ".git/config"))).toEqual(config);
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
}, 15000);
