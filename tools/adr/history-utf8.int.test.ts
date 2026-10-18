import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "vitest";
import { parseSlugMap } from "./input.parse-boundary.ts";
import { fixture, snapshot } from "./public-cli-fixture.ts";

test.each(["batch", "individual"])(
  "public checking refuses invalid UTF-8 through the %s historical read",
  (route) => {
    const { parent, root, git, cli } = fixture();
    try {
      const first = parseSlugMap(readFileSync(resolve(root, "docs/adr/slug-map.json"), "utf8"))
        .originals[0];
      if (!first) {
        throw new Error("Missing superseded identity fixture");
      }
      const path = `docs/adr/0001-${first.slug}.md`;
      const prefix = Buffer.concat([
        readFileSync(resolve(root, path)),
        Buffer.from("\nHistory decoding fixture: ", "utf8"),
      ]);
      const valid = Buffer.concat([prefix, Buffer.from("\uFFFD.\n", "utf8")]);
      const invalid = Buffer.concat([prefix, Buffer.from([0xff]), Buffer.from(".\n")]);
      // Amend only this disposable fixture root so the first source selects its route.
      writeFileSync(resolve(root, path), route === "batch" ? invalid : valid);
      git(["add", "--", path]);
      git(["commit", "--amend", "--no-edit", "--quiet"]);
      git(["update-ref", "refs/remotes/origin/DEVELOP", "HEAD"]);
      if (route === "individual") {
        writeFileSync(resolve(root, path), invalid);
        git(["add", "--", path]);
        git(["commit", "--quiet", "-m", "docs: retain a historical byte fixture"]);
      }
      writeFileSync(resolve(root, path), valid);
      const before = snapshot(root);
      const head = git(["rev-parse", "HEAD"]);
      const index = readFileSync(resolve(root, ".git/index"));
      const config = readFileSync(resolve(root, ".git/config"));
      const result = cli("check.ts");
      expect(result.status, result.stderr).toBe(1);
      expect(result.stderr).toContain("ADR Git text is not valid UTF-8");
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
