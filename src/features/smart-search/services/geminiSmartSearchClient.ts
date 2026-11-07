import { Book } from '@/db/schema/books';
import { CatalogResolver } from '@/features/catalog/services/catalogResolver';
import {
  GeminiLiteraryCandidate,
  GeminiLiteraryResponseSchema,
  EnrichedLiteraryCandidate,
} from '../schemas/geminiSearchSchema';
import { normalizeDiacritics } from './deepLibrarySearchService';

export type GeminiSearchStatus = 'SUCCESS' | 'RATE_LIMIT' | 'ABORTED' | 'ERROR';

export interface SearchLiteraryParams {
  query: string;
  signal?: AbortSignal;
  apiKey?: string;
  proxyUrl?: string;
  localBooks?: Book[];
  resolveExternalCatalog?: (
    title: string,
    author: string
  ) => Promise<{
    coverUrl?: string | null;
    isbn13?: string | null;
    publisher?: string | null;
    pageCount?: number | null;
  } | null>;
}

export interface GeminiSearchResult {
  status: GeminiSearchStatus;
  candidates: EnrichedLiteraryCandidate[];
  errorMessage?: string;
}

function getEnvVar(name: string): string | undefined {
  if (typeof process !== 'undefined' && process.env) {
    return process.env[name];
  }
  return undefined;
}

interface DemoBookEntry {
  keywords: string[];
  candidate: GeminiLiteraryCandidate;
}

