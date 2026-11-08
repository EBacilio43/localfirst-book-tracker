import { GoogleBooksService } from './googleBooksService';
import { OpenLibraryService } from './openLibraryService';
import { CatalogLookupResult, NormalizedBookCandidate } from '../types';
import { parseAndValidateIsbn } from '../utils/isbn';
import { resolveImprintFromIsbn } from '../utils/isbnImprints';
import { API_KEYS } from '@/core/config/apiKeys';

/**
 * Comprueba si dos nombres de editorial coinciden de forma estricta o pertenecen al mismo grupo editorial.
 */
export function isPublisherMatch(candidatePub?: string, targetPub?: string): boolean {
  if (!candidatePub || !targetPub) return false;

  const normalize = (s: string) =>
    s
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '');

  const normCandidate = normalize(candidatePub);
  const normTarget = normalize(targetPub);

  if (!normCandidate || !normTarget) return false;

  // Coincidencia directa o inclusión de sub-cadenas (ej. "debolsillo" en "de bolsillo contemporanea")
  if (normCandidate.includes(normTarget) || normTarget.includes(normCandidate)) {
    return true;
  }

  // Grupos editoriales conocidos y sus sellos filiales
  const penguinGroup = ['debolsillo', 'penguin', 'penguinrandomhouse', 'randomhouse'];
  const isCandidatePenguin = penguinGroup.some((p) => normCandidate.includes(p));
  const isTargetPenguin = penguinGroup.some((p) => normTarget.includes(p));
  if (isCandidatePenguin && isTargetPenguin) {
    return true;
  }

  const planetaGroup = ['planeta', 'editorialplaneta', 'planetadelibros', 'seixbarral', 'destino', 'espasa'];
  const isCandidatePlaneta = planetaGroup.some((p) => normCandidate.includes(p));
  const isTargetPlaneta = planetaGroup.some((p) => normTarget.includes(p));
  if (isCandidatePlaneta && isTargetPlaneta) {
    return true;
  }

  return false;
}

/**
 * Detecta artefactos erróneos de distribuidores, exportadores o mayoristas que Google Books
 * asocia por error a libros en español (ej. "National Geographic Books" en libros de Penguin / Debolsillo).
 */
