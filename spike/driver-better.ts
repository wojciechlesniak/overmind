import BetterDatabase from "better-sqlite3";
import { dirname, resolve } from "node:path";
import type { DatabasePort } from "./driver-port.ts";
export const driver = "better-sqlite3";
export function openDatabase(path: string): DatabasePort {
  const addon = { exports: {} };
  process.dlopen(
    addon,
    resolve(dirname(process.execPath), "../Resources/engine/native/better_sqlite3.node"),
  );
  const db = new BetterDatabase(path, { nativeBinding: addon.exports });
  return {
    exec: (sql) => {
      db.exec(sql);
    },
    prepare: (sql) => db.prepare(sql),
    loadExtension: (file) => {
      db.loadExtension(file);
    },
    close: () => {
      db.close();
    },
    backupViaAPI: async (file) => {
      await db.backup(file);
    },
  };
}
