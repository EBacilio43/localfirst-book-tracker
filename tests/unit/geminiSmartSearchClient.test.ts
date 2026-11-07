import {
  GeminiSmartSearchClient,
} from '../../src/features/smart-search/services/geminiSmartSearchClient';
import { GeminiLiteraryCandidate } from '../../src/features/smart-search/schemas/geminiSearchSchema';
import { Book } from '../../src/db/schema/books';

describe('GeminiSmartSearchClient - Detective Literario con Gemini 2.5 Flash', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    delete process.env.EXPO_PUBLIC_GEMINI_API_KEY;
    delete process.env.EXPO_PUBLIC_GEMINI_PROXY_URL;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  const mockLocalBooks: Book[] = [
    {
      id: 'local-book-1',
      isbn13: '9788497592208',
      isbn10: '8497592204',
      title: 'Cien años de soledad',
      subtitle: null,
      seriesName: null,
      seriesIndex: null,
      authorsJson: JSON.stringify(['Gabriel García Márquez']),
      translator: null,
      publisher: 'Debolsillo',
      description: 'Historia de Macondo.',
      coverUri: 'file:///local/soledad.webp',
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
  ];

  describe('resolveOfflineDemoCandidates', () => {
    it('retorna candidatos relevantes para palabras clave de Macondo', () => {
      const candidates = GeminiSmartSearchClient.resolveOfflineDemoCandidates(
        'un coronel frente al peloton en macondo'
      );

      expect(candidates.length).toBeGreaterThanOrEqual(1);
      expect(candidates[0].title).toBe('Cien años de soledad');
      expect(candidates[0].author).toBe('Gabriel García Márquez');
      expect(candidates[0].matchPercentage).toBeGreaterThanOrEqual(90);
      expect(candidates[0].spoilerFreeReason.length).toBeGreaterThan(10);
    });

    it('retorna candidatos relevantes para palabras clave de laberintos y Borges', () => {
      const candidates = GeminiSmartSearchClient.resolveOfflineDemoCandidates(
        'cuentos sobre laberintos infinitos y bibliotecas'
      );

      expect(candidates.length).toBeGreaterThanOrEqual(1);
      expect(candidates.some((c) => c.author.includes('Borges'))).toBe(true);
    });

    it('retorna candidatos de referencia cuando la consulta es generica', () => {
      const candidates = GeminiSmartSearchClient.resolveOfflineDemoCandidates(
        'una historia clasica inolvidable'
      );

      expect(candidates.length).toBeGreaterThanOrEqual(1);
      expect(candidates[0].title).toBeTruthy();
    });

    it('retorna arreglo vacio si la consulta esta vacia', () => {
      expect(GeminiSmartSearchClient.resolveOfflineDemoCandidates('   ')).toHaveLength(0);
    });
  });

  describe('crossReferenceWithLibraryAndCatalog', () => {
    it('marca inLocalLibrary true cuando el candidato coincide por ISBN-13', async () => {
      const candidates: GeminiLiteraryCandidate[] = [
        {
          title: 'Cien anos de soledad',
          author: 'Gabriel Garcia Marquez',
          matchPercentage: 98,
          spoilerFreeReason: 'Historia de Macondo.',
          isbn13: '9788497592208',
          suggestedPublisher: 'Editorial Sudamericana',
          publicationYear: 1967,
        },
      ];

      const enriched = await GeminiSmartSearchClient.crossReferenceWithLibraryAndCatalog(
        candidates,
        mockLocalBooks
      );

      expect(enriched[0].inLocalLibrary).toBe(true);
      expect(enriched[0].localBook?.id).toBe('local-book-1');
      expect(enriched[0].coverUri).toBe('file:///local/soledad.webp');
      expect(enriched[0].pageCount).toBe(471);
    });

    it('marca inLocalLibrary true cuando el titulo normalizado coincide sin acentos', async () => {
      const candidates: GeminiLiteraryCandidate[] = [
        {
          title: 'CIEN ANOS DE SOLEDAD',
          author: 'Garcia Marquez',
          matchPercentage: 95,
          spoilerFreeReason: 'Familia Buendia.',
          isbn13: null,
        },
      ];

      const enriched = await GeminiSmartSearchClient.crossReferenceWithLibraryAndCatalog(
        candidates,
        mockLocalBooks
      );

      expect(enriched[0].inLocalLibrary).toBe(true);
      expect(enriched[0].localBook?.id).toBe('local-book-1');
    });

    it('consulta resolveExternalCatalog cuando el libro no esta en la biblioteca local', async () => {
      const candidates: GeminiLiteraryCandidate[] = [
        {
          title: 'Rayuela',
          author: 'Julio Cortazar',
          matchPercentage: 93,
          spoilerFreeReason: 'Paris y Horacio Oliveira.',
          isbn13: '9788466331906',
          suggestedPublisher: 'Punto de Lectura',
          publicationYear: 1963,
        },
      ];

      const mockResolver = jest.fn().mockResolvedValue({
        coverUrl: 'https://covers.openlibrary.org/b/id/12345-L.jpg',
        isbn13: '9788466331906',
        publisher: 'Alfaguara',
        pageCount: 600,
      });

      const enriched = await GeminiSmartSearchClient.crossReferenceWithLibraryAndCatalog(
        candidates,
        mockLocalBooks,
        mockResolver
      );

      expect(enriched[0].inLocalLibrary).toBe(false);
      expect(mockResolver).toHaveBeenCalledWith('Rayuela', 'Julio Cortazar');
      expect(enriched[0].coverUri).toBe('https://covers.openlibrary.org/b/id/12345-L.jpg');
      expect(enriched[0].resolvedPublisher).toBe('Alfaguara');
      expect(enriched[0].pageCount).toBe(600);
    });
  });

  describe('search con HTTP, control de cancelacion y errores', () => {
    it('responde con candidatos enriquecidos en modo offline cuando no hay API key ni proxy', async () => {
      const result = await GeminiSmartSearchClient.search({
        query: 'un pueblo llamado comala y un padre pedro',
        localBooks: mockLocalBooks,
      });

      expect(result.status).toBe('SUCCESS');
      expect(result.candidates.length).toBeGreaterThanOrEqual(1);
      expect(result.candidates[0].title).toBe('Pedro Páramo');
    });

    it('devuelve status ABORTED cuando el AbortSignal ya esta cancelado', async () => {
      const controller = new AbortController();
      controller.abort();

      const result = await GeminiSmartSearchClient.search({
        query: 'Cualquier recuerdo',
        signal: controller.signal,
      });

      expect(result.status).toBe('ABORTED');
      expect(result.candidates).toHaveLength(0);
    });

    it('devuelve status SUCCESS ante respuesta estructurada de la API de Gemini', async () => {
      const mockGeminiResponse = {
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    candidates: [
                      {
                        title: 'La metamorfosis',
                        author: 'Franz Kafka',
                        matchPercentage: 97,
                        spoilerFreeReason:
                          'Un hombre amanece transformado en un insecto gigantesco.',
                        isbn13: '9788420651361',
                        suggestedPublisher: 'Alianza Editorial',
                        publicationYear: 1915,
                      },
                    ],
                  }),
                },
              ],
            },
          },
        ],
      };

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockGeminiResponse,
      } as unknown as Response);

      const result = await GeminiSmartSearchClient.search({
        query: 'un hombre se convierte en cucaracha o escarabajo',
        apiKey: 'test-api-key',
      });

      expect(result.status).toBe('SUCCESS');
      expect(result.candidates).toHaveLength(1);
      expect(result.candidates[0].title).toBe('La metamorfosis');
    });

    it('maneja limite de peticiones HTTP 429 devolviendo RATE_LIMIT', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 429,
      } as unknown as Response);

      const result = await GeminiSmartSearchClient.search({
        query: 'consulta que excede cuota',
        apiKey: 'test-api-key',
      });

      expect(result.status).toBe('RATE_LIMIT');
      expect(result.candidates).toHaveLength(0);
      expect(result.errorMessage).toContain('Limite de peticiones alcanzado');
    });

    it('maneja errores 500 del servidor devolviendo ERROR', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 500,
      } as unknown as Response);

      const result = await GeminiSmartSearchClient.search({
        query: 'consulta con fallo de servidor',
        apiKey: 'test-api-key',
      });

      expect(result.status).toBe('ERROR');
      expect(result.errorMessage).toContain('500');
    });

    it('maneja AbortError durante la ejecucion de fetch devolviendo ABORTED', async () => {
      const abortError = new Error('The user aborted a request.');
      abortError.name = 'AbortError';

      global.fetch = jest.fn().mockRejectedValue(abortError);

      const controller = new AbortController();
      const result = await GeminiSmartSearchClient.search({
        query: 'consulta interrumpida',
        apiKey: 'test-api-key',
        signal: controller.signal,
      });

      expect(result.status).toBe('ABORTED');
      expect(result.candidates).toHaveLength(0);
    });

    it('maneja respuestas donde el JSON no cumple el contrato de Zod', async () => {
      const invalidResponse = {
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    candidates: [
                      {
                        // Falta title y author requeridos
                        matchPercentage: 999,
                      },
                    ],
                  }),
                },
              ],
            },
          },
        ],
      };

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => invalidResponse,
      } as unknown as Response);

      const result = await GeminiSmartSearchClient.search({
        query: 'consulta con respuesta deformada',
        apiKey: 'test-api-key',
      });

      expect(result.status).toBe('ERROR');
      expect(result.errorMessage).toContain('esquema de candidatos');
    });
  });
});
