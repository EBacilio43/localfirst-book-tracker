import { GoogleBooksResponseSchema } from '../schemas/apiSchemas';
import { NormalizedBookCandidate } from '../types';
import { normalizeTitle, ensureHttpsCoverUrl } from '../utils/textNormalization';

export class GoogleBooksService {
  private static readonly BASE_URL = 'https://www.googleapis.com/books/v1/volumes';

  /**
   * Consulta Google Books API por ISBN-13 o ISBN-10 con validación Zod y timeout de red.
   */
  static async searchByIsbn(isbn: string, timeoutMs: number = 4000): Promise<NormalizedBookCandidate | null> {
    const cleanIsbn = isbn.replace(/[-\s]/g, '');
    const url = `${this.BASE_URL}?q=isbn:${cleanIsbn}`;

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
      const parseResult = GoogleBooksResponseSchema.safeParse(rawJson);

      if (!parseResult.success || !parseResult.data.items || parseResult.data.items.length === 0) {
        return null;
      }

      const item = parseResult.data.items[0];
      const info = item.volumeInfo;

      let isbn10: string | undefined;
      let isbn13: string = cleanIsbn;

      if (info.industryIdentifiers) {
        for (const id of info.industryIdentifiers) {
          if (id.type === 'ISBN_10') isbn10 = id.identifier;
          if (id.type === 'ISBN_13') isbn13 = id.identifier;
        }
      }

      const cover =
        info.imageLinks?.thumbnail ||
        info.imageLinks?.smallThumbnail;

      return {
        isbn13,
        isbn10,
        title: normalizeTitle(info.title),
        subtitle: info.subtitle ? normalizeTitle(info.subtitle) : undefined,
        authors: info.authors && info.authors.length > 0 ? info.authors : ['Autor desconocido'],
        publisher: info.publisher?.trim(),
        description: info.description?.trim(),
        coverUri: ensureHttpsCoverUrl(cover),
        pageCount: Math.max(0, info.pageCount || 0),
        language: info.language || 'es',
        publishedYear: info.publishedDate ? parseInt(info.publishedDate.substring(0, 4), 10) || undefined : undefined,
        source: 'GOOGLE_BOOKS',
      };
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }
}
