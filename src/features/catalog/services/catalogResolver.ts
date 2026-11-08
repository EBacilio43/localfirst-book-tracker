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
      // 3. Fallback inteligente con Gemini si las APIs tradicionales no lo tienen
      const geminiBook = await this.resolveWithGeminiFallback(isbn13);
      if (geminiBook) {
        return {
          success: true,
          book: geminiBook,
          candidatesCount: 1,
        };
      }

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

  /**
   * Resuelve libros por ISBN usando Gemini 3.8 Flash como tercer nivel de rescate
   * cuando las APIs tradicionales no cuentan con el ejemplar.
   */
  static async resolveWithGeminiFallback(
    isbn13: string
  ): Promise<NormalizedBookCandidate | null> {
    const apiKey =
      typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_GEMINI_API_KEY;
    if (!apiKey) return null;

    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${encodeURIComponent(
        apiKey
      )}`;
      const prompt = `Identifica el libro con ISBN ${isbn13}. Responde UNICAMENTE con un objeto JSON valido con los campos: "title" (string o null si no existe), "subtitle" (string o null), "authors" (array de strings), "publisher" (string o null), "pageCount" (number o 0), "description" (string o null), "publishedYear" (number o null).`;

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 6000);

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.1,
          },
        }),
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (!res.ok) return null;
      const data = await res.json();
      const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawText) return null;

      const parsed = JSON.parse(rawText);
      if (!parsed.title) return null;

      return {
        isbn13,
        title: parsed.title,
        subtitle: parsed.subtitle || undefined,
        authors:
          Array.isArray(parsed.authors) && parsed.authors.length > 0
            ? parsed.authors
            : ['Autor desconocido'],
        publisher: parsed.publisher || undefined,
        description: parsed.description || undefined,
        pageCount:
          typeof parsed.pageCount === 'number' && parsed.pageCount > 0
            ? parsed.pageCount
            : 0,
        publishedYear:
          typeof parsed.publishedYear === 'number'
            ? parsed.publishedYear
            : undefined,
        language: 'es',
        source: 'MERGED',
      };
    } catch {
      return null;
    }
  }
}
