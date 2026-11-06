import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { books } from './books';

export const readingSessions = sqliteTable('reading_sessions', {
  id: text('id').primaryKey(),
  bookId: text('book_id')
    .notNull()
    .references(() => books.id, { onDelete: 'cascade' }),
  startPage: integer('start_page').notNull().default(0),
  endPage: integer('end_page').notNull().default(0),
  pagesRead: integer('pages_read').notNull().default(0),
  durationSeconds: integer('duration_seconds').notNull().default(0),
  startedAtEpochMs: integer('started_at_epoch_ms').notNull(),
  localDate: text('local_date').notNull(),
  createdAt: integer('created_at').notNull(),
});

export type ReadingSession = typeof readingSessions.$inferSelect;
export type NewReadingSession = typeof readingSessions.$inferInsert;
