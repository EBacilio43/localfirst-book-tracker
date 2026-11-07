import { create } from 'zustand';

export const MIN_VALID_SPEED_PAGES_PER_HOUR = 3;
export const MAX_VALID_SPEED_PAGES_PER_HOUR = 180;
export const OUTLIER_MIN_DURATION_SECONDS = 300;

export interface OutlierEvaluationResult {
  isOutlier: boolean;
  reason: 'TOO_SLOW' | 'TOO_FAST' | null;
  speedPagesPerHour: number;
  suggestedAdjustedSeconds: number;
  suggestedAdjustedMinutes: number;
}

/**
 * Calcula los segundos transcurridos totales sumando los acumulados y el intervalo actual en curso.
 */
export function calculateElapsedSeconds(
  startedAtEpochMs: number | null,
  accumulatedSeconds: number,
  isRunning: boolean,
  nowEpochMs?: number
): number {
  if (!isRunning || startedAtEpochMs === null) {
    return Math.max(0, Math.floor(accumulatedSeconds));
  }

  const now = nowEpochMs ?? Date.now();
  const delta = Math.max(0, (now - startedAtEpochMs) / 1000);
  return Math.max(0, Math.floor(accumulatedSeconds + delta));
}

/**
 * Evalua si una sesion cronometrada califica como anomalia (outlier) por ser excesivamente lenta
 * (olvido de cronometro) o excesivamente rapida (paso rapido de paginas).
 */
export function evaluateSessionOutlier(
  pagesRead: number,
  durationSeconds: number,
  averageSpeedPagesPerHour = 25
): OutlierEvaluationResult {
  const speedPagesPerHour =
    durationSeconds > 0
      ? Number((pagesRead / (durationSeconds / 3600)).toFixed(1))
      : 0;

  const safeAvgSpeed = Math.max(1, averageSpeedPagesPerHour);
  const suggestedAdjustedSeconds =
    pagesRead > 0
      ? Math.max(60, Math.round((pagesRead / safeAvgSpeed) * 3600))
      : 60;

  const suggestedAdjustedMinutes = Math.max(
    1,
    Math.round(suggestedAdjustedSeconds / 60)
  );

  if (
    durationSeconds >= OUTLIER_MIN_DURATION_SECONDS &&
    speedPagesPerHour < MIN_VALID_SPEED_PAGES_PER_HOUR
  ) {
    return {
      isOutlier: true,
      reason: 'TOO_SLOW',
      speedPagesPerHour,
      suggestedAdjustedSeconds,
      suggestedAdjustedMinutes,
    };
  }

  if (
    durationSeconds >= 60 &&
    speedPagesPerHour > MAX_VALID_SPEED_PAGES_PER_HOUR
  ) {
    return {
      isOutlier: true,
      reason: 'TOO_FAST',
      speedPagesPerHour,
      suggestedAdjustedSeconds,
      suggestedAdjustedMinutes,
    };
  }

  return {
    isOutlier: false,
    reason: null,
    speedPagesPerHour,
    suggestedAdjustedSeconds,
    suggestedAdjustedMinutes,
  };
}

export interface ReadingTimerState {
  activeBookId: string | null;
  startPage: number;
  startedAtEpochMs: number | null;
  accumulatedSeconds: number;
  isRunning: boolean;
  isPaused: boolean;

  startTimer: (bookId: string, startPage: number, nowEpochMs?: number) => void;
  pauseTimer: (nowEpochMs?: number) => void;
  resumeTimer: (nowEpochMs?: number) => void;
  resetTimer: () => void;
  addSimulatedSeconds: (extraSeconds: number) => void;
  getElapsedSeconds: (nowEpochMs?: number) => number;
}

export const useReadingTimerStore = create<ReadingTimerState>((set, get) => ({
  activeBookId: null,
  startPage: 0,
  startedAtEpochMs: null,
  accumulatedSeconds: 0,
  isRunning: false,
  isPaused: false,

  startTimer: (bookId: string, startPage: number, nowEpochMs?: number) => {
    const now = nowEpochMs ?? Date.now();
    set({
      activeBookId: bookId,
      startPage,
      startedAtEpochMs: now,
      accumulatedSeconds: 0,
      isRunning: true,
      isPaused: false,
    });
  },

  pauseTimer: (nowEpochMs?: number) => {
    const state = get();
    if (!state.isRunning || state.startedAtEpochMs === null) {
      return;
    }
    const now = nowEpochMs ?? Date.now();
    const delta = Math.max(0, (now - state.startedAtEpochMs) / 1000);
    set({
      accumulatedSeconds: state.accumulatedSeconds + delta,
      startedAtEpochMs: null,
      isRunning: false,
      isPaused: true,
    });
  },

  resumeTimer: (nowEpochMs?: number) => {
    const state = get();
    if (!state.isPaused) {
      return;
    }
    const now = nowEpochMs ?? Date.now();
    set({
      startedAtEpochMs: now,
      isRunning: true,
      isPaused: false,
    });
  },

  resetTimer: () => {
    set({
      activeBookId: null,
      startPage: 0,
      startedAtEpochMs: null,
      accumulatedSeconds: 0,
      isRunning: false,
      isPaused: false,
    });
  },

  addSimulatedSeconds: (extraSeconds: number) => {
    set((state) => ({
      accumulatedSeconds: Math.max(0, state.accumulatedSeconds + extraSeconds),
    }));
  },

  getElapsedSeconds: (nowEpochMs?: number) => {
    const state = get();
    return calculateElapsedSeconds(
      state.startedAtEpochMs,
      state.accumulatedSeconds,
      state.isRunning,
      nowEpochMs
    );
  },
}));
