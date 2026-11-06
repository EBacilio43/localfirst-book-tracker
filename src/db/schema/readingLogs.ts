import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';
import { books } from './books';

export const readingLogs = sqliteTable('reading_logs', {
  id: text('id').primaryKey(),
  bookId: text('book_id')
    .notNull()
    .references(() => books.id, { onDelete: 'cascade' }),
  readNumber: integer('read_number').notNull().default(1),
  startedAt: integer('started_at'),
  finishedAt: integer('finished_at'),
  rating: real('rating'),
  review: text('review'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

export type ReadingLog = typeof readingLogs.$inferSelect;
export type NewReadingLog = typeof readingLogs.$inferInsert;
