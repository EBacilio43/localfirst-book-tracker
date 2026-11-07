import { eq, and, isNull, desc } from 'drizzle-orm';
import { db } from '../client';
import { bookLoans, BookLoan, NewBookLoan } from '../schema/bookLoans';
import { books, Book } from '../schema/books';
import {
  scheduleLoanReminder,
  cancelLoanReminder,
} from '../../features/loans/services/loanNotificationAdapter';

export {
  LoanDueEvaluation,
  evaluateLoanDueStatus,
} from '../../features/loans/utils/loanDueStatus';

export interface LoanFilters {
  activeOnly?: boolean;
  loanDirection?: 'LENT_OUT' | 'BORROWED_IN';
  bookId?: string;
}

export interface CreateLoanParams {
  id?: string;
  bookId: string;
  loanDirection: 'LENT_OUT' | 'BORROWED_IN';
  borrowerName: string;
  borrowerContact?: string | null;
  loanedAt?: number;
  dueDate?: number | null;
  notes?: string | null;
}

/**
 * Determina si un libro debe contabilizarse dentro del inventario fisico propio.
 * Retorna false si:
 * - ownership es 'BORROWED' o 'WISHLIST'
 * - modality no es 'PHYSICAL'
 * - el prestamo activo es un libro tomado en prestamo ('BORROWED_IN')
 */
export function shouldCountInOwnedPhysicalInventory(
  book: Book,
  activeLoan?: BookLoan | null
): boolean {
  if (book.ownership === 'BORROWED' || book.ownership === 'WISHLIST') {
    return false;
  }
  if (book.modality !== 'PHYSICAL') {
    return false;
  }
  if (
    activeLoan &&
    activeLoan.returnedAt === null &&
    activeLoan.loanDirection === 'BORROWED_IN'
  ) {
    return false;
  }
  return true;
}

function generateLoanId(): string {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 10);
  return `loan_${timestamp}_${randomPart}`;
}

export class BookLoansRepository {
  /**
   * Obtiene todos los prestamos con filtros opcionales.
   */
  static async getAll(filters?: LoanFilters): Promise<BookLoan[]> {
    const conditions = [];

    if (filters?.bookId) {
      conditions.push(eq(bookLoans.bookId, filters.bookId));
    }
    if (filters?.loanDirection) {
      conditions.push(eq(bookLoans.loanDirection, filters.loanDirection));
    }
    if (filters?.activeOnly) {
      conditions.push(isNull(bookLoans.returnedAt));
    }

    if (conditions.length > 0) {
      return db
        .select()
        .from(bookLoans)
        .where(and(...conditions))
        .orderBy(desc(bookLoans.loanedAt));
    }

    return db.select().from(bookLoans).orderBy(desc(bookLoans.loanedAt));
  }

  /**
   * Obtiene el prestamo activo de un libro (returnedAt === null), si existe.
   */
  static async getActiveByBookId(bookId: string): Promise<BookLoan | null> {
    const results = await db
      .select()
      .from(bookLoans)
      .where(and(eq(bookLoans.bookId, bookId), isNull(bookLoans.returnedAt)))
      .limit(1);

    return results[0] || null;
  }

  /**
   * Obtiene un mapa de todos los prestamos activos indexados por bookId.
   */
  static async getActiveLoansByBookMap(): Promise<Record<string, BookLoan>> {
    const activeLoans = await db
      .select()
      .from(bookLoans)
      .where(isNull(bookLoans.returnedAt));

    const map: Record<string, BookLoan> = {};
    for (const loan of activeLoans) {
      map[loan.bookId] = loan;
    }
    return map;
  }

  /**
   * Obtiene un prestamo por su identificador unico.
   */
  static async getById(id: string): Promise<BookLoan | null> {
    const results = await db
      .select()
      .from(bookLoans)
      .where(eq(bookLoans.id, id))
      .limit(1);

    return results[0] || null;
  }

