import { eq, asc, isNotNull } from 'drizzle-orm';
import { db } from '../client';
import { readingLogs, ReadingLog, NewReadingLog } from '../schema/readingLogs';
import { books, Book } from '../schema/books';
import { isValidHalfStarRating } from '../../features/reading-tracker/store/readerPreferencesStore';

export interface StartReadingResult {
  log: ReadingLog;
  book: Book | null;
  isReread: boolean;
}

export interface FinishReadingParams {
  bookId: string;
  rating?: number | null;
  review?: string | null;
  finishedAt?: number;
}

export interface FinishReadingResult {
  log: ReadingLog;
  book: Book | null;
}

function generateReadingLogId(): string {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 10);
  return `rlog_${timestamp}_${randomPart}`;
}

export class ReadingLogsRepository {
  /**
   * Obtiene todos los registros de lectura de un libro ordenados por numero de lectura ascendente.
   */
  static async getByBookId(bookId: string): Promise<ReadingLog[]> {
    return db
      .select()
      .from(readingLogs)
      .where(eq(readingLogs.bookId, bookId))
      .orderBy(asc(readingLogs.readNumber));
  }

  /**
   * Inicia una sesion de lectura o relectura para un libro.
   * Si ya existe un registro activo (finishedAt === null), lo reutiliza de forma idempotente.
   * Si no existe, calcula el numero de lectura correspondiente, crea el registro y actualiza el libro.
   */
  static async startReading(bookId: string, startedAt?: number): Promise<StartReadingResult> {
    const prevLogs = await this.getByBookId(bookId);
    const activeLog = prevLogs.find((l) => l.finishedAt === null);

    if (activeLog) {
      const bookResults = await db
        .select()
        .from(books)
        .where(eq(books.id, bookId))
        .limit(1);

      const isReread =
        activeLog.readNumber > 1 ||
        prevLogs.some((l) => l.finishedAt !== null && l.id !== activeLog.id);

      return {
        log: activeLog,
        book: bookResults[0] || null,
        isReread,
      };
    }

    const readNumber = prevLogs.length + 1;
    const isReread = readNumber > 1 || prevLogs.some((l) => l.finishedAt !== null);
    const now = Date.now();

    const newLog: NewReadingLog = {
      id: generateReadingLogId(),
      bookId,
      readNumber,
      startedAt: startedAt ?? now,
      finishedAt: null,
      rating: null,
      review: null,
      createdAt: now,
      updatedAt: now,
    };

    const insertedLogs = await db.insert(readingLogs).values(newLog).returning();
    const updatedBooks = await db
      .update(books)
      .set({
        currentStatus: 'LEYENDO',
        currentPage: 0,
        currentPercentage: 0,
        updatedAt: now,
      })
      .where(eq(books.id, bookId))
      .returning();

    return {
      log: insertedLogs[0],
      book: updatedBooks[0] || null,
      isReread,
    };
  }

  /**
   * Finaliza una lectura para un libro.
   * Valida la calificacion en incrementos de 0.5 entre 0.5 y 5.0.
   * Cierra el registro activo o crea uno nuevo completado si no habia ninguno abierto.
   * Actualiza el libro a LEIDO, 100% y pagina final.
   */
  static async finishReading(params: FinishReadingParams): Promise<FinishReadingResult> {
    if (params.rating !== undefined && params.rating !== null) {
      if (!isValidHalfStarRating(params.rating)) {
        throw new Error('La calificacion debe estar entre 0.5 y 5.0 en incrementos de 0.5');
      }
    }

    const prevLogs = await this.getByBookId(params.bookId);
    const activeLog = prevLogs.find((l) => l.finishedAt === null);
    const finishTimestamp = params.finishedAt ?? Date.now();
    let completedLog: ReadingLog;

    if (activeLog) {
      const updatedLogs = await db
        .update(readingLogs)
        .set({
          finishedAt: finishTimestamp,
          rating: params.rating !== undefined ? params.rating : activeLog.rating,
          review: params.review !== undefined ? params.review : activeLog.review,
          updatedAt: Date.now(),
        })
        .where(eq(readingLogs.id, activeLog.id))
        .returning();

      completedLog = updatedLogs[0];
    } else {
      const readNumber = prevLogs.length + 1;
      const now = Date.now();
      const newLog: NewReadingLog = {
        id: generateReadingLogId(),
        bookId: params.bookId,
        readNumber,
        startedAt: finishTimestamp,
        finishedAt: finishTimestamp,
        rating: params.rating ?? null,
        review: params.review ?? null,
        createdAt: now,
        updatedAt: now,
      };

      const insertedLogs = await db.insert(readingLogs).values(newLog).returning();
      completedLog = insertedLogs[0];
    }

    const currentBookResults = await db
      .select()
      .from(books)
      .where(eq(books.id, params.bookId))
      .limit(1);

    const currentBook = currentBookResults[0];
    if (!currentBook) {
      return {
        log: completedLog,
        book: null,
      };
    }

    const finalRating =
      params.rating !== undefined && params.rating !== null
        ? params.rating
        : currentBook.rating;

    const updatedBooks = await db
      .update(books)
      .set({
        currentStatus: 'LEIDO',
        currentPage: currentBook.pageCount,
        currentPercentage: 100,
        rating: finalRating,
        updatedAt: Date.now(),
      })
      .where(eq(books.id, params.bookId))
      .returning();

    return {
      log: completedLog,
      book: updatedBooks[0] || null,
    };
  }

  /**
   * Calcula el total de libros unicos completados con proteccion estricta de relecturas.
   * Un libro cuenta como completado si su estado actual es LEIDO o si posee al menos un
   * registro historico en reading_logs con finishedAt no nulo. Releer un libro terminado
   * no reduce jamas este contador.
   */
  static async getTotalCompletedBooksCount(): Promise<number> {
    const booksWithLeido = await db
      .select({ id: books.id })
      .from(books)
      .where(eq(books.currentStatus, 'LEIDO'));

    const logsFinished = await db
      .select({ bookId: readingLogs.bookId })
      .from(readingLogs)
      .where(isNotNull(readingLogs.finishedAt));

    const completedBookIds = new Set<string>();

    for (const b of booksWithLeido) {
      completedBookIds.add(b.id);
    }

    for (const l of logsFinished) {
      if (l.bookId) {
        completedBookIds.add(l.bookId);
      }
    }

    return completedBookIds.size;
  }
}
