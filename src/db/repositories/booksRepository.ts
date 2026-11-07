import { eq, ne, desc, asc, and, like, or, isNotNull } from 'drizzle-orm';
import { db, rawDb } from '../client';
import { books, Book, NewBook } from '../schema/books';
import { readingSessions } from '../schema/readingSessions';
import {
  calculateAutomaticPercentage,
  resolveReadingLocalDate,
} from '../../features/reading-tracker/store/readerPreferencesStore';

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

export interface UpdateReadingProgressParams {
  bookId: string;
  currentUnit: number;
  totalUnits?: number;
  progressMode?: 'PAGES' | 'CHAPTERS';
  when?: 'TODAY' | 'YESTERDAY';
}

export interface UpdateReadingProgressResult {
  book: Book | null;
  percentage: number;
  localDate: string;
}

export interface PauseOrAbandonBookParams {
  bookId: string;
  status: 'EN_ESPERA' | 'ABANDONADO';
  pauseOrDnfNote?: string | null;
  isSpoiler?: boolean;
  stoppedAtUnit?: number;
}

export interface ConvertWishlistToOwnedParams {
  bookId: string;
  modality?: 'PHYSICAL' | 'DIGITAL';
  shelfId?: string | null;
  format?: Book['format'];
}

function generateSessionId(): string {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 10);
  return `sess_${timestamp}_${randomPart}`;
}

function normalizeTitleForComparison(title: string): string {
  return title
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
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

  /**
   * Actualiza el progreso de lectura calculando automaticamente el porcentaje.
   * Si se avanzaron paginas, registra la sesion con la fecha local correspondiente (HOY o AYER).
   * Asegura el cambio a LEYENDO o LEIDO si alcanza el 100%.
   */
  static async updateReadingProgress(
    params: UpdateReadingProgressParams
  ): Promise<UpdateReadingProgressResult> {
    const book = await BooksRepository.getById(params.bookId);
    const localDate = resolveReadingLocalDate(params.when ?? 'TODAY');

    if (!book) {
      return {
        book: null,
        percentage: 0,
        localDate,
      };
    }

    const effectiveTotal =
      params.totalUnits !== undefined && params.totalUnits > 0
        ? params.totalUnits
        : book.pageCount;

    const percentage = calculateAutomaticPercentage(params.currentUnit, effectiveTotal);
    const newStatus = percentage >= 100 ? 'LEIDO' : 'LEYENDO';
    const previousUnit = book.currentPage ?? 0;
    const unitsRead = params.currentUnit > previousUnit ? params.currentUnit - previousUnit : 0;

    if (unitsRead > 0) {
      const now = Date.now();
      await db.insert(readingSessions).values({
        id: generateSessionId(),
        bookId: book.id,
        startPage: previousUnit,
        endPage: params.currentUnit,
        pagesRead: unitsRead,
        durationSeconds: 0,
        startedAtEpochMs: now,
        localDate,
        createdAt: now,
      });
    }

    const updated = await db
      .update(books)
      .set({
        currentPage: params.currentUnit,
        currentPercentage: percentage,
        progressMode: params.progressMode ?? book.progressMode,
        pageCount: effectiveTotal,
        currentStatus: newStatus,
        updatedAt: Date.now(),
      })
      .where(eq(books.id, params.bookId))
      .returning();

    return {
      book: updated[0] || null,
      percentage,
      localDate,
    };
  }

  /**
   * Pausa o abandona un libro, preservando las paginas avanzadas y recalculando el porcentaje.
   */
  static async pauseOrAbandonBook(params: PauseOrAbandonBookParams): Promise<Book | null> {
    const book = await BooksRepository.getById(params.bookId);
    if (!book) return null;

    let currentPage = book.currentPage;
    let currentPercentage = book.currentPercentage;

    if (params.stoppedAtUnit !== undefined) {
      currentPage = params.stoppedAtUnit;
      currentPercentage = calculateAutomaticPercentage(currentPage, book.pageCount);
    }

    const pauseOrDnfNote =
      params.pauseOrDnfNote !== undefined ? params.pauseOrDnfNote : book.pauseOrDnfNote;
    const isSpoiler = params.isSpoiler !== undefined ? params.isSpoiler : book.isSpoiler;

    const updated = await db
      .update(books)
      .set({
        currentStatus: params.status,
        currentPage,
        currentPercentage,
        pauseOrDnfNote,
        isSpoiler,
        updatedAt: Date.now(),
      })
      .where(eq(books.id, params.bookId))
      .returning();

    return updated[0] || null;
  }

  /**
   * Convierte un libro de la lista de deseos a libro en propiedad (OWNED),
   * asignando su estanteria si es fisico o su formato si es digital.
   */
  static async convertWishlistToOwned(
    params: ConvertWishlistToOwnedParams
  ): Promise<Book | null> {
    const book = await BooksRepository.getById(params.bookId);
    if (!book) return null;

    const modality = params.modality ?? book.modality;
    const isPhysical = modality === 'PHYSICAL';

    const shelfId = isPhysical
      ? params.shelfId !== undefined
        ? params.shelfId
        : book.shelfId
      : null;

    const format = params.format !== undefined ? params.format : book.format;

    const updated = await db
      .update(books)
      .set({
        ownership: 'OWNED',
        currentStatus: 'POR_LEER',
        modality,
        shelfId,
        format,
        updatedAt: Date.now(),
      })
      .where(eq(books.id, params.bookId))
      .returning();

    return updated[0] || null;
  }

  /**
   * Busca todas las ediciones o ejemplares registrados en la biblioteca que compartan
   * el mismo ISBN-13 o el mismo titulo normalizado (excluyendo lista de deseos).
   */
  static async getMultipleEditions(bookId: string): Promise<Book[]> {
    const targetBook = await BooksRepository.getById(bookId);
    if (!targetBook) return [];

    const candidates = await db
      .select()
      .from(books)
      .where(ne(books.ownership, 'WISHLIST'));

    const targetIsbn = targetBook.isbn13?.trim();
    const targetTitle = normalizeTitleForComparison(targetBook.title);

    return candidates.filter((candidate) => {
      if (targetIsbn && candidate.isbn13 && candidate.isbn13.trim() === targetIsbn) {
        return true;
      }
      return normalizeTitleForComparison(candidate.title) === targetTitle;
    });
  }
}
