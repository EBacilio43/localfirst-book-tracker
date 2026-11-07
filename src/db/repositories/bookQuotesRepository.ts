import { eq, and, desc } from 'drizzle-orm';
import { db, rawDb } from '../client';
import { bookQuotes, BookQuote, NewBookQuote } from '../schema/bookQuotes';
import { sanitizeOcrText } from '../../features/quotes-ocr/utils/ocrTextSanitizer';

export interface QuoteFilters {
  entryType?: 'QUOTE' | 'CHARACTER' | 'GLOSSARY' | 'NOTE';
  favoritesOnly?: boolean;
}

export interface CreateBookQuoteParams {
  id?: string;
  bookId: string;
  entryType?: 'QUOTE' | 'CHARACTER' | 'GLOSSARY' | 'NOTE';
  content: string;
  pageNumber?: number | null;
  chapterOrSection?: string | null;
  personalNote?: string | null;
  highlightColor?: string;
  isSpoiler?: boolean;
  isFavorite?: boolean;
}

function generateQuoteId(): string {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 10);
  return `quote_${timestamp}_${randomPart}`;
}

export class BookQuotesRepository {
  /**
   * Obtiene todas las citas o notas de un libro especifico con filtros opcionales.
   */
  static async getByBookId(bookId: string, filters?: QuoteFilters): Promise<BookQuote[]> {
    const conditions = [eq(bookQuotes.bookId, bookId)];

    if (filters?.entryType) {
      conditions.push(eq(bookQuotes.entryType, filters.entryType));
    }
    if (filters?.favoritesOnly) {
      conditions.push(eq(bookQuotes.isFavorite, true));
    }

    return db
      .select()
      .from(bookQuotes)
      .where(and(...conditions))
      .orderBy(desc(bookQuotes.createdAt));
  }

  /**
   * Obtiene todas las citas o notas registradas globalmente.
   */
  static async getAll(filters?: QuoteFilters): Promise<BookQuote[]> {
    const conditions = [];

    if (filters?.entryType) {
      conditions.push(eq(bookQuotes.entryType, filters.entryType));
    }
    if (filters?.favoritesOnly) {
      conditions.push(eq(bookQuotes.isFavorite, true));
    }

    if (conditions.length > 0) {
      return db
        .select()
        .from(bookQuotes)
        .where(and(...conditions))
        .orderBy(desc(bookQuotes.createdAt));
    }

    return db.select().from(bookQuotes).orderBy(desc(bookQuotes.createdAt));
  }

  /**
   * Obtiene una cita por su identificador unico.
   */
  static async getById(id: string): Promise<BookQuote | null> {
    const results = await db
      .select()
      .from(bookQuotes)
      .where(eq(bookQuotes.id, id))
      .limit(1);

    return results[0] || null;
  }

  /**
   * Registra una nueva cita, nota de personaje o termino de glosario.
   * Aplica de forma obligatoria sanitizeOcrText sobre el contenido.
   */
  static async create(params: CreateBookQuoteParams): Promise<BookQuote> {
    const { cleanedText } = sanitizeOcrText(params.content);
    const id = params.id || generateQuoteId();
    const now = Date.now();

    const newQuote: NewBookQuote = {
      id,
      bookId: params.bookId,
      entryType: params.entryType ?? 'QUOTE',
      content: cleanedText,
      pageNumber: params.pageNumber ?? null,
      chapterOrSection: params.chapterOrSection ?? null,
      personalNote: params.personalNote ?? null,
      highlightColor: params.highlightColor ?? '#F3E8CB',
      isSpoiler: params.isSpoiler ?? false,
      isFavorite: params.isFavorite ?? false,
      createdAt: now,
      updatedAt: now,
    };

    await db.insert(bookQuotes).values(newQuote);
    const created = await BookQuotesRepository.getById(id);
    return created ?? (newQuote as BookQuote);
  }

  /**
   * Actualiza los campos de una cita existente.
   */
  static async update(id: string, updates: Partial<NewBookQuote>): Promise<BookQuote | null> {
    const existing = await BookQuotesRepository.getById(id);
    if (!existing) {
      return null;
    }

    const payload: Partial<NewBookQuote> = {
      ...updates,
      updatedAt: Date.now(),
    };

    if (payload.content !== undefined) {
      payload.content = sanitizeOcrText(payload.content).cleanedText;
    }

    await db.update(bookQuotes).set(payload).where(eq(bookQuotes.id, id));
    return BookQuotesRepository.getById(id);
  }

  /**
   * Alterna el estado de favorita de una cita.
   */
  static async toggleFavorite(id: string): Promise<BookQuote | null> {
    const existing = await BookQuotesRepository.getById(id);
    if (!existing) {
      return null;
    }
    return BookQuotesRepository.update(id, { isFavorite: !existing.isFavorite });
  }

  /**
   * Alterna la marca de spoiler de una cita o nota.
   */
  static async toggleSpoiler(id: string): Promise<BookQuote | null> {
    const existing = await BookQuotesRepository.getById(id);
    if (!existing) {
      return null;
    }
    return BookQuotesRepository.update(id, { isSpoiler: !existing.isSpoiler });
  }

  /**
   * Elimina una cita de la base de datos.
   */
  static async delete(id: string): Promise<boolean> {
    const existing = await BookQuotesRepository.getById(id);
    if (!existing) {
      return false;
    }
    await db.delete(bookQuotes).where(eq(bookQuotes.id, id));
    return true;
  }

  /**
   * Busqueda de texto completo mediante SQLite FTS5 (quotes_fts) con fallback
   * en memoria con normalizacion NFD para busquedas insensibles a tildes.
   */
  static async searchFts(
    query: string,
    entryType?: 'QUOTE' | 'CHARACTER' | 'GLOSSARY' | 'NOTE'
  ): Promise<BookQuote[]> {
    const cleanQuery = query.trim();
    if (!cleanQuery) {
      return [];
    }

    try {
      let ftsSql = `SELECT id FROM quotes_fts WHERE quotes_fts MATCH ?`;
      const ftsParams: string[] = [`"${cleanQuery}"*`];
      if (entryType) {
        ftsSql += ` AND entry_type = ?`;
        ftsParams.push(entryType);
      }
      ftsSql += ` ORDER BY rank LIMIT 50`;

      const ftsResults = rawDb?.getAllSync<{ id: string }>(ftsSql, ftsParams);
      if (ftsResults && ftsResults.length > 0) {
        const ids = ftsResults.map((r) => r.id);
        const allQuotes = await BookQuotesRepository.getAll(entryType ? { entryType } : undefined);
        const quoteMap = new Map(allQuotes.map((q) => [q.id, q]));
        const matched = ids.map((id) => quoteMap.get(id)).filter((q): q is BookQuote => q !== undefined);
        if (matched.length > 0) {
          return matched;
        }
      }
    } catch {
      // Si la tabla virtual FTS no esta disponible o falla, continua con el fallback
    }

    // Fallback con normalizacion NFD para busqueda sin tildes/diacriticos en memoria
    const normalizedQuery = cleanQuery
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

    const candidates = await BookQuotesRepository.getAll(entryType ? { entryType } : undefined);

    return candidates.filter((item) => {
      const contentNorm = (item.content || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const noteNorm = (item.personalNote || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const chapterNorm = (item.chapterOrSection || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

      return (
        contentNorm.includes(normalizedQuery) ||
        noteNorm.includes(normalizedQuery) ||
        chapterNorm.includes(normalizedQuery)
      );
    });
  }
}
