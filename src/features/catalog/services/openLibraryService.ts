import { OpenLibraryResponseSchema } from '../schemas/apiSchemas';
import { NormalizedBookCandidate } from '../types';
import { normalizeTitle, ensureHttpsCoverUrl } from '../utils/textNormalization';

export class OpenLibraryService {
  private static readonly BASE_URL = 'https://openlibrary.org/api/books';

  /**
   * Consulta Open Library API por ISBN con validación Zod y extracción de portada de alta resolución.
   */
  static async searchByIsbn(isbn: string, timeoutMs: number = 4000): Promise<NormalizedBookCandidate | null> {
    const cleanIsbn = isbn.replace(/[-\s]/g, '');
    const bibkey = `ISBN:${cleanIsbn}`;
    const url = `${this.BASE_URL}?bibkeys=${bibkey}&format=json&jscmd=data`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        return null;
      }

      const rawJson = await response.json();
      const parseResult = OpenLibraryResponseSchema.safeParse(rawJson);

      if (!parseResult.success) {
        return null;
      }

      const bookData = parseResult.data[bibkey];
      if (!bookData) {
        return null;
      }

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
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }
}
