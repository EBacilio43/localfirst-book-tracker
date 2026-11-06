import { z } from 'zod';

// Esquema Zod para Google Books API
export const GoogleBooksVolumeInfoSchema = z.object({
  title: z.string().optional().default('Sin título'),
  subtitle: z.string().optional(),
  authors: z.array(z.string()).optional().default([]),
  publisher: z.string().optional(),
  publishedDate: z.string().optional(),
  description: z.string().optional(),
  pageCount: z.number().optional().default(0),
  language: z.string().optional().default('es'),
  imageLinks: z
    .object({
      smallThumbnail: z.string().optional(),
      thumbnail: z.string().optional(),
    })
    .optional(),
  industryIdentifiers: z
    .array(
      z.object({
        type: z.string(),
        identifier: z.string(),
      })
    )
    .optional(),
});

export const GoogleBooksResponseSchema = z.object({
  totalItems: z.number().optional().default(0),
  items: z
    .array(
      z.object({
        id: z.string(),
        volumeInfo: GoogleBooksVolumeInfoSchema,
      })
    )
    .optional()
    .default([]),
});

// Esquema Zod para Open Library API
export const OpenLibraryBookDataSchema = z.object({
  title: z.string().optional().default('Sin título'),
  subtitle: z.string().optional(),
  authors: z
    .array(
      z.object({
        name: z.string(),
      })
    )
    .optional()
    .default([]),
  publishers: z
    .array(
      z.object({
        name: z.string(),
      })
    )
    .optional()
    .default([]),
  number_of_pages: z.number().optional().default(0),
  publish_date: z.string().optional(),
  cover: z
    .object({
      small: z.string().optional(),
      medium: z.string().optional(),
      large: z.string().optional(),
    })
    .optional(),
});

export const OpenLibraryResponseSchema = z.record(OpenLibraryBookDataSchema);
