import * as SQLite from 'expo-sqlite';
import type { CatalogueSqliteDb } from './open-sqlite';

export type { CatalogueSqliteDb };

/**
 * Opens the local SQLite database for offline read-only catalogue caching on Android and iOS.
 */
export async function openCatalogueSqliteDatabase(): Promise<CatalogueSqliteDb | null> {
  try {
    const db = await SQLite.openDatabaseAsync('caredose_catalogue.db');
    return db;
  } catch {
    return null;
  }
}
