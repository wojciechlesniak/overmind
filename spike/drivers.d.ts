interface ProbeStatement {
  run(...values: (string | number | null)[]): unknown;
  get(...values: (string | number | null)[]): unknown;
  all(...values: (string | number | null)[]): unknown[];
}
declare module "better-sqlite3" {
  export default class Database {
    constructor(path: string, options: { nativeBinding: object });
    exec(sql: string): void;
    prepare(sql: string): ProbeStatement;
    loadExtension(path: string): void;
    close(): void;
    backup(path: string): Promise<unknown>;
  }
}
declare module "bun:sqlite" {
  export class Database {
    constructor(path: string, options: { create: boolean; strict: boolean });
    exec(sql: string): void;
    prepare(sql: string): ProbeStatement;
    loadExtension(path: string): void;
    close(): void;
  }
}
