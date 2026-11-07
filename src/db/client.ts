import { openDatabaseSync, SQLiteDatabase } from 'expo-sqlite';
import { drizzle, ExpoSQLiteDatabase } from 'drizzle-orm/expo-sqlite';
import * as schema from './schema';

let expoDbInstance: SQLiteDatabase | null = null;
let drizzleDbInstance: ExpoSQLiteDatabase<typeof schema> | null = null;

/**
 * Obtiene o inicializa la conexión síncrona a la base de datos local SQLite.
 * Configura el modo WAL y la tabla virtual FTS5 para búsquedas en español sin acentos.
 */
export function getDbConnection(): {
  db: ExpoSQLiteDatabase<typeof schema>;
  rawDb: SQLiteDatabase;
} {
  if (drizzleDbInstance && expoDbInstance) {
    return { db: drizzleDbInstance, rawDb: expoDbInstance };
  }

  expoDbInstance = openDatabaseSync('bacibooks.db');

  // 1. Activar Write-Ahead Logging para rendimiento y concurrencia
  expoDbInstance.execSync('PRAGMA journal_mode = WAL;');
  expoDbInstance.execSync('PRAGMA foreign_keys = ON;');

  // 2. Inicializar FTS5 para búsqueda instantánea en español (remueve diacríticos)
  initFts5SearchIndex(expoDbInstance);

  drizzleDbInstance = drizzle(expoDbInstance, { schema });

  return { db: drizzleDbInstance, rawDb: expoDbInstance };
}

/**
 * Configura la tabla virtual FTS5 y sus triggers automáticos de sincronización con la tabla books.
 */
function initFts5SearchIndex(sqlite: SQLiteDatabase) {
  try {
    sqlite.execSync(`
      CREATE VIRTUAL TABLE IF NOT EXISTS books_fts USING fts5(
        id UNINDEXED,
        title,
        authors,
        publisher,
        series_name,
        description,
        tokenize = 'unicode61 remove_diacritics 2'
      );

      -- Triggers para mantener books_fts sincronizado automáticamente con books
      CREATE TRIGGER IF NOT EXISTS books_ai AFTER INSERT ON books BEGIN
        INSERT INTO books_fts(id, title, authors, publisher, series_name, description)
        VALUES (new.id, new.title, new.authors_json, new.publisher, new.series_name, new.description);
      END;

      CREATE TRIGGER IF NOT EXISTS books_ad AFTER DELETE ON books BEGIN
        DELETE FROM books_fts WHERE id = old.id;
      END;

      CREATE TRIGGER IF NOT EXISTS books_au AFTER UPDATE ON books BEGIN
        DELETE FROM books_fts WHERE id = old.id;
        INSERT INTO books_fts(id, title, authors, publisher, series_name, description)
        VALUES (new.id, new.title, new.authors_json, new.publisher, new.series_name, new.description);
      END;

      -- Tabla virtual FTS5 para citas, notas y glosario
      CREATE VIRTUAL TABLE IF NOT EXISTS quotes_fts USING fts5(
        id UNINDEXED,
        book_id UNINDEXED,
        entry_type UNINDEXED,
        content,
        personal_note,
        chapter_or_section,
        tokenize = 'unicode61 remove_diacritics 2'
      );

      -- Triggers para mantener quotes_fts sincronizado automáticamente con book_quotes
      CREATE TRIGGER IF NOT EXISTS quotes_ai AFTER INSERT ON book_quotes BEGIN
        INSERT INTO quotes_fts(id, book_id, entry_type, content, personal_note, chapter_or_section)
        VALUES (new.id, new.book_id, new.entry_type, new.content, new.personal_note, new.chapter_or_section);
      END;

      CREATE TRIGGER IF NOT EXISTS quotes_ad AFTER DELETE ON book_quotes BEGIN
        DELETE FROM quotes_fts WHERE id = old.id;
      END;

      CREATE TRIGGER IF NOT EXISTS quotes_au AFTER UPDATE ON book_quotes BEGIN
        DELETE FROM quotes_fts WHERE id = old.id;
        INSERT INTO quotes_fts(id, book_id, entry_type, content, personal_note, chapter_or_section)
        VALUES (new.id, new.book_id, new.entry_type, new.content, new.personal_note, new.chapter_or_section);
      END;
    `);
  } catch (error) {
    console.warn('[SQLite FTS5] No se pudo inicializar la tabla virtual FTS5:', error);
  }
}

// Exportación por defecto lista para usar
export const { db, rawDb } = getDbConnection();
