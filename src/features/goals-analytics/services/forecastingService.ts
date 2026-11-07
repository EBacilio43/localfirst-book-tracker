import { ReadingSession } from '../../../db/schema/readingSessions';
import { Book } from '../../../db/schema/books';
import { ReadingLog } from '../../../db/schema/readingLogs';

export const COLD_START_SPEED_PAGES_PER_HOUR = 25;
export const COLD_START_PACE_PAGES_PER_DAY = 20;
export const MIN_SPEED_PAGES_PER_HOUR = 3;
export const MAX_SPEED_PAGES_PER_HOUR = 180;

export interface ReaderVelocityMetrics {
  pagesPerHour: number;
  pagesPerDay: number;
  isColdStart: boolean;
  validSessionsCount: number;
}

export interface BookCompletionEta {
  remainingPages: number;
  remainingHoursTotal: number;
  remainingHoursWhole: number;
  remainingMinutesPart: number;
  effectivePagesPerDay: number;
  estimatedDaysRemaining: number;
  estimatedCompletionDateIso: string;
}

export interface GoalPacingInput {
  targetUnits: number;
  currentUnits: number;
  elapsedDaysInPeriod: number;
  totalDaysInPeriod: number;
  readerSpeedPagesPerHour?: number;
  averagePagesPerBook?: number;
  unitType?: 'BOOKS' | 'PAGES' | 'MINUTES';
}

export interface GoalPacingResult {
  expectedByToday: number;
  deltaUnits: number;
  status: 'AHEAD' | 'ON_TRACK' | 'BEHIND';
  tolerance: number;
  remainingDays: number;
  remainingUnits: number;
  requiredDailyUnits: number;
  requiredPagesPerDay: number;
  requiredMinutesPerDay: number;
  projectedEndTotal: number;
}

export interface HeatmapDayCell {
  dateIso: string;
  dayLabel: string;
  shortDateLabel: string;
  pagesRead: number;
  minutesRead: number;
  level: 0 | 1 | 2 | 3;
  isShieldUsed: boolean;
  isRetroactiveYesterday: boolean;
  isToday: boolean;
  isFuture: boolean;
}

export interface HeatmapWeekRow {
  weekLabel: string;
  days: HeatmapDayCell[];
}

export interface StreakAndHeatmapResult {
  currentStreakDays: number;
  bestStreakDays: number;
  weeklyDaysCompleted: number;
  availableShields: number;
  weeks: HeatmapWeekRow[];
}

export interface BuildAdvancedStatsParams {
  books: Book[];
  logs: ReadingLog[];
  sessions: ReadingSession[];
  year: number;
  referenceDate?: Date;
}

export interface ModalityStats {
  readCount: number;
  totalPages: number;
  averageSpeedPagesPerHour: number;
  percentageOfTotal: number;
}

export interface WeekdayStat {
  dayIndex: number;
  dayLabel: string;
  totalPages: number;
  totalMinutes: number;
  averagePagesPerDay: number;
  sessionsCount: number;
}

export interface WrappedCardData {
  year: number;
  totalBooksRead: number;
  physicalBooks: number;
  digitalBooks: number;
  totalPagesRead: number;
  totalHoursRead: number;
  averageSpeedPagesPerHour: number;
  bestStreakDays: number;
  topPublisher: string | null;
  topAuthor: string | null;
}

export interface AdvancedStatsSummary {
  year: number;
  physicalStats: ModalityStats;
  digitalStats: ModalityStats;
  weekdayDistribution: WeekdayStat[];
  peakWeekdayLabel: string;
  wrappedCard: WrappedCardData;
}

function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Calcula la velocidad lectora media (pags/hora) y ritmo diario (pags/dia en 14 dias),
 * aplicando filtrado de anomalias (outliers) y soporte de arranque en frio (Cold Start).
 */
