export interface NormalizedBookCandidate {
  isbn13: string;
  isbn10?: string;
  title: string;
  subtitle?: string;
  authors: string[];
  publisher?: string;
  description?: string;
  coverUri?: string;
  alternativeCovers?: string[];
  pageCount: number;
  language: string;
  publishedYear?: number;
  source: 'GOOGLE_BOOKS' | 'OPEN_LIBRARY' | 'MERGED';
}

export interface CatalogLookupResult {
  success: boolean;
  book: NormalizedBookCandidate | null;
  error?: string;
  candidatesCount: number;
}
