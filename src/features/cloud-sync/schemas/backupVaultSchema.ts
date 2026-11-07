import { z } from 'zod';

export const CURRENT_BACKUP_SCHEMA_VERSION = 5;

export const CoverManifestItemSchema = z.object({
  bookId: z.string(),
  fileName: z.string(),
  sizeBytes: z.number().nonnegative(),
});

export type CoverManifestItem = z.infer<typeof CoverManifestItemSchema>;

export const BackupVaultSchema = z.object({
  schemaVersion: z.number().int().min(1).max(CURRENT_BACKUP_SCHEMA_VERSION),
  exportedAt: z.number(),
  appVersion: z.string().default('1.0.0'),
  deviceLabel: z.string().default('Dispositivo BaciBooks'),
  books: z.array(z.record(z.string(), z.unknown())).default([]),
  shelves: z.array(z.record(z.string(), z.unknown())).default([]),
  readingLogs: z.array(z.record(z.string(), z.unknown())).default([]),
  readingSessions: z.array(z.record(z.string(), z.unknown())).default([]),
  goals: z.array(z.record(z.string(), z.unknown())).default([]),
  bookQuotes: z.array(z.record(z.string(), z.unknown())).default([]),
  bookLoans: z.array(z.record(z.string(), z.unknown())).default([]),
  coverManifest: z.array(CoverManifestItemSchema).default([]),
});

export type BackupVaultPayload = z.infer<typeof BackupVaultSchema>;

export function migrateAndValidateVault(rawPayload: unknown): BackupVaultPayload {
  if (!rawPayload || typeof rawPayload !== 'object' || Array.isArray(rawPayload)) {
    throw new Error('El archivo de respaldo no tiene un formato valido.');
  }

  const record: Record<string, unknown> = { ...(rawPayload as Record<string, unknown>) };

  const version = typeof record.schemaVersion === 'number' ? record.schemaVersion : 1;

  if (version < 1) {
    throw new Error('La version del archivo de respaldo no es valida.');
  }

  if (version > CURRENT_BACKUP_SCHEMA_VERSION) {
    throw new Error('El archivo de respaldo fue creado con una version mas reciente de la aplicacion y no puede abrirse.');
  }

  if (typeof record.exportedAt !== 'number') {
    record.exportedAt = Date.now();
  }

  if (typeof record.appVersion !== 'string') {
    record.appVersion = '1.0.0';
  }

  if (typeof record.deviceLabel !== 'string') {
    record.deviceLabel = 'Dispositivo BaciBooks';
  }

  if (!Array.isArray(record.books)) {
    record.books = [];
  }

  if (!Array.isArray(record.shelves)) {
    record.shelves = [];
  }

  if (!Array.isArray(record.readingLogs)) {
    record.readingLogs = [];
  }

  if (!Array.isArray(record.readingSessions)) {
    record.readingSessions = [];
  }

  if (!Array.isArray(record.goals)) {
    record.goals = [];
  }

  if (!Array.isArray(record.bookQuotes)) {
    record.bookQuotes = [];
  }

  if (!Array.isArray(record.bookLoans)) {
    record.bookLoans = [];
  }

  if (!Array.isArray(record.coverManifest)) {
    record.coverManifest = [];
  }

  record.schemaVersion = CURRENT_BACKUP_SCHEMA_VERSION;

  const parseResult = BackupVaultSchema.safeParse(record);
  if (!parseResult.success) {
    throw new Error('El archivo de respaldo contiene informacion danada o incompatible.');
  }

  return parseResult.data;
}