export function calculateReaderVelocity(
  sessions: ReadingSession[],
  referenceDate?: Date
): ReaderVelocityMetrics {
  const ref = referenceDate ? new Date(referenceDate.getTime()) : new Date();

  const validSessions = sessions.filter((s) => {
    if (s.durationSeconds <= 0 || s.pagesRead <= 0) return false;
    const speed = s.pagesRead / (s.durationSeconds / 3600);
    return speed >= MIN_SPEED_PAGES_PER_HOUR && speed <= MAX_SPEED_PAGES_PER_HOUR;
  });

  const isColdStart = validSessions.length === 0;

  let pagesPerHour: number;
  if (isColdStart) {
    pagesPerHour = COLD_START_SPEED_PAGES_PER_HOUR;
  } else {
    const totalPages = validSessions.reduce((acc, s) => acc + s.pagesRead, 0);
    const totalSeconds = validSessions.reduce((acc, s) => acc + s.durationSeconds, 0);
    pagesPerHour =
      totalSeconds > 0
        ? Number((totalPages / (totalSeconds / 3600)).toFixed(1))
        : COLD_START_SPEED_PAGES_PER_HOUR;
  }

  let pagesPerDay: number;
  if (sessions.length === 0) {
    pagesPerDay = COLD_START_PACE_PAGES_PER_DAY;
  } else {
    const last14Dates = new Set<string>();
    for (let i = 0; i < 14; i++) {
      const d = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate() - i);
      last14Dates.add(formatLocalDate(d));
    }

    const pages14d = sessions
      .filter((s) => last14Dates.has(s.localDate))
      .reduce((acc, s) => acc + Math.max(0, s.pagesRead), 0);

    const avg14d = pages14d / 14;
    if (avg14d < 1) {
      pagesPerDay = 5;
    } else {
      pagesPerDay = Number(avg14d.toFixed(1));
    }
  }

  return {
    pagesPerHour,
    pagesPerDay,
    isColdStart,
    validSessionsCount: validSessions.length,
  };
}

/**
 * Predice la fecha estimada de conclusion (ETA) y horas restantes de lectura para un libro,
 * contemplando el modo de lectura (paginas o porcentaje) y ritmo lector personalizado u observado.
 */
export function calculateBookCompletionEta(
  book: Pick<
    Book,
    'id' | 'title' | 'pageCount' | 'currentPage' | 'currentPercentage' | 'progressMode'
  >,
  velocity: ReaderVelocityMetrics,
  customPagesPerDay?: number,
  referenceDate?: Date
): BookCompletionEta {
  const ref = referenceDate ? new Date(referenceDate.getTime()) : new Date();

  let remainingPages: number;
  if (book.pageCount > 0) {
    if (book.progressMode === 'PAGES') {
      remainingPages = Math.max(0, book.pageCount - (book.currentPage ?? 0));
    } else {
      const remainingPercent = Math.max(0, 100 - (book.currentPercentage ?? 0));
      remainingPages = Math.max(0, Math.round(book.pageCount * (remainingPercent / 100)));
    }
  } else {
    remainingPages = 0;
  }

  const safeSpeed = Math.max(1, velocity.pagesPerHour);
  const remainingHoursTotal = Number((remainingPages / safeSpeed).toFixed(2));
  const remainingHoursWhole = Math.floor(remainingHoursTotal);
  const remainingMinutesPart = Math.round((remainingHoursTotal - remainingHoursWhole) * 60);

  const effectivePagesPerDay = Math.max(
    1,
    customPagesPerDay !== undefined && customPagesPerDay > 0
      ? customPagesPerDay
      : velocity.pagesPerDay
  );

  const estimatedDaysRemaining =
    remainingPages > 0 ? Math.ceil(remainingPages / effectivePagesPerDay) : 0;

  const targetDate = new Date(
    ref.getFullYear(),
    ref.getMonth(),
    ref.getDate() + estimatedDaysRemaining
  );
  const estimatedCompletionDateIso = formatLocalDate(targetDate);

  return {
    remainingPages,
    remainingHoursTotal,
    remainingHoursWhole,
    remainingMinutesPart,
    effectivePagesPerDay,
    estimatedDaysRemaining,
    estimatedCompletionDateIso,
  };
}

/**
 * Evalua el ritmo de avance respecto a una meta de lectura y calcula el plan de recuperacion necesario.
 */
