import {
  normalizeDiacritics,
  buildHighlightedSnippet,
  DeepLibrarySearchService,
} from '../../src/features/smart-search/services/deepLibrarySearchService';
import { Book } from '../../src/db/schema/books';
import { BookQuote } from '../../src/db/schema/bookQuotes';
import { ReadingLog } from '../../src/db/schema/readingLogs';

describe('DeepLibrarySearchService - Busqueda Profunda Local', () => {
  describe('normalizeDiacritics', () => {
    it('elimina acentos, tildes y dieresis convirtiendo a minusculas', () => {
      expect(normalizeDiacritics('CÓLERA')).toBe('colera');
      expect(normalizeDiacritics('García Márquez')).toBe('garcia marquez');
      expect(normalizeDiacritics('Pingüino')).toBe('pinguino');
      expect(normalizeDiacritics('AÑO')).toBe('ano');
      expect(normalizeDiacritics('AÑOS')).toBe('anos');
    });

    it('maneja cadenas vacias y espacios', () => {
      expect(normalizeDiacritics('')).toBe('');
      expect(normalizeDiacritics('   ')).toBe('');
      expect(normalizeDiacritics('  Don Quijote  ')).toBe('don quijote');
    });
  });

  describe('buildHighlightedSnippet', () => {
    it('encuentra la coincidencia ignorando acentos y mayusculas', () => {
      const text = 'El amor en los tiempos del cólera fue publicado en 1985.';
      const snippet = buildHighlightedSnippet(text, 'colera', 40);

      expect(snippet.hasMatch).toBe(true);
      expect(snippet.match).toBe('cólera');
      expect(snippet.before).toContain('tiempos del ');
      expect(snippet.after).toContain(' fue publicado');
    });

    it('encuentra coincidencias cuando el texto no tiene acento pero la consulta si', () => {
      const text = 'La cronica de una muerte anunciada.';
      const snippet = buildHighlightedSnippet(text, 'crónica');

      expect(snippet.hasMatch).toBe(true);
      expect(snippet.match).toBe('cronica');
    });

    it('devuelve hasMatch false cuando no existe coincidencia', () => {
      const text = 'Cien anos de soledad.';
      const snippet = buildHighlightedSnippet(text, 'rayuela');

      expect(snippet.hasMatch).toBe(false);
      expect(snippet.match).toBe('');
      expect(snippet.before).toContain('Cien anos');
    });

    it('maneja textos vacios o consultas vacias', () => {
      expect(buildHighlightedSnippet('', 'prueba').hasMatch).toBe(false);
      expect(buildHighlightedSnippet('Texto base', '').hasMatch).toBe(false);
    });
  });

  describe('searchLocalLibrary', () => {
    const mockBooks: Book[] = [
      {
        id: 'book-1',
        isbn13: '9788497592208',
        isbn10: '8497592204',
        title: 'Cien años de soledad',
        subtitle: 'Edición conmemorativa',
        seriesName: null,
        seriesIndex: null,
        authorsJson: JSON.stringify(['Gabriel García Márquez']),
        translator: null,
        publisher: 'Debolsillo',
        description: 'La historia de la familia Buendía en el pueblo mítico de Macondo.',
        coverUri: 'file:///covers/soledad.webp',
        pageCount: 471,
        modality: 'PHYSICAL',
        ownership: 'OWNED',
        metadataStatus: 'COMPLETE',
        format: 'BOLSILLO',
        progressMode: 'PAGES',
        language: 'es',
        currentStatus: 'LEIDO',
        currentPage: 471,
        currentPercentage: 100,
        rating: 5,
        pauseOrDnfNote: null,
        isSpoiler: false,
        shelfId: 'shelf-1',
        wishlistStoreNote: null,
        createdAt: 1700000000000,
        updatedAt: 1700000000000,
      },
      {
        id: 'book-2',
        isbn13: '9788466353779',
        isbn10: null,
        title: 'Dune',
        subtitle: null,
        seriesName: 'Las Crónicas de Dune',
        seriesIndex: 1,
        authorsJson: JSON.stringify(['Frank Herbert']),
        translator: 'Domingo Santos',
        publisher: 'Plaza & Janés',
        description: 'En el planeta desértico Arrakis, el agua y la especia lo son todo.',
        coverUri: null,
        pageCount: 704,
        modality: 'DIGITAL',
        ownership: 'OWNED',
        metadataStatus: 'COMPLETE',
        format: 'EPUB_PDF',
        progressMode: 'PERCENTAGE',
        language: 'es',
        currentStatus: 'EN_ESPERA',
        currentPage: 250,
        currentPercentage: 35.5,
        rating: null,
        pauseOrDnfNote: 'Pausado porque el emperador y los Harkonnen preparan una emboscada.',
        isSpoiler: true,
        shelfId: null,
        wishlistStoreNote: null,
        createdAt: 1700000000000,
        updatedAt: 1700000000000,
      },
    ];

    const mockQuotes: BookQuote[] = [
      {
        id: 'quote-1',
        bookId: 'book-1',
        entryType: 'QUOTE',
        content: 'Muchos años después, frente al pelotón de fusilamiento...',
        pageNumber: 9,
        chapterOrSection: 'Capítulo 1',
        personalNote: 'Frase de apertura inolvidable sobre el coronel Aureliano Buendia.',
        highlightColor: '#F3E8CB',
        isSpoiler: false,
        isFavorite: true,
        createdAt: 1700000000000,
        updatedAt: 1700000000000,
      },
      {
        id: 'quote-2',
        bookId: 'book-1',
        entryType: 'CHARACTER',
        content: 'Melquíades: gitano sabio que trae los inventos y escribe los pergaminos.',
        pageNumber: 15,
        chapterOrSection: 'Personajes',
        personalNote: 'Guardián del destino final de Macondo.',
        highlightColor: '#F3E8CB',
        isSpoiler: true,
        isFavorite: false,
        createdAt: 1700000000000,
        updatedAt: 1700000000000,
      },
      {
        id: 'quote-3',
        bookId: 'book-2',
        entryType: 'NOTE',
        content: 'La especia melange prolonga la vida y permite navegar el hiperespacio.',
        pageNumber: 42,
        chapterOrSection: 'Ecología de Arrakis',
        personalNote: 'Nota sobre la economía interestelar de Dune.',
        highlightColor: '#E2E8F0',
        isSpoiler: false,
        isFavorite: false,
        createdAt: 1700000000000,
        updatedAt: 1700000000000,
      },
    ];

    const mockLogs: ReadingLog[] = [
      {
        id: 'log-1',
        bookId: 'book-1',
        readNumber: 1,
        startedAt: 1690000000000,
        finishedAt: 1695000000000,
        rating: 5,
        review: 'Obra maestra absoluta de Macondo y la soledad latinoamericana.',
        createdAt: 1700000000000,
        updatedAt: 1700000000000,
      },
    ];

    it('encuentra libros por coincidencia en autor o titulo insensible a acentos', () => {
      const result = DeepLibrarySearchService.searchLocalLibrary({
        query: 'garcia marquez',
        books: mockBooks,
        quotes: mockQuotes,
        logs: mockLogs,
      });

      expect(result.counts.books).toBe(1);
      expect(result.matchedBooks[0].id).toBe('book-1');
      expect(result.matchedBooks[0].matchedField).toBe('authors');
    });

    it('encuentra libros por coincidencia en saga o descripcion', () => {
      const result = DeepLibrarySearchService.searchLocalLibrary({
        query: 'arrakis',
        books: mockBooks,
        quotes: mockQuotes,
        logs: mockLogs,
      });

      expect(result.counts.books).toBe(1);
      expect(result.matchedBooks[0].id).toBe('book-2');
      expect(result.matchedBooks[0].matchedField).toBe('description');
    });

    it('encuentra citas respetando entryType QUOTE y preservando isSpoiler', () => {
      const result = DeepLibrarySearchService.searchLocalLibrary({
        query: 'fusilamiento',
        books: mockBooks,
        quotes: mockQuotes,
        logs: mockLogs,
      });

      expect(result.counts.quotes).toBe(1);
      expect(result.matchedQuotes[0].id).toBe('quote-1');
      expect(result.matchedQuotes[0].isSpoiler).toBe(false);
      expect(result.matchedQuotes[0].book?.title).toBe('Cien años de soledad');
    });

    it('encuentra personajes respetando entryType CHARACTER y preservando isSpoiler', () => {
      const result = DeepLibrarySearchService.searchLocalLibrary({
        query: 'melquiades',
        books: mockBooks,
        quotes: mockQuotes,
        logs: mockLogs,
      });

      expect(result.counts.characters).toBe(1);
      expect(result.matchedCharacters[0].id).toBe('quote-2');
      expect(result.matchedCharacters[0].isSpoiler).toBe(true);
      expect(result.matchedCharacters[0].entryType).toBe('CHARACTER');
    });

    it('encuentra notas en pauseOrDnfNote preservando isSpoiler del libro', () => {
      const result = DeepLibrarySearchService.searchLocalLibrary({
        query: 'harkonnen',
        books: mockBooks,
        quotes: mockQuotes,
        logs: mockLogs,
      });

      expect(result.counts.notes).toBe(1);
      expect(result.matchedNotes[0].sourceType).toBe('BOOK_PAUSE_OR_DNF');
      expect(result.matchedNotes[0].isSpoiler).toBe(true);
      expect(result.matchedNotes[0].book?.id).toBe('book-2');
    });

    it('encuentra notas en resenas de lectura (ReadingLog)', () => {
      const result = DeepLibrarySearchService.searchLocalLibrary({
        query: 'latinoamericana',
        books: mockBooks,
        quotes: mockQuotes,
        logs: mockLogs,
      });

      expect(result.counts.notes).toBe(1);
      expect(result.matchedNotes[0].sourceType).toBe('READING_LOG_REVIEW');
      expect(result.matchedNotes[0].isSpoiler).toBe(false);
    });

    it('respeta el filtro scope retornando solo la categoria seleccionada pero calculando todos los conteos', () => {
      // "Macondo" aparece en descripcion del libro, personaje Melquiades, y resena del log
      const resultQuotesOnly = DeepLibrarySearchService.searchLocalLibrary({
        query: 'macondo',
        scope: 'CHARACTERS',
        books: mockBooks,
        quotes: mockQuotes,
        logs: mockLogs,
      });

      expect(resultQuotesOnly.scope).toBe('CHARACTERS');
      expect(resultQuotesOnly.counts.books).toBe(1);
      expect(resultQuotesOnly.counts.characters).toBe(1);
      expect(resultQuotesOnly.counts.notes).toBe(1);
      expect(resultQuotesOnly.counts.total).toBe(3);

      expect(resultQuotesOnly.matchedBooks).toHaveLength(0);
      expect(resultQuotesOnly.matchedCharacters).toHaveLength(1);
      expect(resultQuotesOnly.matchedNotes).toHaveLength(0);
    });

    it('devuelve resultados vacios ante una consulta en blanco', () => {
      const result = DeepLibrarySearchService.searchLocalLibrary({
        query: '   ',
        books: mockBooks,
        quotes: mockQuotes,
      });

      expect(result.counts.total).toBe(0);
      expect(result.matchedBooks).toHaveLength(0);
    });
  });
});
