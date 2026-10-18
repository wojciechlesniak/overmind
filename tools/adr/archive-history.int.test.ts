import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import { expect, test } from "vitest";
import { parseAdr, parseSlugMap, renderAdr } from "./input.parse-boundary.ts";
import { fixture, snapshot } from "./public-cli-fixture.ts";

test.each(["complete", "missing", "tampered"] as const)(
  "public check validates a mapped canonical rename with %s historical archive",
  (kind) => {
    const { parent, root, git, cli } = fixture(false, true);
    try {
      const initial = git(["rev-parse", "HEAD"]).trim();
      const mapPath = resolve(root, "docs/adr/slug-map.json");
      const mapBytes = readFileSync(mapPath);
      const entry = parseSlugMap(mapBytes.toString("utf8")).originals[1];
      if (!entry?.polishOriginal) {
        throw new Error("Missing original translation fixture");
      }
      const oldPath = `docs/adr/${entry.polishOriginal}`;
      const canonicalPath = `docs/adr/0002-${entry.slug}.md`;
      const archive = `docs/pl/adr/${entry.polishOriginal}`;
      const source = readFileSync(resolve(root, oldPath));
      const record = parseAdr(basename(oldPath), source.toString("utf8"));
      expect(record.meta.status).toBe("accepted");
      expect(Buffer.from(git(["show", `${initial}:${oldPath}`]), "utf8")).toEqual(source);
      expect(existsSync(resolve(root, canonicalPath))).toBe(false);
      mkdirSync(resolve(root, "docs/pl/adr"), { recursive: true });
      if (kind !== "missing") {
        writeFileSync(
          resolve(root, archive),
          kind === "complete"
            ? source
            : Buffer.concat([source, Buffer.from("\nHarmless archival fixture edit.\n", "utf8")]),
        );
      }
      renameSync(resolve(root, oldPath), resolve(root, canonicalPath));
      const translated = {
        ...record.meta,
        translation_of: archive,
        source_sha256: createHash("sha256").update(source).digest("hex"),
        translated_on: "2026-10-17",
        translation_status: "reviewed" as const,
        translator: "Fixture translator",
      };
      writeFileSync(resolve(root, canonicalPath), renderAdr(translated, record.body));
      const current = parseAdr(
        basename(canonicalPath),
        readFileSync(resolve(root, canonicalPath), "utf8"),
      );
      expect(current.meta).toEqual(translated);
      expect(current.body).toBe(record.body);
      expect(readFileSync(mapPath)).toEqual(mapBytes);
      git(["add", "."]);
      git(["commit", "--quiet", "-m", "docs: preserve mapped translation history"]);
      git(["push", "--quiet", "origin", "DEVELOP"]);
      git(["fetch", "--quiet", "--no-tags", "origin", "DEVELOP"]);
      const renamed = git(["rev-parse", "HEAD"]).trim();
      expect(renamed).not.toBe(initial);
      expect(git(["rev-parse", "origin/DEVELOP"]).trim()).toBe(renamed);
      expect(Buffer.from(git(["show", `${renamed}:docs/adr/slug-map.json`]), "utf8")).toEqual(
        mapBytes,
      );
      expect(
        git(["log", "--format=%H", "--reverse", "HEAD", "--", ":(glob)docs/adr/0002-*.md"])
          .trim()
          .split("\n"),
      ).toEqual([initial, renamed]);
      expect(git(["status", "--porcelain"])).toBe("");
      const before = snapshot(root);
      const index = readFileSync(resolve(root, ".git/index"));
      const config = readFileSync(resolve(root, ".git/config"));
      const result = cli("check.ts");
      expect(result.signal).toBeNull();
      expect(result.status).toBe(kind === "complete" ? 0 : 1);
      expect(result.stdout).toBe("");
      expect(result.stderr).toBe(
        kind === "complete"
          ? ""
          : kind === "missing"
            ? "ADR Git operation is unavailable or exceeds its limits\n"
            : "ADR history contains an unpreserved identity rename\n",
      );
      expect(snapshot(root)).toEqual(before);
      expect(readFileSync(resolve(root, ".git/index"))).toEqual(index);
      expect(readFileSync(resolve(root, ".git/config"))).toEqual(config);
      expect(git(["rev-parse", "HEAD"]).trim()).toBe(renamed);
      expect(git(["rev-parse", "origin/DEVELOP"]).trim()).toBe(renamed);
      expect(readFileSync(mapPath)).toEqual(mapBytes);
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  },
  15000,
);
