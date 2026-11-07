import { create } from 'zustand';

export type ProgressDisplayMode = 'PAGES' | 'CHAPTERS';

export interface ReaderPreferencesState {
  progressDisplayMode: ProgressDisplayMode;
  hasCompletedInitialSetup: boolean;
  setProgressDisplayMode: (mode: ProgressDisplayMode) => void;
  completeInitialSetup: (mode: ProgressDisplayMode) => void;
}

export const useReaderPreferencesStore = create<ReaderPreferencesState>((set) => ({
  progressDisplayMode: 'PAGES',
  hasCompletedInitialSetup: false,

  setProgressDisplayMode: (mode: ProgressDisplayMode) =>
    set({ progressDisplayMode: mode }),

  completeInitialSetup: (mode: ProgressDisplayMode) =>
    set({
      progressDisplayMode: mode,
      hasCompletedInitialSetup: true,
    }),
}));

/**
 * Calcula el porcentaje de avance automatico tanto para paginas como para capitulos.
 * Si totalUnits <= 0 o currentUnit <= 0, devuelve 0.
 * Si currentUnit >= totalUnits, devuelve 100.
 * En otro caso devuelve el porcentaje redondeado a 1 decimal.
 */
export function calculateAutomaticPercentage(currentUnit: number, totalUnits: number): number {
  if (
    typeof currentUnit !== 'number' ||
    typeof totalUnits !== 'number' ||
    Number.isNaN(currentUnit) ||
    Number.isNaN(totalUnits) ||
    totalUnits <= 0 ||
    currentUnit <= 0
  ) {
    return 0;
  }

  if (currentUnit >= totalUnits) {
    return 100;
  }

  const rawPercentage = (currentUnit / totalUnits) * 100;
  return Number(rawPercentage.toFixed(1));
}

/**
 * Devuelve la fecha YYYY-MM-DD en la zona horaria local del dispositivo.
 * Si when es YESTERDAY, resta un dia calendario local a referenceDate o new Date().
 */
export function resolveReadingLocalDate(
  when: 'TODAY' | 'YESTERDAY',
  referenceDate?: Date
): string {
  const base = referenceDate ? new Date(referenceDate.getTime()) : new Date();

  if (when === 'YESTERDAY') {
    base.setDate(base.getDate() - 1);
  }

  const year = base.getFullYear();
  const month = String(base.getMonth() + 1).padStart(2, '0');
  const day = String(base.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

/**
 * Valida que una calificacion sea valida segun el sistema de medias estrellas:
 * debe estar entre 0.5 y 5.0 inclusive, con incrementos exactos de 0.5.
 */
export function isValidHalfStarRating(rating: number): boolean {
  if (
    typeof rating !== 'number' ||
    Number.isNaN(rating) ||
    !Number.isFinite(rating)
  ) {
    return false;
  }

  if (rating < 0.5 || rating > 5.0) {
    return false;
  }

  return (rating * 2) % 1 === 0;
}
