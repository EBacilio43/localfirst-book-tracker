import { GoogleBooksService } from './googleBooksService';
import { OpenLibraryService } from './openLibraryService';
import { CatalogLookupResult, NormalizedBookCandidate } from '../types';
import { parseAndValidateIsbn } from '../utils/isbn';

export class CatalogResolver {
  /**
   * Resuelve los metadatos de un libro por ISBN utilizando una cascada concurrente
   * con fusión campo por campo (Field-Level Merge) entre Google Books y Open Library.
   */
  static async resolveByIsbn(rawIsbn: string): Promise<CatalogLookupResult> {
    const { isValid, isbn13, isStoreCode } = parseAndValidateIsbn(rawIsbn);

    if (isStoreCode) {
      return {
        success: false,
        book: null,
        error: 'STORE_BARCODE',
        candidatesCount: 0,
      };
    }

    if (!isValid || !isbn13) {
      return {
        success: false,
        book: null,
        error: 'INVALID_ISBN',
        candidatesCount: 0,
      };
    }

    // Ejecución concurrente hacia ambos catálogos para minimizar latencia
    const [googleResult, openLibResult] = await Promise.allSettled([
      GoogleBooksService.searchByIsbn(isbn13),
      OpenLibraryService.searchByIsbn(isbn13),
    ]);

    const googleBook = googleResult.status === 'fulfilled' ? googleResult.value : null;
    const openLibBook = openLibResult.status === 'fulfilled' ? openLibResult.value : null;

    if (!googleBook && !openLibBook) {
      return {
        success: false,
        book: null,
        error: 'NOT_FOUND_OR_OFFLINE',
        candidatesCount: 0,
      };
    }

    // Fusión de campos si ambos respondieron
    if (googleBook && openLibBook) {
      const mergedBook = this.mergeCandidates(googleBook, openLibBook);
      return {
        success: true,
        book: mergedBook,
        candidatesCount: 2,
      };
    }

    const singleBook = googleBook || openLibBook!;
    return {
      success: true,
      book: singleBook,
      candidatesCount: 1,
    };
  }

  /**
   * Fusiona los mejores campos disponibles entre Google Books y Open Library.
   */
  static mergeCandidates(
    google: NormalizedBookCandidate,
    openLib: NormalizedBookCandidate
  ): NormalizedBookCandidate {
    // 1. Título y subtítulo
    const title = google.title && google.title !== 'Sin título' ? google.title : openLib.title;
    const subtitle = google.subtitle || openLib.subtitle;

    // 2. Autores
    const authors =
      google.authors.length > 0 && google.authors[0] !== 'Autor desconocido'
        ? google.authors
        : openLib.authors;

    // 3. Editorial exacta
    const publisher = google.publisher || openLib.publisher;

    // 4. Sinopsis (Google Books suele ser mucho más completo)
    const description = google.description || openLib.description;

    // 5. Portada (Prioriza Open Library si tiene cover L/M de mayor nitidez editorial, o Google Books)
    const coverUri = openLib.coverUri || google.coverUri;

    // 6. Páginas (evita 0 o valores negativos)
    const pageCount = google.pageCount > 0 ? google.pageCount : openLib.pageCount;

    return {
      isbn13: google.isbn13,
      isbn10: google.isbn10,
      title,
      subtitle,
      authors,
      publisher,
      description,
      coverUri,
      pageCount,
      language: google.language || openLib.language,
      publishedYear: google.publishedYear || openLib.publishedYear,
      source: 'MERGED',
    };
  }
}
