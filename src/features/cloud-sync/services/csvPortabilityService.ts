import {
  isValidIsbn10,
  isValidIsbn13,
  convertIsbn10ToIsbn13,
} from '../../catalog/utils/isbn';

export interface ParsedCsvBookRow {
  title: string;
  authors: string[];
  isbn13: string | null;
  publisher: string | null;
  pageCount: number;
  currentStatus: 'POR_LEER' | 'LEYENDO' | 'LEIDO';
  rating: number | null;
  finishedAtLocalDate: string | null;
}

/**
 * Limpia y normaliza un codigo ISBN proveniente de un archivo CSV (incluyendo formulas Excel de Goodreads).
 * Remueve wrappers como '="9788437604947"', comillas, guiones y espacios.
 * Retorna un ISBN-13 limpio o null si es invalido o vacio.
 */
export function cleanCsvIsbn(rawIsbn?: string | null): string | null {
  if (!rawIsbn) return null;
  const clean = rawIsbn.replace(/[^0-9xX]/g, '').toUpperCase();
  if (!clean) return null;

  if (clean.length === 13) {
    if (isValidIsbn13(clean)) return clean;
    if (/^(978|979)\d{10}$/.test(clean)) return clean;
  }

  if (clean.length === 10 && isValidIsbn10(clean)) {
    return convertIsbn10ToIsbn13(clean);
  }

  return null;
}

/**
 * Tokenizador de lineas y campos CSV con soporte para campos entre comillas y saltos de linea.
 */
function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;
  let i = 0;

  while (i < text.length) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (inQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          currentField += '"';
          i += 2;
          continue;
        } else {
          inQuotes = false;
          i++;
          continue;
        }
      } else {
        currentField += char;
        i++;
        continue;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
        i++;
        continue;
      } else if (char === ',') {
        currentRow.push(currentField);
        currentField = '';
        i++;
        continue;
      } else if (char === '\r') {
        if (nextChar === '\n') {
          i++;
        }
        currentRow.push(currentField);
        currentField = '';
        if (currentRow.some((f) => f.trim().length > 0)) {
          rows.push(currentRow);
        }
        currentRow = [];
        i++;
        continue;
      } else if (char === '\n') {
        currentRow.push(currentField);
        currentField = '';
        if (currentRow.some((f) => f.trim().length > 0)) {
          rows.push(currentRow);
        }
        currentRow = [];
        i++;
        continue;
      } else {
        currentField += char;
        i++;
        continue;
      }
    }
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField);
    if (currentRow.some((f) => f.trim().length > 0)) {
      rows.push(currentRow);
    }
  }

  return rows;
}

