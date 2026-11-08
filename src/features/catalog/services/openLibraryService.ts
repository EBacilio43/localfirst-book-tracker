import { OpenLibraryResponseSchema } from '../schemas/apiSchemas';
import { NormalizedBookCandidate } from '../types';
import { normalizeTitle, ensureHttpsCoverUrl } from '../utils/textNormalization';

export class OpenLibraryService {
  private static readonly BASE_URL = 'https://openlibrary.org/api/books';
  private static readonly SEARCH_URL = 'https://openlibrary.org/search.json';

  /**
   * Consulta Open Library API por ISBN con validación Zod, fallback a Search API
   * y extracción de portada de alta resolución.
   */
  static async searchByIsbn(isbn: string, timeoutMs: number = 8000): Promise<NormalizedBookCandidate | null> {
    const cleanIsbn = isbn.replace(/[-\s]/g, '');
    const bibkey = `ISBN:${cleanIsbn}`;
    const url = `${this.BASE_URL}?bibkeys=${bibkey}&format=json&jscmd=data`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      // 1. Intento principal con Books API estructurada
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
        },
      });

      if (response.ok) {
        const rawJson = await response.json();
        const parseResult = OpenLibraryResponseSchema.safeParse(rawJson);

        if (parseResult.success) {
          const bookData = parseResult.data[bibkey];
          if (bookData) {
            const authors =
              bookData.authors && bookData.authors.length > 0
                ? bookData.authors.map((a) => a.name.trim()).filter(Boolean)
                : ['Autor desconocido'];

            const publisher =
              bookData.publishers && bookData.publishers.length > 0
                ? bookData.publishers[0].name.trim()
                : undefined;

            const cover =
              bookData.cover?.large ||
              bookData.cover?.medium ||
              bookData.cover?.small;

            return {
              isbn13: cleanIsbn,
              title: normalizeTitle(bookData.title),
              subtitle: bookData.subtitle ? normalizeTitle(bookData.subtitle) : undefined,
              authors,
              publisher,
              coverUri: ensureHttpsCoverUrl(cover),
              pageCount: Math.max(0, bookData.number_of_pages || 0),
              language: 'es',
              publishedYear: bookData.publish_date
                ? parseInt(bookData.publish_date.replace(/\D/g, '').substring(0, 4), 10) || undefined
                : undefined,
              source: 'OPEN_LIBRARY',
            };
          }
        }
      }

      // 2. Fallback secundario a Open Library Search API
      const searchRes = await fetch(`${this.SEARCH_URL}?isbn=${cleanIsbn}`, {
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
        },
      });

      if (searchRes.ok) {
        const searchJson = await searchRes.json();
        if (searchJson.docs && searchJson.docs.length > 0) {
          const doc = searchJson.docs[0];
          const coverUri = doc.cover_i
            ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg`
            : undefined;

          return {
            isbn13: cleanIsbn,
            title: normalizeTitle(doc.title || 'Sin título'),
            subtitle: doc.subtitle ? normalizeTitle(doc.subtitle) : undefined,
            authors:
              doc.author_name && doc.author_name.length > 0
                ? doc.author_name
                : ['Autor desconocido'],
            publisher:
              doc.publisher && doc.publisher.length > 0
                ? doc.publisher[0]
                : undefined,
            coverUri: ensureHttpsCoverUrl(coverUri),
            pageCount: Math.max(0, doc.number_of_pages_median || 0),
            language: 'es',
            publishedYear: doc.first_publish_year || undefined,
            source: 'OPEN_LIBRARY',
          };
        }
      }

      return null;
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }
}
