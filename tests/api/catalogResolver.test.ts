import { CatalogResolver } from '../../src/features/catalog/services/catalogResolver';
import { GoogleBooksService } from '../../src/features/catalog/services/googleBooksService';
import { OpenLibraryService } from '../../src/features/catalog/services/openLibraryService';
import { NormalizedBookCandidate } from '../../src/features/catalog/types';

jest.mock('../../src/features/catalog/services/googleBooksService');
jest.mock('../../src/features/catalog/services/openLibraryService');

describe('CatalogResolver Contract & Fallback Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(CatalogResolver, 'resolveWithGeminiFallback').mockResolvedValue(null);
    jest.spyOn(CatalogResolver, 'enrichMetadataWithGemini').mockResolvedValue(null);
  });

  const mockGoogleBook: NormalizedBookCandidate = {
    isbn13: '9788445000663',
    title: 'El Señor de los Anillos',
    authors: ['J.R.R. Tolkien'],
    publisher: 'Minotauro',
    description: 'La gran obra de fantasía épica.',
    coverUri: undefined, // Simula que Google Books no tiene portada
    pageCount: 560,
    language: 'es',
    source: 'GOOGLE_BOOKS',
  };

  const mockOpenLibBook: NormalizedBookCandidate = {
    isbn13: '9788445000663',
    title: 'El Señor de los Anillos',
    authors: ['J.R.R. Tolkien'],
    publisher: 'Minotauro',
    description: undefined,
    coverUri: 'https://covers.openlibrary.org/b/id/8445000-L.jpg',
    pageCount: 558,
    language: 'es',
    source: 'OPEN_LIBRARY',
  };

  it('fusiona campos en cascada cuando ambas APIs responden (Field-Level Merge)', async () => {
    (GoogleBooksService.searchByIsbn as jest.Mock).mockResolvedValue(mockGoogleBook);
    (OpenLibraryService.searchByIsbn as jest.Mock).mockResolvedValue(mockOpenLibBook);

    const result = await CatalogResolver.resolveByIsbn('978-84-450-0066-3');

    expect(result.success).toBe(true);
    expect(result.candidatesCount).toBe(2);
    expect(result.book).toBeDefined();
    // La sinopsis proviene de Google Books
    expect(result.book?.description).toBe('La gran obra de fantasía épica.');
    // La portada faltante en Google Books se llena desde Open Library
    expect(result.book?.coverUri).toBe('https://covers.openlibrary.org/b/id/8445000-L.jpg');
    expect(result.book?.source).toBe('MERGED');
  });

  it('devuelve el libro de Google Books si Open Library no responde', async () => {
    (GoogleBooksService.searchByIsbn as jest.Mock).mockResolvedValue({
      ...mockGoogleBook,
      coverUri: 'https://books.google.com/thumb.jpg',
    });
    (OpenLibraryService.searchByIsbn as jest.Mock).mockResolvedValue(null);

    const result = await CatalogResolver.resolveByIsbn('978-84-450-0066-3');

    expect(result.success).toBe(true);
    expect(result.candidatesCount).toBe(1);
    expect(result.book?.source).toBe('GOOGLE_BOOKS');
  });

  it('devuelve el libro de Open Library si Google Books falla o da timeout', async () => {
    (GoogleBooksService.searchByIsbn as jest.Mock).mockResolvedValue(null);
    (OpenLibraryService.searchByIsbn as jest.Mock).mockResolvedValue(mockOpenLibBook);

    const result = await CatalogResolver.resolveByIsbn('978-84-450-0066-3');

    expect(result.success).toBe(true);
    expect(result.candidatesCount).toBe(1);
    expect(result.book?.source).toBe('OPEN_LIBRARY');
  });

  it('maneja el caso de error cuando ninguna API encuentra el libro o no hay internet', async () => {
    (GoogleBooksService.searchByIsbn as jest.Mock).mockResolvedValue(null);
    (OpenLibraryService.searchByIsbn as jest.Mock).mockResolvedValue(null);

    const result = await CatalogResolver.resolveByIsbn('978-84-450-0066-3');

    expect(result.success).toBe(false);
    expect(result.book).toBeNull();
    expect(result.error).toBe('NOT_FOUND_OR_OFFLINE');
  });

  it('detecta códigos de barras internos de librería e interrumpe la llamada de red', async () => {
    const result = await CatalogResolver.resolveByIsbn('2000000123456');

    expect(result.success).toBe(false);
    expect(result.error).toBe('STORE_BARCODE');
    expect(GoogleBooksService.searchByIsbn).not.toHaveBeenCalled();
    expect(OpenLibraryService.searchByIsbn).not.toHaveBeenCalled();
  });

  it('rechaza ISBNs inválidos sin disparar peticiones a los servidores', async () => {
    const result = await CatalogResolver.resolveByIsbn('12345');

    expect(result.success).toBe(false);
    expect(result.error).toBe('INVALID_ISBN');
    expect(GoogleBooksService.searchByIsbn).not.toHaveBeenCalled();
    expect(OpenLibraryService.searchByIsbn).not.toHaveBeenCalled();
  });
});
