import { create } from 'zustand';
import { NormalizedBookCandidate } from '../../catalog/types';
import { CatalogResolver } from '../../catalog/services/catalogResolver';
import { BooksRepository } from '../../../db/repositories/booksRepository';
import { parseAndValidateIsbn } from '../../catalog/utils/isbn';

export type QueueItemStatus = 'RESOLVING' | 'RESOLVED' | 'DUPLICATE' | 'OFFLINE_PENDING' | 'ERROR';

export interface ScannedQueueItem {
  id: string;
  rawIsbn: string;
  isbn13: string;
  timestamp: number;
  status: QueueItemStatus;
  candidate?: NormalizedBookCandidate | null;
  errorMessage?: string;
  isDuplicateInLibrary?: boolean;
}

interface ScannerState {
  isBurstMode: boolean;
  isTorchOn: boolean;
  queue: ScannedQueueItem[];
  recentCooldownMap: Record<string, number>;
  activeResolvedCandidate: NormalizedBookCandidate | null;
  isDuplicateActive: boolean;

  setBurstMode: (enabled: boolean) => void;
  toggleTorch: () => void;
  processScannedBarcode: (rawBarcode: string) => Promise<{ status: QueueItemStatus; message?: string }>;
  removeFromQueue: (id: string) => void;
  clearQueue: () => void;
  clearActiveCandidate: () => void;
}

const COOLDOWN_MS = 3000;

export const useScannerStore = create<ScannerState>((set, get) => ({
  isBurstMode: false,
  isTorchOn: false,
  queue: [],
  recentCooldownMap: {},
  activeResolvedCandidate: null,
  isDuplicateActive: false,

  setBurstMode: (enabled: boolean) => set({ isBurstMode: enabled }),

  toggleTorch: () => set((state) => ({ isTorchOn: !state.isTorchOn })),

  clearActiveCandidate: () => set({ activeResolvedCandidate: null, isDuplicateActive: false }),

  removeFromQueue: (id: string) =>
    set((state) => ({
      queue: state.queue.filter((item) => item.id !== id),
    })),

  clearQueue: () => set({ queue: [] }),

  processScannedBarcode: async (rawBarcode: string) => {
    const now = Date.now();
    const { recentCooldownMap, isBurstMode, queue } = get();

    // 1. Validación sintáctica de ISBN
    const validation = parseAndValidateIsbn(rawBarcode);
    if (validation.isStoreCode) {
      return { status: 'ERROR', message: 'Código interno de tienda ignorado' };
    }
    if (!validation.isValid || !validation.isbn13) {
      return { status: 'ERROR', message: 'Código de barras no es un ISBN válido' };
    }

    const isbn13 = validation.isbn13;

    // 2. Cooldown de 3,000ms por ISBN para evitar lecturas duplicadas en bucle a 60fps
    const lastScanned = recentCooldownMap[isbn13] || 0;
    if (now - lastScanned < COOLDOWN_MS) {
      return { status: 'ERROR', message: 'ISBN en periodo de enfriamiento' };
    }

    // Actualiza mapa de enfriamiento
    set((state) => ({
      recentCooldownMap: {
        ...state.recentCooldownMap,
        [isbn13]: now,
      },
    }));

    // 3. Comprobar si ya existe en la biblioteca local SQLite
    const existingInDb = await BooksRepository.getByIsbn(isbn13);
    const isDuplicate = !!existingInDb;

    const itemId = `${isbn13}-${now}`;

    if (!isBurstMode) {
      // Modo individual: resolver y abrir Bottom Sheet de confirmación
      set({ isDuplicateActive: isDuplicate });

      const lookup = await CatalogResolver.resolveByIsbn(isbn13);
      if (lookup.success && lookup.book) {
        set({ activeResolvedCandidate: lookup.book });
        return { status: isDuplicate ? 'DUPLICATE' : 'RESOLVED' };
      } else {
        // Fallback offline o no encontrado
        set({
          activeResolvedCandidate: {
            isbn13,
            title: 'Libro sin conexión',
            authors: ['Pendiente de sincronizar'],
            pageCount: 0,
            language: 'es',
            source: 'GOOGLE_BOOKS',
          },
        });
        return { status: 'OFFLINE_PENDING' };
      }
    } else {
      // Modo ráfaga: añadir a la bandeja de cola
      const initialItem: ScannedQueueItem = {
        id: itemId,
        rawIsbn: rawBarcode,
        isbn13,
        timestamp: now,
        status: 'RESOLVING',
        isDuplicateInLibrary: isDuplicate,
      };

      set({ queue: [initialItem, ...queue] });

      // Resolver metadatos en segundo plano sin interrumpir la cámara
      const lookup = await CatalogResolver.resolveByIsbn(isbn13);

      set((state) => ({
        queue: state.queue.map((item) => {
          if (item.id !== itemId) return item;
          if (lookup.success && lookup.book) {
            return {
              ...item,
              status: isDuplicate ? 'DUPLICATE' : 'RESOLVED',
              candidate: lookup.book,
            };
          }
          return {
            ...item,
            status: 'OFFLINE_PENDING',
            candidate: {
              isbn13,
              title: 'Libro escaneado',
              authors: ['Pendiente de red'],
              pageCount: 0,
              language: 'es',
              source: 'GOOGLE_BOOKS',
            },
          };
        }),
      }));

      return { status: isDuplicate ? 'DUPLICATE' : 'RESOLVED' };
    }
  },
}));
