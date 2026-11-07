import { ShelvesRepository } from '../../src/db/repositories/shelvesRepository';
import { BooksRepository } from '../../src/db/repositories/booksRepository';
import { db } from '../../src/db/client';
import { Shelf } from '../../src/db/schema/shelves';
import { Book } from '../../src/db/schema/books';
import { resolveReadingLocalDate } from '../../src/features/reading-tracker/store/readerPreferencesStore';

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

function createDeleteChain<T>(resolveValue: T) {
  const returning = jest.fn().mockResolvedValue(resolveValue);
  const where = jest.fn().mockReturnValue({ returning });
  return { where, returning };
}

describe('shelvesAndWishlist Unit Tests', () => {
  const sampleShelf: Shelf = {
    id: 'shelf-1',
    furnitureName: 'Librero Estudio',
    shelfLevel: 'Nivel 1',
    colorTag: '#1E4635',
    createdAt: 1700000000,
    updatedAt: 1700000000,
  };

  const sampleBook: Book = {
    id: 'book-1',
    isbn13: '9788445000663',
    isbn10: '8445000668',
    title: 'El Señor de los Anillos',
    subtitle: null,
    seriesName: 'El Señor de los Anillos',
    seriesIndex: 1,
    authorsJson: JSON.stringify(['J.R.R. Tolkien']),
    translator: null,
    publisher: 'Minotauro',
    description: 'Fantasia epica.',
    coverUri: 'https://example.com/cover.jpg',
    pageCount: 400,
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
    shelfId: 'shelf-1',
    wishlistStoreNote: null,
    createdAt: 1700000000,
    updatedAt: 1700000000,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('ShelvesRepository', () => {
    it('create es idempotente cuando ya existe un estante con el mismo furnitureName y shelfLevel', async () => {
      const selectChain = createSelectChain([sampleShelf]);
      (db.select as jest.Mock).mockReturnValue({ from: selectChain.from });

      const result = await ShelvesRepository.create({
        furnitureName: 'Librero Estudio',
        shelfLevel: 'Nivel 1',
      });

      expect(result).toEqual(sampleShelf);
      expect(db.insert).not.toHaveBeenCalled();
    });

    it('create registra un nuevo estante si no existe previamente', async () => {
      const selectChain = createSelectChain([]);
      (db.select as jest.Mock).mockReturnValue({ from: selectChain.from });

      const newShelf: Shelf = {
        id: 'shelf-2',
        furnitureName: 'Mueble Sala',
        shelfLevel: 'Balda Superior',
        colorTag: '#2D5F4E',
        createdAt: 1700001000,
        updatedAt: 1700001000,
      };

      const insertChain = createInsertChain([newShelf]);
      (db.insert as jest.Mock).mockReturnValue(insertChain);

      const result = await ShelvesRepository.create({
        furnitureName: 'Mueble Sala',
        shelfLevel: 'Balda Superior',
        colorTag: '#2D5F4E',
      });

      expect(result).toEqual(newShelf);
      expect(db.insert).toHaveBeenCalled();
    });

    it('getGroupedWithBookCounts agrupa muebles y repisas calculando libros asociados', async () => {
      const shelf1: Shelf = { ...sampleShelf, id: 's1', furnitureName: 'Librero Roble', shelfLevel: '1' };
      const shelf2: Shelf = { ...sampleShelf, id: 's2', furnitureName: 'Librero Roble', shelfLevel: '2' };
      const shelf3: Shelf = { ...sampleShelf, id: 's3', furnitureName: 'Comoda Pasillo', shelfLevel: 'A' };

      const bookA: Book = { ...sampleBook, id: 'bA', shelfId: 's1' };
      const bookB: Book = { ...sampleBook, id: 'bB', shelfId: 's1' };
      const bookC: Book = { ...sampleBook, id: 'bC', shelfId: 's2' };
      const bookWithoutShelf: Book = { ...sampleBook, id: 'bD', shelfId: null };

      const selectShelves = createSelectChain([shelf1, shelf2, shelf3]);
      const selectBooks = createSelectChain([bookA, bookB, bookC, bookWithoutShelf]);

      (db.select as jest.Mock)
        .mockImplementationOnce(() => ({ from: selectShelves.from }))
        .mockImplementationOnce(() => ({ from: selectBooks.from }));

      const grouped = await ShelvesRepository.getGroupedWithBookCounts();

      expect(grouped).toHaveLength(2);

      const robleGroup = grouped.find((g) => g.furnitureName === 'Librero Roble');
      expect(robleGroup).toBeDefined();
      expect(robleGroup?.totalBooks).toBe(3);
      expect(robleGroup?.compartments).toHaveLength(2);
      expect(robleGroup?.compartments[0].bookCount).toBe(2);
      expect(robleGroup?.compartments[1].bookCount).toBe(1);

      const pasilloGroup = grouped.find((g) => g.furnitureName === 'Comoda Pasillo');
      expect(pasilloGroup).toBeDefined();
      expect(pasilloGroup?.totalBooks).toBe(0);
      expect(pasilloGroup?.compartments[0].bookCount).toBe(0);
    });

    it('delete desvincula primero los libros asociados a la repisa antes de eliminarla', async () => {
      const updateChain = createUpdateChain([{ id: 'book-1', shelfId: null }]);
      (db.update as jest.Mock).mockReturnValue(updateChain);

      const deleteChain = createDeleteChain([{ id: 'shelf-1' }]);
      (db.delete as jest.Mock).mockReturnValue(deleteChain);

      const result = await ShelvesRepository.delete('shelf-1');

      expect(result).toBe(true);
      expect(db.update).toHaveBeenCalled();
      expect(db.delete).toHaveBeenCalled();
    });
  });

  describe('BooksRepository - Nuevos metodos de Fase 2', () => {
    it('updateReadingProgress calcula porcentaje automatico y registra sesion retroactiva YESTERDAY', async () => {
      const baseBook: Book = {
        ...sampleBook,
        currentPage: 20,
        currentPercentage: 5,
        pageCount: 400,
        currentStatus: 'LEYENDO',
      };

      const selectBookChain = createSelectChain([baseBook]);
      (db.select as jest.Mock).mockReturnValue({ from: selectBookChain.from });

      const insertSessionChain = createInsertChain([{ id: 'sess_1' }]);
      (db.insert as jest.Mock).mockReturnValue(insertSessionChain);

      const updatedBook: Book = {
        ...baseBook,
        currentPage: 100,
        currentPercentage: 25,
      };
      const updateBookChain = createUpdateChain([updatedBook]);
      (db.update as jest.Mock).mockReturnValue(updateBookChain);

      const result = await BooksRepository.updateReadingProgress({
        bookId: 'book-1',
        currentUnit: 100,
        when: 'YESTERDAY',
      });

      const expectedYesterday = resolveReadingLocalDate('YESTERDAY');
      expect(result.percentage).toBe(25);
      expect(result.localDate).toBe(expectedYesterday);
      expect(result.book?.currentPage).toBe(100);
      expect(db.insert).toHaveBeenCalled();
      expect(db.update).toHaveBeenCalled();
    });

    it('updateReadingProgress marca estado LEIDO cuando el porcentaje alcanza o supera 100%', async () => {
      const baseBook: Book = {
        ...sampleBook,
        currentPage: 350,
        pageCount: 400,
        currentStatus: 'LEYENDO',
      };

      const selectBookChain = createSelectChain([baseBook]);
      (db.select as jest.Mock).mockReturnValue({ from: selectBookChain.from });

      const insertSessionChain = createInsertChain([{ id: 'sess_2' }]);
      (db.insert as jest.Mock).mockReturnValue(insertSessionChain);

      const updatedBook: Book = {
        ...baseBook,
        currentPage: 400,
        currentPercentage: 100,
        currentStatus: 'LEIDO',
      };
      const updateBookChain = createUpdateChain([updatedBook]);
      (db.update as jest.Mock).mockReturnValue(updateBookChain);

      const result = await BooksRepository.updateReadingProgress({
        bookId: 'book-1',
        currentUnit: 400,
        when: 'TODAY',
      });

      expect(result.percentage).toBe(100);
      expect(result.book?.currentStatus).toBe('LEIDO');
    });

    it('pauseOrAbandonBook guarda nota anti-olvido con indicador isSpoiler y recalcula porcentaje', async () => {
      const selectBookChain = createSelectChain([sampleBook]);
      (db.select as jest.Mock).mockReturnValue({ from: selectBookChain.from });

      const pausedBook: Book = {
        ...sampleBook,
        currentStatus: 'EN_ESPERA',
        currentPage: 200,
        currentPercentage: 50,
        pauseOrDnfNote: 'Pausado porque inician examenes finales',
        isSpoiler: true,
      };

      const updateBookChain = createUpdateChain([pausedBook]);
      (db.update as jest.Mock).mockReturnValue(updateBookChain);

      const result = await BooksRepository.pauseOrAbandonBook({
        bookId: 'book-1',
        status: 'EN_ESPERA',
        pauseOrDnfNote: 'Pausado porque inician examenes finales',
        isSpoiler: true,
        stoppedAtUnit: 200,
      });

      expect(result?.currentStatus).toBe('EN_ESPERA');
      expect(result?.currentPage).toBe(200);
      expect(result?.currentPercentage).toBe(50);
      expect(result?.pauseOrDnfNote).toBe('Pausado porque inician examenes finales');
      expect(result?.isSpoiler).toBe(true);
    });

    it('convertWishlistToOwned convierte libro de WISHLIST a OWNED + POR_LEER asignando estanteria fisica', async () => {
      const wishlistBook: Book = {
        ...sampleBook,
        ownership: 'WISHLIST',
        currentStatus: 'WISHLIST',
        shelfId: null,
      };

      const selectBookChain = createSelectChain([wishlistBook]);
      (db.select as jest.Mock).mockReturnValue({ from: selectBookChain.from });

      const ownedBook: Book = {
        ...wishlistBook,
        ownership: 'OWNED',
        currentStatus: 'POR_LEER',
        modality: 'PHYSICAL',
        shelfId: 'shelf-10',
        format: 'TAPA_DURA',
      };

      const updateBookChain = createUpdateChain([ownedBook]);
      (db.update as jest.Mock).mockReturnValue(updateBookChain);

      const result = await BooksRepository.convertWishlistToOwned({
        bookId: 'book-1',
        modality: 'PHYSICAL',
        shelfId: 'shelf-10',
        format: 'TAPA_DURA',
      });

      expect(result?.ownership).toBe('OWNED');
      expect(result?.currentStatus).toBe('POR_LEER');
      expect(result?.shelfId).toBe('shelf-10');
      expect(result?.format).toBe('TAPA_DURA');
    });

    it('convertWishlistToOwned para libros digitales forza shelfId en null', async () => {
      const wishlistBook: Book = {
        ...sampleBook,
        ownership: 'WISHLIST',
        currentStatus: 'WISHLIST',
        modality: 'DIGITAL',
        shelfId: null,
      };

      const selectBookChain = createSelectChain([wishlistBook]);
      (db.select as jest.Mock).mockReturnValue({ from: selectBookChain.from });

      const ownedDigitalBook: Book = {
        ...wishlistBook,
        ownership: 'OWNED',
        currentStatus: 'POR_LEER',
        modality: 'DIGITAL',
        shelfId: null,
        format: 'KINDLE',
      };

      const updateBookChain = createUpdateChain([ownedDigitalBook]);
      (db.update as jest.Mock).mockReturnValue(updateBookChain);

      const result = await BooksRepository.convertWishlistToOwned({
        bookId: 'book-1',
        modality: 'DIGITAL',
        shelfId: 'shelf-invalida-para-digital',
        format: 'KINDLE',
      });

      expect(result?.ownership).toBe('OWNED');
      expect(result?.modality).toBe('DIGITAL');
      expect(result?.shelfId).toBeNull();
      expect(result?.format).toBe('KINDLE');
    });

    it('getMultipleEditions encuentra ejemplares por mismo ISBN o titulo normalizado excluyendo WISHLIST', async () => {
      const targetBook: Book = {
        ...sampleBook,
        id: 'target-1',
        isbn13: '9788445000663',
        title: 'Cronica de una Muerte Anunciada',
      };

      // Candidatos en la biblioteca
      const editionSameIsbn: Book = {
        ...sampleBook,
        id: 'cand-1',
        isbn13: '9788445000663',
        title: 'Chronicle of a Death Foretold',
      };

      const editionNormalizedTitle: Book = {
        ...sampleBook,
        id: 'cand-2',
        isbn13: '9789999999999',
        title: 'Crónica de una muerte anunciada', // con tilde y minúsculas
      };

      const completelyDifferentBook: Book = {
        ...sampleBook,
        id: 'cand-3',
        isbn13: '9781111111111',
        title: 'Cien Años de Soledad',
      };

      const selectTargetChain = createSelectChain([targetBook]);
      const selectCandidatesChain = createSelectChain([
        targetBook,
        editionSameIsbn,
        editionNormalizedTitle,
        completelyDifferentBook,
      ]);

      (db.select as jest.Mock)
        .mockImplementationOnce(() => ({ from: selectTargetChain.from }))
        .mockImplementationOnce(() => ({ from: selectCandidatesChain.from }));

      const editions = await BooksRepository.getMultipleEditions('target-1');

      expect(editions).toHaveLength(3);
      expect(editions.map((e) => e.id)).toEqual(['target-1', 'cand-1', 'cand-2']);
      expect(editions.some((e) => e.id === 'cand-3')).toBe(false);
    });
  });
});