const DEMO_LITERARY_KNOWLEDGE_BASE: DemoBookEntry[] = [
  {
    keywords: ['soledad', 'macondo', 'buendia', 'aureliano', 'marquez', 'cien', 'mariposas'],
    candidate: {
      title: 'Cien años de soledad',
      author: 'Gabriel García Márquez',
      matchPercentage: 98,
      spoilerFreeReason:
        'Historia multigeneracional en el mítico pueblo de Macondo siguiendo a la estirpe de los Buendía y sus vivencias mágicas.',
      isbn13: '9788497592208',
      suggestedPublisher: 'Debolsillo',
      publicationYear: 1967,
    },
  },
  {
    keywords: ['laberinto', 'biblioteca', 'babel', 'espejos', 'ficciones', 'borges', 'aleph', 'infinito'],
    candidate: {
      title: 'Ficciones',
      author: 'Jorge Luis Borges',
      matchPercentage: 96,
      spoilerFreeReason:
        'Cuentos que exploran laberintos infinitos, bibliotecas universales, senderos que se bifurcan y paradojas filosóficas.',
      isbn13: '9788497594370',
      suggestedPublisher: 'Debolsillo',
      publicationYear: 1944,
    },
  },
  {
    keywords: ['pedro', 'paramo', 'comala', 'murmullos', 'rulfo', 'padre', 'muertos', 'fantasma'],
    candidate: {
      title: 'Pedro Páramo',
      author: 'Juan Rulfo',
      matchPercentage: 97,
      spoilerFreeReason:
        'Un joven viaja al pueblo desértico de Comala en busca de su padre, descubriendo un lugar suspendido en el tiempo y habitado por ecos.',
      isbn13: '9788437604183',
      suggestedPublisher: 'Cátedra',
      publicationYear: 1955,
    },
  },
  {
    keywords: ['rayuela', 'maga', 'paris', 'oliveira', 'cortazar', 'cronopio', 'buenos aires', 'jazz'],
    candidate: {
      title: 'Rayuela',
      author: 'Julio Cortázar',
      matchPercentage: 95,
      spoilerFreeReason:
        'Novela transgresora con múltiples órdenes de lectura que sigue las derivas de Horacio Oliveira y la Maga entre París y Buenos Aires.',
      isbn13: '9788466331906',
      suggestedPublisher: 'Punto de Lectura',
      publicationYear: 1963,
    },
  },
  {
    keywords: ['quijote', 'sancho', 'molinos', 'cervantes', 'mancha', 'rocio', 'dulcinea', 'caballero'],
    candidate: {
      title: 'Don Quijote de la Mancha',
      author: 'Miguel de Cervantes',
      matchPercentage: 99,
      spoilerFreeReason:
        'Un hidalgo manchego pierde el juicio leyendo novelas de caballería y emprende aventuras cómicas e idealistas junto a su fiel escudero.',
      isbn13: '9788424115999',
      suggestedPublisher: 'Real Academia Española',
      publicationYear: 1605,
    },
  },
  {
    keywords: ['1984', 'orwell', 'gran hermano', 'distopia', 'ministerio', 'winston', 'pantalla', 'vigilancia'],
    candidate: {
      title: '1984',
      author: 'George Orwell',
      matchPercentage: 98,
      spoilerFreeReason:
        'Una sociedad totalitaria donde el Partido y el omnipresente Gran Hermano manipulan la historia, el lenguaje y el pensamiento.',
      isbn13: '9788499890944',
      suggestedPublisher: 'Debolsillo',
      publicationYear: 1949,
    },
  },
  {
    keywords: ['principito', 'rosa', 'zorro', 'asteroide', 'exupery', 'desierto', 'baobab', 'cordero'],
    candidate: {
      title: 'El principito',
      author: 'Antoine de Saint-Exupéry',
      matchPercentage: 99,
      spoilerFreeReason:
        'Un aviador varado en el desierto del Sahara entabla amistad con un pequeño viajero procedente de un diminuto asteroide.',
      isbn13: '9788498381498',
      suggestedPublisher: 'Salamandra',
      publicationYear: 1943,
    },
  },
  {
    keywords: ['metamorfosis', 'gregor', 'insecto', 'kafka', 'samsa', 'escarabajo', 'familia'],
    candidate: {
      title: 'La metamorfosis',
      author: 'Franz Kafka',
      matchPercentage: 98,
      spoilerFreeReason:
        'Un viajante de comercio despierta transformado en un insecto descomunal, alterando irreversiblemente la dinámica con su familia.',
      isbn13: '9788420651361',
      suggestedPublisher: 'Alianza Editorial',
      publicationYear: 1915,
    },
  },
  {
    keywords: ['sombra', 'viento', 'zafon', 'cementerio', 'libros olvidados', 'barcelona', 'carax'],
    candidate: {
      title: 'La sombra del viento',
      author: 'Carlos Ruiz Zafón',
      matchPercentage: 94,
      spoilerFreeReason:
        'En la Barcelona de posguerra, un joven halla un libro en el Cementerio de los Libros Olvidados que lo arrastra a un oscuro enigma del pasado.',
      isbn13: '9788408043645',
      suggestedPublisher: 'Planeta',
      publicationYear: 2001,
    },
  },
  {
    keywords: ['colera', 'florentino', 'fermina', 'amor', 'marquez', 'fluvial', 'barco'],
    candidate: {
      title: 'El amor en los tiempos del cólera',
      author: 'Gabriel García Márquez',
      matchPercentage: 93,
      spoilerFreeReason:
        'Un testimonio de fidelidad y devoción amorosa a lo largo de más de medio siglo en una ciudad portuaria caribeña.',
      isbn13: '9788497592451',
      suggestedPublisher: 'Debolsillo',
      publicationYear: 1985,
    },
  },
  {
    keywords: ['fahrenheit', 'bradbury', 'montag', 'bombero', 'quemar', '451', 'libros prohibidos'],
    candidate: {
      title: 'Fahrenheit 451',
      author: 'Ray Bradbury',
      matchPercentage: 92,
      spoilerFreeReason:
        'En un futuro distópico, los bomberos tienen la misión de quemar cualquier libro encontrado para suprimir el pensamiento crítico.',
      isbn13: '9788497592604',
      suggestedPublisher: 'Debolsillo',
      publicationYear: 1953,
    },
  },
  {
    keywords: ['tunel', 'castel', 'maria', 'sabato', 'pintor', 'obsesion', 'ventana'],
    candidate: {
      title: 'El túnel',
      author: 'Ernesto Sabato',
      matchPercentage: 91,
      spoilerFreeReason:
        'Confesión existencialista de un pintor solitario que cree haber encontrado en una mujer a la única persona capaz de comprenderlo.',
      isbn13: '9788432248382',
      suggestedPublisher: 'Seix Barral',
      publicationYear: 1948,
    },
  },
];

