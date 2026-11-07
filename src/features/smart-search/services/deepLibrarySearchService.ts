import { Book } from '@/db/schema/books';
import { BookQuote } from '@/db/schema/bookQuotes';
import { ReadingLog } from '@/db/schema/readingLogs';

export type SearchScope = 'ALL' | 'BOOKS' | 'QUOTES' | 'CHARACTERS' | 'NOTES';

export interface HighlightedSnippet {
  before: string;
  match: string;
  after: string;
  hasMatch: boolean;
}

export interface MatchedBookItem {
  id: string;
  title: string;
  subtitle?: string | null;
  authorsJson: string;
  publisher?: string | null;
  seriesName?: string | null;
  description?: string | null;
  coverUri?: string | null;
  book: Book;
  matchedField: 'title' | 'subtitle' | 'authors' | 'publisher' | 'seriesName' | 'description';
  snippet: HighlightedSnippet;
}

export interface MatchedQuoteItem {
  id: string;
  bookId: string;
  content: string;
  personalNote?: string | null;
  chapterOrSection?: string | null;
  pageNumber?: number | null;
  highlightColor: string;
  isFavorite: boolean;
  isSpoiler: boolean;
  quote: BookQuote;
  book?: Book;
  matchedField: 'content' | 'personalNote' | 'chapterOrSection';
  snippet: HighlightedSnippet;
}

export interface MatchedCharacterItem {
  id: string;
  bookId: string;
  content: string;
  personalNote?: string | null;
  chapterOrSection?: string | null;
  pageNumber?: number | null;
  entryType: 'CHARACTER' | 'GLOSSARY';
  isSpoiler: boolean;
  quote: BookQuote;
  book?: Book;
  matchedField: 'content' | 'personalNote' | 'chapterOrSection';
  snippet: HighlightedSnippet;
}

export type NoteSourceType = 'BOOK_PAUSE_OR_DNF' | 'QUOTE_NOTE' | 'READING_LOG_REVIEW';

export interface MatchedNoteItem {
  id: string;
  sourceType: NoteSourceType;
  bookId: string;
  book?: Book;
  quote?: BookQuote;
  log?: ReadingLog;
  matchedField: string;
  content: string;
  snippet: HighlightedSnippet;
  isSpoiler: boolean;
}

export interface DeepSearchResult {
  query: string;
  scope: SearchScope;
  counts: {
    total: number;
    books: number;
    quotes: number;
    characters: number;
    notes: number;
  };
  matchedBooks: MatchedBookItem[];
  matchedQuotes: MatchedQuoteItem[];
  matchedCharacters: MatchedCharacterItem[];
  matchedNotes: MatchedNoteItem[];
}

export interface DeepLibrarySearchParams {
  query: string;
  scope?: SearchScope;
  books: Book[];
  quotes: BookQuote[];
  logs?: ReadingLog[];
}

const DIACRITIC_CHAR_MAP: Record<string, string> = {
  a: '[aáàäâãåā]',
  e: '[eéèëêē]',
  i: '[iíìïîī]',
  o: '[oóòöôõō]',
  u: '[uúùüûū]',
  n: '[nñ]',
  c: '[cç]',
};

/**
 * Normaliza una cadena eliminando marcas diacriticas (acentos, tildes, dieresis)
 * mediante descomposicion Unicode NFD y conversion a minusculas.
 */
