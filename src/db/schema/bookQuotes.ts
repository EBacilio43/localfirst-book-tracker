import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { books } from './books';

export const bookQuotes = sqliteTable('book_quotes', {
  id: text('id').primaryKey(),
  bookId: text('book_id')
    .notNull()
    .references(() => books.id, { onDelete: 'cascade' }),
  entryType: text('entry_type', {
    enum: ['QUOTE', 'CHARACTER', 'GLOSSARY', 'NOTE'],
  }).notNull().default('QUOTE'),
  content: text('content').notNull(),
  pageNumber: integer('page_number'),
  chapterOrSection: text('chapter_or_section'),
  personalNote: text('personal_note'),
  highlightColor: text('highlight_color').notNull().default('#F3E8CB'),
  isSpoiler: integer('is_spoiler', { mode: 'boolean' }).notNull().default(false),
  isFavorite: integer('is_favorite', { mode: 'boolean' }).notNull().default(false),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

export type BookQuote = typeof bookQuotes.$inferSelect;
export type NewBookQuote = typeof bookQuotes.$inferInsert;