/**
 * Cliente del Detective Literario impulsado por Gemini 2.5 Flash y SQLite FTS5.
 * Resuelve libros a partir de recuerdos difusos, tramas o citas inexactas.
 */
export class GeminiSmartSearchClient {
  private static readonly OFFICIAL_GEMINI_ENDPOINT =
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

  /**
   * Resuelve candidatos heurísticos realistas validados por Zod cuando la app corre
   * en modo sin conexión o durante el desarrollo local sin variables de entorno de IA.
   */
  static resolveOfflineDemoCandidates(query: string): GeminiLiteraryCandidate[] {
    const cleanQuery = query.trim();
    const normalizedQuery = normalizeDiacritics(cleanQuery);

    if (!normalizedQuery) {
      return [];
    }

    const words = normalizedQuery.split(/\s+/).filter((w) => w.length > 2);

    // Puntuamos las coincidencias tematicas
    const scored = DEMO_LITERARY_KNOWLEDGE_BASE.map((entry) => {
      let score = 0;
      for (const keyword of entry.keywords) {
        const normKey = normalizeDiacritics(keyword);
        if (normalizedQuery.includes(normKey)) {
          score += 3;
        } else if (words.some((w) => normKey.includes(w) || w.includes(normKey))) {
          score += 1;
        }
      }
      return { entry, score };
    });

    scored.sort((a, b) => b.score - a.score);

    const matches = scored.filter((item) => item.score > 0);
    const selectedEntries =
      matches.length > 0
        ? matches.slice(0, 4).map((m) => m.entry.candidate)
        : DEMO_LITERARY_KNOWLEDGE_BASE.slice(0, 3).map((m, idx) => ({
            ...m.candidate,
            matchPercentage: Math.max(60, 85 - idx * 7),
          }));

    const validation = GeminiLiteraryResponseSchema.safeParse({
      candidates: selectedEntries,
    });

    if (validation.success) {
      return validation.data.candidates;
    }

    return selectedEntries;
  }

  /**
   * Cruce híbrido: verifica si los candidatos de IA ya existen en la biblioteca local del usuario
   * (por ISBN-13 o título normalizado) o consulta el catálogo externo para enriquecer portada y metadatos.
   */
  static async crossReferenceWithLibraryAndCatalog(
    candidates: GeminiLiteraryCandidate[],
    localBooks: Book[],
    resolveExternalCatalog?: (
      title: string,
      author: string
    ) => Promise<{
      coverUrl?: string | null;
      isbn13?: string | null;
      publisher?: string | null;
      pageCount?: number | null;
    } | null>
  ): Promise<EnrichedLiteraryCandidate[]> {
    const results: EnrichedLiteraryCandidate[] = [];

    for (const candidate of candidates) {
      const candidateIsbn = candidate.isbn13 ? candidate.isbn13.replace(/[-\s]/g, '').trim() : null;
      const candidateNormTitle = normalizeDiacritics(candidate.title);

      // 1. Verificar coincidencia en la biblioteca local del usuario
      const matchedLocalBook = localBooks.find((book) => {
        if (candidateIsbn && book.isbn13) {
          const bookIsbn = book.isbn13.replace(/[-\s]/g, '').trim();
          if (bookIsbn === candidateIsbn) return true;
        }
        return normalizeDiacritics(book.title) === candidateNormTitle;
      });

      if (matchedLocalBook) {
        results.push({
          ...candidate,
          inLocalLibrary: true,
          localBook: matchedLocalBook,
          coverUri: matchedLocalBook.coverUri ?? null,
          pageCount: matchedLocalBook.pageCount > 0 ? matchedLocalBook.pageCount : null,
          resolvedPublisher: matchedLocalBook.publisher ?? candidate.suggestedPublisher ?? null,
          resolvedIsbn13: matchedLocalBook.isbn13 ?? candidate.isbn13 ?? null,
        });
        continue;
      }

      // 2. Si no esta en la biblioteca local, resolver catalogo externo
      let externalCoverUri: string | null = null;
      let externalPublisher: string | null = candidate.suggestedPublisher ?? null;
      let externalIsbn13: string | null = candidate.isbn13 ?? null;
      let externalPageCount: number | null = null;

      if (resolveExternalCatalog) {
        try {
          const external = await resolveExternalCatalog(candidate.title, candidate.author);
          if (external) {
            externalCoverUri = external.coverUrl ?? null;
            externalPublisher = external.publisher ?? externalPublisher;
            externalIsbn13 = external.isbn13 ?? externalIsbn13;
            externalPageCount = external.pageCount ?? null;
          }
        } catch {
          // Mantener datos del candidato
        }
      } else if (candidate.isbn13) {
        try {
          const lookup = await CatalogResolver.resolveByIsbn(candidate.isbn13);
          if (lookup.success && lookup.book) {
            externalCoverUri = lookup.book.coverUri ?? null;
            externalPublisher = lookup.book.publisher ?? externalPublisher;
            externalIsbn13 = lookup.book.isbn13 ?? externalIsbn13;
            externalPageCount = lookup.book.pageCount > 0 ? lookup.book.pageCount : null;
          }
        } catch {
          // Fallback silencioso
        }
      }

      results.push({
        ...candidate,
        inLocalLibrary: false,
        coverUri: externalCoverUri,
        pageCount: externalPageCount,
        resolvedPublisher: externalPublisher,
        resolvedIsbn13: externalIsbn13,
      });
    }

    return results;
  }

