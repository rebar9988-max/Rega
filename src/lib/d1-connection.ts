/** Request-bound D1 access. Node verification registers a local SQLite implementation. */
export type D1Value = string | number | null | ArrayBuffer;
export interface D1Statement {
  bind(...values: D1Value[]): D1Statement;
  all<T = Record<string, unknown>>(): Promise<{ results: T[]; success: boolean; meta: { changes?: number } }>;
  run(): Promise<{ success: boolean; meta: { changes?: number } }>;
  raw(options?: { columnNames?: boolean }): Promise<unknown[][]>;
}
export interface D1Connection {
  prepare(sql: string): D1Statement;
  batch(statements: D1Statement[]): Promise<unknown[]>;
}
let provider: (() => D1Connection) | undefined;
export function registerD1Provider(resolve: () => D1Connection): void { provider = resolve; }
export function d1Connection(): D1Connection {
  if (!provider) throw new Error("D1 binding is unavailable");
  return provider();
}
export function usesD1(): boolean { return process.env.REGA_DATABASE_PROVIDER === "d1"; }
