import {
  BookLoansRepository,
  evaluateLoanDueStatus,
  shouldCountInOwnedPhysicalInventory,
} from '../../src/db/repositories/bookLoansRepository';
import { db } from '../../src/db/client';
import { BookLoan } from '../../src/db/schema/bookLoans';
import { Book } from '../../src/db/schema/books';
import * as loanNotificationAdapter from '../../src/features/loans/services/loanNotificationAdapter';

jest.mock('../../src/db/client', () => {
  const mockDb = {
    select: jest.fn(),
    insert: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };
  return {
    db: mockDb,
  };
});

describe('BookLoansRepository Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const sampleBook: Book = {
    id: 'book-1',
    isbn13: '9788445000663',
    isbn10: '8445000668',
    title: 'El Señor de los Anillos',
    subtitle: null,
    seriesName: null,
    seriesIndex: null,
    authorsJson: JSON.stringify(['J.R.R. Tolkien']),
    translator: null,
    publisher: 'Minotauro',
    description: null,
    coverUri: null,
    pageCount: 500,
    modality: 'PHYSICAL',
    ownership: 'OWNED',
    metadataStatus: 'COMPLETE',
    format: 'TAPA_DURA',
    progressMode: 'PAGES',
    language: 'es',
    currentStatus: 'LEIDO',
    currentPage: 500,
    currentPercentage: 100,
    rating: 5,
    pauseOrDnfNote: null,
    isSpoiler: false,
    shelfId: 'shelf-1',
    wishlistStoreNote: null,
    createdAt: 1700000000,
    updatedAt: 1700000000,
  };

  const sampleLoan: BookLoan = {
    id: 'loan-1',
    bookId: 'book-1',
    loanDirection: 'LENT_OUT',
    borrowerName: 'Carlos Perez',
    borrowerContact: '+525512345678',
    loanedAt: 1700000000000,
    dueDate: 1700500000000,
    returnedAt: null,
    notificationId: 'notif_loan_1700500000000',
    notes: 'Prestado para sus vacaciones.',
    createdAt: 1700000000000,
    updatedAt: 1700000000000,
  };

  describe('evaluateLoanDueStatus', () => {
    it('retorna RETURNED si el libro ya fue devuelto', () => {
      const returnedLoan: BookLoan = {
        ...sampleLoan,
        returnedAt: Date.now(),
      };
      const evaluation = evaluateLoanDueStatus(returnedLoan);
      expect(evaluation.status).toBe('RETURNED');
      expect(evaluation.daysRemaining).toBe(0);
    });

    it('retorna OVERDUE si la fecha limite ya expiro', () => {
      const now = 1700000000000;
      const overdueLoan: BookLoan = {
        ...sampleLoan,
        returnedAt: null,
        dueDate: now - 86400000 * 2, // Vencio hace 2 dias
      };
      const evaluation = evaluateLoanDueStatus(overdueLoan, now);
      expect(evaluation.status).toBe('OVERDUE');
      expect(evaluation.daysRemaining).toBeLessThan(0);
    });

    it('retorna DUE_SOON si faltan entre 0 y 2 dias', () => {
      const now = 1700000000000;
      const dueSoonLoan: BookLoan = {
        ...sampleLoan,
        returnedAt: null,
        dueDate: now + 86400000 * 1.5, // Falta 1.5 dias (ceil = 2)
      };
      const evaluation = evaluateLoanDueStatus(dueSoonLoan, now);
      expect(evaluation.status).toBe('DUE_SOON');
      expect(evaluation.daysRemaining).toBe(2);
    });

    it('retorna ON_TIME si faltan mas de 2 dias', () => {
      const now = 1700000000000;
      const onTimeLoan: BookLoan = {
        ...sampleLoan,
        returnedAt: null,
        dueDate: now + 86400000 * 5, // Faltan 5 dias
      };
      const evaluation = evaluateLoanDueStatus(onTimeLoan, now);
      expect(evaluation.status).toBe('ON_TIME');
      expect(evaluation.daysRemaining).toBe(5);
    });

    it('retorna ON_TIME e Infinity si no tiene dueDate', () => {
      const noDueDateLoan: BookLoan = {
        ...sampleLoan,
        returnedAt: null,
        dueDate: null,
      };
      const evaluation = evaluateLoanDueStatus(noDueDateLoan);
      expect(evaluation.status).toBe('ON_TIME');
      expect(evaluation.daysRemaining).toBe(Infinity);
    });
  });

  describe('shouldCountInOwnedPhysicalInventory', () => {
    it('retorna true para un libro fisico propio', () => {
      expect(shouldCountInOwnedPhysicalInventory(sampleBook)).toBe(true);
    });

    it('retorna true para un libro fisico propio prestado a un tercero (LENT_OUT)', () => {
      expect(shouldCountInOwnedPhysicalInventory(sampleBook, sampleLoan)).toBe(true);
    });

    it('retorna false si el libro es digital', () => {
      const digitalBook: Book = { ...sampleBook, modality: 'DIGITAL' };
      expect(shouldCountInOwnedPhysicalInventory(digitalBook)).toBe(false);
    });

    it('retorna false si el libro es de la lista de deseos (WISHLIST)', () => {
      const wishlistBook: Book = { ...sampleBook, ownership: 'WISHLIST' };
      expect(shouldCountInOwnedPhysicalInventory(wishlistBook)).toBe(false);
    });

    it('retorna false si el libro es prestado al usuario (BORROWED)', () => {
      const borrowedBook: Book = { ...sampleBook, ownership: 'BORROWED' };
      expect(shouldCountInOwnedPhysicalInventory(borrowedBook)).toBe(false);
    });

    it('retorna false si hay un prestamo activo de tipo BORROWED_IN', () => {
      const borrowedInLoan: BookLoan = {
        ...sampleLoan,
        loanDirection: 'BORROWED_IN',
        returnedAt: null,
      };
      expect(shouldCountInOwnedPhysicalInventory(sampleBook, borrowedInLoan)).toBe(false);
    });
  });

  describe('BookLoansRepository CRUD & Idempotence', () => {
    it('crea un prestamo nuevo y programa recordatorio si tiene dueDate', async () => {
      const scheduleSpy = jest.spyOn(loanNotificationAdapter, 'scheduleLoanReminder');

      // 1. getActiveByBookId -> null
      const mockLimitActive = jest.fn().mockResolvedValue([]);
      const mockWhereActive = jest.fn().mockReturnValue({ limit: mockLimitActive });

      // 2. select book -> sampleBook
      const mockLimitBook = jest.fn().mockResolvedValue([sampleBook]);
      const mockWhereBook = jest.fn().mockReturnValue({ limit: mockLimitBook });

      // 3. getById -> sampleLoan
      const mockLimitGetById = jest.fn().mockResolvedValue([sampleLoan]);
      const mockWhereGetById = jest.fn().mockReturnValue({ limit: mockLimitGetById });

      (db.select as jest.Mock)
        .mockReturnValueOnce({ from: jest.fn().mockReturnValue({ where: mockWhereActive }) })
        .mockReturnValueOnce({ from: jest.fn().mockReturnValue({ where: mockWhereBook }) })
        .mockReturnValueOnce({ from: jest.fn().mockReturnValue({ where: mockWhereGetById }) });

      const mockValues = jest.fn().mockResolvedValue(undefined);
      (db.insert as jest.Mock).mockReturnValue({ values: mockValues });

      const futureDate = Date.now() + 86400000 * 7;
      const loan = await BookLoansRepository.createLoan({
        bookId: 'book-1',
        loanDirection: 'LENT_OUT',
        borrowerName: 'Ana Gomez',
        dueDate: futureDate,
      });

      expect(scheduleSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          borrowerName: 'Ana Gomez',
          dueDateMs: futureDate,
        })
      );
      expect(db.insert).toHaveBeenCalled();
      expect(loan).toEqual(sampleLoan);
    });

    it('es idempotente: si ya existe un prestamo activo, actualiza el existente en lugar de duplicar', async () => {
      // 1. getActiveByBookId -> sampleLoan (activo)
      const mockLimitActive = jest.fn().mockResolvedValue([sampleLoan]);
      const mockWhereActive = jest.fn().mockReturnValue({ limit: mockLimitActive });

      // 2. select book -> sampleBook
      const mockLimitBook = jest.fn().mockResolvedValue([sampleBook]);
      const mockWhereBook = jest.fn().mockReturnValue({ limit: mockLimitBook });

      // 3. getById -> sampleLoan actualizado
      const mockLimitGetById = jest.fn().mockResolvedValue([{ ...sampleLoan, borrowerName: 'Carlos Renovado' }]);
      const mockWhereGetById = jest.fn().mockReturnValue({ limit: mockLimitGetById });

      (db.select as jest.Mock)
        .mockReturnValueOnce({ from: jest.fn().mockReturnValue({ where: mockWhereActive }) })
        .mockReturnValueOnce({ from: jest.fn().mockReturnValue({ where: mockWhereBook }) })
        .mockReturnValueOnce({ from: jest.fn().mockReturnValue({ where: mockWhereGetById }) });

      const mockWhereUpdate = jest.fn().mockResolvedValue(undefined);
      const mockSet = jest.fn().mockReturnValue({ where: mockWhereUpdate });
      (db.update as jest.Mock).mockReturnValue({ set: mockSet });

      const result = await BookLoansRepository.createLoan({
        bookId: 'book-1',
        loanDirection: 'LENT_OUT',
        borrowerName: 'Carlos Renovado',
      });

      expect(db.insert).not.toHaveBeenCalled();
      expect(db.update).toHaveBeenCalled();
      expect(result.borrowerName).toBe('Carlos Renovado');
    });

    it('actualiza ownership = BORROWED en la tabla books cuando loanDirection es BORROWED_IN', async () => {
      // 1. getActiveByBookId -> null
      const mockLimitActive = jest.fn().mockResolvedValue([]);
      const mockWhereActive = jest.fn().mockReturnValue({ limit: mockLimitActive });

      // 2. select book -> sampleBook
      const mockLimitBook = jest.fn().mockResolvedValue([sampleBook]);
      const mockWhereBook = jest.fn().mockReturnValue({ limit: mockLimitBook });

      // 3. getById -> sampleLoan
      const mockLimitGetById = jest.fn().mockResolvedValue([sampleLoan]);
      const mockWhereGetById = jest.fn().mockReturnValue({ limit: mockLimitGetById });

      (db.select as jest.Mock)
        .mockReturnValueOnce({ from: jest.fn().mockReturnValue({ where: mockWhereActive }) })
        .mockReturnValueOnce({ from: jest.fn().mockReturnValue({ where: mockWhereBook }) })
        .mockReturnValueOnce({ from: jest.fn().mockReturnValue({ where: mockWhereGetById }) });

      const mockValues = jest.fn().mockResolvedValue(undefined);
      (db.insert as jest.Mock).mockReturnValue({ values: mockValues });

      const mockWhereUpdate = jest.fn().mockResolvedValue(undefined);
      const mockSet = jest.fn().mockReturnValue({ where: mockWhereUpdate });
      (db.update as jest.Mock).mockReturnValue({ set: mockSet });

      await BookLoansRepository.createLoan({
        bookId: 'book-1',
        loanDirection: 'BORROWED_IN',
        borrowerName: 'Biblioteca Publica',
      });

      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          ownership: 'BORROWED',
        })
      );
    });

    it('marca un prestamo como devuelto y cancela su recordatorio local', async () => {
      const cancelSpy = jest.spyOn(loanNotificationAdapter, 'cancelLoanReminder');

      // 1. getById -> sampleLoan
      const mockLimit1 = jest.fn().mockResolvedValue([sampleLoan]);
      const mockWhere1 = jest.fn().mockReturnValue({ limit: mockLimit1 });

      // 2. getById final -> sampleLoan devuelto
      const returnedLoan = { ...sampleLoan, returnedAt: 1700600000000 };
      const mockLimit2 = jest.fn().mockResolvedValue([returnedLoan]);
      const mockWhere2 = jest.fn().mockReturnValue({ limit: mockLimit2 });

      (db.select as jest.Mock)
        .mockReturnValueOnce({ from: jest.fn().mockReturnValue({ where: mockWhere1 }) })
        .mockReturnValueOnce({ from: jest.fn().mockReturnValue({ where: mockWhere2 }) });

      const mockWhereUpdate = jest.fn().mockResolvedValue(undefined);
      const mockSet = jest.fn().mockReturnValue({ where: mockWhereUpdate });
      (db.update as jest.Mock).mockReturnValue({ set: mockSet });

      const result = await BookLoansRepository.markAsReturned('loan-1', 1700600000000);

      expect(cancelSpy).toHaveBeenCalledWith('notif_loan_1700500000000');
      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          returnedAt: 1700600000000,
        })
      );
      expect(result?.returnedAt).toBe(1700600000000);
    });

    it('extiende la fecha limite sumando dias y reprogramando el recordatorio', async () => {
      const cancelSpy = jest.spyOn(loanNotificationAdapter, 'cancelLoanReminder');
      const scheduleSpy = jest.spyOn(loanNotificationAdapter, 'scheduleLoanReminder');

      // 1. getById -> sampleLoan
      const mockLimit1 = jest.fn().mockResolvedValue([sampleLoan]);
      const mockWhere1 = jest.fn().mockReturnValue({ limit: mockLimit1 });

      // 2. select book -> sampleBook
      const mockLimitBook = jest.fn().mockResolvedValue([sampleBook]);
      const mockWhereBook = jest.fn().mockReturnValue({ limit: mockLimitBook });

      // 3. getById final -> extended loan
      const extendedDueDate = sampleLoan.dueDate! + 7 * 86400000;
      const extendedLoan = { ...sampleLoan, dueDate: extendedDueDate };
      const mockLimit2 = jest.fn().mockResolvedValue([extendedLoan]);
      const mockWhere2 = jest.fn().mockReturnValue({ limit: mockLimit2 });

      (db.select as jest.Mock)
        .mockReturnValueOnce({ from: jest.fn().mockReturnValue({ where: mockWhere1 }) })
        .mockReturnValueOnce({ from: jest.fn().mockReturnValue({ where: mockWhereBook }) })
        .mockReturnValueOnce({ from: jest.fn().mockReturnValue({ where: mockWhere2 }) });

      const mockWhereUpdate = jest.fn().mockResolvedValue(undefined);
      const mockSet = jest.fn().mockReturnValue({ where: mockWhereUpdate });
      (db.update as jest.Mock).mockReturnValue({ set: mockSet });

      const result = await BookLoansRepository.extendDueDate('loan-1', 7);

      expect(cancelSpy).toHaveBeenCalledWith('notif_loan_1700500000000');
      expect(scheduleSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          dueDateMs: extendedDueDate,
        })
      );
      expect(result?.dueDate).toBe(extendedDueDate);
    });

    it('retorna mapa de prestamos activos indexados por bookId', async () => {
      const activeLoan1 = { ...sampleLoan, id: 'l1', bookId: 'b1' };
      const activeLoan2 = { ...sampleLoan, id: 'l2', bookId: 'b2' };

      const mockWhere = jest.fn().mockResolvedValue([activeLoan1, activeLoan2]);
      (db.select as jest.Mock).mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: mockWhere,
        }),
      });

      const map = await BookLoansRepository.getActiveLoansByBookMap();

      expect(Object.keys(map)).toHaveLength(2);
      expect(map['b1'].id).toBe('l1');
      expect(map['b2'].id).toBe('l2');
    });
  });
});
