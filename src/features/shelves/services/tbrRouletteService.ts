import { Book } from '../../../db/schema/books';
import { ReadingLog } from '../../../db/schema/readingLogs';

export interface TbrCandidateFilters {
  modality?: 'ALL' | 'PHYSICAL' | 'DIGITAL';
  maxPages?: number;
  minPages?: number;
  shelfId?: string;
  includeSagas?: boolean;
}

export interface BlockedSequel {
  book: Book;
  reason: string;
  missingOrUnreadIndex: number;
}

export interface EvaluateTbrResult {
  eligible: Book[];
  blockedSequels: BlockedSequel[];
}

export interface SagaGapReport {
  seriesName: string;
  missingIndices: number[];
  ownedIndices: number[];
  wishlistMatches: Book[];
}

/**
 * Evalua libros candidatos para la Ruleta TBR aplicando filtros y el escudo de integridad de sagas.
 * Descarta libros no aptos (leidos, lista de deseos, fuera de filtros o secuelas con tomos previos sin leer).
 */
export function evaluateTbrCandidates(
  allBooks: Book[],
  completedLogs: ReadingLog[],
  filters?: TbrCandidateFilters
): EvaluateTbrResult {
  const readBookIds = new Set<string>();

  for (const b of allBooks) {
    if (b.currentStatus === 'LEIDO') {
      readBookIds.add(b.id);
    }
  }

  for (const log of completedLogs) {
    if (log.finishedAt !== null && log.bookId) {
      readBookIds.add(log.bookId);
    }
  }

  const isBookRead = (b: Book): boolean => readBookIds.has(b.id);

  const baseCandidates = allBooks.filter((book) => {
    if (book.currentStatus !== 'POR_LEER' || book.ownership === 'WISHLIST') {
      return false;
    }

    if (filters?.modality && filters.modality !== 'ALL') {
      if (book.modality !== filters.modality) {
        return false;
      }
    }

    if (filters?.shelfId && book.shelfId !== filters.shelfId) {
      return false;
    }

    if (filters?.minPages !== undefined && book.pageCount < filters.minPages) {
      return false;
    }

    if (filters?.maxPages !== undefined && book.pageCount > filters.maxPages) {
      return false;
    }

    if (filters?.includeSagas === false && book.seriesName && book.seriesName.trim() !== '') {
      return false;
    }

    return true;
  });

  const eligible: Book[] = [];
  const blockedSequels: BlockedSequel[] = [];

  for (const candidate of baseCandidates) {
    const hasSaga = !!candidate.seriesName && candidate.seriesName.trim() !== '';
    const isSequel = candidate.seriesIndex !== null && candidate.seriesIndex > 1;

    if (!hasSaga || !isSequel) {
      eligible.push(candidate);
      continue;
    }

    const seriesKey = candidate.seriesName!.trim().toLowerCase();
    const candidateIndex = candidate.seriesIndex!;

    const sagaBooksInLibrary = allBooks.filter(
      (b) =>
        b.seriesName &&
        b.seriesName.trim().toLowerCase() === seriesKey &&
        b.ownership !== 'WISHLIST'
    );

    // Condicion A: Verificar si existe algun tomo previo registrado en la biblioteca que aun no este leido
    const unreadRegisteredPrior = sagaBooksInLibrary
      .filter((b) => b.seriesIndex !== null && b.seriesIndex < candidateIndex && !isBookRead(b))
      .sort((a, b) => (a.seriesIndex ?? 0) - (b.seriesIndex ?? 0));

    if (unreadRegisteredPrior.length > 0) {
      const blocker = unreadRegisteredPrior[0];
      blockedSequels.push({
        book: candidate,
        reason: `El tomo previo #${blocker.seriesIndex} (${blocker.title}) no ha sido leido aun`,
        missingOrUnreadIndex: blocker.seriesIndex ?? 1,
      });
      continue;
    }

    // Condicion B: Si el candidato tiene seriesIndex > 1, verificar que el tomo #1 este leido en la biblioteca
    const hasReadTomeOne = sagaBooksInLibrary.some(
      (b) => b.seriesIndex === 1 && isBookRead(b)
    );

    if (!hasReadTomeOne) {
      blockedSequels.push({
        book: candidate,
        reason: `El tomo inicial #1 de la saga no ha sido leido o no se encuentra en la biblioteca`,
        missingOrUnreadIndex: 1,
      });
      continue;
    }

    // Verificar tomos enteros intermedios hasta el anterior inmediato
    const previousIntegerLimit =
      candidateIndex === Math.floor(candidateIndex)
        ? candidateIndex - 1
        : Math.floor(candidateIndex);

    let foundMissingIntermediate = false;

    for (let k = 2; k <= previousIntegerLimit; k++) {
      const hasReadTomeK = sagaBooksInLibrary.some(
        (b) => b.seriesIndex === k && isBookRead(b)
      );

      if (!hasReadTomeK) {
        blockedSequels.push({
          book: candidate,
          reason: `El tomo #${k} de la saga no ha sido leido o no se encuentra en la biblioteca`,
          missingOrUnreadIndex: k,
        });
        foundMissingIntermediate = true;
        break;
      }
    }

    if (!foundMissingIntermediate) {
      eligible.push(candidate);
    }
  }

  return {
    eligible,
    blockedSequels,
  };
}

