jest.mock('../../src/db/client', () => {
  const mockDb = {
    select: jest.fn(),
    insert: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };
  const mockRawDb = {
    getAllSync: jest.fn(),
  };
  return {
    db: mockDb,
    rawDb: mockRawDb,
  };
});

import {
  calculateReaderVelocity,
  calculateBookCompletionEta,
  calculateGoalPacingAndCatchUp,
  calculateStreakAndHeatmap,
  buildAdvancedStatsAndWrapped,
  COLD_START_SPEED_PAGES_PER_HOUR,
  COLD_START_PACE_PAGES_PER_DAY,
} from '../../src/features/goals-analytics/services/forecastingService';
import {
  calculateElapsedSeconds,
  evaluateSessionOutlier,
  useReadingTimerStore,
} from '../../src/features/reading-tracker/store/readingTimerStore';
import { ReadingSession } from '../../src/db/schema/readingSessions';
import { Book } from '../../src/db/schema/books';
import { ReadingLog } from '../../src/db/schema/readingLogs';
import { ReadingSessionsRepository } from '../../src/db/repositories/readingSessionsRepository';
import { ReadingGoalsRepository } from '../../src/db/repositories/readingGoalsRepository';
import { db } from '../../src/db/client';

describe('Reading Timer Store y Funciones Puras', () => {
  beforeEach(() => {
    useReadingTimerStore.getState().resetTimer();
  });

  test('calculateElapsedSeconds calcula correctamente el tiempo transcurrido', () => {
    expect(calculateElapsedSeconds(null, 120, false)).toBe(120);
    expect(calculateElapsedSeconds(1000, 50, false)).toBe(50);
    expect(calculateElapsedSeconds(1000, 50, true, 4000)).toBe(53);
    expect(calculateElapsedSeconds(null, -10, false)).toBe(0);
  });

  test('evaluateSessionOutlier detecta sesiones demasiado lentas o rapidas', () => {
    // Sesion lenta (1 pag en 1800s / 30 min = 2 pags/h < 3)
    const slow = evaluateSessionOutlier(1, 1800, 25);
    expect(slow.isOutlier).toBe(true);
    expect(slow.reason).toBe('TOO_SLOW');
    expect(slow.speedPagesPerHour).toBe(2);
    expect(slow.suggestedAdjustedSeconds).toBe(144);
    expect(slow.suggestedAdjustedMinutes).toBe(2);

    // Sesion rapida (100 pags en 120 segundos)
    const fast = evaluateSessionOutlier(100, 120, 25);
    expect(fast.isOutlier).toBe(true);
    expect(fast.reason).toBe('TOO_FAST');

    // Sesion normal (20 pags en 40 min = 30 pags/h)
    const normal = evaluateSessionOutlier(20, 2400, 25);
    expect(normal.isOutlier).toBe(false);
    expect(normal.reason).toBeNull();
  });

  test('useReadingTimerStore maneja el ciclo de vida del cronometro', () => {
    const store = useReadingTimerStore.getState();

    store.startTimer('book-101', 50, 1000);
    let state = useReadingTimerStore.getState();
    expect(state.activeBookId).toBe('book-101');
    expect(state.startPage).toBe(50);
    expect(state.isRunning).toBe(true);
    expect(state.isPaused).toBe(false);
    expect(state.getElapsedSeconds(5000)).toBe(4);

    store.pauseTimer(5000);
    state = useReadingTimerStore.getState();
    expect(state.isRunning).toBe(false);
    expect(state.isPaused).toBe(true);
    expect(state.accumulatedSeconds).toBe(4);

    store.resumeTimer(10000);
    state = useReadingTimerStore.getState();
    expect(state.isRunning).toBe(true);
    expect(state.isPaused).toBe(false);
    expect(state.getElapsedSeconds(16000)).toBe(10);

    store.addSimulatedSeconds(20);
    state = useReadingTimerStore.getState();
    expect(state.accumulatedSeconds).toBe(24);

    store.resetTimer();
    state = useReadingTimerStore.getState();
    expect(state.activeBookId).toBeNull();
    expect(state.startPage).toBe(0);
    expect(state.accumulatedSeconds).toBe(0);
    expect(state.isRunning).toBe(false);
    expect(state.isPaused).toBe(false);
  });
});