  /**
   * Consulta al Detective Literario mediante Gemini 2.5 Flash o proxy seguro,
   * con soporte de cancelacion mediante AbortSignal y validacion Zod estricta.
   */
  static async search(params: SearchLiteraryParams): Promise<GeminiSearchResult> {
    const cleanQuery = params.query.trim();

    if (!cleanQuery) {
      return {
        status: 'SUCCESS',
        candidates: [],
      };
    }

    if (params.signal?.aborted) {
      return {
        status: 'ABORTED',
        candidates: [],
        errorMessage: 'Busqueda cancelada por el usuario.',
      };
    }

    const apiKey = params.apiKey ?? getEnvVar('EXPO_PUBLIC_GEMINI_API_KEY');
    const proxyUrl = params.proxyUrl ?? getEnvVar('EXPO_PUBLIC_GEMINI_PROXY_URL');

    // Si no hay API key ni proxy configurado, responder con catalogo demo heuristico
    if (!apiKey && !proxyUrl) {
      const demoCandidates = this.resolveOfflineDemoCandidates(cleanQuery);
      const enriched = await this.crossReferenceWithLibraryAndCatalog(
        demoCandidates,
        params.localBooks ?? [],
        params.resolveExternalCatalog
      );
      return {
        status: 'SUCCESS',
        candidates: enriched,
      };
    }

    const endpoint = proxyUrl || `${this.OFFICIAL_GEMINI_ENDPOINT}?key=${encodeURIComponent(apiKey || '')}`;

    const promptText = `Eres el Detective Literario de BaciBooks. Tu mision es descubrir que libro busca el lector basandote en recuerdos difusos, fragmentos de trama, frases recordadas o pistas tematicas.

Consulta del usuario:
"${cleanQuery}"

Instrucciones estrictas:
1. Responde UNICAMENTE con un objeto JSON valido con la clave "candidates".
2. Cada candidato debe tener los campos:
   - "title": titulo exacto de la obra.
   - "author": nombre del autor o autora principal.
   - "matchPercentage": numero entero entre 0 y 100 de probabilidad de coincidencia.
   - "spoilerFreeReason": explicacion concisa y SIN SPOILERS de por que coincide con la pista del usuario.
   - "isbn13": codigo ISBN-13 estandar si es conocido (o null).
   - "suggestedPublisher": editorial de referencia recomendada (o null).
   - "publicationYear": ano original de publicacion como numero entero (o null).
3. Proporciona entre 1 y 6 candidatos ordenados por matchPercentage de mayor a menor.
4. NO incluyas formato Markdown ni bloques de codigo con acentos graves. Devuelve exclusivamente JSON puro.`;

    const requestBody = proxyUrl
      ? { query: cleanQuery, prompt: promptText }
      : {
          contents: [
            {
              role: 'user',
              parts: [{ text: promptText }],
            },
          ],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.2,
          },
        };

