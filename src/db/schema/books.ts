import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

export const books = sqliteTable('books', {
  id: text('id').primaryKey(),
  isbn13: text('isbn13'),
  isbn10: text('isbn10'),
  title: text('title').notNull(),
  subtitle: text('subtitle'),
  seriesName: text('series_name'),
  seriesIndex: real('series_index'),
  authorsJson: text('authors_json').notNull().default('[]'),
  translator: text('translator'),
  publisher: text('publisher'),
  description: text('description'),
  coverUri: text('cover_uri'),
  pageCount: integer('page_count').notNull().default(0),
  modality: text('modality', { enum: ['PHYSICAL', 'DIGITAL'] }).notNull().default('PHYSICAL'),
  ownership: text('ownership', { enum: ['OWNED', 'BORROWED', 'WISHLIST'] }).notNull().default('OWNED'),
  metadataStatus: text('metadata_status', { enum: ['COMPLETE', 'PENDING_OFFLINE_SYNC'] }).notNull().default('COMPLETE'),
  format: text('format', {
    enum: [
      'RUSTICA',
      'TAPA_DURA',
      'BOLSILLO',
      'ESPECIAL',
      'KINDLE',
      'KOBO',
      'EPUB_PDF',
      'APPLE_BOOKS',
    ],
  }),
  progressMode: text('progress_mode', { enum: ['PAGES', 'PERCENTAGE', 'CHAPTERS'] }).notNull().default('PAGES'),
  language: text('language').notNull().default('es'),
  currentStatus: text('current_status', {
    enum: ['POR_LEER', 'LEYENDO', 'EN_ESPERA', 'LEIDO', 'ABANDONADO', 'WISHLIST'],
  }).notNull().default('POR_LEER'),
  currentPage: integer('current_page').notNull().default(0),
  currentPercentage: real('current_percentage').notNull().default(0),
  rating: real('rating'),
  pauseOrDnfNote: text('pause_or_dnf_note'),
  isSpoiler: integer('is_spoiler', { mode: 'boolean' }).notNull().default(false),
  shelfId: text('shelf_id'),
  wishlistStoreNote: text('wishlist_store_note'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

export type Book = typeof books.$inferSelect;
export type NewBook = typeof books.$inferInsert;
