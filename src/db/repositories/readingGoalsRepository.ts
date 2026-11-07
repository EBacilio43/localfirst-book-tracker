import { eq, and, isNull, desc } from 'drizzle-orm';
import { db } from '../client';
import { readingGoals, ReadingGoal, NewReadingGoal } from '../schema/readingGoals';

export interface UpsertGoalParams {
  periodType: 'ANNUAL' | 'MONTHLY' | 'DAILY';
  year: number;
  month?: number | null;
  targetBooks?: number;
  targetPages?: number;
  targetMinutesPerDay?: number;
}

function generateGoalId(): string {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 10);
  return `rgoal_${timestamp}_${randomPart}`;
}

export class ReadingGoalsRepository {
  /**
   * Obtiene todas las metas registradas ordenadas cronologicamente por ano y mes descendente.
   */
  static async getAll(): Promise<ReadingGoal[]> {
    return db
      .select()
      .from(readingGoals)
      .orderBy(desc(readingGoals.year), desc(readingGoals.month));
  }

  /**
   * Obtiene una meta especifica segun su tipo de periodo, ano y mes opcional.
   */
  static async getByPeriod(
    periodType: 'ANNUAL' | 'MONTHLY' | 'DAILY',
    year: number,
    month?: number | null
  ): Promise<ReadingGoal | null> {
    const conditions = [
      eq(readingGoals.periodType, periodType),
      eq(readingGoals.year, year),
    ];

    if (month !== undefined && month !== null) {
      conditions.push(eq(readingGoals.month, month));
    } else {
      conditions.push(isNull(readingGoals.month));
    }

    const results = await db
      .select()
      .from(readingGoals)
      .where(and(...conditions))
      .limit(1);

    return results[0] ?? null;
  }

  /**
   * Inserta o actualiza una meta de forma idempotente para el periodo especificado.
   */
  static async upsertGoal(params: UpsertGoalParams): Promise<ReadingGoal> {
    const existing = await this.getByPeriod(params.periodType, params.year, params.month);
    const now = Date.now();

    if (existing) {
      const updated = await db
        .update(readingGoals)
        .set({
          targetBooks:
            params.targetBooks !== undefined ? params.targetBooks : existing.targetBooks,
          targetPages:
            params.targetPages !== undefined ? params.targetPages : existing.targetPages,
          targetMinutesPerDay:
            params.targetMinutesPerDay !== undefined
              ? params.targetMinutesPerDay
              : existing.targetMinutesPerDay,
          updatedAt: now,
        })
        .where(eq(readingGoals.id, existing.id))
        .returning();

      return updated[0];
    }

    const newGoal: NewReadingGoal = {
      id: generateGoalId(),
      periodType: params.periodType,
      year: params.year,
      month: params.month ?? null,
      targetBooks: params.targetBooks ?? 0,
      targetPages: params.targetPages ?? 0,
      targetMinutesPerDay: params.targetMinutesPerDay ?? 0,
      createdAt: now,
      updatedAt: now,
    };

    const inserted = await db.insert(readingGoals).values(newGoal).returning();
    return inserted[0];
  }

  /**
   * Elimina una meta por su identificador unico.
   */
  static async delete(id: string): Promise<boolean> {
    const deleted = await db
      .delete(readingGoals)
      .where(eq(readingGoals.id, id))
      .returning();

    return deleted.length > 0;
  }
}