function normalizeHeader(header: string): string {
  return header
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Parsea un archivo CSV proveniente de Goodreads o formato personalizado en espanol.
 * Soporta campos entre comillas con comas internas, valida ISBNs y descarta duplicados.
 */
export function parseGoodreadsOrCustomCsv(
  csvContent: string,
  existingIsbn13Set?: Set<string>
): {
  importedCandidates: ParsedCsvBookRow[];
  skippedDuplicatesCount: number;
  totalRowsRead: number;
} {
  const rows = parseCsvRows(csvContent);
  if (rows.length === 0) {
    return {
      importedCandidates: [],
      skippedDuplicatesCount: 0,
      totalRowsRead: 0,
    };
  }

  const headerRow = rows[0];
  let titleIdx = -1;
  let authorIdx = -1;
  let additionalAuthorsIdx = -1;
  let authorLfIdx = -1;
  let isbn13Idx = -1;
  let isbnIdx = -1;
  let publisherIdx = -1;
  let pagesIdx = -1;
  let statusIdx = -1;
  let ratingIdx = -1;
  let dateReadIdx = -1;

  for (let i = 0; i < headerRow.length; i++) {
    const h = normalizeHeader(headerRow[i]);
    if (isbn13Idx === -1 && (h === 'isbn13' || h === 'isbn-13' || h === 'isbn 13')) {
      isbn13Idx = i;
    } else if (isbnIdx === -1 && (h === 'isbn' || h === 'isbn10' || h === 'isbn-10')) {
      isbnIdx = i;
    } else if (titleIdx === -1 && (h === 'title' || h === 'titulo' || h === 'nombre')) {
      titleIdx = i;
    } else if (additionalAuthorsIdx === -1 && (h.includes('additional author') || h.includes('coautor'))) {
      additionalAuthorsIdx = i;
    } else if (authorLfIdx === -1 && h === 'author l-f') {
      authorLfIdx = i;
    } else if (authorIdx === -1 && (h === 'author' || h === 'autor' || h === 'autores' || h === 'authors')) {
      authorIdx = i;
    } else if (publisherIdx === -1 && (h === 'publisher' || h === 'editorial')) {
      publisherIdx = i;
    } else if (pagesIdx === -1 && (h.includes('pages') || h.includes('paginas') || h === 'num pages' || h === 'number of pages')) {
      pagesIdx = i;
    } else if (statusIdx === -1 && (h === 'exclusive shelf' || h === 'estado' || h === 'shelf' || h === 'estanteria')) {
      statusIdx = i;
    } else if (ratingIdx === -1 && (h === 'my rating' || h === 'calificacion' || h === 'rating' || h === 'puntuacion')) {
      ratingIdx = i;
    } else if (dateReadIdx === -1 && (h === 'date read' || (h.includes('fecha') && h.includes('lectura')) || h === 'finished at')) {
      dateReadIdx = i;
    }
  }

  if (titleIdx === -1) {
    titleIdx = 0;
  }

  const importedCandidates: ParsedCsvBookRow[] = [];
  const seenInBatch = new Set<string>();
  let skippedDuplicatesCount = 0;
  let totalRowsRead = 0;

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (row.length === 0 || row.every((col) => col.trim().length === 0)) {
      continue;
    }

    totalRowsRead++;

    const getField = (idx: number): string => (idx >= 0 && idx < row.length ? row[idx].trim() : '');

    const rawTitle = getField(titleIdx);
    const title = rawTitle.length > 0 ? rawTitle : 'Libro sin título';

    // Autores
    const authors: string[] = [];
    const primaryAuthor = getField(authorIdx) || (authorLfIdx >= 0 ? getField(authorLfIdx) : '');
    if (primaryAuthor) {
      if (primaryAuthor.includes(';')) {
        primaryAuthor.split(';').forEach((a) => {
          const trimmed = a.trim();
          if (trimmed.length > 0) authors.push(trimmed);
        });
      } else {
        authors.push(primaryAuthor);
      }
    }

    if (additionalAuthorsIdx >= 0) {
      const extra = getField(additionalAuthorsIdx);
      if (extra) {
        extra.split(/[,;]/).forEach((a) => {
          const trimmed = a.trim();
          if (trimmed.length > 0 && !authors.includes(trimmed)) {
            authors.push(trimmed);
          }
        });
      }
    }

    if (authors.length === 0) {
      authors.push('Autor no especificado');
    }

    // ISBN
    let cleanIsbn: string | null = null;
    if (isbn13Idx >= 0) {
      cleanIsbn = cleanCsvIsbn(getField(isbn13Idx));
    }
    if (!cleanIsbn && isbnIdx >= 0) {
      cleanIsbn = cleanCsvIsbn(getField(isbnIdx));
    }

    // Editorial
    const rawPublisher = publisherIdx >= 0 ? getField(publisherIdx) : '';
    const publisher = rawPublisher.length > 0 ? rawPublisher : null;

    // Paginas (siempre > 0, por defecto 200)
    let pageCount = 200;
    if (pagesIdx >= 0) {
      const parsedPages = parseInt(getField(pagesIdx), 10);
      if (!isNaN(parsedPages) && parsedPages > 0) {
        pageCount = parsedPages;
      }
    }

    // Estado de lectura
    let currentStatus: 'POR_LEER' | 'LEYENDO' | 'LEIDO' = 'POR_LEER';
    if (statusIdx >= 0) {
      const rawStatus = normalizeHeader(getField(statusIdx));
      if (rawStatus === 'read' || rawStatus === 'leido' || rawStatus === 'terminado') {
        currentStatus = 'LEIDO';
      } else if (
        rawStatus === 'currently-reading' ||
        rawStatus === 'currently reading' ||
        rawStatus === 'leyendo' ||
        rawStatus === 'en progreso'
      ) {
        currentStatus = 'LEYENDO';
      } else if (
        rawStatus === 'to-read' ||
        rawStatus === 'to read' ||
        rawStatus === 'por leer' ||
        rawStatus === 'por_leer' ||
        rawStatus === 'pendiente'
      ) {
        currentStatus = 'POR_LEER';
      }
    }

    // Calificacion
    let rating: number | null = null;
    if (ratingIdx >= 0) {
      const parsedRating = parseFloat(getField(ratingIdx));
      if (!isNaN(parsedRating) && parsedRating > 0) {
        rating = Math.min(5, Math.max(1, Math.round(parsedRating)));
      }
    }

    // Fecha de lectura
    let finishedAtLocalDate: string | null = null;
    if (dateReadIdx >= 0) {
      const rawDate = getField(dateReadIdx).replace(/\//g, '-').trim();
      const match = rawDate.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
      if (match) {
        const year = match[1];
        const month = match[2].padStart(2, '0');
        const day = match[3].padStart(2, '0');
        finishedAtLocalDate = `${year}-${month}-${day}`;
      }
    }

    // Verificacion de duplicados
    if (cleanIsbn) {
      if (existingIsbn13Set?.has(cleanIsbn) || seenInBatch.has(cleanIsbn)) {
        skippedDuplicatesCount++;
        continue;
      }
      seenInBatch.add(cleanIsbn);
    }

    importedCandidates.push({
      title,
      authors,
      isbn13: cleanIsbn,
      publisher,
      pageCount,
      currentStatus,
      rating,
      finishedAtLocalDate,
    });
  }

  return {
    importedCandidates,
    skippedDuplicatesCount,
    totalRowsRead,
  };
}

function escapeCsvField(val: string | number | null | undefined): string {
  if (val === null || val === undefined) return '""';
  const str = String(val);
  return `"${str.replace(/"/g, '""')}"`;
}

function parseAuthorsJson(authorsJson?: string | null): string {
  if (!authorsJson) return '';
  try {
    const parsed = JSON.parse(authorsJson);
    if (Array.isArray(parsed)) {
      return parsed.join(', ');
    }
    return String(parsed);
  } catch {
    return authorsJson;
  }
}

function formatStatusSpanish(status?: string | null): string {
  if (!status) return 'Por leer';
  switch (status.toUpperCase()) {
    case 'LEIDO':
      return 'Leído';
    case 'LEYENDO':
      return 'Leyendo';
    case 'POR_LEER':
    default:
      return 'Por leer';
  }
}

/**
 * Exporta una coleccion de libros a un archivo CSV con encabezados legibles en espanol.
 */
export function exportBooksToCsv(
  books: Array<{
    title: string;
    authorsJson?: string | null;
    isbn13?: string | null;
    publisher?: string | null;
    pageCount?: number | null;
    currentStatus?: string | null;
    rating?: number | null;
  }>
): string {
  const headers = [
    '"Título"',
    '"Autor"',
    '"ISBN"',
    '"Editorial"',
    '"Páginas"',
    '"Estado"',
    '"Calificación"',
  ];

  const rows = books.map((b) => {
    const authorStr = parseAuthorsJson(b.authorsJson);
    const pagesStr = b.pageCount && b.pageCount > 0 ? String(b.pageCount) : '';
    const statusStr = formatStatusSpanish(b.currentStatus);
    const ratingStr = b.rating != null ? String(b.rating) : '';

    return [
      escapeCsvField(b.title),
      escapeCsvField(authorStr),
      escapeCsvField(b.isbn13 ?? ''),
      escapeCsvField(b.publisher ?? ''),
      escapeCsvField(pagesStr),
      escapeCsvField(statusStr),
      escapeCsvField(ratingStr),
    ].join(',');
  });

  return [headers.join(','), ...rows].join('\r\n');
}
