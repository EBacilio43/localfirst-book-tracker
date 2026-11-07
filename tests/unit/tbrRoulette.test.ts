import {
  evaluateTbrCandidates,
  spinTbrRoulette,
  detectSagaGaps,
  TbrRouletteService,
} from '../../src/features/shelves/services/tbrRouletteService';
import { Book } from '../../src/db/schema/books';
import { ReadingLog } from '../../src/db/schema/readingLogs';

describe('tbrRoulette Unit Tests', () => {
  const baseBookTemplate: Book = {
    id: 'base-book',
    isbn13: '9780000000001',
    isbn10: null,
    title: 'Libro Base',
    subtitle: null,
    seriesName: null,
    seriesIndex: null,
    authorsJson: JSON.stringify(['Autor']),
    translator: null,
    publisher: 'Editorial',
    description: null,
    coverUri: null,
    pageCount: 300,
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

  const createBook = (overrides: Partial<Book>): Book => ({
    ...baseBookTemplate,
    id: overrides.id ?? `book_${Math.random().toString(36).substring(2, 8)}`,
    ...overrides,
  });

  describe('evaluateTbrCandidates - Libros autoconclusivos y filtros base', () => {
    it('incluye libros autoconclusivos en POR_LEER como elegibles', () => {
      const standalone1 = createBook({ id: 's1', title: 'Novela Autoconclusiva 1' });
      const standalone2 = createBook({ id: 's2', title: 'Novela Autoconclusiva 2' });

      const result = evaluateTbrCandidates([standalone1, standalone2], []);

      expect(result.eligible).toHaveLength(2);
      expect(result.blockedSequels).toHaveLength(0);
    });

    it('excluye libros que estan en la lista de deseos WISHLIST', () => {
      const wishlistBook = createBook({
        id: 'w1',
        title: 'Libro Deseado',
        ownership: 'WISHLIST',
        currentStatus: 'WISHLIST',
      });
      const ownedBook = createBook({ id: 'o1', title: 'Libro Comprado' });

      const result = evaluateTbrCandidates([wishlistBook, ownedBook], []);

      expect(result.eligible).toHaveLength(1);
      expect(result.eligible[0].id).toBe('o1');
      expect(result.blockedSequels).toHaveLength(0);
    });

    it('excluye libros que no esten en estado POR_LEER', () => {
      const readingBook = createBook({ id: 'b1', currentStatus: 'LEYENDO' });
      const readBook = createBook({ id: 'b2', currentStatus: 'LEIDO' });
      const pausedBook = createBook({ id: 'b3', currentStatus: 'EN_ESPERA' });
      const dnfBook = createBook({ id: 'b4', currentStatus: 'ABANDONADO' });
      const tbrBook = createBook({ id: 'b5', currentStatus: 'POR_LEER' });

      const result = evaluateTbrCandidates([readingBook, readBook, pausedBook, dnfBook, tbrBook], []);

      expect(result.eligible).toHaveLength(1);
      expect(result.eligible[0].id).toBe('b5');
    });

    it('filtra por modalidad PHYSICAL y DIGITAL', () => {
      const physicalBook = createBook({ id: 'p1', modality: 'PHYSICAL' });
      const digitalBook = createBook({ id: 'd1', modality: 'DIGITAL' });

      const physicalOnly = evaluateTbrCandidates([physicalBook, digitalBook], [], {
        modality: 'PHYSICAL',
      });
      expect(physicalOnly.eligible).toHaveLength(1);
      expect(physicalOnly.eligible[0].id).toBe('p1');

      const digitalOnly = evaluateTbrCandidates([physicalBook, digitalBook], [], {
        modality: 'DIGITAL',
      });
      expect(digitalOnly.eligible).toHaveLength(1);
      expect(digitalOnly.eligible[0].id).toBe('d1');

      const all = evaluateTbrCandidates([physicalBook, digitalBook], [], {
        modality: 'ALL',
      });
      expect(all.eligible).toHaveLength(2);
    });

    it('filtra por estanteria especifica shelfId', () => {
      const bookShelf1 = createBook({ id: 'b1', shelfId: 'shelf_A' });
      const bookShelf2 = createBook({ id: 'b2', shelfId: 'shelf_B' });

      const result = evaluateTbrCandidates([bookShelf1, bookShelf2], [], {
        shelfId: 'shelf_A',
      });

      expect(result.eligible).toHaveLength(1);
      expect(result.eligible[0].id).toBe('b1');
    });

    it('filtra por rango de paginas minPages y maxPages', () => {
      const shortBook = createBook({ id: 'b1', pageCount: 120 });
      const mediumBook = createBook({ id: 'b2', pageCount: 350 });
      const longBook = createBook({ id: 'b3', pageCount: 800 });

      const result = evaluateTbrCandidates([shortBook, mediumBook, longBook], [], {
        minPages: 200,
        maxPages: 500,
      });

      expect(result.eligible).toHaveLength(1);
      expect(result.eligible[0].id).toBe('b2');
    });

    it('excluye sagas cuando includeSagas es false', () => {
      const standalone = createBook({ id: 's1', seriesName: null });
      const sagaBook = createBook({ id: 'sg1', seriesName: 'Fundacion', seriesIndex: 1 });

      const result = evaluateTbrCandidates([standalone, sagaBook], [], {
        includeSagas: false,
      });

      expect(result.eligible).toHaveLength(1);
      expect(result.eligible[0].id).toBe('s1');
    });
  });

  describe('evaluateTbrCandidates - Saga Integrity Shield', () => {
    const dune1 = createBook({
      id: 'dune-1',
      title: 'Dune',
      seriesName: 'Dune',
      seriesIndex: 1,
      currentStatus: 'POR_LEER',
    });

    const dune2 = createBook({
      id: 'dune-2',
      title: 'El Mesias de Dune',
      seriesName: 'Dune',
      seriesIndex: 2,
      currentStatus: 'POR_LEER',
    });

    const dune3 = createBook({
      id: 'dune-3',
      title: 'Hijos de Dune',
      seriesName: 'Dune',
      seriesIndex: 3,
      currentStatus: 'POR_LEER',
    });

    it('si el usuario tiene Dune #1, #2 y #3 en POR_LEER, solo #1 es elegible y #2 y #3 quedan bloqueados', () => {
      const result = evaluateTbrCandidates([dune1, dune2, dune3], []);

      expect(result.eligible).toHaveLength(1);
      expect(result.eligible[0].id).toBe('dune-1');

      expect(result.blockedSequels).toHaveLength(2);

      const blocked2 = result.blockedSequels.find((b) => b.book.id === 'dune-2');
      const blocked3 = result.blockedSequels.find((b) => b.book.id === 'dune-3');

      expect(blocked2).toBeDefined();
      expect(blocked2?.missingOrUnreadIndex).toBe(1);

      expect(blocked3).toBeDefined();
      expect(blocked3?.missingOrUnreadIndex).toBe(1);
    });

    it('cuando Dune #1 pasa a LEIDO, Dune #2 se desbloquea automaticamente y #3 continua bloqueado', () => {
      const dune1Read = { ...dune1, currentStatus: 'LEIDO' as const };

      const result = evaluateTbrCandidates([dune1Read, dune2, dune3], []);

      expect(result.eligible).toHaveLength(1);
      expect(result.eligible[0].id).toBe('dune-2');

      expect(result.blockedSequels).toHaveLength(1);
      expect(result.blockedSequels[0].book.id).toBe('dune-3');
      expect(result.blockedSequels[0].missingOrUnreadIndex).toBe(2);
    });

    it('desbloquea secuela si el tomo previo figura en completedLogs aunque currentStatus del libro sea LEYENDO por relectura', () => {
      const dune1Rereading = { ...dune1, currentStatus: 'LEYENDO' as const };

      const finishedLogDune1: ReadingLog = {
        id: 'rlog_d1',
        bookId: 'dune-1',
        readNumber: 1,
        startedAt: 1700000000,
        finishedAt: 1700001000,
        rating: 5.0,
        review: 'Obra maestra',
        createdAt: 1700000000,
        updatedAt: 1700001000,
      };

      const result = evaluateTbrCandidates([dune1Rereading, dune2, dune3], [finishedLogDune1]);

      expect(result.eligible).toHaveLength(1);
      expect(result.eligible[0].id).toBe('dune-2');
      expect(result.blockedSequels).toHaveLength(1);
      expect(result.blockedSequels[0].book.id).toBe('dune-3');
    });

    it('si el usuario tiene el #1 leido y el #3 en POR_LEER pero le falta el #2, el #3 queda retenido', () => {
      const dune1Read = { ...dune1, currentStatus: 'LEIDO' as const };

      // Solo tenemos Dune #1 leido y Dune #3 por leer en la biblioteca (falta Dune #2)
      const result = evaluateTbrCandidates([dune1Read, dune3], []);

      expect(result.eligible).toHaveLength(0);
      expect(result.blockedSequels).toHaveLength(1);
      expect(result.blockedSequels[0].book.id).toBe('dune-3');
      expect(result.blockedSequels[0].missingOrUnreadIndex).toBe(2);
      expect(result.blockedSequels[0].reason).toContain('El tomo #2 de la saga no ha sido leido o no se encuentra en la biblioteca');
    });

    it('si el usuario tiene solo el #2 sin tener ni haber leido el #1, el #2 queda retenido', () => {
      const result = evaluateTbrCandidates([dune2], []);

      expect(result.eligible).toHaveLength(0);
      expect(result.blockedSequels).toHaveLength(1);
      expect(result.blockedSequels[0].book.id).toBe('dune-2');
      expect(result.blockedSequels[0].missingOrUnreadIndex).toBe(1);
      expect(result.blockedSequels[0].reason).toContain('El tomo inicial #1 de la saga no ha sido leido o no se encuentra en la biblioteca');
    });

    it('soporta tomos intermedios (#1.5) reteniendo el #2 hasta que el #1.5 sea leido', () => {
      const tome1 = createBook({ id: 't1', seriesName: 'Saga Epica', seriesIndex: 1, currentStatus: 'LEIDO' });
      const tome15 = createBook({ id: 't15', seriesName: 'Saga Epica', seriesIndex: 1.5, currentStatus: 'POR_LEER' });
      const tome2 = createBook({ id: 't2', seriesName: 'Saga Epica', seriesIndex: 2, currentStatus: 'POR_LEER' });

      // Con el #1 leido, el #1.5 debe ser elegible y el #2 debe estar bloqueado por el #1.5
      const result1 = evaluateTbrCandidates([tome1, tome15, tome2], []);

      expect(result1.eligible).toHaveLength(1);
      expect(result1.eligible[0].id).toBe('t15');

      expect(result1.blockedSequels).toHaveLength(1);
      expect(result1.blockedSequels[0].book.id).toBe('t2');
      expect(result1.blockedSequels[0].missingOrUnreadIndex).toBe(1.5);

      // Cuando el #1.5 tambien se marca como leido, el #2 se desbloquea
      const tome15Read = { ...tome15, currentStatus: 'LEIDO' as const };
      const result2 = evaluateTbrCandidates([tome1, tome15Read, tome2], []);

      expect(result2.eligible).toHaveLength(1);
      expect(result2.eligible[0].id).toBe('t2');
      expect(result2.blockedSequels).toHaveLength(0);
    });
  });

  describe('spinTbrRoulette', () => {
    it('devuelve null si la lista de elegibles esta vacia', () => {
      const selected = spinTbrRoulette([]);
      expect(selected).toBeNull();
    });

    it('devuelve el unico libro cuando la lista tiene un elemento', () => {
      const singleBook = createBook({ id: 'single', title: 'Unico Candidato' });
      const selected = spinTbrRoulette([singleBook]);
      expect(selected).toEqual(singleBook);
    });

    it('selecciona deterministicamente segun el generador randomFn suministrado', () => {
      const b1 = createBook({ id: 'b1', title: 'Primero' });
      const b2 = createBook({ id: 'b2', title: 'Segundo' });
      const b3 = createBook({ id: 'b3', title: 'Tercero' });
      const books = [b1, b2, b3];

      const firstPick = spinTbrRoulette(books, () => 0.0);
      expect(firstPick?.id).toBe('b1');

      const middlePick = spinTbrRoulette(books, () => 0.5);
      expect(middlePick?.id).toBe('b2');

      const lastPick = spinTbrRoulette(books, () => 0.999);
      expect(lastPick?.id).toBe('b3');
    });
  });

  describe('detectSagaGaps', () => {
    it('identifica el hueco #2 cuando se tienen #1 y #3 y lo vincula con la lista de deseos si esta registrado alli', () => {
      const tome1Owned = createBook({
        id: 'o1',
        title: 'Trilogia #1',
        seriesName: 'La Primera Ley',
        seriesIndex: 1,
        ownership: 'OWNED',
      });

      const tome2Wishlist = createBook({
        id: 'w2',
        title: 'Trilogia #2 (Deseado)',
        seriesName: 'La Primera Ley',
        seriesIndex: 2,
        ownership: 'WISHLIST',
        currentStatus: 'WISHLIST',
      });

      const tome3Owned = createBook({
        id: 'o3',
        title: 'Trilogia #3',
        seriesName: 'La Primera Ley',
        seriesIndex: 3,
        ownership: 'OWNED',
      });

      const reports = detectSagaGaps([tome1Owned, tome2Wishlist, tome3Owned]);

      expect(reports).toHaveLength(1);
      const report = reports[0];
      expect(report.seriesName).toBe('La Primera Ley');
      expect(report.missingIndices).toEqual([2]);
      expect(report.ownedIndices).toEqual([1, 3]);
      expect(report.wishlistMatches).toHaveLength(1);
      expect(report.wishlistMatches[0].id).toBe('w2');
    });

    it('identifica multiples huecos continuos cuando faltan varios tomos intermedios', () => {
      const tome1 = createBook({ id: 'b1', seriesName: 'Fundacion', seriesIndex: 1, ownership: 'OWNED' });
      const tome5 = createBook({ id: 'b5', seriesName: 'Fundacion', seriesIndex: 5, ownership: 'OWNED' });

      const reports = detectSagaGaps([tome1, tome5]);

      expect(reports).toHaveLength(1);
      expect(reports[0].seriesName).toBe('Fundacion');
      expect(reports[0].missingIndices).toEqual([2, 3, 4]);
      expect(reports[0].ownedIndices).toEqual([1, 5]);
      expect(reports[0].wishlistMatches).toHaveLength(0);
    });

    it('no genera reporte si la saga es completa y contigua (#1, #2, #3)', () => {
      const hp1 = createBook({ id: 'hp1', seriesName: 'Harry Potter', seriesIndex: 1, ownership: 'OWNED' });
      const hp2 = createBook({ id: 'hp2', seriesName: 'Harry Potter', seriesIndex: 2, ownership: 'OWNED' });
      const hp3 = createBook({ id: 'hp3', seriesName: 'Harry Potter', seriesIndex: 3, ownership: 'OWNED' });

      const reports = detectSagaGaps([hp1, hp2, hp3]);

      expect(reports).toHaveLength(0);
    });

    it('ignora libros autoconclusivos o sagas que solo posean un tomo registrado', () => {
      const standalone = createBook({ id: 'st1', seriesName: null });
      const singleSaga = createBook({ id: 'sg1', seriesName: 'Saga Nueva', seriesIndex: 1, ownership: 'OWNED' });

      const reports = detectSagaGaps([standalone, singleSaga]);

      expect(reports).toHaveLength(0);
    });
  });

  describe('TbrRouletteService - Metodos estaticos de clase', () => {
    it('expone las funciones estaticas correspondientes en la clase', () => {
      expect(TbrRouletteService.evaluateTbrCandidates).toBe(evaluateTbrCandidates);
      expect(TbrRouletteService.spinTbrRoulette).toBe(spinTbrRoulette);
      expect(TbrRouletteService.detectSagaGaps).toBe(detectSagaGaps);
    });
  });
});