export function calculateGoalPacingAndCatchUp(
  params: GoalPacingInput
): GoalPacingResult {
  const {
    targetUnits,
    currentUnits,
    elapsedDaysInPeriod,
    totalDaysInPeriod,
    readerSpeedPagesPerHour = 25,
    averagePagesPerBook = 300,
    unitType = 'BOOKS',
  } = params;

  const safeTotalDays = Math.max(1, totalDaysInPeriod);
  const safeElapsedDays = Math.min(safeTotalDays, Math.max(1, elapsedDaysInPeriod));

  const expectedByToday = Number(
    ((targetUnits * safeElapsedDays) / safeTotalDays).toFixed(2)
  );

  const deltaUnits = Number((currentUnits - expectedByToday).toFixed(2));

  const rawTolerance =
    unitType === 'BOOKS'
      ? Math.max(0.3, targetUnits * 0.03)
      : Math.max(10, targetUnits * 0.03);
  const tolerance = Number(rawTolerance.toFixed(2));

  let status: 'AHEAD' | 'ON_TRACK' | 'BEHIND';
  if (deltaUnits > tolerance) {
    status = 'AHEAD';
  } else if (deltaUnits < -tolerance) {
    status = 'BEHIND';
  } else {
    status = 'ON_TRACK';
  }

  const remainingDays = Math.max(1, totalDaysInPeriod - elapsedDaysInPeriod);
  const remainingUnits = Math.max(0, targetUnits - currentUnits);

  const requiredDailyUnits = Math.ceil(remainingUnits / remainingDays);

  const safeSpeed = Math.max(1, readerSpeedPagesPerHour);
  const safePagesPerBook = Math.max(1, averagePagesPerBook);

  let requiredPagesPerDay: number;
  let requiredMinutesPerDay: number;

  if (unitType === 'BOOKS') {
    requiredPagesPerDay = Math.ceil(requiredDailyUnits * safePagesPerBook);
    requiredMinutesPerDay = Math.ceil((requiredPagesPerDay / safeSpeed) * 60);
  } else if (unitType === 'PAGES') {
    requiredPagesPerDay = requiredDailyUnits;
    requiredMinutesPerDay = Math.ceil((requiredPagesPerDay / safeSpeed) * 60);
  } else {
    requiredMinutesPerDay = requiredDailyUnits;
    requiredPagesPerDay = Math.ceil((requiredMinutesPerDay / 60) * safeSpeed);
  }

  const projectedEndTotal =
    elapsedDaysInPeriod > 0
      ? Math.round((currentUnits / elapsedDaysInPeriod) * totalDaysInPeriod)
      : targetUnits;

  return {
    expectedByToday,
    deltaUnits,
    status,
    tolerance,
    remainingDays,
    remainingUnits,
    requiredDailyUnits,
    requiredPagesPerDay,
    requiredMinutesPerDay,
    projectedEndTotal,
  };
}

/**
 * Genera el mapa de calor de 4 semanas, calcula la racha actual y mejor racha historica,
 * y aplica el mecanismo de Escudo de Racha ante pausas aisladas de un dia.
 */
