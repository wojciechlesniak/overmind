import { spawn, execFileSync } from "node:child_process";
import { once } from "node:events";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { openDatabase, driver } from "./driver-default.ts";
import { number, record } from "./probe-input.parse-boundary.ts";
import type { DatabasePort } from "./driver-port.ts";

export function configure(db: DatabasePort): void {
  db.exec(
    "PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; PRAGMA foreign_keys=ON; PRAGMA synchronous=NORMAL;",
  );
}
export function scalar(db: DatabasePort, sql: string): unknown {
  return Object.values(record(db.prepare(sql).get()))[0];
}
export async function features(directory: string, extension: string) {
  const path = join(directory, "features.db");
  const db = openDatabase(path);
  configure(db);
  const pragmas = Object.fromEntries(
    ["journal_mode", "busy_timeout", "foreign_keys", "synchronous"].map((key) => [
      key,
      scalar(db, `PRAGMA ${key}`),
    ]),
  );
  if (
    pragmas["journal_mode"] !== "wal" ||
    pragmas["busy_timeout"] !== 5000 ||
    pragmas["foreign_keys"] !== 1 ||
    pragmas["synchronous"] !== 1
  ) {
    throw new Error("Required SQLite pragmas failed");
  }
  db.exec(
    "CREATE VIRTUAL TABLE search USING fts5(text); INSERT INTO search VALUES('overmind engine'),('other text');",
  );
  const fts = db
    .prepare(
      "SELECT text, bm25(search) AS rank FROM search WHERE search MATCH 'engine' ORDER BY rank",
    )
    .all();
  if (fts.length !== 1 || record(fts[0])["text"] !== "overmind engine") {
    throw new Error("FTS5 ranking failed");
  }
  db.exec(
    "CREATE TABLE events(id INTEGER PRIMARY KEY, ts INTEGER NOT NULL, type TEXT NOT NULL, payload TEXT NOT NULL); CREATE INDEX events_type ON events(type, id);",
  );
  const insert = db.prepare("INSERT INTO events VALUES(?, ?, ?, ?)");
  const started = performance.now();
  db.exec("BEGIN IMMEDIATE");
  for (let id = 1; id <= 100000; id++) {
    insert.run(id, id, "probe", JSON.stringify({ id, valid: true }));
  }
  db.exec("COMMIT");
  const insertMs = performance.now() - started;
  const readStart = performance.now();
  const selected = db
    .prepare(
      "SELECT id, payload FROM events INDEXED BY events_type WHERE type=? AND id BETWEEN ? AND ?",
    )
    .all("probe", 40000, 40099);
  const readMs = performance.now() - readStart;
  if (selected.length !== 100 || record(selected[0])["id"] !== 40000) {
    throw new Error("Indexed read failed");
  }
  db.exec("PRAGMA user_version=11");
  const userVersion = scalar(db, "PRAGMA user_version");
  const jsonValue = scalar(db, "SELECT json_extract(payload, '$.id') FROM events WHERE id=42");
  if (userVersion !== 11 || jsonValue !== 42) {
    throw new Error("Migration/JSON failed");
  }
  const writer = spawn(process.execPath, ["--mode", "writer", "--dir", directory], {
    stdio: ["ignore", "pipe", "pipe"],
  });
  try {
    await Promise.race([
      once(writer.stdout, "data"),
      once(writer, "exit").then(() => {
        throw new Error("Writer exited early");
      }),
      delay(5000).then(() => {
        throw new Error("Writer ready timeout");
      }),
    ]);
    const before = number(scalar(db, "SELECT count(*) FROM events"));
    if (before <= 100000) {
      throw new Error("Writer did not modify database");
    }
    const backupFile = join(directory, "vacuum-backup.db");
    db.exec(`VACUUM INTO '${backupFile.replaceAll("'", "''")}'`);
    const copied = openDatabase(backupFile);
    const backupCount = number(scalar(copied, "SELECT count(*) FROM events"));
    const integrity = scalar(copied, "PRAGMA integrity_check");
    const malformed = scalar(
      copied,
      "SELECT count(*) FROM events WHERE json_extract(payload, '$.id') != id",
    );
    copied.close();
    let apiBackup: string | number = "unavailable";
    if (db.backupViaAPI) {
      const apiFile = join(directory, "api-backup.db");
      await db.backupViaAPI(apiFile);
      const api = openDatabase(apiFile);
      if (scalar(api, "PRAGMA integrity_check") !== "ok") {
        throw new Error("API backup corrupt");
      }
      apiBackup = number(scalar(api, "SELECT count(*) FROM events"));
      api.close();
    }
    await delay(75);
    const after = number(scalar(db, "SELECT count(*) FROM events"));
    if (
      integrity !== "ok" ||
      malformed !== 0 ||
      backupCount < before ||
      backupCount > after ||
      after <= before
    ) {
      throw new Error("Consistent active-writer backup failed");
    }
    let extensionResult = "loaded";
    try {
      db.loadExtension(extension);
    } catch (error) {
      extensionResult = error instanceof Error ? error.message : "load failed";
    }
    const childOutput = execFileSync("/usr/bin/printf", ["child-ok"], {
      encoding: "utf8",
      timeout: 2000,
    });
    if (childOutput !== "child-ok") {
      throw new Error("Child output failed");
    }
    return {
      driver,
      pragmas,
      fts: "pass",
      insertRows: 100000,
      insertMs,
      rowsPerSecond: 100000000 / insertMs,
      indexedReadRows: selected.length,
      readMs,
      before,
      backupCount,
      after,
      integrity,
      apiBackup,
      userVersion,
      jsonValue,
      extension: extensionResult,
      childOutput,
      sqlite: scalar(db, "SELECT sqlite_version()"),
    };
  } finally {
    writer.kill("SIGTERM");
    await Promise.race([
      once(writer, "exit"),
      delay(2000).then(() => {
        writer.kill("SIGKILL");
      }),
    ]);
    db.close();
  }
}