export function normalizeDiacritics(input: string): string {
  if (!input) return '';
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Escapa caracteres especiales de expresiones regulares.
 */
function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Construye un patron de expresion regular insensible a diacriticos y mayusculas.
 */
function buildDiacriticRegex(normalizedQuery: string): RegExp | null {
  if (!normalizedQuery) return null;

  try {
    let pattern = '';
    for (const char of normalizedQuery) {
      if (DIACRITIC_CHAR_MAP[char]) {
        pattern += DIACRITIC_CHAR_MAP[char];
      } else if (/\s/.test(char)) {
        pattern += '\\s+';
      } else {
        pattern += escapeRegex(char);
      }
    }
    return new RegExp(pattern, 'i');
  } catch {
    return null;
  }
}

/**
 * Encuentra la coincidencia de una consulta ignorando acentos y mayusculas
 * y extrae un fragmento de texto contextual resaltando la coincidencia original.
 */
export function buildHighlightedSnippet(
  text: string,
  query: string,
  maxLength: number = 120
): HighlightedSnippet {
  if (!text) {
    return { before: '', match: '', after: '', hasMatch: false };
  }

  const cleanQuery = query.trim();
  const normalizedQuery = normalizeDiacritics(cleanQuery);

  if (!normalizedQuery) {
    const isTruncated = text.length > maxLength;
    return {
      before: isTruncated ? text.slice(0, maxLength) + '...' : text,
      match: '',
      after: '',
      hasMatch: false,
    };
  }

  const regex = buildDiacriticRegex(normalizedQuery);
  const matchResult = regex ? regex.exec(text) : null;

  if (!matchResult || matchResult.index === undefined) {
    const isTruncated = text.length > maxLength;
    return {
      before: isTruncated ? text.slice(0, maxLength) + '...' : text,
      match: '',
      after: '',
      hasMatch: false,
    };
  }

  const startIndex = matchResult.index;
  const matchText = matchResult[0];
  const endIndex = startIndex + matchText.length;

  const matchLength = matchText.length;
  const availableContext = Math.max(0, maxLength - matchLength);
  const contextBefore = Math.floor(availableContext / 2);
  const contextAfter = availableContext - contextBefore;

  const sliceStart = Math.max(0, startIndex - contextBefore);
  const sliceEnd = Math.min(text.length, endIndex + contextAfter);

  const prefix = sliceStart > 0 ? '...' : '';
  const suffix = sliceEnd < text.length ? '...' : '';

  return {
    before: prefix + text.slice(sliceStart, startIndex),
    match: matchText,
    after: text.slice(endIndex, sliceEnd) + suffix,
    hasMatch: true,
  };
}

/**
 * Parsea de forma segura el arreglo JSON de autores.
 */
function parseAuthorsList(authorsJson: string | null | undefined): string[] {
  if (!authorsJson) return [];
  try {
    const parsed = JSON.parse(authorsJson);
    if (Array.isArray(parsed)) {
      return parsed.map((a) => String(a).trim()).filter(Boolean);
    }
  } catch {
    return authorsJson.split(',').map((a) => a.trim()).filter(Boolean);
  }
  return [];
}

/**
 * Servicio de busqueda profunda local con soporte para insensibilidad a acentos,
 * busqueda multi-entidad (libros, citas, personajes y notas) y preservacion de spoilers.
 */
export class DeepLibrarySearchService {
  /**
   * Realiza una busqueda profunda en las colecciones locales de libros, citas y notas.
   */
  static searchLocalLibrary(params: DeepLibrarySearchParams): DeepSearchResult {
    const { query, scope = 'ALL', books, quotes, logs = [] } = params;
    const cleanQuery = query.trim();
    const normalizedQuery = normalizeDiacritics(cleanQuery);

    if (!normalizedQuery) {
      return {
        query,
        scope,
        counts: { total: 0, books: 0, quotes: 0, characters: 0, notes: 0 },
        matchedBooks: [],
        matchedQuotes: [],
        matchedCharacters: [],
        matchedNotes: [],
      };
    }

    const bookMap = new Map(books.map((b) => [b.id, b]));

    // 1. Busqueda en libros locales (title, subtitle, authorsJson, publisher, seriesName, description)
    const allMatchedBooks: MatchedBookItem[] = [];
    for (const book of books) {
      const normalizedTitle = normalizeDiacritics(book.title);
      const authors = parseAuthorsList(book.authorsJson);
      const matchedAuthor = authors.find((author) =>
        normalizeDiacritics(author).includes(normalizedQuery)
      );
      const normalizedSeries = book.seriesName ? normalizeDiacritics(book.seriesName) : '';
      const normalizedSubtitle = book.subtitle ? normalizeDiacritics(book.subtitle) : '';
      const normalizedPublisher = book.publisher ? normalizeDiacritics(book.publisher) : '';
      const normalizedDescription = book.description ? normalizeDiacritics(book.description) : '';

      if (normalizedTitle.includes(normalizedQuery)) {
        allMatchedBooks.push({
          ...book,
          book,
          matchedField: 'title',
          snippet: buildHighlightedSnippet(book.title, cleanQuery),
        });
      } else if (matchedAuthor) {
        allMatchedBooks.push({
          ...book,
          book,
          matchedField: 'authors',
          snippet: buildHighlightedSnippet(matchedAuthor, cleanQuery),
        });
      } else if (normalizedSeries.includes(normalizedQuery) && book.seriesName) {
        allMatchedBooks.push({
          ...book,
          book,
          matchedField: 'seriesName',
          snippet: buildHighlightedSnippet(book.seriesName, cleanQuery),
        });
      } else if (normalizedSubtitle.includes(normalizedQuery) && book.subtitle) {
        allMatchedBooks.push({
          ...book,
          book,
          matchedField: 'subtitle',
          snippet: buildHighlightedSnippet(book.subtitle, cleanQuery),
        });
      } else if (normalizedPublisher.includes(normalizedQuery) && book.publisher) {
        allMatchedBooks.push({
          ...book,
          book,
          matchedField: 'publisher',
          snippet: buildHighlightedSnippet(book.publisher, cleanQuery),
        });
      } else if (normalizedDescription.includes(normalizedQuery) && book.description) {
        allMatchedBooks.push({
          ...book,
          book,
          matchedField: 'description',
          snippet: buildHighlightedSnippet(book.description, cleanQuery),
        });
      }
    }

    // 2. Busqueda en citas (quotes donde entryType === 'QUOTE')
    const allMatchedQuotes: MatchedQuoteItem[] = [];
    for (const quote of quotes) {
      if (quote.entryType !== 'QUOTE') continue;

      const normContent = normalizeDiacritics(quote.content);
      const normNote = quote.personalNote ? normalizeDiacritics(quote.personalNote) : '';
      const normChapter = quote.chapterOrSection ? normalizeDiacritics(quote.chapterOrSection) : '';

      if (normContent.includes(normalizedQuery)) {
        allMatchedQuotes.push({
          ...quote,
          quote,
          book: bookMap.get(quote.bookId),
          matchedField: 'content',
          snippet: buildHighlightedSnippet(quote.content, cleanQuery),
          isSpoiler: Boolean(quote.isSpoiler),
        });
      } else if (normNote.includes(normalizedQuery) && quote.personalNote) {
        allMatchedQuotes.push({
          ...quote,
          quote,
          book: bookMap.get(quote.bookId),
          matchedField: 'personalNote',
          snippet: buildHighlightedSnippet(quote.personalNote, cleanQuery),
          isSpoiler: Boolean(quote.isSpoiler),
        });
      } else if (normChapter.includes(normalizedQuery) && quote.chapterOrSection) {
        allMatchedQuotes.push({
          ...quote,
          quote,
          book: bookMap.get(quote.bookId),
          matchedField: 'chapterOrSection',
          snippet: buildHighlightedSnippet(quote.chapterOrSection, cleanQuery),
          isSpoiler: Boolean(quote.isSpoiler),
        });
      }
    }

    // 3. Busqueda en personajes y glosario (entryType === 'CHARACTER' || entryType === 'GLOSSARY')
    const allMatchedCharacters: MatchedCharacterItem[] = [];
    for (const quote of quotes) {
      if (quote.entryType !== 'CHARACTER' && quote.entryType !== 'GLOSSARY') continue;

      const normContent = normalizeDiacritics(quote.content);
      const normNote = quote.personalNote ? normalizeDiacritics(quote.personalNote) : '';
      const normChapter = quote.chapterOrSection ? normalizeDiacritics(quote.chapterOrSection) : '';

      if (normContent.includes(normalizedQuery)) {
        allMatchedCharacters.push({
          ...quote,
          quote,
          book: bookMap.get(quote.bookId),
          matchedField: 'content',
          snippet: buildHighlightedSnippet(quote.content, cleanQuery),
          isSpoiler: Boolean(quote.isSpoiler),
          entryType: quote.entryType as 'CHARACTER' | 'GLOSSARY',
        });
      } else if (normNote.includes(normalizedQuery) && quote.personalNote) {
        allMatchedCharacters.push({
          ...quote,
          quote,
          book: bookMap.get(quote.bookId),
          matchedField: 'personalNote',
          snippet: buildHighlightedSnippet(quote.personalNote, cleanQuery),
          isSpoiler: Boolean(quote.isSpoiler),
          entryType: quote.entryType as 'CHARACTER' | 'GLOSSARY',
        });
      } else if (normChapter.includes(normalizedQuery) && quote.chapterOrSection) {
        allMatchedCharacters.push({
          ...quote,
          quote,
          book: bookMap.get(quote.bookId),
          matchedField: 'chapterOrSection',
          snippet: buildHighlightedSnippet(quote.chapterOrSection, cleanQuery),
          isSpoiler: Boolean(quote.isSpoiler),
          entryType: quote.entryType as 'CHARACTER' | 'GLOSSARY',
        });
      }
    }

    // 4. Busqueda en notas (pauseOrDnfNote de libros, quotes con entryType === 'NOTE', y reviews de logs)
    const allMatchedNotes: MatchedNoteItem[] = [];

    // 4a. Notas de pausa o abandono en libros (preservando isSpoiler del libro)
    for (const book of books) {
      if (book.pauseOrDnfNote) {
        const normNote = normalizeDiacritics(book.pauseOrDnfNote);
        if (normNote.includes(normalizedQuery)) {
          allMatchedNotes.push({
            id: `note_book_${book.id}`,
            sourceType: 'BOOK_PAUSE_OR_DNF',
            bookId: book.id,
            book,
            matchedField: 'pauseOrDnfNote',
            content: book.pauseOrDnfNote,
            snippet: buildHighlightedSnippet(book.pauseOrDnfNote, cleanQuery),
            isSpoiler: Boolean(book.isSpoiler),
          });
        }
      }
    }

    // 4b. Citas de tipo nota (entryType === 'NOTE', preservando isSpoiler de la cita)
    for (const quote of quotes) {
      if (quote.entryType !== 'NOTE') continue;

      const normContent = normalizeDiacritics(quote.content);
      const normNote = quote.personalNote ? normalizeDiacritics(quote.personalNote) : '';

      if (normContent.includes(normalizedQuery)) {
        allMatchedNotes.push({
          id: quote.id,
          sourceType: 'QUOTE_NOTE',
          bookId: quote.bookId,
          book: bookMap.get(quote.bookId),
          quote,
          matchedField: 'content',
          content: quote.content,
          snippet: buildHighlightedSnippet(quote.content, cleanQuery),
          isSpoiler: Boolean(quote.isSpoiler),
        });
      } else if (normNote.includes(normalizedQuery) && quote.personalNote) {
        allMatchedNotes.push({
          id: quote.id,
          sourceType: 'QUOTE_NOTE',
          bookId: quote.bookId,
          book: bookMap.get(quote.bookId),
          quote,
          matchedField: 'personalNote',
          content: quote.personalNote,
          snippet: buildHighlightedSnippet(quote.personalNote, cleanQuery),
          isSpoiler: Boolean(quote.isSpoiler),
        });
      }
    }

    // 4c. Resenas en registros de lectura
    for (const log of logs) {
      if (log.review) {
        const normReview = normalizeDiacritics(log.review);
        if (normReview.includes(normalizedQuery)) {
          allMatchedNotes.push({
            id: log.id,
            sourceType: 'READING_LOG_REVIEW',
            bookId: log.bookId,
            book: bookMap.get(log.bookId),
            log,
            matchedField: 'review',
            content: log.review,
            snippet: buildHighlightedSnippet(log.review, cleanQuery),
            isSpoiler: false,
          });
        }
      }
    }

    const counts = {
      total:
        allMatchedBooks.length +
        allMatchedQuotes.length +
        allMatchedCharacters.length +
        allMatchedNotes.length,
      books: allMatchedBooks.length,
      quotes: allMatchedQuotes.length,
      characters: allMatchedCharacters.length,
      notes: allMatchedNotes.length,
    };

    return {
      query,
      scope,
      counts,
      matchedBooks: scope === 'ALL' || scope === 'BOOKS' ? allMatchedBooks : [],
      matchedQuotes: scope === 'ALL' || scope === 'QUOTES' ? allMatchedQuotes : [],
      matchedCharacters: scope === 'ALL' || scope === 'CHARACTERS' ? allMatchedCharacters : [],
      matchedNotes: scope === 'ALL' || scope === 'NOTES' ? allMatchedNotes : [],
    };
  }
}

export const searchLocalLibrary = DeepLibrarySearchService.searchLocalLibrary;