describe('Motor Matematico de Predicciones (ForecastingService)', () => {
  const refDate = new Date('2026-11-06T12:00:00Z');

  test('calculateReaderVelocity aplica Cold Start cuando no hay sesiones validas', () => {
    const velocity = calculateReaderVelocity([], refDate);
    expect(velocity.isColdStart).toBe(true);
    expect(velocity.pagesPerHour).toBe(COLD_START_SPEED_PAGES_PER_HOUR);
    expect(velocity.pagesPerDay).toBe(COLD_START_PACE_PAGES_PER_DAY);
    expect(velocity.validSessionsCount).toBe(0);
  });

  test('calculateReaderVelocity calcula ritmo y velocidad ponderada filtrando anomalias', () => {
    const sessions: ReadingSession[] = [
      {
        id: 's1',
        bookId: 'b1',
        startPage: 0,
        endPage: 30,
        pagesRead: 30,
        durationSeconds: 3600, // 30 pags/h
        startedAtEpochMs: new Date('2026-11-06T10:00:00Z').getTime(),
        localDate: '2026-11-06',
        createdAt: new Date('2026-11-06T11:00:00Z').getTime(),
      },
      {
        id: 's2',
        bookId: 'b1',
        startPage: 30,
        endPage: 50,
        pagesRead: 20,
        durationSeconds: 1800, // 40 pags/h
        startedAtEpochMs: new Date('2026-11-05T10:00:00Z').getTime(),
        localDate: '2026-11-05',
        createdAt: new Date('2026-11-05T10:30:00Z').getTime(),
      },
      {
        id: 's3_outlier',
        bookId: 'b1',
        startPage: 50,
        endPage: 51,
        pagesRead: 1,
        durationSeconds: 7200, // 0.5 pags/h (outlier, ignorada)
        startedAtEpochMs: new Date('2026-11-04T10:00:00Z').getTime(),
        localDate: '2026-11-04',
        createdAt: new Date('2026-11-04T12:00:00Z').getTime(),
      },
    ];

    const velocity = calculateReaderVelocity(sessions, refDate);
    expect(velocity.isColdStart).toBe(false);
    expect(velocity.validSessionsCount).toBe(2);
    // 50 pags / 1.5 horas = 33.3 pags/h
    expect(velocity.pagesPerHour).toBe(33.3);
    // 51 pags / 14 = 3.6 pags/dia
    expect(velocity.pagesPerDay).toBe(3.6);
  });

  test('calculateBookCompletionEta proyecta fecha de terminacion e intervalos', () => {
    const book: Pick<Book, 'id' | 'title' | 'pageCount' | 'currentPage' | 'currentPercentage' | 'progressMode'> = {
      id: 'b1',
      title: 'El nombre del viento',
      pageCount: 600,
      currentPage: 300,
      currentPercentage: 50,
      progressMode: 'PAGES',
    };

    const velocity = {
      pagesPerHour: 30,
      pagesPerDay: 30,
      isColdStart: false,
      validSessionsCount: 5,
    };

    const eta = calculateBookCompletionEta(book, velocity, undefined, refDate);
    expect(eta.remainingPages).toBe(300);
    expect(eta.remainingHoursTotal).toBe(10);
    expect(eta.remainingHoursWhole).toBe(10);
    expect(eta.remainingMinutesPart).toBe(0);
    expect(eta.estimatedDaysRemaining).toBe(10);
    expect(eta.estimatedCompletionDateIso).toBe('2026-11-16');
  });

  test('calculateGoalPacingAndCatchUp evalua tolerancia y estado AHEAD/ON_TRACK/BEHIND', () => {
    const onTrack = calculateGoalPacingAndCatchUp({
      targetUnits: 24,
      currentUnits: 12,
      elapsedDaysInPeriod: 180,
      totalDaysInPeriod: 365,
      unitType: 'BOOKS',
    });
    expect(onTrack.status).toBe('ON_TRACK');

    const ahead = calculateGoalPacingAndCatchUp({
      targetUnits: 24,
      currentUnits: 16,
      elapsedDaysInPeriod: 180,
      totalDaysInPeriod: 365,
      unitType: 'BOOKS',
    });
    expect(ahead.status).toBe('AHEAD');

    const behind = calculateGoalPacingAndCatchUp({
      targetUnits: 24,
      currentUnits: 8,
      elapsedDaysInPeriod: 180,
      totalDaysInPeriod: 365,
      unitType: 'BOOKS',
    });
    expect(behind.status).toBe('BEHIND');
    expect(behind.requiredDailyUnits).toBeGreaterThan(0);
  });

  test('calculateStreakAndHeatmap calcula rachas y aplica el Escudo de Racha correctamente', () => {
    const sessions: ReadingSession[] = [
      // Leido hoy (2026-11-06)
      {
        id: 'st1',
        bookId: 'b1',
        startPage: 0,
        endPage: 25,
        pagesRead: 25,
        durationSeconds: 1800,
        startedAtEpochMs: new Date('2026-11-06T10:00:00Z').getTime(),
        localDate: '2026-11-06',
        createdAt: new Date('2026-11-06T10:00:00Z').getTime(),
      },
      // Hueco el 2026-11-05 (0 pags)
      // Leido el 2026-11-04
      {
        id: 'st2',
        bookId: 'b1',
        startPage: 0,
        endPage: 30,
        pagesRead: 30,
        durationSeconds: 1800,
        startedAtEpochMs: new Date('2026-11-04T10:00:00Z').getTime(),
        localDate: '2026-11-04',
        createdAt: new Date('2026-11-04T10:00:00Z').getTime(),
      },
      // Leido el 2026-11-03
      {
        id: 'st3',
        bookId: 'b1',
        startPage: 0,
        endPage: 35,
        pagesRead: 35,
        durationSeconds: 1800,
        startedAtEpochMs: new Date('2026-11-03T10:00:00Z').getTime(),
        localDate: '2026-11-03',
        createdAt: new Date('2026-11-03T10:00:00Z').getTime(),
      },
    ];

    const result = calculateStreakAndHeatmap(sessions, refDate);
    expect(result.currentStreakDays).toBe(4);
    expect(result.weeks).toHaveLength(4);
    expect(result.weeks[0].days).toHaveLength(7);
  });

  test('buildAdvancedStatsAndWrapped construye metricas de Wrapped y desglose fisico/digital', () => {
    const books: Book[] = [
      {
        id: 'b_phys',
        isbn13: '9781111111111',
        isbn10: null,
        title: 'Cronica de una muerte anunciada',
        subtitle: null,
        seriesName: null,
        seriesIndex: null,
        authorsJson: '["Gabriel Garcia Marquez"]',
        translator: null,
        publisher: 'Diana',
        description: null,
        coverUri: null,
        pageCount: 150,
        modality: 'PHYSICAL',
        ownership: 'OWNED',
        metadataStatus: 'COMPLETE',
        format: 'RUSTICA',
        progressMode: 'PAGES',
        language: 'es',
        currentStatus: 'LEIDO',
        currentPage: 150,
        currentPercentage: 100,
        rating: 5,
        pauseOrDnfNote: null,
        isSpoiler: false,
        shelfId: null,
        wishlistStoreNote: null,
        createdAt: new Date('2026-01-01').getTime(),
        updatedAt: new Date('2026-06-01').getTime(),
      },
      {
        id: 'b_dig',
        isbn13: '9782222222222',
        isbn10: null,
        title: 'Fundacion',
        subtitle: null,
        seriesName: null,
        seriesIndex: null,
        authorsJson: '["Isaac Asimov"]',
        translator: null,
        publisher: 'Debolsillo',
        description: null,
        coverUri: null,
        pageCount: 250,
        modality: 'DIGITAL',
        ownership: 'OWNED',
        metadataStatus: 'COMPLETE',
        format: 'KINDLE',
        progressMode: 'PAGES',
        language: 'es',
        currentStatus: 'LEIDO',
        currentPage: 250,
        currentPercentage: 100,
        rating: 4.5,
        pauseOrDnfNote: null,
        isSpoiler: false,
        shelfId: null,
        wishlistStoreNote: null,
        createdAt: new Date('2026-02-01').getTime(),
        updatedAt: new Date('2026-07-01').getTime(),
      },
    ];

    const logs: ReadingLog[] = [
      {
        id: 'l1',
        bookId: 'b_phys',
        readNumber: 1,
        startedAt: new Date('2026-05-01').getTime(),
        finishedAt: new Date('2026-06-01').getTime(),
        rating: 5,
        review: null,
        createdAt: new Date('2026-05-01').getTime(),
        updatedAt: new Date('2026-06-01').getTime(),
      },
      {
        id: 'l2',
        bookId: 'b_dig',
        readNumber: 1,
        startedAt: new Date('2026-06-15').getTime(),
        finishedAt: new Date('2026-07-01').getTime(),
        rating: 4.5,
        review: null,
        createdAt: new Date('2026-06-15').getTime(),
        updatedAt: new Date('2026-07-01').getTime(),
      },
    ];

    const sessions: ReadingSession[] = [
      {
        id: 's_phys',
        bookId: 'b_phys',
        startPage: 0,
        endPage: 150,
        pagesRead: 150,
        durationSeconds: 18000,
        startedAtEpochMs: new Date('2026-05-10T12:00:00Z').getTime(),
        localDate: '2026-05-10',
        createdAt: new Date('2026-05-10T12:00:00Z').getTime(),
      },
      {
        id: 's_dig',
        bookId: 'b_dig',
        startPage: 0,
        endPage: 250,
        pagesRead: 250,
        durationSeconds: 22500,
        startedAtEpochMs: new Date('2026-06-20T12:00:00Z').getTime(),
        localDate: '2026-06-20',
        createdAt: new Date('2026-06-20T12:00:00Z').getTime(),
      },
    ];

    const stats = buildAdvancedStatsAndWrapped({
      books,
      logs,
      sessions,
      year: 2026,
      referenceDate: refDate,
    });

    expect(stats.physicalStats.readCount).toBe(1);
    expect(stats.digitalStats.readCount).toBe(1);
    expect(stats.physicalStats.percentageOfTotal).toBe(50);
    expect(stats.digitalStats.percentageOfTotal).toBe(50);
    expect(stats.wrappedCard.totalBooksRead).toBe(2);
    expect(stats.wrappedCard.totalPagesRead).toBe(400);
    expect(stats.weekdayDistribution).toHaveLength(7);
  });
});

