import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { books } from './books';

export const bookLoans = sqliteTable('book_loans', {
  id: text('id').primaryKey(),
  bookId: text('book_id')
    .notNull()
    .references(() => books.id, { onDelete: 'cascade' }),
  loanDirection: text('loan_direction', {
    enum: ['LENT_OUT', 'BORROWED_IN'],
  }).notNull().default('LENT_OUT'),
  borrowerName: text('borrower_name').notNull(),
  borrowerContact: text('borrower_contact'),
  loanedAt: integer('loaned_at').notNull(),
  dueDate: integer('due_date'),
  returnedAt: integer('returned_at'),
  notificationId: text('notification_id'),
  notes: text('notes'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

export type BookLoan = typeof bookLoans.$inferSelect;
export type NewBookLoan = typeof bookLoans.$inferInsert;