export function isDistributorArtifact(pub?: string): boolean {
  if (!pub) return false;
  const lower = pub.toLowerCase().trim();
  return (
    lower.includes('national geographic') ||
    lower.includes('distributor') ||
    lower.includes('distribuidora') ||
    lower.includes('baker & taylor') ||
    lower.includes('ingram') ||
    lower.includes('bookwire') ||
    lower.includes('unknown') ||
    lower.includes('editorial no especificada')
  );
}

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

    let finalBook: NormalizedBookCandidate;

    if (!googleBook && !openLibBook) {
      // 3. Fallback inteligente con Gemini si las APIs tradicionales no lo tienen
      const geminiBook = await this.resolveWithGeminiFallback(isbn13);
      if (geminiBook) {
        finalBook = geminiBook;
      } else {
        return {
          success: false,
          book: null,
          error: 'NOT_FOUND_OR_OFFLINE',
          candidatesCount: 0,
        };
      }
    } else if (googleBook && openLibBook) {
      finalBook = this.mergeCandidates(googleBook, openLibBook);
    } else {
      finalBook = googleBook || openLibBook!;
    }

    // 1. Resolver sello exacto a partir del prefijo de registro ISBN o corregir distribuidores (instantáneo y offline)
    const exactImprint = resolveImprintFromIsbn(isbn13, finalBook.title, finalBook.publisher);
    if (exactImprint) {
      finalBook = {
        ...finalBook,
        publisher: exactImprint,
      };
    }

    // 2. Enriquecer editorial y sinopsis con Gemini si aún falta alguno de estos campos
    const isPublisherMissing =
      !finalBook.publisher ||
      finalBook.publisher.trim() === '' ||
      finalBook.publisher === 'Editorial no especificada' ||
      isDistributorArtifact(finalBook.publisher);
    const isDescriptionMissing =
      !finalBook.description || finalBook.description.trim() === '';

    if (isPublisherMissing || isDescriptionMissing) {
      try {
        const enriched = await this.enrichMetadataWithGemini(
          isbn13,
          finalBook.title,
          finalBook.authors?.[0]
        );
        if (enriched) {
          finalBook = {
            ...finalBook,
            publisher:
              isPublisherMissing && enriched.publisher
                ? enriched.publisher
                : finalBook.publisher,
            description:
              isDescriptionMissing && enriched.description
                ? enriched.description
                : finalBook.description,
          };
        }
      } catch {
        // Enriquecimiento opcional sin bloquear
      }
    }

    // 2. Garantizar portadas alternativas y portada principal
    const initialCovers: string[] = [];
    // Prioridad #1: Portada directa de Google Books para este ISBN específico (modelo Bookmory)
    if (googleBook?.coverUri) initialCovers.push(googleBook.coverUri);
    // Prioridad #2: Portada de Open Library para este ISBN si existe y es diferente
    if (openLibBook?.coverUri && !initialCovers.includes(openLibBook.coverUri)) {
      initialCovers.push(openLibBook.coverUri);
    }
    if (finalBook.coverUri && !initialCovers.includes(finalBook.coverUri)) {
      initialCovers.push(finalBook.coverUri);
    }

    const alternativeCovers = await this.fetchAlternativeCovers(
      isbn13,
      finalBook.title,
      finalBook.authors?.[0],
      finalBook.publisher,
      initialCovers
    );

    const primaryCover =
      alternativeCovers.length > 0
        ? alternativeCovers[0]
        : finalBook.coverUri;

    finalBook = {
      ...finalBook,
      coverUri: primaryCover,
      alternativeCovers,
    };

    return {
      success: true,
      book: finalBook,
      candidatesCount: googleBook && openLibBook ? 2 : 1,
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

    // 3. Editorial exacta (descarta artefactos de distribuidores como National Geographic Books y prioriza sellos editoriales reales)
    const validOpenLibPub =
      openLib.publisher && !isDistributorArtifact(openLib.publisher)
        ? openLib.publisher
        : undefined;

    const validGooglePub =
      google.publisher && !isDistributorArtifact(google.publisher)
        ? google.publisher
        : undefined;

    const publisher = validOpenLibPub || validGooglePub;

    // 4. Sinopsis (Google Books suele ser mucho más completo)
    const description = google.description || openLib.description;

    // 5. Portada (Prioriza Google Books porque su consulta es por el ISBN exacto del ejemplar, o Open Library si Google Books no tuviera imagen)
    const coverUri = google.coverUri || openLib.coverUri;

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
    const apiKey = API_KEYS.gemini;
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

  /**
   * Enriquece editorial y sinopsis faltantes usando Gemini 3.8 Flash.
   */
  static async enrichMetadataWithGemini(
    isbn13: string,
    title?: string,
    author?: string
  ): Promise<{ publisher?: string; description?: string } | null> {
    const apiKey = API_KEYS.gemini;
    if (!apiKey) return null;

    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${encodeURIComponent(
        apiKey
      )}`;
      const prompt = `Identifica el sello editorial exacto en español y sinopsis corta del libro con ISBN ${isbn13}${
        title ? ` ("${title}"${author ? ` de ${author}` : ''})` : ''
      }. Responde UNICAMENTE un JSON valido con los campos: "publisher" (nombre exacto del sello editorial, ej. Debolsillo, Penguin Clásicos, Alfaguara, Planeta, Alianza, etc. No respondas nombres de distribuidores o mayoristas como National Geographic Books), "description" (sinopsis breve de 2 a 4 oraciones, string o null).`;

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
      return {
        publisher:
          typeof parsed.publisher === 'string' && parsed.publisher.trim() !== ''
            ? parsed.publisher.trim()
            : undefined,
        description:
          typeof parsed.description === 'string' &&
          parsed.description.trim() !== ''
            ? parsed.description.trim()
            : undefined,
      };
    } catch {
      return null;
    }
  }

  /**
   * Obtiene un conjunto enriquecido de portadas alternativas para el libro.
   * Si se conoce la editorial, filtra EXCLUSIVAMENTE portadas de esa editorial,
   * manteniendo la lista concisa (máximo 4 a 5 opciones) con la portada del ISBN exacto en primer lugar.
   */
  static async fetchAlternativeCovers(
    isbn13: string,
    title?: string,
    author?: string,
    publisherOrInitialCovers?: string | Array<string | undefined | null>,
    maybeInitialCovers?: Array<string | undefined | null>
  ): Promise<string[]> {
    let publisher: string | undefined;
    let initialCovers: Array<string | undefined | null> = [];

    if (Array.isArray(publisherOrInitialCovers)) {
      initialCovers = publisherOrInitialCovers;
    } else if (typeof publisherOrInitialCovers === 'string') {
      publisher =
        publisherOrInitialCovers !== 'Editorial no especificada'
          ? publisherOrInitialCovers.trim()
          : undefined;
      initialCovers = maybeInitialCovers || [];
    } else {
      initialCovers = maybeInitialCovers || [];
    }

    const cleanIsbn = isbn13.replace(/[-\s]/g, '');
    const publisherCovers = new Set<string>();
    const generalCovers = new Set<string>();

    // 1. Agregar portadas directas del ISBN exacto (Google Books y Open Library para este ISBN)
    // El ISBN escaneado corresponde exactamente al libro en mano: su portada va en primer lugar (#1)
    for (const c of initialCovers) {
      if (c && typeof c === 'string' && c.trim() !== '') {
        const secureUrl = c.trim().replace(/^http:\/\//i, 'https://').replace('&edge=curl', '');
        publisherCovers.add(secureUrl);
      }
    }

    // 2. Verificar portada directa por ISBN en Open Library si aun no esta
    const directIsbnCover = `https://covers.openlibrary.org/b/isbn/${cleanIsbn}-L.jpg`;
    if (!publisherCovers.has(directIsbnCover) && typeof fetch !== 'undefined') {
      try {
        const olRes = await fetch(`${directIsbnCover}?default=false`, {
          method: 'HEAD',
        });
        if (olRes.ok) {
          publisherCovers.add(directIsbnCover);
        }
      } catch {
        // Silencioso ante fallas de red
      }
    }

    const cleanTitle =
      title && title !== 'Sin título' && title !== 'Libro sin conexión'
        ? title.trim()
        : '';

    if (cleanTitle && typeof fetch !== 'undefined') {
      const apiKey = API_KEYS.googleBooks;

      // 3. Consultar Google Books filtrando por editorial
      try {
        const query = publisher
          ? `intitle:"${cleanTitle}" inpublisher:"${publisher}"`
          : `intitle:"${cleanTitle}"`;

        const gbUrl = apiKey
          ? `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=8&printType=books&key=${encodeURIComponent(apiKey)}`
          : `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=8&printType=books`;

        const gbRes = await fetch(gbUrl);
        if (gbRes.ok) {
          const gbData = await gbRes.json();
          if (gbData.items && Array.isArray(gbData.items)) {
            for (const item of gbData.items) {
              const info = item.volumeInfo;
              const thumb =
                info?.imageLinks?.thumbnail ||
                info?.imageLinks?.smallThumbnail ||
                info?.imageLinks?.medium ||
                info?.imageLinks?.large;

              if (thumb && typeof thumb === 'string') {
                const secureThumb = thumb.replace(/^http:\/\//i, 'https://').replace('&edge=curl', '');
                const itemPub = info?.publisher || '';

                if (publisher && isPublisherMatch(itemPub, publisher)) {
                  publisherCovers.add(secureThumb);
                } else if (!publisher) {
                  generalCovers.add(secureThumb);
                }
              }
              if (publisherCovers.size >= 5) break;
            }
          }
        }
      } catch {
        // Silencioso ante fallas de red
      }

      // 4. Si aún tenemos menos de 4 portadas y hay editorial, consultar Open Library por esa editorial
      if (publisher && publisherCovers.size < 4) {
        try {
          const olUrl = `https://openlibrary.org/search.json?title=${encodeURIComponent(cleanTitle)}&publisher=${encodeURIComponent(publisher)}&limit=5`;
          const olRes = await fetch(olUrl);
          if (olRes.ok) {
            const olData = await olRes.json();
            if (olData.docs && Array.isArray(olData.docs)) {
              for (const doc of olData.docs) {
                const docPub = doc.publisher?.[0] || '';
                if (!docPub || isPublisherMatch(docPub, publisher)) {
                  if (doc.cover_i && typeof doc.cover_i === 'number' && doc.cover_i > 0) {
                    publisherCovers.add(`https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg`);
                  }
                }
                if (publisherCovers.size >= 5) break;
              }
            }
          }
        } catch {
          // Silencioso ante fallas de red
        }
      }
    }

    // Si identificamos la editorial, devolvemos EXCLUSIVAMENTE portadas de esa editorial (máx 5)
    if (publisher && publisherCovers.size > 0) {
      return Array.from(publisherCovers).slice(0, 5);
    }

    // Si no se identificó editorial, devolver las opciones generales (máx 5)
    return [...Array.from(publisherCovers), ...Array.from(generalCovers)].slice(0, 5);
  }

  /**
   * Resuelve la mejor portada individual en alta resolución.
   */
  static async resolveCoverUri(
    isbn13: string,
    title?: string,
    author?: string
  ): Promise<string | undefined> {
    const covers = await this.fetchAlternativeCovers(isbn13, title, author);
    return covers.length > 0 ? covers[0] : undefined;
  }
}
