import { z } from 'zod';
import { Book } from '@/db/schema/books';

/**
 * Esquema Zod para un candidato individual retornado por el Detective Literario IA.
 */
export const GeminiLiteraryCandidateSchema = z.object({
  title: z.string().min(1, 'El titulo de la obra es requerido'),
  author: z.string().min(1, 'El autor o autora es requerido'),
  matchPercentage: z
    .number()
    .min(0, 'El porcentaje minimo es 0')
    .max(100, 'El porcentaje maximo es 100'),
  spoilerFreeReason: z
    .string()
    .min(1, 'La explicacion sin spoilers es requerida'),
  isbn13: z.string().nullable().optional(),
  suggestedPublisher: z.string().nullable().optional(),
  publicationYear: z.number().int().nullable().optional(),
});

/**
 * Esquema Zod para la respuesta estructurada del Detective Literario IA.
 */
export const GeminiLiteraryResponseSchema = z.object({
  candidates: z
    .array(GeminiLiteraryCandidateSchema)
    .min(1, 'Debe incluir al menos un candidato')
    .max(6, 'No puede exceder 6 candidatos'),
});

export type GeminiLiteraryCandidate = z.infer<typeof GeminiLiteraryCandidateSchema>;
export type GeminiLiteraryResponse = z.infer<typeof GeminiLiteraryResponseSchema>;

/**
 * Representa un candidato de IA enriquecido con datos del catalogo externo
 * y su estado de posesion en la biblioteca local del usuario.
 */
export interface EnrichedLiteraryCandidate extends GeminiLiteraryCandidate {
  inLocalLibrary: boolean;
  localBook?: Book;
  coverUri?: string | null;
  pageCount?: number | null;
  resolvedPublisher?: string | null;
  resolvedIsbn13?: string | null;
}