export function calculateStreakAndHeatmap(
  sessions: ReadingSession[],
  referenceDate?: Date
): StreakAndHeatmapResult {
  const ref = referenceDate ? new Date(referenceDate.getTime()) : new Date();
  const refDate = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate());
  const todayIso = formatLocalDate(refDate);

  interface DayAggregation {
    pagesRead: number;
    durationSeconds: number;
    hasRetroactive: boolean;
  }
  const dayMap = new Map<string, DayAggregation>();

  for (const session of sessions) {
    const cur = dayMap.get(session.localDate) ?? {
      pagesRead: 0,
      durationSeconds: 0,
      hasRetroactive: false,
    };
    cur.pagesRead += Math.max(0, session.pagesRead);
    cur.durationSeconds += Math.max(0, session.durationSeconds);

    if (session.createdAt) {
      const createdIso = formatLocalDate(new Date(session.createdAt));
      if (session.localDate < createdIso) {
        cur.hasRetroactive = true;
      }
    }

    dayMap.set(session.localDate, cur);
  }

  const shieldedDates = new Set<string>();

  for (let i = 1; i < 14; i++) {
    const targetDate = new Date(
      refDate.getFullYear(),
      refDate.getMonth(),
      refDate.getDate() - i
    );
    const targetIso = formatLocalDate(targetDate);
    const targetPages = dayMap.get(targetIso)?.pagesRead ?? 0;

    if (targetPages === 0) {
      const prevDate = new Date(
        refDate.getFullYear(),
        refDate.getMonth(),
        refDate.getDate() - i - 1
      );
      const prevIso = formatLocalDate(prevDate);
      const prevPages = dayMap.get(prevIso)?.pagesRead ?? 0;

      const nextDate = new Date(
        refDate.getFullYear(),
        refDate.getMonth(),
        refDate.getDate() - i + 1
      );
      const nextIso = formatLocalDate(nextDate);
      const nextPages = dayMap.get(nextIso)?.pagesRead ?? 0;

      if (prevPages > 0 && nextPages > 0) {
        shieldedDates.add(targetIso);
        break;
      }
    }
  }

  const isDateActive = (iso: string): boolean => {
    return (dayMap.get(iso)?.pagesRead ?? 0) > 0 || shieldedDates.has(iso);
  };

  let currentStreakDays = 0;
  let checkOffset = 0;

  if (isDateActive(todayIso)) {
    checkOffset = 0;
  } else {
    const yesterday = new Date(
      refDate.getFullYear(),
      refDate.getMonth(),
      refDate.getDate() - 1
    );
    const yesterdayIso = formatLocalDate(yesterday);
    if (isDateActive(yesterdayIso)) {
      checkOffset = 1;
    } else {
      checkOffset = -1;
    }
  }

  if (checkOffset >= 0) {
    let offset = checkOffset;
    while (true) {
      const d = new Date(
        refDate.getFullYear(),
        refDate.getMonth(),
        refDate.getDate() - offset
      );
      const iso = formatLocalDate(d);
      if (isDateActive(iso)) {
        currentStreakDays++;
        offset++;
      } else {
        break;
      }
    }
  }

  const allActiveDates = Array.from(dayMap.keys()).filter(
    (d) => (dayMap.get(d)?.pagesRead ?? 0) > 0
  );
  for (const s of shieldedDates) {
    allActiveDates.push(s);
  }

  let bestStreakDays = currentStreakDays;
  if (allActiveDates.length > 0) {
    allActiveDates.sort();
    const [minY, minM, minD] = allActiveDates[0].split('-').map(Number);
    const cursor = new Date(minY, minM - 1, minD);
    let runningStreak = 0;
    while (cursor <= refDate) {
      const iso = formatLocalDate(cursor);
      if (isDateActive(iso)) {
        runningStreak++;
        if (runningStreak > bestStreakDays) {
          bestStreakDays = runningStreak;
        }
      } else {
        runningStreak = 0;
      }
      cursor.setDate(cursor.getDate() + 1);
    }
  }

  const dayOfWeek = (refDate.getDay() + 6) % 7;
  const currentWeekMonday = new Date(
    refDate.getFullYear(),
    refDate.getMonth(),
    refDate.getDate() - dayOfWeek
  );
  const currentWeekSunday = new Date(
    currentWeekMonday.getFullYear(),
    currentWeekMonday.getMonth(),
    currentWeekMonday.getDate() + 6
  );
  const currentWeekMondayIso = formatLocalDate(currentWeekMonday);
  const currentWeekSundayIso = formatLocalDate(currentWeekSunday);

  let readDaysLast7 = 0;
  let totalPagesLast7 = 0;
  for (let i = 0; i < 7; i++) {
    const d = new Date(
      refDate.getFullYear(),
      refDate.getMonth(),
      refDate.getDate() - i
    );
    const iso = formatLocalDate(d);
    const pages = dayMap.get(iso)?.pagesRead ?? 0;
    if (pages > 0) {
      readDaysLast7++;
      totalPagesLast7 += pages;
    }
  }

  const qualifiedForShield = readDaysLast7 >= 5 || totalPagesLast7 >= 150;
  const hasUsedShieldThisWeek = Array.from(shieldedDates).some(
    (iso) => iso >= currentWeekMondayIso && iso <= currentWeekSundayIso
  );
  const availableShields = qualifiedForShield && !hasUsedShieldThisWeek ? 1 : 0;

  let weeklyDaysCompleted = 0;
  for (let i = 0; i < 7; i++) {
    const d = new Date(
      currentWeekMonday.getFullYear(),
      currentWeekMonday.getMonth(),
      currentWeekMonday.getDate() + i
    );
    const iso = formatLocalDate(d);
    if (d <= refDate && isDateActive(iso)) {
      weeklyDaysCompleted++;
    }
  }

  const DAY_LABELS = ['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom'];
  const MONTH_NAMES = [
    'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
    'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'
  ];

  const weeks: HeatmapWeekRow[] = [];
  for (let w = 0; w < 4; w++) {
    const weekMonday = new Date(
      currentWeekMonday.getFullYear(),
      currentWeekMonday.getMonth(),
      currentWeekMonday.getDate() - (3 - w) * 7
    );
    const weekSunday = new Date(
      weekMonday.getFullYear(),
      weekMonday.getMonth(),
      weekMonday.getDate() + 6
    );

    const monDay = weekMonday.getDate();
    const sunDay = weekSunday.getDate();
    const monMonth = MONTH_NAMES[weekMonday.getMonth()];
    const sunMonth = MONTH_NAMES[weekSunday.getMonth()];

    const weekLabel =
      monMonth === sunMonth
        ? `${monDay}–${sunDay} ${sunMonth}`
        : `${monDay} ${monMonth}–${sunDay} ${sunMonth}`;

    const days: HeatmapDayCell[] = [];
    for (let d = 0; d < 7; d++) {
      const cellDate = new Date(
        weekMonday.getFullYear(),
        weekMonday.getMonth(),
        weekMonday.getDate() + d
      );
      const dateIso = formatLocalDate(cellDate);
      const daySummary = dayMap.get(dateIso);
      const pagesRead = daySummary?.pagesRead ?? 0;
      const durationSeconds = daySummary?.durationSeconds ?? 0;
      const minutesRead = Math.round(durationSeconds / 60);

      let level: 0 | 1 | 2 | 3;
      if (pagesRead <= 0) {
        level = 0;
      } else if (pagesRead < 20) {
        level = 1;
      } else if (pagesRead < 50) {
        level = 2;
      } else {
        level = 3;
      }

      const isToday = dateIso === todayIso;
      const isFuture = dateIso > todayIso;
      const isShieldUsed = shieldedDates.has(dateIso);
      const isRetroactiveYesterday = daySummary?.hasRetroactive ?? false;

      days.push({
        dateIso,
        dayLabel: DAY_LABELS[d],
        shortDateLabel: String(cellDate.getDate()),
        pagesRead,
        minutesRead,
        level,
        isShieldUsed,
        isRetroactiveYesterday,
        isToday,
        isFuture,
      });
    }

    weeks.push({
      weekLabel,
      days,
    });
  }

  return {
    currentStreakDays,
    bestStreakDays,
    weeklyDaysCompleted,
    availableShields,
    weeks,
  };
}

