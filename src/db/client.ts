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

  // 2. Crear tablas relacionales si es la primera ejecución
  initCoreSchema(expoDbInstance);

  // 3. Inicializar FTS5 para búsqueda instantánea en español (remueve diacríticos)
  initFts5SearchIndex(expoDbInstance);

  drizzleDbInstance = drizzle(expoDbInstance, { schema });

  return { db: drizzleDbInstance, rawDb: expoDbInstance };
}

/**
 * Inicializa las tablas del esquema relacional en SQLite si no existen.
 */
function initCoreSchema(sqlite: SQLiteDatabase) {
  try {
    sqlite.execSync(`
      CREATE TABLE IF NOT EXISTS books (
        id TEXT PRIMARY KEY NOT NULL,
        isbn13 TEXT,
        isbn10 TEXT,
        title TEXT NOT NULL,
        subtitle TEXT,
        series_name TEXT,
        series_index REAL,
        authors_json TEXT DEFAULT '[]' NOT NULL,
        translator TEXT,
        publisher TEXT,
        description TEXT,
        cover_uri TEXT,
        page_count INTEGER DEFAULT 0 NOT NULL,
        modality TEXT DEFAULT 'PHYSICAL' NOT NULL,
        ownership TEXT DEFAULT 'OWNED' NOT NULL,
        metadata_status TEXT DEFAULT 'COMPLETE' NOT NULL,
        format TEXT,
        progress_mode TEXT DEFAULT 'PAGES' NOT NULL,
        language TEXT DEFAULT 'es' NOT NULL,
        current_status TEXT DEFAULT 'POR_LEER' NOT NULL,
        current_page INTEGER DEFAULT 0 NOT NULL,
        current_percentage REAL DEFAULT 0 NOT NULL,
        rating REAL,
        pause_or_dnf_note TEXT,
        is_spoiler INTEGER DEFAULT 0 NOT NULL,
        shelf_id TEXT,
        wishlist_store_note TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS shelves (
        id TEXT PRIMARY KEY NOT NULL,
        furniture_name TEXT NOT NULL,
        shelf_level TEXT,
        color_tag TEXT DEFAULT '#1E4635' NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS reading_sessions (
        id TEXT PRIMARY KEY NOT NULL,
        book_id TEXT NOT NULL,
        start_page INTEGER DEFAULT 0 NOT NULL,
        end_page INTEGER DEFAULT 0 NOT NULL,
        pages_read INTEGER DEFAULT 0 NOT NULL,
        duration_seconds INTEGER DEFAULT 0 NOT NULL,
        started_at_epoch_ms INTEGER NOT NULL,
        local_date TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (book_id) REFERENCES books(id) ON UPDATE NO ACTION ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS reading_logs (
        id TEXT PRIMARY KEY NOT NULL,
        book_id TEXT NOT NULL,
        read_number INTEGER DEFAULT 1 NOT NULL,
        started_at INTEGER,
        finished_at INTEGER,
        rating REAL,
        review TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        FOREIGN KEY (book_id) REFERENCES books(id) ON UPDATE NO ACTION ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS book_quotes (
        id TEXT PRIMARY KEY NOT NULL,
        book_id TEXT NOT NULL,
        entry_type TEXT DEFAULT 'QUOTE' NOT NULL,
        content TEXT NOT NULL,
        page_number INTEGER,
        chapter_or_section TEXT,
        personal_note TEXT,
        highlight_color TEXT DEFAULT '#F3E8CB' NOT NULL,
        is_spoiler INTEGER DEFAULT 0 NOT NULL,
        is_favorite INTEGER DEFAULT 0 NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        FOREIGN KEY (book_id) REFERENCES books(id) ON UPDATE NO ACTION ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS book_loans (
        id TEXT PRIMARY KEY NOT NULL,
        book_id TEXT NOT NULL,
        loan_direction TEXT DEFAULT 'LENT_OUT' NOT NULL,
        borrower_name TEXT NOT NULL,
        borrower_contact TEXT,
        loaned_at INTEGER NOT NULL,
        due_date INTEGER,
        returned_at INTEGER,
        notification_id TEXT,
        notes TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        FOREIGN KEY (book_id) REFERENCES books(id) ON UPDATE NO ACTION ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS reading_goals (
        id TEXT PRIMARY KEY NOT NULL,
        period_type TEXT NOT NULL,
        year INTEGER NOT NULL,
        month INTEGER,
        target_books INTEGER DEFAULT 0 NOT NULL,
        target_pages INTEGER DEFAULT 0 NOT NULL,
        target_minutes_per_day INTEGER DEFAULT 0 NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_books_isbn13 ON books(isbn13);
      CREATE INDEX IF NOT EXISTS idx_books_status ON books(current_status);
      CREATE INDEX IF NOT EXISTS idx_reading_sessions_book_id ON reading_sessions(book_id);
      CREATE INDEX IF NOT EXISTS idx_book_quotes_book_id ON book_quotes(book_id);
      CREATE INDEX IF NOT EXISTS idx_book_loans_book_id ON book_loans(book_id);
    `);
  } catch (error) {
    console.error('[SQLite] Error al inicializar el esquema base:', error);
  }
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
