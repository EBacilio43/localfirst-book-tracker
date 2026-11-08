import React from 'react';
import { render, cleanup } from '@testing-library/react-native';
import { BookScanBottomCardSkeleton } from '../../src/shared/components/Skeleton';
import { useScannerStore } from '../../src/features/scanner/store/scannerStore';
import { CatalogResolver } from '../../src/features/catalog/services/catalogResolver';
import { BooksRepository } from '../../src/db/repositories/booksRepository';

jest.mock('../../src/db/repositories/booksRepository', () => ({
  BooksRepository: {
    getByIsbn: jest.fn(),
  },
}));

jest.mock('../../src/features/catalog/services/catalogResolver', () => ({
  CatalogResolver: {
    resolveByIsbn: jest.fn(),
  },
}));

jest.mock('expo-haptics', () => ({
  notificationAsync: jest.fn().mockResolvedValue(undefined),
  NotificationFeedbackType: {
    Success: 'success',
  },
}));

describe('BookScanBottomCardSkeleton y Estado de Resolución del Escáner', () => {
  afterEach(() => {
    cleanup();
    jest.clearAllMocks();
  });

  it('se renderiza correctamente con testID book-scan-bottom-skeleton', () => {
    const { getByTestId } = render(<BookScanBottomCardSkeleton isbn="9788445000663" />);
    expect(getByTestId('book-scan-bottom-skeleton')).toBeTruthy();
  });

  it('activa isResolvingCandidate y resolvingIsbn inmediatamente al escanear un ISBN valido', async () => {
    const isbn = '9788445000663';
    (BooksRepository.getByIsbn as jest.Mock).mockResolvedValue(null);
    (CatalogResolver.resolveByIsbn as jest.Mock).mockImplementation(async () => {
      // Validar que durante la ejecucion de la resolucion el estado isResolvingCandidate este activo
      const state = useScannerStore.getState();
      expect(state.isResolvingCandidate).toBe(true);
      expect(state.resolvingIsbn).toBe(isbn);
      return {
        success: true,
        book: {
          isbn13: isbn,
          title: 'El Señor de los Anillos',
          authors: ['J.R.R. Tolkien'],
          pageCount: 1200,
          language: 'es',
          source: 'GOOGLE_BOOKS',
        },
      };
    });

    const store = useScannerStore.getState();
    const resultPromise = store.processScannedBarcode(isbn);

    // Estado inmediatamente despues de llamar
    expect(useScannerStore.getState().isResolvingCandidate).toBe(true);
    expect(useScannerStore.getState().resolvingIsbn).toBe(isbn);

    const result = await resultPromise;
    expect(result.status).toBe('RESOLVED');

    // Estado una vez concluido
    const finalState = useScannerStore.getState();
    expect(finalState.isResolvingCandidate).toBe(false);
    expect(finalState.resolvingIsbn).toBeNull();
    expect(finalState.activeResolvedCandidate?.title).toBe('El Señor de los Anillos');
  });

  it('limpia el estado de busqueda cuando se invoca clearActiveCandidate', () => {
    useScannerStore.setState({
      isResolvingCandidate: true,
      resolvingIsbn: '9788445000663',
      activeResolvedCandidate: null,
    });

    useScannerStore.getState().clearActiveCandidate();

    const state = useScannerStore.getState();
    expect(state.isResolvingCandidate).toBe(false);
    expect(state.resolvingIsbn).toBeNull();
    expect(state.activeResolvedCandidate).toBeNull();
  });
});

