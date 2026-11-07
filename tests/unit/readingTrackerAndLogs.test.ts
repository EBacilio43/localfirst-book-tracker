import {
  calculateAutomaticPercentage,
  resolveReadingLocalDate,
  isValidHalfStarRating,
  useReaderPreferencesStore,
} from '../../src/features/reading-tracker/store/readerPreferencesStore';
import { ReadingLogsRepository } from '../../src/db/repositories/readingLogsRepository';
import { db } from '../../src/db/client';
import { ReadingLog } from '../../src/db/schema/readingLogs';
import { Book } from '../../src/db/schema/books';

jest.mock('../../src/db/client', () => {
  const mockDb = {
    select: jest.fn(),
    insert: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };
  return {
    db: mockDb,
    rawDb: {
      getAllSync: jest.fn(),
    },
  };
});

function createSelectChain<T>(resolveValue: T) {
  const promise = Promise.resolve(resolveValue);
  const limit = jest.fn().mockReturnValue(promise);
  const orderBy = jest.fn().mockReturnValue(promise);

  const whereObj = {
    then: promise.then.bind(promise),
    catch: promise.catch.bind(promise),
    finally: promise.finally.bind(promise),
    limit,
    orderBy,
  };

  const where = jest.fn().mockReturnValue(whereObj);

  const fromObj = {
    then: promise.then.bind(promise),
    catch: promise.catch.bind(promise),
    finally: promise.finally.bind(promise),
    where,
    orderBy,
    limit,
  };

  const from = jest.fn().mockReturnValue(fromObj);

  return { from, where, limit, orderBy };
}

function createInsertChain<T>(resolveValue: T) {
  const returning = jest.fn().mockResolvedValue(resolveValue);
  const values = jest.fn().mockReturnValue({ returning });
  return { values, returning };
}

function createUpdateChain<T>(resolveValue: T) {
  const returning = jest.fn().mockResolvedValue(resolveValue);
  const where = jest.fn().mockReturnValue({ returning });
  const set = jest.fn().mockReturnValue({ where });
  return { set, where, returning };
}