    let response: Response;
    try {
      response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(requestBody),
        signal: params.signal,
      });
    } catch (err: unknown) {
      if (params.signal?.aborted || (err instanceof Error && err.name === 'AbortError')) {
        return {
          status: 'ABORTED',
          candidates: [],
          errorMessage: 'Busqueda cancelada por una nueva solicitud.',
        };
      }
      return {
        status: 'ERROR',
        candidates: [],
        errorMessage:
          err instanceof Error
            ? err.message
            : 'Error de conexion de red al contactar al Detective Literario.',
      };
    }

    if (params.signal?.aborted) {
      return {
        status: 'ABORTED',
        candidates: [],
        errorMessage: 'Busqueda cancelada por una nueva solicitud.',
      };
    }

    if (response.status === 429) {
      return {
        status: 'RATE_LIMIT',
        candidates: [],
        errorMessage:
          'Limite de peticiones alcanzado. Por favor, espera unos momentos antes de reintentar.',
      };
    }

    if (!response.ok) {
      return {
        status: 'ERROR',
        candidates: [],
        errorMessage: `Error en el servicio del detective literario (${response.status})`,
      };
    }

    let rawJson: unknown;
    try {
      rawJson = await response.json();
    } catch {
      return {
        status: 'ERROR',
        candidates: [],
        errorMessage: 'Respuesta invalida del servidor (no es JSON valido).',
      };
    }

    // Extraccion de la estructura segun sea API oficial de Gemini o proxy
    let candidatePayload: unknown = null;

    if (
      typeof rawJson === 'object' &&
      rawJson !== null &&
      'candidates' in rawJson &&
      Array.isArray((rawJson as { candidates: unknown }).candidates)
    ) {
      const firstCandidate = (rawJson as { candidates: unknown[] }).candidates[0];
      if (
        firstCandidate &&
        typeof firstCandidate === 'object' &&
        'content' in firstCandidate &&
        typeof (firstCandidate as { content: unknown }).content === 'object'
      ) {
        // Formato oficial de la API de Gemini
        const geminiContent = firstCandidate as {
          content?: { parts?: Array<{ text?: string }> };
        };
        const textContent = geminiContent.content?.parts?.[0]?.text;
        if (textContent) {
          try {
            const sanitized = textContent
              .replace(/^```json\s*/i, '')
              .replace(/^```\s*/i, '')
              .replace(/```\s*$/i, '')
              .trim();
            candidatePayload = JSON.parse(sanitized);
          } catch {
            return {
              status: 'ERROR',
              candidates: [],
              errorMessage: 'No se pudo interpretar el contenido JSON emitido por la IA.',
            };
          }
        }
      } else {
        // Formato devuelto por un proxy con estructura directa
        candidatePayload = rawJson;
      }
    } else if (typeof rawJson === 'object' && rawJson !== null && 'data' in rawJson) {
      candidatePayload = (rawJson as { data: unknown }).data;
    } else {
      candidatePayload = rawJson;
    }

    const validation = GeminiLiteraryResponseSchema.safeParse(candidatePayload);
    if (!validation.success) {
      return {
        status: 'ERROR',
        candidates: [],
        errorMessage: 'La respuesta de la IA no cumplio el contrato del esquema de candidatos.',
      };
    }

    const enriched = await this.crossReferenceWithLibraryAndCatalog(
      validation.data.candidates,
      params.localBooks ?? [],
      params.resolveExternalCatalog
    );

    if (params.signal?.aborted) {
      return {
        status: 'ABORTED',
        candidates: [],
        errorMessage: 'Busqueda cancelada por una nueva solicitud.',
      };
    }

    return {
      status: 'SUCCESS',
      candidates: enriched,
    };
  }

  /**
   * Alias de conveniencia para la busqueda del Detective Literario.
   */
  static investigate = GeminiSmartSearchClient.search;
  static searchByMemory = GeminiSmartSearchClient.search;
}