/**
 * Construye el resumen de estadisticas avanzadas (fisico vs digital, distribucion por dia de la semana)
 * y la tarjeta anual para exportacion (Wrapped).
 */
export function buildAdvancedStatsAndWrapped(
  params: BuildAdvancedStatsParams
): AdvancedStatsSummary {
  const { books, logs, sessions, year, referenceDate } = params;
  const bookMap = new Map<string, Book>(books.map((b) => [b.id, b]));

  const completedBookIdsInYear = new Set<string>();

  for (const log of logs) {
    if (log.finishedAt !== null && log.bookId) {
      const finishedYear = new Date(log.finishedAt).getFullYear();
      if (finishedYear === year) {
        completedBookIdsInYear.add(log.bookId);
      }
    }
  }

  for (const book of books) {
    if (book.currentStatus === 'LEIDO') {
      if (completedBookIdsInYear.has(book.id)) {
        continue;
      }
      const updatedYear = new Date(book.updatedAt).getFullYear();
      const hasLogOtherYear = logs.some(
        (l) =>
          l.bookId === book.id &&
          l.finishedAt !== null &&
          new Date(l.finishedAt).getFullYear() !== year
      );
      if (!hasLogOtherYear && (updatedYear === year || logs.length === 0)) {
        completedBookIdsInYear.add(book.id);
      }
    }
  }

  let physicalReadCount = 0;
  let digitalReadCount = 0;

  for (const bookId of completedBookIdsInYear) {
    const book = bookMap.get(bookId);
    if (book?.modality === 'DIGITAL') {
      digitalReadCount++;
    } else {
      physicalReadCount++;
    }
  }

  const yearPrefix = `${year}-`;
  const sessionsInYear = sessions.filter((s) => {
    if (s.localDate && s.localDate.startsWith(yearPrefix)) return true;
    if (s.startedAtEpochMs) {
      return new Date(s.startedAtEpochMs).getFullYear() === year;
    }
    return false;
  });

  let physicalPages = 0;
  let physicalSeconds = 0;
  let digitalPages = 0;
  let digitalSeconds = 0;

  for (const s of sessionsInYear) {
    const book = bookMap.get(s.bookId);
    const isDigital = book?.modality === 'DIGITAL';
    const pages = Math.max(0, s.pagesRead);
    const seconds = Math.max(0, s.durationSeconds);

    if (isDigital) {
      digitalPages += pages;
      digitalSeconds += seconds;
    } else {
      physicalPages += pages;
      physicalSeconds += seconds;
    }
  }

  const totalBooksRead = physicalReadCount + digitalReadCount;
  const physicalPercentage =
    totalBooksRead > 0
      ? Number(((physicalReadCount / totalBooksRead) * 100).toFixed(1))
      : 0;
  const digitalPercentage =
    totalBooksRead > 0
      ? Number(((digitalReadCount / totalBooksRead) * 100).toFixed(1))
      : 0;

  const physicalHours = physicalSeconds / 3600;
  const physicalSpeed =
    physicalHours > 0 ? Number((physicalPages / physicalHours).toFixed(1)) : 0;

  const digitalHours = digitalSeconds / 3600;
  const digitalSpeed =
    digitalHours > 0 ? Number((digitalPages / digitalHours).toFixed(1)) : 0;

  const physicalStats: ModalityStats = {
    readCount: physicalReadCount,
    totalPages: physicalPages,
    averageSpeedPagesPerHour: physicalSpeed,
    percentageOfTotal: physicalPercentage,
  };

  const digitalStats: ModalityStats = {
    readCount: digitalReadCount,
    totalPages: digitalPages,
    averageSpeedPagesPerHour: digitalSpeed,
    percentageOfTotal: digitalPercentage,
  };

  const WEEKDAY_LABELS = ['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom'];
  interface WeekdayAccumulator {
    totalPages: number;
    totalSeconds: number;
    sessionsCount: number;
    dates: Set<string>;
  }

  const weekdayMap: WeekdayAccumulator[] = Array.from({ length: 7 }, () => ({
    totalPages: 0,
    totalSeconds: 0,
    sessionsCount: 0,
    dates: new Set<string>(),
  }));

  for (const s of sessionsInYear) {
    const [sy, sm, sd] = s.localDate.split('-').map(Number);
    const d = new Date(sy, sm - 1, sd);
    const dayIndex = (d.getDay() + 6) % 7;

    weekdayMap[dayIndex].totalPages += Math.max(0, s.pagesRead);
    weekdayMap[dayIndex].totalSeconds += Math.max(0, s.durationSeconds);
    weekdayMap[dayIndex].sessionsCount += 1;
    weekdayMap[dayIndex].dates.add(s.localDate);
  }

  let peakWeekdayIndex = 0;
  let maxWeekdayPages = -1;

  const weekdayDistribution: WeekdayStat[] = weekdayMap.map((accum, idx) => {
    if (accum.totalPages > maxWeekdayPages) {
      maxWeekdayPages = accum.totalPages;
      peakWeekdayIndex = idx;
    }
    const avgPages =
      accum.dates.size > 0
        ? Number((accum.totalPages / accum.dates.size).toFixed(1))
        : 0;

    return {
      dayIndex: idx,
      dayLabel: WEEKDAY_LABELS[idx],
      totalPages: accum.totalPages,
      totalMinutes: Math.round(accum.totalSeconds / 60),
      averagePagesPerDay: avgPages,
      sessionsCount: accum.sessionsCount,
    };
  });

  const peakWeekdayLabel = WEEKDAY_LABELS[peakWeekdayIndex];

  const totalPagesRead = physicalPages + digitalPages;
  const totalSecondsRead = physicalSeconds + digitalSeconds;
  const totalHoursRead = Number((totalSecondsRead / 3600).toFixed(1));
  const averageSpeedPagesPerHour =
    totalHoursRead > 0
      ? Number((totalPagesRead / totalHoursRead).toFixed(1))
      : totalBooksRead > 0
      ? 25
      : 0;

  const streakResult = calculateStreakAndHeatmap(sessions, referenceDate);
  const bestStreakDays = streakResult.bestStreakDays;

  const publisherCount = new Map<string, number>();
  const authorCount = new Map<string, number>();

  for (const bookId of completedBookIdsInYear) {
    const book = bookMap.get(bookId);
    if (!book) continue;

    if (book.publisher && book.publisher.trim().length > 0) {
      const pub = book.publisher.trim();
      publisherCount.set(pub, (publisherCount.get(pub) ?? 0) + 1);
    }

    if (book.authorsJson) {
      try {
        const authors = JSON.parse(book.authorsJson);
        if (Array.isArray(authors)) {
          for (const author of authors) {
            if (typeof author === 'string' && author.trim().length > 0) {
              const auth = author.trim();
              authorCount.set(auth, (authorCount.get(auth) ?? 0) + 1);
            }
          }
        }
      } catch {
        // Ignora JSON invalido
      }
    }
  }

  if (publisherCount.size === 0) {
    for (const s of sessionsInYear) {
      const book = bookMap.get(s.bookId);
      if (book?.publisher && book.publisher.trim().length > 0) {
        const pub = book.publisher.trim();
        publisherCount.set(pub, (publisherCount.get(pub) ?? 0) + s.pagesRead);
      }
    }
  }

  if (authorCount.size === 0) {
    for (const s of sessionsInYear) {
      const book = bookMap.get(s.bookId);
      if (book?.authorsJson) {
        try {
          const authors = JSON.parse(book.authorsJson);
          if (Array.isArray(authors)) {
            for (const author of authors) {
              if (typeof author === 'string' && author.trim().length > 0) {
                const auth = author.trim();
                authorCount.set(auth, (authorCount.get(auth) ?? 0) + s.pagesRead);
              }
            }
          }
        } catch {
          // Ignora JSON invalido
        }
      }
    }
  }

  let topPublisher: string | null = null;
  let maxPubCount = 0;
  for (const [pub, count] of publisherCount.entries()) {
    if (count > maxPubCount) {
      maxPubCount = count;
      topPublisher = pub;
    }
  }

  let topAuthor: string | null = null;
  let maxAuthCount = 0;
  for (const [author, count] of authorCount.entries()) {
    if (count > maxAuthCount) {
      maxAuthCount = count;
      topAuthor = author;
    }
  }

  const wrappedCard: WrappedCardData = {
    year,
    totalBooksRead,
    physicalBooks: physicalReadCount,
    digitalBooks: digitalReadCount,
    totalPagesRead,
    totalHoursRead,
    averageSpeedPagesPerHour,
    bestStreakDays,
    topPublisher,
    topAuthor,
  };

  return {
    year,
    physicalStats,
    digitalStats,
    weekdayDistribution,
    peakWeekdayLabel,
    wrappedCard,
  };
}
