import { eq, desc, asc, and, like, or, isNotNull } from 'drizzle-orm';
import { db, rawDb } from '../client';
import { books, Book, NewBook } from '../schema/books';

export interface BookFilters {
  modality?: 'PHYSICAL' | 'DIGITAL';
  currentStatus?: 'POR_LEER' | 'LEYENDO' | 'EN_ESPERA' | 'LEIDO' | 'ABANDONADO' | 'WISHLIST';
  shelfId?: string;
  seriesName?: string;
}

export interface SeriesGroup {
  seriesName: string;
  totalBooks: number;
  books: Book[];
}

export class BooksRepository {
  /**
   * Obtiene todos los libros con filtros opcionales.
   */
  static async getAll(filters: BookFilters = {}): Promise<Book[]> {
    const conditions = [];

    if (filters.modality) {
      conditions.push(eq(books.modality, filters.modality));
    }
    if (filters.currentStatus) {
      conditions.push(eq(books.currentStatus, filters.currentStatus));
    }
    if (filters.shelfId) {
      conditions.push(eq(books.shelfId, filters.shelfId));
    }
    if (filters.seriesName) {
      conditions.push(eq(books.seriesName, filters.seriesName));
    }

    if (conditions.length > 0) {
      return db
        .select()
        .from(books)
        .where(and(...conditions))
        .orderBy(desc(books.createdAt));
    }

    return db.select().from(books).orderBy(desc(books.createdAt));
  }

  /**
   * Obtiene un libro por su ID único.
   */
  static async getById(id: string): Promise<Book | null> {
    const results = await db.select().from(books).where(eq(books.id, id)).limit(1);
    return results[0] || null;
  }

  /**
   * Busca si ya existe un libro registrado con este ISBN-13 (detección de duplicados).
   */
  static async getByIsbn(isbn13: string): Promise<Book | null> {
    if (!isbn13) return null;
    const results = await db
      .select()
      .from(books)
      .where(eq(books.isbn13, isbn13))
      .limit(1);
    return results[0] || null;
  }

  /**
   * Registra un libro de manera transaccional e idempotente.
   */
  static async create(newBook: NewBook): Promise<Book> {
    const inserted = await db.insert(books).values(newBook).returning();
    return inserted[0];
  }

  /**
   * Actualiza los datos de un libro existente.
   */
  static async update(id: string, updates: Partial<NewBook>): Promise<Book | null> {
    const updated = await db
      .update(books)
      .set({
        ...updates,
        updatedAt: Date.now(),
      })
      .where(eq(books.id, id))
      .returning();

    return updated[0] || null;
  }

  /**
   * Elimina un libro por su ID.
   */
  static async delete(id: string): Promise<boolean> {
    const deleted = await db.delete(books).where(eq(books.id, id)).returning();
    return deleted.length > 0;
  }

  /**
   * Agrupa libros por saga/serie en orden de lectura numérico (ej. #1, #1.5, #2).
   */
  static async getSeriesGrouped(): Promise<SeriesGroup[]> {
    const allBooksInSeries = await db
      .select()
      .from(books)
      .where(isNotNull(books.seriesName))
      .orderBy(asc(books.seriesIndex));

    const map = new Map<string, Book[]>();

    for (const book of allBooksInSeries) {
      if (!book.seriesName) continue;
      const list = map.get(book.seriesName) || [];
      list.push(book);
      map.set(book.seriesName, list);
    }

    const groups: SeriesGroup[] = [];
    for (const [seriesName, seriesBooks] of map.entries()) {
      groups.push({
        seriesName,
        totalBooks: seriesBooks.length,
        books: seriesBooks.sort((a, b) => (a.seriesIndex ?? 0) - (b.seriesIndex ?? 0)),
      });
    }

    return groups;
  }

  /**
   * Búsqueda instantánea de texto completo en SQLite (FTS5 + LIKE fallback).
   */
  static async search(query: string): Promise<Book[]> {
    const cleanQuery = query.trim();
    if (!cleanQuery) return [];

    try {
      // Intenta primero mediante FTS5 para máxima velocidad y tolerancia a diacríticos
      const ftsResults = rawDb.getAllSync<{ id: string }>(
        `SELECT id FROM books_fts WHERE books_fts MATCH ? ORDER BY rank LIMIT 30`,
        [`"${cleanQuery}"*`]
      );

      if (ftsResults && ftsResults.length > 0) {
        const ids = ftsResults.map((r) => r.id);
        const matchedBooks = await db.select().from(books);
        const bookMap = new Map(matchedBooks.map((b) => [b.id, b]));
        return ids.map((id) => bookMap.get(id)).filter((b): b is Book => b !== undefined);
      }
    } catch {
      // Fallback a LIKE estándar si FTS5 no estuviera disponible en el entorno
    }

    const pattern = `%${cleanQuery}%`;
    return db
      .select()
      .from(books)
      .where(
        or(
          like(books.title, pattern),
          like(books.seriesName, pattern),
          like(books.publisher, pattern),
          like(books.authorsJson, pattern)
        )
      )
      .limit(30);
  }
}
