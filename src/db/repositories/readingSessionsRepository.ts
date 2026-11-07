import { eq, desc } from 'drizzle-orm';
import { db } from '../client';
import { readingSessions, ReadingSession, NewReadingSession } from '../schema/readingSessions';
import { books, Book } from '../schema/books';
import {
  calculateAutomaticPercentage,
  resolveReadingLocalDate,
} from '../../features/reading-tracker/store/readerPreferencesStore';

export interface CreateTimedSessionParams {
  bookId: string;
  startPage: number;
  endPage: number;
  durationSeconds: number;
  startedAtEpochMs: number;
  when?: 'TODAY' | 'YESTERDAY';
  localDateOverride?: string;
  outlierResolution?: 'NONE' | 'ADJUST_TO_AVERAGE' | 'EXCLUDE_SPEED' | 'KEEP_RAW';
  averageSpeedPagesPerHour?: number;
  totalUnitsOverride?: number;
  progressMode?: 'PAGES' | 'CHAPTERS';
}

function generateSessionId(): string {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 10);
  return `sess_${timestamp}_${randomPart}`;
}

export class ReadingSessionsRepository {
  /**
   * Obtiene todas las sesiones registradas ordenadas por startedAtEpochMs descendente.
   */
  static async getAll(): Promise<ReadingSession[]> {
    return db
      .select()
      .from(readingSessions)
      .orderBy(desc(readingSessions.startedAtEpochMs));
  }

  /**
   * Obtiene las sesiones de lectura asociadas a un libro especifico ordenadas cronologicamente.
   */
  static async getByBookId(bookId: string): Promise<ReadingSession[]> {
    return db
      .select()
      .from(readingSessions)
      .where(eq(readingSessions.bookId, bookId))
      .orderBy(desc(readingSessions.startedAtEpochMs));
  }

  /**
   * Registra una sesion de lectura cronometrada con resolucion de anomalias (outliers)
   * y actualiza el libro correspondiente (progreso, porcentaje y estado).
   */
  static async createTimedSession(
    params: CreateTimedSessionParams
  ): Promise<{ session: ReadingSession; updatedBook: Book | null }> {
    const pagesRead = Math.max(0, params.endPage - params.startPage);

    let effectiveDurationSeconds: number;
    if (params.outlierResolution === 'ADJUST_TO_AVERAGE' && pagesRead > 0) {
      const avgSpeed = params.averageSpeedPagesPerHour || 25;
      effectiveDurationSeconds = Math.max(60, Math.round((pagesRead / avgSpeed) * 3600));
    } else if (params.outlierResolution === 'EXCLUDE_SPEED') {
      effectiveDurationSeconds = 0;
    } else {
      effectiveDurationSeconds = Math.max(0, Math.round(params.durationSeconds));
    }

    const localDate =
      params.localDateOverride ?? resolveReadingLocalDate(params.when ?? 'TODAY');

    const now = Date.now();
    const newSession: NewReadingSession = {
      id: generateSessionId(),
      bookId: params.bookId,
      startPage: params.startPage,
      endPage: params.endPage,
      pagesRead,
      durationSeconds: effectiveDurationSeconds,
      startedAtEpochMs: params.startedAtEpochMs,
      localDate,
      createdAt: now,
    };

    const insertedSessions = await db.insert(readingSessions).values(newSession).returning();
    const createdSession = insertedSessions[0];

    const currentBookResults = await db
      .select()
      .from(books)
      .where(eq(books.id, params.bookId))
      .limit(1);

    const currentBook = currentBookResults[0];
    if (!currentBook) {
      return {
        session: createdSession,
        updatedBook: null,
      };
    }

    const effectiveMode = params.progressMode ?? currentBook.progressMode;
    const effectiveTotal =
      params.totalUnitsOverride !== undefined && params.totalUnitsOverride > 0
        ? params.totalUnitsOverride
        : currentBook.pageCount;

    const percentage = calculateAutomaticPercentage(params.endPage, effectiveTotal);
    const newStatus = percentage >= 100 ? 'LEIDO' : 'LEYENDO';

    const updatePayload: Partial<typeof books.$inferInsert> = {
      currentPage: params.endPage,
      currentPercentage: percentage,
      currentStatus: newStatus,
      progressMode: effectiveMode,
      updatedAt: now,
    };

    if (
      effectiveMode !== 'CHAPTERS' &&
      params.totalUnitsOverride !== undefined &&
      params.totalUnitsOverride > 0
    ) {
      updatePayload.pageCount = params.totalUnitsOverride;
    }

    const updatedBooks = await db
      .update(books)
      .set(updatePayload)
      .where(eq(books.id, params.bookId))
      .returning();

    return {
      session: createdSession,
      updatedBook: updatedBooks[0] || null,
    };
  }

  /**
   * Elimina una sesion de lectura por su identificador unico.
   */
  static async delete(id: string): Promise<boolean> {
    const deleted = await db
      .delete(readingSessions)
      .where(eq(readingSessions.id, id))
      .returning();

    return deleted.length > 0;
  }
}
