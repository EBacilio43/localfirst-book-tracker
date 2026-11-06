import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const shelves = sqliteTable('shelves', {
  id: text('id').primaryKey(),
  furnitureName: text('furniture_name').notNull(),
  shelfLevel: text('shelf_level'),
  colorTag: text('color_tag').notNull().default('#1E4635'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

export type Shelf = typeof shelves.$inferSelect;
export type NewShelf = typeof shelves.$inferInsert;
