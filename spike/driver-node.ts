import { DatabaseSync, backup } from "node:sqlite";
import type { DatabasePort } from "./driver-port.ts";
export const driver = "node:sqlite";
export function openDatabase(path: string): DatabasePort {
  const db = new DatabaseSync(path, { allowExtension: true });
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
      await backup(db, file);
    },
  };
}
