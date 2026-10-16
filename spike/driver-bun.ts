import { Database } from "bun:sqlite";
import type { DatabasePort } from "./driver-port.ts";
export const driver = "bun:sqlite";
export function openDatabase(path: string): DatabasePort {
  const db = new Database(path, { create: true, strict: true });
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
  };
}
