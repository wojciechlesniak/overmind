import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";
import { openDatabase } from "./driver-node.ts";
import { configure, scalar } from "./features.ts";
import type { DatabasePort } from "./driver-port.ts";

async function fixture(run: (db: DatabasePort, directory: string) => void | Promise<void>) {
  const directory = mkdtempSync("/private/tmp/ove11-adapter-");
  const db = openDatabase(join(directory, "source.db"));
  try {
    configure(db);
    await run(db, directory);
  } finally {
    db.close();
    rmSync(directory, { recursive: true, force: true });
  }
}
it("retains the required WAL/foreign-key/busy/synchronous policy on Node22", async () => {
  expect(process.versions.node).toBe("22.23.3");
  await fixture((db) => {
    expect(scalar(db, "PRAGMA journal_mode")).toBe("wal");
    expect(scalar(db, "PRAGMA busy_timeout")).toBe(5000);
    expect(scalar(db, "PRAGMA foreign_keys")).toBe(1);
    expect(scalar(db, "PRAGMA synchronous")).toBe(1);
  });
});
it("supports migrations, JSON and ranked FTS5 without leaking driver objects", async () => {
  await fixture((db) => {
    db.exec(
      "PRAGMA user_version=7; CREATE VIRTUAL TABLE search USING fts5(text); INSERT INTO search VALUES('overmind engine');",
    );
    expect(scalar(db, "PRAGMA user_version")).toBe(7);
    expect(scalar(db, "SELECT json_extract('{\"version\":7}', '$.version')")).toBe(7);
    expect(
      db.prepare("SELECT text FROM search WHERE search MATCH ? ORDER BY rank").all("engine"),
    ).toEqual([{ text: "overmind engine" }]);
    expect(
      db.prepare("SELECT text FROM search WHERE search MATCH ?").get("missing"),
    ).toBeUndefined();
  });
});
it("rolls back transaction writes after a real SQLite constraint error", async () => {
  await fixture((db) => {
    db.exec("CREATE TABLE events(id INTEGER PRIMARY KEY); BEGIN; INSERT INTO events VALUES(1);");
    expect(() => {
      db.exec("INSERT INTO events VALUES(1)");
    }).toThrow();
    db.exec("ROLLBACK");
    expect(scalar(db, "SELECT count(*) FROM events")).toBe(0);
  });
});
it("awaits the native backup API before opening an integrity-checked copy", async () => {
  await fixture(async (db, directory) => {
    db.exec("CREATE TABLE events(id INTEGER PRIMARY KEY); INSERT INTO events VALUES(42);");
    if (!db.backupViaAPI) {
      throw new Error("Missing Node backup API");
    }
    const file = join(directory, "backup.db");
    await db.backupViaAPI(file);
    const copy = openDatabase(file);
    try {
      expect(scalar(copy, "PRAGMA integrity_check")).toBe("ok");
      expect(scalar(copy, "SELECT id FROM events")).toBe(42);
    } finally {
      copy.close();
    }
  });
});
