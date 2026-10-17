import { existsSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "vitest";
import { parseAdr, parseSlugMap, renderAdr } from "./input.parse-boundary.ts";
import { fixture, snapshot } from "./public-cli-fixture.ts";

test("public allocation honors real local and remote reservations and denies an unavailable origin", () => {
  const { parent, root, git, cli } = fixture();
  try {
    git(["checkout", "-b", "task/OVE_TEST001"]);
    writeFileSync(resolve(root, "docs/adr/0035-reserved.md"), "Remote reservation only.\n");
    git(["add", "."]);
    git(["commit", "--quiet", "-m", "docs: reserve a number"]);
    git(["push", "--quiet", "origin", "task/OVE_TEST001"]);
    git(["checkout", "DEVELOP"]);
    const local = resolve(root, "docs/adr/0033-local-reservation.md");
    writeFileSync(local, "Local reservation only.\n");
    const created = cli("new.ts", ["Use branch reservations"]);
    expect(created.status).toBe(0);
    expect(created.stdout.trim()).toBe("docs/adr/0036-use-branch-reservations.md");
    const record = parseAdr(
      "0036-use-branch-reservations.md",
      readFileSync(resolve(root, created.stdout.trim()), "utf8"),
    );
    expect(record.meta.adr).toBe(36);
    expect(record.meta.status).toBe("proposed");
    expect(readFileSync(local, "utf8")).toBe("Local reservation only.\n");
    expect(git(["branch", "--show-current"]).trim()).toBe("DEVELOP");
    const before = snapshot(root);
    git(["remote", "set-url", "origin", resolve(parent, "missing.git")]);
    expect(cli("new.ts", ["Refuse unavailable state"]).status).toBe(1);
    expect(snapshot(root)).toEqual(before);
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
}, 15000);

test("public renumber and index commands leave a complete conforming repository checkable", () => {
  const { parent, root, cli } = fixture(true);
  try {
    expect(cli("check.ts").status).toBe(0);
    const created = cli("new.ts", ["Keep a proposal"]);
    expect(created.status).toBe(0);
    expect(created.stdout.trim()).toBe("docs/adr/0032-keep-a-proposal.md");
    const original = resolve(root, created.stdout.trim());
    const collided = "docs/adr/0031-keep-a-proposal.md";
    const proposal = parseAdr("0032-keep-a-proposal.md", readFileSync(original, "utf8"));
    renameSync(original, resolve(root, collided));
    const example = "`[ADR 0031](0031-keep-a-proposal.md#confirmation)`";
    writeFileSync(
      resolve(root, collided),
      renderAdr(
        { ...proposal.meta, adr: 31 },
        proposal.body +
          `\n## Confirmation\n\n[ADR 0031](0031-keep-a-proposal.md#confirmation "Self")\n\n${example}\n`,
      ),
    );
    const mapPath = resolve(root, "docs/adr/slug-map.json");
    const map = parseSlugMap(readFileSync(mapPath, "utf8"));
    const entry = map.additional.find((item) => item.adr === 32);
    if (!entry) {
      throw new Error("Missing created proposal");
    }
    entry.adr = 31;
    writeFileSync(mapPath, JSON.stringify(map, null, 2) + "\n");
    writeFileSync(
      resolve(root, "docs/notes.md"),
      '[ADR 0031](adr/0031-keep-a-proposal.md#confirmation "Proposal")\n',
    );
    expect(cli("check.ts").status).toBe(1);
    const before = snapshot(root);
    expect(cli("renumber.ts", ["31", "32"]).status).toBe(0);
    expect(snapshot(root)).toEqual(before);
    expect(cli("renumber.ts", ["31", "32", "--apply"]).status).toBe(0);
    expect(existsSync(resolve(root, collided))).toBe(false);
    expect(readFileSync(resolve(root, "docs/notes.md"), "utf8")).toBe(
      '[ADR 0032](adr/0032-keep-a-proposal.md#confirmation "Proposal")\n',
    );
    const body = readFileSync(original, "utf8");
    expect(body).toContain('[ADR 0032](0032-keep-a-proposal.md#confirmation "Self")');
    expect(body).toContain(example);
    expect(cli("check.ts").status).toBe(0);
    expect(cli("gen-index.ts").status).toBe(0);
    expect(cli("gen-index.ts", ["--check"]).status).toBe(0);
    const indexPath = resolve(root, "docs/adr/README.md");
    const index = readFileSync(indexPath, "utf8");
    expect(index).toContain("superseded by 0023");
    expect(index).toContain("supersedes 0001");
    writeFileSync(indexPath, index.replace("| 0032 |", "| 9999 |"));
    const stale = cli("gen-index.ts", ["--check"]);
    expect(stale.status).toBe(1);
    expect(stale.stderr).toContain("ADR index is stale");
    writeFileSync(indexPath, index);
    expect(cli("check.ts").status).toBe(0);
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
}, 15000);
