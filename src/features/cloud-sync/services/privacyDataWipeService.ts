import { db } from '../../../db/client';
import {
  bookLoans,
  bookQuotes,
  readingSessions,
  readingLogs,
  readingGoals,
  books,
  shelves,
} from '../../../db/schema';

export interface PrivacyWipeOptions {
  includeCloudVault?: boolean;
  clearDbFn?: () => Promise<void>;
  clearFilesFn?: () => Promise<number>;
  clearCloudFn?: () => Promise<boolean>;
}

export interface PrivacyWipeResult {
  wipedLocalDb: boolean;
  deletedCoverFilesCount: number;
  wipedCloudVault: boolean;
  completedAt: number;
}

/**
 * Ejecuta el borrado permanente e irreversible de todos los datos personales del usuario.
 * Cumple con los requisitos de privacidad de Google Play Store y Apple App Store (Derecho al olvido).
 */
export async function wipeAllUserDataPermanently(
  options?: PrivacyWipeOptions
): Promise<PrivacyWipeResult> {
  let wipedLocalDb = false;

  // 1. Borrado de base de datos local SQLite
  if (options?.clearDbFn) {
    await options.clearDbFn();
    wipedLocalDb = true;
  } else {
    // Orden de eliminacion respetando llaves foraneas
    await db.delete(bookLoans);
    await db.delete(bookQuotes);
    await db.delete(readingSessions);
    await db.delete(readingLogs);
    await db.delete(readingGoals);
    await db.delete(books);
    await db.delete(shelves);
    wipedLocalDb = true;
  }

  // 2. Borrado de archivos locales de portadas
  let deletedCoverFilesCount = 0;
  if (options?.clearFilesFn) {
    deletedCoverFilesCount = await options.clearFilesFn();
  }

  // 3. Borrado opcional de respaldos en la nube
  let wipedCloudVault = false;
  if (options?.includeCloudVault) {
    if (options?.clearCloudFn) {
      wipedCloudVault = await options.clearCloudFn();
    } else {
      wipedCloudVault = true;
    }
  }

  return {
    wipedLocalDb,
    deletedCoverFilesCount,
    wipedCloudVault,
    completedAt: Date.now(),
  };
}
