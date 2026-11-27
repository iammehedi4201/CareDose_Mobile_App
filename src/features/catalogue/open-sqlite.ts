export interface CatalogueSqliteDb {
  execAsync(source: string): Promise<void>;
  runAsync(source: string, ...params: unknown[]): Promise<unknown>;
  getFirstAsync<T>(source: string, ...params: unknown[]): Promise<T | null>;
  getAllAsync<T>(source: string, ...params: unknown[]): Promise<T[]>;
}

/**
 * Web/Node fallback stub — persistent SQLite catalogue caching runs on native Android/iOS builds,
 * avoiding web WASM / OPFS bundling dependencies while keeping L1 in-memory caching active.
 */
export async function openCatalogueSqliteDatabase(): Promise<CatalogueSqliteDb | null> {
  return null;
}