/**
 * Selecciona aleatoriamente un libro entre la lista de candidatos elegibles para la Ruleta TBR.
 */
export function spinTbrRoulette(
  eligibleBooks: Book[],
  randomFn?: () => number
): Book | null {
  if (!eligibleBooks || eligibleBooks.length === 0) {
    return null;
  }

  const random = randomFn ?? Math.random;
  const index = Math.floor(random() * eligibleBooks.length);
  return eligibleBooks[index] ?? null;
}

/**
 * Detecta huecos o tomos faltantes en las sagas registradas en la biblioteca,
 * cotejando con los ejemplares guardados en la lista de deseos.
 */
export function detectSagaGaps(allBooks: Book[]): SagaGapReport[] {
  const sagaMap = new Map<string, { originalName: string; books: Book[] }>();

  for (const book of allBooks) {
    if (!book.seriesName || book.seriesName.trim() === '') {
      continue;
    }

    const key = book.seriesName.trim().toLowerCase();
    const entry = sagaMap.get(key) || { originalName: book.seriesName.trim(), books: [] };
    entry.books.push(book);
    sagaMap.set(key, entry);
  }

  const reports: SagaGapReport[] = [];

  for (const entry of sagaMap.values()) {
    const ownedBooks = entry.books.filter((b) => b.ownership !== 'WISHLIST');
    const wishlistBooks = entry.books.filter((b) => b.ownership === 'WISHLIST');

    const ownedIndicesSet = new Set<number>();
    for (const b of ownedBooks) {
      if (b.seriesIndex !== null && b.seriesIndex > 0) {
        ownedIndicesSet.add(b.seriesIndex);
      }
    }

    if (ownedIndicesSet.size === 0) {
      continue;
    }

    const ownedIndices = Array.from(ownedIndicesSet).sort((a, b) => a - b);
    const maxIndex = Math.max(...ownedIndices);
    const missingIndices: number[] = [];

    for (let i = 1; i < maxIndex; i++) {
      if (!ownedIndicesSet.has(i)) {
        missingIndices.push(i);
      }
    }

    if (missingIndices.length > 0) {
      const missingSet = new Set(missingIndices);
      const wishlistMatches = wishlistBooks.filter(
        (b) => b.seriesIndex !== null && missingSet.has(b.seriesIndex)
      );

      reports.push({
        seriesName: entry.originalName,
        missingIndices,
        ownedIndices,
        wishlistMatches,
      });
    }
  }

  return reports;
}

export class TbrRouletteService {
  static evaluateTbrCandidates = evaluateTbrCandidates;
  static spinTbrRoulette = spinTbrRoulette;
  static detectSagaGaps = detectSagaGaps;
}
