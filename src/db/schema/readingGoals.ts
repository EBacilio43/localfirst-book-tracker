import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const readingGoals = sqliteTable('reading_goals', {
  id: text('id').primaryKey(),
  periodType: text('period_type', {
    enum: ['ANNUAL', 'MONTHLY', 'DAILY'],
  }).notNull(),
  year: integer('year').notNull(),
  month: integer('month'),
  targetBooks: integer('target_books').notNull().default(0),
  targetPages: integer('target_pages').notNull().default(0),
  targetMinutesPerDay: integer('target_minutes_per_day').notNull().default(0),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

export type ReadingGoal = typeof readingGoals.$inferSelect;
export type NewReadingGoal = typeof readingGoals.$inferInsert;