describe('ReadingSessionsRepository y ReadingGoalsRepository', () => {
  const mockDb = db as unknown as {
    select: jest.Mock;
    insert: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('ReadingSessionsRepository.createTimedSession guarda sesion con resolucion de anomalias', async () => {
    const mockBook: Book = {
      id: 'book-1',
      isbn13: '9781234567890',
      isbn10: null,
      title: 'Prueba',
      subtitle: null,
      seriesName: null,
      seriesIndex: null,
      authorsJson: '[]',
      translator: null,
      publisher: null,
      description: null,
      coverUri: null,
      pageCount: 200,
      modality: 'PHYSICAL',
      ownership: 'OWNED',
      metadataStatus: 'COMPLETE',
      format: 'RUSTICA',
      progressMode: 'PAGES',
      language: 'es',
      currentStatus: 'LEYENDO',
      currentPage: 50,
      currentPercentage: 25,
      rating: null,
      pauseOrDnfNote: null,
      isSpoiler: false,
      shelfId: null,
      wishlistStoreNote: null,
      createdAt: 1000,
      updatedAt: 1000,
    };

    mockDb.insert.mockReturnValue({
      values: jest.fn().mockReturnValue({
        returning: jest.fn().mockResolvedValue([
          {
            id: 'sess-1',
            bookId: 'book-1',
            startPage: 50,
            endPage: 80,
            pagesRead: 30,
            durationSeconds: 3600,
            startedAtEpochMs: 2000,
            localDate: '2026-11-06',
            createdAt: 2000,
          },
        ]),
      }),
    });

    mockDb.select.mockReturnValue({
      from: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue([mockBook]),
        }),
      }),
    });

    mockDb.update.mockReturnValue({
      set: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnValue({
          returning: jest.fn().mockResolvedValue([
            {
              ...mockBook,
              currentPage: 80,
              currentPercentage: 40,
            },
          ]),
        }),
      }),
    });

    const result = await ReadingSessionsRepository.createTimedSession({
      bookId: 'book-1',
      startPage: 50,
      endPage: 80,
      durationSeconds: 3600,
      startedAtEpochMs: 2000,
      outlierResolution: 'NONE',
    });

    expect(result.session.id).toBe('sess-1');
    expect(result.updatedBook?.currentPage).toBe(80);
    expect(result.updatedBook?.currentPercentage).toBe(40);
  });

  test('ReadingGoalsRepository.upsertGoal inserta de forma idempotente', async () => {
    // Caso 1: No existe la meta previa, hace insert
    mockDb.select.mockReturnValue({
      from: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue([]),
        }),
      }),
    });

    mockDb.insert.mockReturnValue({
      values: jest.fn().mockReturnValue({
        returning: jest.fn().mockResolvedValue([
          {
            id: 'goal-1',
            periodType: 'ANNUAL',
            year: 2026,
            month: null,
            targetBooks: 24,
            targetPages: 0,
            targetMinutesPerDay: 0,
            createdAt: 1000,
            updatedAt: 1000,
          },
        ]),
      }),
    });

    const goal = await ReadingGoalsRepository.upsertGoal({
      periodType: 'ANNUAL',
      year: 2026,
      targetBooks: 24,
    });

    expect(goal.id).toBe('goal-1');
    expect(goal.targetBooks).toBe(24);
  });
});
