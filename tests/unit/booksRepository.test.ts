import { BooksRepository } from '../../src/db/repositories/booksRepository';
import { db, rawDb } from '../../src/db/client';
import { Book } from '../../src/db/schema/books';

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

describe('BooksRepository Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const sampleBook: Book = {
    id: 'book-1',
    isbn13: '9788445000663',
    isbn10: '8445000668',
    title: 'El Señor de los Anillos: La Comunidad del Anillo',
    subtitle: null,
    seriesName: 'El Señor de los Anillos',
    seriesIndex: 1,
    authorsJson: JSON.stringify(['J.R.R. Tolkien']),
    translator: null,
    publisher: 'Minotauro',
    description: 'La gran obra épica.',
    coverUri: 'https://covers.openlibrary.org/b/id/123-L.jpg',
    pageCount: 560,
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

  it('obtiene un libro por su ID único', async () => {
    const mockLimit = jest.fn().mockResolvedValue([sampleBook]);
    const mockWhere = jest.fn().mockReturnValue({ limit: mockLimit });
    const mockFrom = jest.fn().mockReturnValue({ where: mockWhere });
    (db.select as jest.Mock).mockReturnValue({ from: mockFrom });

    const result = await BooksRepository.getById('book-1');

    expect(result).toEqual(sampleBook);
    expect(db.select).toHaveBeenCalled();
  });

  it('devuelve null si el libro no existe', async () => {
    const mockLimit = jest.fn().mockResolvedValue([]);
    const mockWhere = jest.fn().mockReturnValue({ limit: mockLimit });
    const mockFrom = jest.fn().mockReturnValue({ where: mockWhere });
    (db.select as jest.Mock).mockReturnValue({ from: mockFrom });

    const result = await BooksRepository.getById('inexistente');

    expect(result).toBeNull();
  });

  it('detecta duplicados por ISBN-13', async () => {
    const mockLimit = jest.fn().mockResolvedValue([sampleBook]);
    const mockWhere = jest.fn().mockReturnValue({ limit: mockLimit });
    const mockFrom = jest.fn().mockReturnValue({ where: mockWhere });
    (db.select as jest.Mock).mockReturnValue({ from: mockFrom });

    const result = await BooksRepository.getByIsbn('9788445000663');

    expect(result).toEqual(sampleBook);
  });

  it('agrupa libros por saga y los ordena numéricamente (#1, #2, #3)', async () => {
    const bookTome1: Book = { ...sampleBook, id: 'b1', seriesIndex: 1, title: 'Tomo 1' };
    const bookTome2: Book = { ...sampleBook, id: 'b2', seriesIndex: 2, title: 'Tomo 2' };
    const bookTome15: Book = { ...sampleBook, id: 'b15', seriesIndex: 1.5, title: 'Tomo 1.5 Intermedio' };

    const mockOrderBy = jest.fn().mockResolvedValue([bookTome1, bookTome2, bookTome15]);
    const mockWhere = jest.fn().mockReturnValue({ orderBy: mockOrderBy });
    const mockFrom = jest.fn().mockReturnValue({ where: mockWhere });
    (db.select as jest.Mock).mockReturnValue({ from: mockFrom });

    const groups = await BooksRepository.getSeriesGrouped();

    expect(groups).toHaveLength(1);
    expect(groups[0].seriesName).toBe('El Señor de los Anillos');
    expect(groups[0].totalBooks).toBe(3);
    // Verifica que se ordenen 1, 1.5, 2
    expect(groups[0].books[0].seriesIndex).toBe(1);
    expect(groups[0].books[1].seriesIndex).toBe(1.5);
    expect(groups[0].books[2].seriesIndex).toBe(2);
  });

  it('elimina un libro correctamente', async () => {
    const mockReturning = jest.fn().mockResolvedValue([{ id: 'book-1' }]);
    const mockWhere = jest.fn().mockReturnValue({ returning: mockReturning });
    (db.delete as jest.Mock).mockReturnValue({ where: mockWhere });

    const success = await BooksRepository.delete('book-1');

    expect(success).toBe(true);
    expect(db.delete).toHaveBeenCalled();
  });
});
