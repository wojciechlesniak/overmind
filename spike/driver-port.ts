export type Scalar = string | number | null;
export interface Statement {
  run(...values: Scalar[]): unknown;
  get(...values: Scalar[]): unknown;
  all(...values: Scalar[]): unknown[];
}
export interface DatabasePort {
  exec(sql: string): void;
  prepare(sql: string): Statement;
  loadExtension(path: string): void;
  close(): void;
  backupViaAPI?: (path: string) => Promise<void>;
}
