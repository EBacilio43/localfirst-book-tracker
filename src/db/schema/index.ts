import { relations } from 'drizzle-orm';
import { books } from './books';
import { shelves } from './shelves';
import { readingSessions } from './readingSessions';
import { readingLogs } from './readingLogs';
import { bookQuotes } from './bookQuotes';
import { bookLoans } from './bookLoans';
import { readingGoals } from './readingGoals';

export * from './books';
export * from './shelves';
export * from './readingSessions';
export * from './readingLogs';
export * from './bookQuotes';
export * from './bookLoans';
export * from './readingGoals';

export const booksRelations = relations(books, ({ one, many }) => ({
  shelf: one(shelves, {
    fields: [books.shelfId],
    references: [shelves.id],
  }),
  sessions: many(readingSessions),
  logs: many(readingLogs),
  quotes: many(bookQuotes),
  loans: many(bookLoans),
}));

export const shelvesRelations = relations(shelves, ({ many }) => ({
  books: many(books),
}));

export const readingSessionsRelations = relations(readingSessions, ({ one }) => ({
  book: one(books, {
    fields: [readingSessions.bookId],
    references: [books.id],
  }),
}));

export const readingLogsRelations = relations(readingLogs, ({ one }) => ({
  book: one(books, {
    fields: [readingLogs.bookId],
    references: [books.id],
  }),
}));

export const bookQuotesRelations = relations(bookQuotes, ({ one }) => ({
  book: one(books, {
    fields: [bookQuotes.bookId],
    references: [books.id],
  }),
}));

export const bookLoansRelations = relations(bookLoans, ({ one }) => ({
  book: one(books, {
    fields: [bookLoans.bookId],
    references: [books.id],
  }),
}));
