import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
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

test("public allocation refuses a mapped next-number collision without changing inputs", () => {
  const { parent, root, git, cli } = fixture();
  try {
    const head = git(["rev-parse", "HEAD"]).trim();
    const mapPath = resolve(root, "docs/adr/slug-map.json");
    const map = parseSlugMap(readFileSync(mapPath, "utf8"));
    map.additional.push({
      adr: 31,
      slug: "mapped-reservation",
      polishOriginal: null,
      title: "Keep the mapped reservation",
    });
    writeFileSync(mapPath, JSON.stringify(map, null, 2) + "\n");
    expect(parseSlugMap(readFileSync(mapPath, "utf8")).additional.at(-1)?.adr).toBe(31);
    expect(existsSync(resolve(root, "docs/adr/0031-mapped-reservation.md"))).toBe(false);
    const before = snapshot(root);
    const denied = cli("new.ts", ["Refuse mapped collision"]);
    expect(denied.status).toBe(1);
    expect(denied.stderr).toContain("ADR number is already mapped");
    expect(snapshot(root)).toEqual(before);
    expect(git(["rev-parse", "HEAD"]).trim()).toBe(head);
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
}, 15000);

test("public allocation includes a local reservation above every published number", () => {
  const { parent, root, git, cli } = fixture();
  try {
    const head = git(["rev-parse", "HEAD"]).trim();
    const reserved = resolve(root, "docs/adr/0037-local-highest.md");
    writeFileSync(reserved, "Local reservation only.\n");
    const created = cli("new.ts", ["Choose local reservation"]);
    expect(created.status).toBe(0);
    expect(created.stdout.trim()).toBe("docs/adr/0038-choose-local-reservation.md");
    const record = parseAdr(
      "0038-choose-local-reservation.md",
      readFileSync(resolve(root, created.stdout.trim()), "utf8"),
    );
    expect(record.meta.adr).toBe(38);
    expect(record.meta.status).toBe("proposed");
    expect(readFileSync(reserved, "utf8")).toBe("Local reservation only.\n");
    expect(git(["rev-parse", "HEAD"]).trim()).toBe(head);
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
}, 15000);

test("public allocation fetches a newer remote DEVELOP without changing the checkout", () => {
  const { parent, root, remote, git, cli } = fixture();
  try {
    const head = git(["rev-parse", "HEAD"]).trim();
    const peer = resolve(parent, "publisher");
    git(["clone", "--quiet", "--branch", "DEVELOP", remote, peer], parent);
    git(["config", "user.name", "ADR publisher"], peer);
    git(["config", "user.email", "adr-publisher@example.invalid"], peer);
    writeFileSync(
      resolve(peer, "docs/adr/0044-remote-develop.md"),
      "Remote DEVELOP reservation only.\n",
    );
    git(["add", "."], peer);
    git(["commit", "--quiet", "-m", "docs: publish a newer reservation"], peer);
    git(["push", "--quiet", "origin", "DEVELOP"], peer);
    const published = git(["rev-parse", "HEAD"], peer).trim();
    expect(published).not.toBe(head);
    expect(git(["rev-parse", "origin/DEVELOP"]).trim()).toBe(head);
    const created = cli("new.ts", ["Choose fetched DEVELOP"]);
    expect(created.status).toBe(0);
    expect(created.stdout.trim()).toBe("docs/adr/0045-choose-fetched-develop.md");
    const record = parseAdr(
      "0045-choose-fetched-develop.md",
      readFileSync(resolve(root, created.stdout.trim()), "utf8"),
    );
    expect(record.meta.adr).toBe(45);
    expect(record.meta.status).toBe("proposed");
    expect(git(["rev-parse", "origin/DEVELOP"]).trim()).toBe(published);
    expect(git(["rev-parse", "HEAD"]).trim()).toBe(head);
    expect(git(["branch", "--show-current"]).trim()).toBe("DEVELOP");
    expect(existsSync(resolve(root, "docs/adr/0044-remote-develop.md"))).toBe(false);
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
}, 15000);

test("public renumber and index commands leave a complete conforming repository checkable", () => {
  const { parent, root, cli } = fixture(true);
  try {
    const archivedEntry = parseSlugMap(
      readFileSync(resolve(root, "docs/adr/slug-map.json"), "utf8"),
    ).originals[0];
    if (!archivedEntry) {
      throw new Error("Missing original ADR fixture");
    }
    const archive = resolve(root, "docs/pl/adr/0001-raw-original.md");
    const archivedBytes = Buffer.from(
      [
        "\ufeff<!-- Oryginał: zachowaj bajty, odstępy i komentarze. -->",
        "# Decyzja źródłowa",
        "",
        `[ADR 0001](../../adr/0001-${archivedEntry.slug}.md)`,
        "",
        "Zachowaj  dwa odstępy, tabulator:\t oraz koniec wiersza.  ",
        "",
      ].join("\r\n"),
      "utf8",
    );
    mkdirSync(resolve(root, "docs/pl/adr"), { recursive: true });
    writeFileSync(archive, archivedBytes);
    expect(cli("check.ts").status).toBe(0);
    expect(readFileSync(archive)).toEqual(archivedBytes);
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
    expect(readFileSync(archive)).toEqual(archivedBytes);
    expect(cli("renumber.ts", ["31", "32", "--apply"]).status).toBe(0);
    expect(readFileSync(archive)).toEqual(archivedBytes);
    expect(existsSync(resolve(root, collided))).toBe(false);
    expect(readFileSync(resolve(root, "docs/notes.md"), "utf8")).toBe(
      '[ADR 0032](adr/0032-keep-a-proposal.md#confirmation "Proposal")\n',
    );
    const body = readFileSync(original, "utf8");
    expect(body).toContain('[ADR 0032](0032-keep-a-proposal.md#confirmation "Self")');
    expect(body).toContain(example);
    expect(cli("check.ts").status).toBe(0);
    expect(readFileSync(archive)).toEqual(archivedBytes);
    expect(cli("gen-index.ts").status).toBe(0);
    expect(readFileSync(archive)).toEqual(archivedBytes);
    expect(cli("gen-index.ts", ["--check"]).status).toBe(0);
    expect(readFileSync(archive)).toEqual(archivedBytes);
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
    expect(readFileSync(archive)).toEqual(archivedBytes);
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
}, 15000);

test.each(["Use `literal` identifiers", "Use *literal* emphasis"])(
  "public allocation renders the literal title %s as valid Markdown data",
  (title) => {
    const { parent, root, cli } = fixture();
    try {
      const created = cli("new.ts", [title]);
      expect(created.status, created.stderr).toBe(0);
      const path = created.stdout.trim();
      expect(path).toMatch(/^docs\/adr\/0031-[a-z0-9-]+\.md$/u);
      const record = parseAdr(
        path.slice("docs/adr/".length),
        readFileSync(resolve(root, path), "utf8"),
      );
      expect(record.meta.title).toBe(title);
      const checked = cli("check.ts");
      expect(checked.status, checked.stderr).toBe(0);
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  },
  15000,
);
