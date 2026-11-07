import { eq, and, isNull, asc } from 'drizzle-orm';
import { db } from '../client';
import { shelves, Shelf, NewShelf } from '../schema/shelves';
import { books, Book } from '../schema/books';

export interface ShelfCompartment extends Shelf {
  bookCount: number;
  books: Book[];
}

export interface FurnitureShelvesGroup {
  furnitureName: string;
  totalBooks: number;
  compartments: ShelfCompartment[];
}

export interface CreateShelfInput {
  id?: string;
  furnitureName: string;
  shelfLevel?: string | null;
  colorTag?: string;
}

function generateShelfId(): string {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 10);
  return `shelf_${timestamp}_${randomPart}`;
}

export class ShelvesRepository {
  /**
   * Obtiene todos los estantes ordenados por mueble y nivel.
   */
  static async getAll(): Promise<Shelf[]> {
    return db
      .select()
      .from(shelves)
      .orderBy(asc(shelves.furnitureName), asc(shelves.shelfLevel));
  }

  /**
   * Obtiene un estante por su ID unico.
   */
  static async getById(id: string): Promise<Shelf | null> {
    const results = await db
      .select()
      .from(shelves)
      .where(eq(shelves.id, id))
      .limit(1);

    return results[0] || null;
  }

  /**
   * Obtiene los estantes agrupados por mueble junto con el conteo y lista de libros asociados.
   */
  static async getGroupedWithBookCounts(): Promise<FurnitureShelvesGroup[]> {
    const allShelves = await db
      .select()
      .from(shelves)
      .orderBy(asc(shelves.furnitureName), asc(shelves.shelfLevel));

    const allBooks = await db.select().from(books);

    const booksByShelf = new Map<string, Book[]>();
    for (const book of allBooks) {
      if (book.shelfId) {
        const list = booksByShelf.get(book.shelfId) || [];
        list.push(book);
        booksByShelf.set(book.shelfId, list);
      }
    }

    const groupsMap = new Map<string, ShelfCompartment[]>();
    for (const shelf of allShelves) {
      const compartmentBooks = booksByShelf.get(shelf.id) || [];
      const compartment: ShelfCompartment = {
        ...shelf,
        bookCount: compartmentBooks.length,
        books: compartmentBooks,
      };

      const group = groupsMap.get(shelf.furnitureName) || [];
      group.push(compartment);
      groupsMap.set(shelf.furnitureName, group);
    }

    const result: FurnitureShelvesGroup[] = [];
    for (const [furnitureName, compartments] of groupsMap.entries()) {
      const totalBooks = compartments.reduce((sum, item) => sum + item.bookCount, 0);
      result.push({
        furnitureName,
        totalBooks,
        compartments,
      });
    }

    return result;
  }

  /**
   * Registra un nuevo estante de manera idempotente.
   * Si ya existe un estante con el mismo furnitureName y shelfLevel, devuelve el existente.
   */
  static async create(input: CreateShelfInput): Promise<Shelf> {
    const normalizedLevel = input.shelfLevel ?? null;

    const existing = await db
      .select()
      .from(shelves)
      .where(
        and(
          eq(shelves.furnitureName, input.furnitureName),
          normalizedLevel !== null
            ? eq(shelves.shelfLevel, normalizedLevel)
            : isNull(shelves.shelfLevel)
        )
      )
      .limit(1);

    if (existing[0]) {
      return existing[0];
    }

    const now = Date.now();
    const newShelf: NewShelf = {
      id: input.id ?? generateShelfId(),
      furnitureName: input.furnitureName,
      shelfLevel: normalizedLevel,
      colorTag: input.colorTag ?? '#1E4635',
      createdAt: now,
      updatedAt: now,
    };

    const inserted = await db.insert(shelves).values(newShelf).returning();
    return inserted[0];
  }

  /**
   * Actualiza los datos de un estante existente.
   */
  static async update(id: string, updates: Partial<NewShelf>): Promise<Shelf | null> {
    const updated = await db
      .update(shelves)
      .set({
        ...updates,
        updatedAt: Date.now(),
      })
      .where(eq(shelves.id, id))
      .returning();

    return updated[0] || null;
  }

  /**
   * Elimina un estante, desvinculando primero los libros asignados a el.
   */
  static async delete(id: string): Promise<boolean> {
    await db
      .update(books)
      .set({
        shelfId: null,
        updatedAt: Date.now(),
      })
      .where(eq(books.shelfId, id));

    const deleted = await db.delete(shelves).where(eq(shelves.id, id)).returning();
    return deleted.length > 0;
  }

  /**
   * Asigna o desvincula un libro de un estante especifico.
   */
  static async assignBookToShelf(bookId: string, shelfId: string | null): Promise<Book | null> {
    const updated = await db
      .update(books)
      .set({
        shelfId,
        updatedAt: Date.now(),
      })
      .where(eq(books.id, bookId))
      .returning();

    return updated[0] || null;
  }
}