describe('readingTrackerAndLogs Unit Tests', () => {
  const sampleBook: Book = {
    id: 'book-100',
    isbn13: '9788445000663',
    isbn10: '8445000668',
    title: 'El Hobbit',
    subtitle: null,
    seriesName: null,
    seriesIndex: null,
    authorsJson: JSON.stringify(['J.R.R. Tolkien']),
    translator: null,
    publisher: 'Minotauro',
    description: 'Aventura en la Tierra Media.',
    coverUri: 'https://example.com/cover.jpg',
    pageCount: 300,
    modality: 'PHYSICAL',
    ownership: 'OWNED',
    metadataStatus: 'COMPLETE',
    format: 'TAPA_DURA',
    progressMode: 'PAGES',
    language: 'es',
    currentStatus: 'POR_LEER',
    currentPage: 0,
    currentPercentage: 0,
    rating: null,
    pauseOrDnfNote: null,
    isSpoiler: false,
    shelfId: null,
    wishlistStoreNote: null,
    createdAt: 1700000000,
    updatedAt: 1700000000,
  };

  const sampleLog: ReadingLog = {
    id: 'rlog_100',
    bookId: 'book-100',
    readNumber: 1,
    startedAt: 1700000000,
    finishedAt: null,
    rating: null,
    review: null,
    createdAt: 1700000000,
    updatedAt: 1700000000,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    useReaderPreferencesStore.setState({
      progressDisplayMode: 'PAGES',
      hasCompletedInitialSetup: false,
    });
  });

  describe('calculateAutomaticPercentage', () => {
    it('devuelve 0 cuando la unidad actual es 0 o negativa', () => {
      expect(calculateAutomaticPercentage(0, 300)).toBe(0);
      expect(calculateAutomaticPercentage(-10, 300)).toBe(0);
    });

    it('devuelve 0 cuando las unidades totales son menores o iguales a 0', () => {
      expect(calculateAutomaticPercentage(50, 0)).toBe(0);
      expect(calculateAutomaticPercentage(50, -100)).toBe(0);
    });

    it('devuelve 0 ante parametros no numericos o NaN', () => {
      expect(calculateAutomaticPercentage(NaN, 300)).toBe(0);
      expect(calculateAutomaticPercentage(50, NaN)).toBe(0);
    });

    it('calcula porcentajes normales con precision de un decimal', () => {
      expect(calculateAutomaticPercentage(75, 300)).toBe(25);
      expect(calculateAutomaticPercentage(100, 300)).toBe(33.3);
      expect(calculateAutomaticPercentage(1, 3)).toBe(33.3);
      expect(calculateAutomaticPercentage(2, 3)).toBe(66.7);
    });

    it('devuelve 100 cuando la unidad actual es igual o mayor al total', () => {
      expect(calculateAutomaticPercentage(300, 300)).toBe(100);
      expect(calculateAutomaticPercentage(350, 300)).toBe(100);
    });
  });

  describe('resolveReadingLocalDate', () => {
    it('resuelve TODAY con la fecha local esperada', () => {
      const fixedDate = new Date(2026, 4, 15, 14, 0, 0); // 15 de mayo de 2026
      const result = resolveReadingLocalDate('TODAY', fixedDate);
      expect(result).toBe('2026-05-15');
    });

    it('resuelve YESTERDAY restando un dia calendario', () => {
      const fixedDate = new Date(2026, 4, 15, 14, 0, 0); // 15 de mayo de 2026
      const result = resolveReadingLocalDate('YESTERDAY', fixedDate);
      expect(result).toBe('2026-05-14');
    });

    it('gestiona correctamente el cambio de mes hacia febrero en anio no bisiesto', () => {
      const marchFirst = new Date(2026, 2, 1, 10, 0, 0); // 1 de marzo de 2026
      const result = resolveReadingLocalDate('YESTERDAY', marchFirst);
      expect(result).toBe('2026-02-28');
    });

    it('gestiona correctamente el cambio de mes hacia febrero en anio bisiesto', () => {
      const marchFirstLeap = new Date(2024, 2, 1, 10, 0, 0); // 1 de marzo de 2024
      const result = resolveReadingLocalDate('YESTERDAY', marchFirstLeap);
      expect(result).toBe('2024-02-29');
    });

    it('gestiona correctamente el cambio de anio en 1 de enero', () => {
      const newYear = new Date(2026, 0, 1, 8, 30, 0); // 1 de enero de 2026
      const result = resolveReadingLocalDate('YESTERDAY', newYear);
      expect(result).toBe('2025-12-31');
    });

    it('utiliza la fecha actual si no se pasa referenceDate', () => {
      const todayString = resolveReadingLocalDate('TODAY');
      expect(todayString).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  describe('isValidHalfStarRating', () => {
    it('acepta calificaciones validas de medias estrellas entre 0.5 y 5.0', () => {
      const validRatings = [0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0];
      for (const rating of validRatings) {
        expect(isValidHalfStarRating(rating)).toBe(true);
      }
    });

    it('rechaza valores fuera del rango permitido', () => {
      expect(isValidHalfStarRating(0)).toBe(false);
      expect(isValidHalfStarRating(-1)).toBe(false);
      expect(isValidHalfStarRating(5.5)).toBe(false);
      expect(isValidHalfStarRating(6.0)).toBe(false);
    });

    it('rechaza fracciones que no correspondan a incrementos exactos de 0.5', () => {
      expect(isValidHalfStarRating(0.3)).toBe(false);
      expect(isValidHalfStarRating(4.2)).toBe(false);
      expect(isValidHalfStarRating(2.25)).toBe(false);
      expect(isValidHalfStarRating(3.8)).toBe(false);
    });

    it('rechaza NaN, Infinity y valores no numericos', () => {
      expect(isValidHalfStarRating(NaN)).toBe(false);
      expect(isValidHalfStarRating(Infinity)).toBe(false);
      expect(isValidHalfStarRating(-Infinity)).toBe(false);
    });
  });

  describe('useReaderPreferencesStore', () => {
    it('inicia con los valores predeterminados', () => {
      const state = useReaderPreferencesStore.getState();
      expect(state.progressDisplayMode).toBe('PAGES');
      expect(state.hasCompletedInitialSetup).toBe(false);
    });

    it('permite alternar entre PAGES y CHAPTERS', () => {
      useReaderPreferencesStore.getState().setProgressDisplayMode('CHAPTERS');
      expect(useReaderPreferencesStore.getState().progressDisplayMode).toBe('CHAPTERS');

      useReaderPreferencesStore.getState().setProgressDisplayMode('PAGES');
      expect(useReaderPreferencesStore.getState().progressDisplayMode).toBe('PAGES');
    });

    it('completa la configuracion inicial marcando el flag y guardando el modo', () => {
      useReaderPreferencesStore.getState().completeInitialSetup('CHAPTERS');
      const state = useReaderPreferencesStore.getState();
      expect(state.hasCompletedInitialSetup).toBe(true);
      expect(state.progressDisplayMode).toBe('CHAPTERS');
    });
  });

  describe('ReadingLogsRepository', () => {
    it('startReading es idempotente si ya existe una lectura activa abierta', () => {
      const selectChainLogs = createSelectChain([sampleLog]);
      const selectChainBook = createSelectChain([sampleBook]);

      (db.select as jest.Mock)
        .mockImplementationOnce(() => ({ from: selectChainLogs.from }))
        .mockImplementationOnce(() => ({ from: selectChainBook.from }));

      return ReadingLogsRepository.startReading('book-100').then((result) => {
        expect(result.log).toEqual(sampleLog);
        expect(result.book).toEqual(sampleBook);
        expect(result.isReread).toBe(false);
        expect(db.insert).not.toHaveBeenCalled();
      });
    });

    it('startReading crea una relectura con readNumber = 2 e isReread = true si habia una lectura finalizada previa', async () => {
      const finishedPreviousLog: ReadingLog = {
        ...sampleLog,
        id: 'rlog_1',
        finishedAt: 1700000500,
        rating: 4.5,
      };

      const selectChainLogs = createSelectChain([finishedPreviousLog]);
      (db.select as jest.Mock).mockReturnValueOnce({ from: selectChainLogs.from });

      const newRereadLog: ReadingLog = {
        id: 'rlog_2',
        bookId: 'book-100',
        readNumber: 2,
        startedAt: 1700001000,
        finishedAt: null,
        rating: null,
        review: null,
        createdAt: 1700001000,
        updatedAt: 1700001000,
      };

      const updatedBook: Book = {
        ...sampleBook,
        currentStatus: 'LEYENDO',
        currentPage: 0,
        currentPercentage: 0,
      };

      const insertChain = createInsertChain([newRereadLog]);
      const updateChain = createUpdateChain([updatedBook]);

      (db.insert as jest.Mock).mockReturnValue(insertChain);
      (db.update as jest.Mock).mockReturnValue(updateChain);

      const result = await ReadingLogsRepository.startReading('book-100', 1700001000);

      expect(result.isReread).toBe(true);
      expect(result.log.readNumber).toBe(2);
      expect(result.book?.currentStatus).toBe('LEYENDO');
      expect(db.insert).toHaveBeenCalled();
      expect(db.update).toHaveBeenCalled();
    });

    it('finishReading cierra la lectura activa asignando calificacion valida de medias estrellas', async () => {
      const selectChainLogs = createSelectChain([sampleLog]);
      (db.select as jest.Mock).mockReturnValueOnce({ from: selectChainLogs.from });

      const closedLog: ReadingLog = {
        ...sampleLog,
        finishedAt: 1700002000,
        rating: 4.5,
        review: 'Excelente lectura de fantasia',
      };

      const updateLogChain = createUpdateChain([closedLog]);
      (db.update as jest.Mock).mockReturnValueOnce(updateLogChain);

      const selectChainBook = createSelectChain([sampleBook]);
      (db.select as jest.Mock).mockReturnValueOnce({ from: selectChainBook.from });

      const finishedBook: Book = {
        ...sampleBook,
        currentStatus: 'LEIDO',
        currentPage: 300,
        currentPercentage: 100,
        rating: 4.5,
      };

      const updateBookChain = createUpdateChain([finishedBook]);
      (db.update as jest.Mock).mockReturnValueOnce(updateBookChain);

      const result = await ReadingLogsRepository.finishReading({
        bookId: 'book-100',
        rating: 4.5,
        review: 'Excelente lectura de fantasia',
        finishedAt: 1700002000,
      });

      expect(result.log.finishedAt).toBe(1700002000);
      expect(result.log.rating).toBe(4.5);
      expect(result.book?.currentStatus).toBe('LEIDO');
      expect(result.book?.currentPercentage).toBe(100);
      expect(result.book?.currentPage).toBe(300);
    });

    it('finishReading rechaza calificaciones no conformes a medias estrellas como 4.3', async () => {
      await expect(
        ReadingLogsRepository.finishReading({
          bookId: 'book-100',
          rating: 4.3,
        })
      ).rejects.toThrow('La calificacion debe estar entre 0.5 y 5.0 en incrementos de 0.5');

      expect(db.update).not.toHaveBeenCalled();
      expect(db.insert).not.toHaveBeenCalled();
    });

    it('getTotalCompletedBooksCount cuenta libros unicos completados sin decrementar jamas si uno entra en relectura', async () => {
      // Caso Hueco #5:
      // Book A tiene currentStatus = 'LEIDO'
      // Book B tiene currentStatus = 'LEYENDO' por relectura, pero tiene un log terminado en reading_logs
      // Book C tiene currentStatus = 'LEYENDO' sin lecturas terminadas
      const booksWithLeido = [{ id: 'book-A' }];
      const finishedLogs = [
        { bookId: 'book-A' },
        { bookId: 'book-B' },
      ];

      const chainBooks = createSelectChain(booksWithLeido);
      const chainLogs = createSelectChain(finishedLogs);

      (db.select as jest.Mock)
        .mockImplementationOnce(() => ({ from: chainBooks.from }))
        .mockImplementationOnce(() => ({ from: chainLogs.from }));

      const totalCount = await ReadingLogsRepository.getTotalCompletedBooksCount();

      // Debe ser 2 libros unicos (book-A y book-B), a pesar de que book-B este en estado LEYENDO
      expect(totalCount).toBe(2);
    });
  });
});
