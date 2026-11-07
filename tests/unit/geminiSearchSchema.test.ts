import {
  GeminiLiteraryCandidateSchema,
  GeminiLiteraryResponseSchema,
} from '../../src/features/smart-search/schemas/geminiSearchSchema';

describe('GeminiSearchSchema - Validacion con Zod', () => {
  describe('GeminiLiteraryCandidateSchema', () => {
    it('valida un candidato valido completo', () => {
      const validCandidate = {
        title: 'Cien anos de soledad',
        author: 'Gabriel Garcia Marquez',
        matchPercentage: 98,
        spoilerFreeReason:
          'Saga familiar ambientada en el pueblo de Macondo con sucesos de realismo magico.',
        isbn13: '9788497592208',
        suggestedPublisher: 'Debolsillo',
        publicationYear: 1967,
      };

      const result = GeminiLiteraryCandidateSchema.safeParse(validCandidate);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.title).toBe('Cien anos de soledad');
        expect(result.data.matchPercentage).toBe(98);
      }
    });

    it('permite campos opcionales nulos o no definidos', () => {
      const minimalCandidate = {
        title: 'Ficciones',
        author: 'Jorge Luis Borges',
        matchPercentage: 95,
        spoilerFreeReason: 'Laberintos infinitos y bibliotecas universales.',
        isbn13: null,
        suggestedPublisher: null,
        publicationYear: null,
      };

      const result = GeminiLiteraryCandidateSchema.safeParse(minimalCandidate);
      expect(result.success).toBe(true);
    });

    it('rechaza un candidato con titulo o autor vacio', () => {
      const invalidTitle = {
        title: '',
        author: 'Jorge Luis Borges',
        matchPercentage: 90,
        spoilerFreeReason: 'Razon valida sin spoilers.',
      };

      const resultTitle = GeminiLiteraryCandidateSchema.safeParse(invalidTitle);
      expect(resultTitle.success).toBe(false);

      const invalidAuthor = {
        title: 'Ficciones',
        author: '',
        matchPercentage: 90,
        spoilerFreeReason: 'Razon valida sin spoilers.',
      };

      const resultAuthor = GeminiLiteraryCandidateSchema.safeParse(invalidAuthor);
      expect(resultAuthor.success).toBe(false);
    });

    it('rechaza porcentajes menores a 0 o mayores a 100', () => {
      const candidateNegative = {
        title: '1984',
        author: 'George Orwell',
        matchPercentage: -5,
        spoilerFreeReason: 'Distopia sobre vigilancia y el Gran Hermano.',
      };
      expect(GeminiLiteraryCandidateSchema.safeParse(candidateNegative).success).toBe(false);

      const candidateOver100 = {
        title: '1984',
        author: 'George Orwell',
        matchPercentage: 105,
        spoilerFreeReason: 'Distopia sobre vigilancia y el Gran Hermano.',
      };
      expect(GeminiLiteraryCandidateSchema.safeParse(candidateOver100).success).toBe(false);
    });

    it('rechaza anio de publicacion que no sea entero', () => {
      const invalidYear = {
        title: 'Rayuela',
        author: 'Julio Cortazar',
        matchPercentage: 90,
        spoilerFreeReason: 'Novela experimental entre Paris y Buenos Aires.',
        publicationYear: 1963.5,
      };
      expect(GeminiLiteraryCandidateSchema.safeParse(invalidYear).success).toBe(false);
    });
  });

  describe('GeminiLiteraryResponseSchema', () => {
    it('valida una respuesta con entre 1 y 6 candidatos', () => {
      const singleCandidateResponse = {
        candidates: [
          {
            title: 'Pedro Paramo',
            author: 'Juan Rulfo',
            matchPercentage: 96,
            spoilerFreeReason: 'Busqueda de un padre en el pueblo desierto de Comala.',
          },
        ],
      };
      expect(GeminiLiteraryResponseSchema.safeParse(singleCandidateResponse).success).toBe(true);
    });

    it('rechaza una respuesta vacia con 0 candidatos', () => {
      const emptyResponse = {
        candidates: [],
      };
      expect(GeminiLiteraryResponseSchema.safeParse(emptyResponse).success).toBe(false);
    });

    it('rechaza una respuesta con mas de 6 candidatos', () => {
      const candidates = Array.from({ length: 7 }, (_, idx) => ({
        title: `Libro ${idx + 1}`,
        author: `Autor ${idx + 1}`,
        matchPercentage: 80 - idx,
        spoilerFreeReason: `Razon valida para el candidato ${idx + 1}.`,
      }));

      const excessiveResponse = { candidates };
      expect(GeminiLiteraryResponseSchema.safeParse(excessiveResponse).success).toBe(false);
    });
  });
});