  /**
   * Registra un nuevo prestamo de manera idempotente.
   * Si ya existe un prestamo activo para el libro, actualiza dicho registro.
   * Si es BORROWED_IN, actualiza ownership = 'BORROWED' en la tabla books.
   * Programa recordatorio local si se provee dueDate.
   */
  static async createLoan(params: CreateLoanParams): Promise<BookLoan> {
    const activeLoan = await BookLoansRepository.getActiveByBookId(params.bookId);

    const bookResults = await db
      .select()
      .from(books)
      .where(eq(books.id, params.bookId))
      .limit(1);
    const bookTitle = bookResults[0]?.title ?? 'Libro';

    let notificationId: string | null = null;
    if (params.dueDate) {
      notificationId = await scheduleLoanReminder({
        bookTitle,
        borrowerName: params.borrowerName,
        loanDirection: params.loanDirection,
        dueDateMs: params.dueDate,
      });
    }

    const now = Date.now();

    if (activeLoan) {
      if (activeLoan.notificationId && activeLoan.notificationId !== notificationId) {
        await cancelLoanReminder(activeLoan.notificationId);
      }

      const updates: Partial<NewBookLoan> = {
        loanDirection: params.loanDirection,
        borrowerName: params.borrowerName,
        borrowerContact:
          params.borrowerContact !== undefined
            ? params.borrowerContact
            : activeLoan.borrowerContact,
        loanedAt: params.loanedAt ?? activeLoan.loanedAt,
        dueDate: params.dueDate !== undefined ? params.dueDate : activeLoan.dueDate,
        notificationId: notificationId ?? activeLoan.notificationId,
        notes: params.notes !== undefined ? params.notes : activeLoan.notes,
        updatedAt: now,
      };

      await db.update(bookLoans).set(updates).where(eq(bookLoans.id, activeLoan.id));

      if (params.loanDirection === 'BORROWED_IN') {
        await db
          .update(books)
          .set({ ownership: 'BORROWED', updatedAt: now })
          .where(eq(books.id, params.bookId));
      }

      const updated = await BookLoansRepository.getById(activeLoan.id);
      return updated!;
    }

    const id = params.id || generateLoanId();
    const newRecord: NewBookLoan = {
      id,
      bookId: params.bookId,
      loanDirection: params.loanDirection,
      borrowerName: params.borrowerName,
      borrowerContact: params.borrowerContact ?? null,
      loanedAt: params.loanedAt ?? now,
      dueDate: params.dueDate ?? null,
      returnedAt: null,
      notificationId,
      notes: params.notes ?? null,
      createdAt: now,
      updatedAt: now,
    };

    await db.insert(bookLoans).values(newRecord);

    if (params.loanDirection === 'BORROWED_IN') {
      await db
        .update(books)
        .set({ ownership: 'BORROWED', updatedAt: now })
        .where(eq(books.id, params.bookId));
    }

    const created = await BookLoansRepository.getById(id);
    return created ?? (newRecord as BookLoan);
  }

  /**
   * Marca un prestamo como devuelto, cancelando recordatorios pendientes.
   */
  static async markAsReturned(
    loanId: string,
    returnedAtMs?: number
  ): Promise<BookLoan | null> {
    const loan = await BookLoansRepository.getById(loanId);
    if (!loan) {
      return null;
    }

    if (loan.notificationId) {
      await cancelLoanReminder(loan.notificationId);
    }

    const returnedAt = returnedAtMs ?? Date.now();
    await db
      .update(bookLoans)
      .set({
        returnedAt,
        updatedAt: Date.now(),
      })
      .where(eq(bookLoans.id, loanId));

    return BookLoansRepository.getById(loanId);
  }

  /**
   * Extiende la fecha limite sumando dias y reprogramando el recordatorio local.
   */
  static async extendDueDate(
    loanId: string,
    extraDays: number
  ): Promise<BookLoan | null> {
    const loan = await BookLoansRepository.getById(loanId);
    if (!loan) {
      return null;
    }

    const baseDate = loan.dueDate ?? Date.now();
    const newDueDate = baseDate + extraDays * 86400000;

    if (loan.notificationId) {
      await cancelLoanReminder(loan.notificationId);
    }

    const bookResults = await db
      .select()
      .from(books)
      .where(eq(books.id, loan.bookId))
      .limit(1);
    const bookTitle = bookResults[0]?.title ?? 'Libro';

    const newNotificationId = await scheduleLoanReminder({
      bookTitle,
      borrowerName: loan.borrowerName,
      loanDirection: loan.loanDirection,
      dueDateMs: newDueDate,
    });

    const now = Date.now();
    await db
      .update(bookLoans)
      .set({
        dueDate: newDueDate,
        notificationId: newNotificationId,
        updatedAt: now,
      })
      .where(eq(bookLoans.id, loanId));

    return BookLoansRepository.getById(loanId);
  }

  /**
   * Elimina un prestamo y cancela sus notificaciones asociadas.
   */
  static async delete(id: string): Promise<boolean> {
    const loan = await BookLoansRepository.getById(id);
    if (!loan) {
      return false;
    }
    if (loan.notificationId) {
      await cancelLoanReminder(loan.notificationId);
    }
    await db.delete(bookLoans).where(eq(bookLoans.id, id));
    return true;
  }
}
