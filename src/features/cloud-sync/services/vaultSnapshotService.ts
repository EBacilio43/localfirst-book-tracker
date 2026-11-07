import {
  BackupVaultPayload,
  CoverManifestItem,
  CURRENT_BACKUP_SCHEMA_VERSION,
  migrateAndValidateVault,
} from '../schemas/backupVaultSchema';

export interface PageProgressConflict {
  bookId: string;
  bookTitle: string;
  localPage: number;
  localUpdatedAt: number;
  cloudPage: number;
  cloudUpdatedAt: number;
  totalPages: number;
  recommendedSource: 'LOCAL' | 'CLOUD';
}

export interface EntityWithIdAndTimestamps {
  id: string;
  updatedAt?: number | null;
  createdAt?: number | null;
  [key: string]: unknown;
}

export interface BookProgressCandidate {
  id: string;
  title: string;
  currentPage?: number | null;
  pageCount?: number | null;
  updatedAt?: number | null;
}

export function mergeCollectionByUpdatedAt<
  T extends { id: string; updatedAt?: number | null; createdAt?: number | null }
>(localItems: T[], cloudItems: T[]): T[] {
  const itemMap = new Map<string, T>();

  for (const item of localItems) {
    if (item && typeof item.id === 'string' && item.id.length > 0) {
      itemMap.set(item.id, item);
    }
  }

  for (const cloudItem of cloudItems) {
    if (!cloudItem || typeof cloudItem.id !== 'string' || cloudItem.id.length === 0) {
      continue;
    }

    const localItem = itemMap.get(cloudItem.id);
    if (!localItem) {
      itemMap.set(cloudItem.id, cloudItem);
    } else {
      const localTimestamp = localItem.updatedAt ?? localItem.createdAt ?? 0;
      const cloudTimestamp = cloudItem.updatedAt ?? cloudItem.createdAt ?? 0;

      if (cloudTimestamp > localTimestamp) {
        itemMap.set(cloudItem.id, cloudItem);
      }
    }
  }

  return Array.from(itemMap.values()).sort((a, b) => a.id.localeCompare(b.id));
}

export function detectBookProgressConflicts(
  localBooks: Array<{
    id: string;
    title: string;
    currentPage?: number | null;
    pageCount?: number | null;
    updatedAt?: number | null;
  }>,
  cloudBooks: Array<{
    id: string;
    title: string;
    currentPage?: number | null;
    pageCount?: number | null;
    updatedAt?: number | null;
  }>
): PageProgressConflict[] {
  const localMap = new Map(localBooks.map((book) => [book.id, book]));
  const conflicts: PageProgressConflict[] = [];

  for (const cloudBook of cloudBooks) {
    const localBook = localMap.get(cloudBook.id);
    if (!localBook) {
      continue;
    }

    const localPage = typeof localBook.currentPage === 'number' ? localBook.currentPage : 0;
    const cloudPage = typeof cloudBook.currentPage === 'number' ? cloudBook.currentPage : 0;

    if (localPage !== cloudPage) {
      const localUpdatedAt = typeof localBook.updatedAt === 'number' ? localBook.updatedAt : 0;
      const cloudUpdatedAt = typeof cloudBook.updatedAt === 'number' ? cloudBook.updatedAt : 0;
      const totalPages =
        typeof localBook.pageCount === 'number'
          ? localBook.pageCount
          : typeof cloudBook.pageCount === 'number'
          ? cloudBook.pageCount
          : 0;
      const bookTitle =
        typeof localBook.title === 'string' && localBook.title.trim().length > 0
          ? localBook.title
          : typeof cloudBook.title === 'string' && cloudBook.title.trim().length > 0
          ? cloudBook.title
          : 'Libro sin titulo';

      conflicts.push({
        bookId: cloudBook.id,
        bookTitle,
        localPage,
        localUpdatedAt,
        cloudPage,
        cloudUpdatedAt,
        totalPages,
        recommendedSource: localUpdatedAt >= cloudUpdatedAt ? 'LOCAL' : 'CLOUD',
      });
    }
  }

  return conflicts.sort((a, b) => a.bookId.localeCompare(b.bookId));
}

export function mergeCoverManifest(
  localManifest: CoverManifestItem[],
  cloudManifest: CoverManifestItem[]
): CoverManifestItem[] {
  const manifestMap = new Map<string, CoverManifestItem>();

  for (const item of localManifest) {
    if (item && item.fileName) {
      manifestMap.set(item.fileName, item);
    }
  }

  for (const item of cloudManifest) {
    if (!item || !item.fileName) continue;
    const existing = manifestMap.get(item.fileName);
    if (!existing || item.sizeBytes >= existing.sizeBytes) {
      manifestMap.set(item.fileName, item);
    }
  }

  return Array.from(manifestMap.values()).sort((a, b) =>
    a.fileName.localeCompare(b.fileName)
  );
}

export interface BuildSnapshotParams {
  books?: Array<Record<string, unknown>>;
  shelves?: Array<Record<string, unknown>>;
  readingLogs?: Array<Record<string, unknown>>;
  readingSessions?: Array<Record<string, unknown>>;
  goals?: Array<Record<string, unknown>>;
  bookQuotes?: Array<Record<string, unknown>>;
  bookLoans?: Array<Record<string, unknown>>;
  coverManifest?: CoverManifestItem[];
  deviceLabel?: string;
  appVersion?: string;
  exportedAt?: number;
}

export class VaultSnapshotService {
  public static buildDeterministicSnapshot(params: BuildSnapshotParams): BackupVaultPayload {
    const sortById = (list?: Array<Record<string, unknown>>): Array<Record<string, unknown>> => {
      if (!list) return [];
      return [...list].sort((a, b) => {
        const idA = typeof a.id === 'string' ? a.id : '';
        const idB = typeof b.id === 'string' ? b.id : '';
        return idA.localeCompare(idB);
      });
    };

    const sortedManifest = params.coverManifest
      ? [...params.coverManifest].sort((a, b) => a.fileName.localeCompare(b.fileName))
      : [];

    const rawPayload: unknown = {
      schemaVersion: CURRENT_BACKUP_SCHEMA_VERSION,
      exportedAt: params.exportedAt ?? Date.now(),
      appVersion: params.appVersion ?? '1.0.0',
      deviceLabel: params.deviceLabel ?? 'Dispositivo BaciBooks',
      books: sortById(params.books),
      shelves: sortById(params.shelves),
      readingLogs: sortById(params.readingLogs),
      readingSessions: sortById(params.readingSessions),
      goals: sortById(params.goals),
      bookQuotes: sortById(params.bookQuotes),
      bookLoans: sortById(params.bookLoans),
      coverManifest: sortedManifest,
    };

    return migrateAndValidateVault(rawPayload);
  }

  public static mergeSnapshots(
    localVault: BackupVaultPayload,
    cloudVault: BackupVaultPayload
  ): { mergedVault: BackupVaultPayload; conflicts: PageProgressConflict[] } {
    const toEntities = (records: Array<Record<string, unknown>>): EntityWithIdAndTimestamps[] =>
      records.map((r) => ({
        ...r,
        id: typeof r.id === 'string' ? r.id : '',
        updatedAt: typeof r.updatedAt === 'number' ? r.updatedAt : null,
        createdAt: typeof r.createdAt === 'number' ? r.createdAt : null,
      }));

    const toBookProgress = (records: Array<Record<string, unknown>>): BookProgressCandidate[] =>
      records.map((r) => ({
        id: typeof r.id === 'string' ? r.id : '',
        title: typeof r.title === 'string' ? r.title : '',
        currentPage: typeof r.currentPage === 'number' ? r.currentPage : null,
        pageCount: typeof r.pageCount === 'number' ? r.pageCount : null,
        updatedAt: typeof r.updatedAt === 'number' ? r.updatedAt : null,
      }));

    const mergedBooks = mergeCollectionByUpdatedAt(
      toEntities(localVault.books),
      toEntities(cloudVault.books)
    );

    const mergedShelves = mergeCollectionByUpdatedAt(
      toEntities(localVault.shelves),
      toEntities(cloudVault.shelves)
    );

    const mergedReadingLogs = mergeCollectionByUpdatedAt(
      toEntities(localVault.readingLogs),
      toEntities(cloudVault.readingLogs)
    );

    const mergedReadingSessions = mergeCollectionByUpdatedAt(
      toEntities(localVault.readingSessions),
      toEntities(cloudVault.readingSessions)
    );

    const mergedGoals = mergeCollectionByUpdatedAt(
      toEntities(localVault.goals),
      toEntities(cloudVault.goals)
    );

    const mergedQuotes = mergeCollectionByUpdatedAt(
      toEntities(localVault.bookQuotes),
      toEntities(cloudVault.bookQuotes)
    );

    const mergedLoans = mergeCollectionByUpdatedAt(
      toEntities(localVault.bookLoans),
      toEntities(cloudVault.bookLoans)
    );

    const mergedCovers = mergeCoverManifest(localVault.coverManifest, cloudVault.coverManifest);

    const conflicts = detectBookProgressConflicts(
      toBookProgress(localVault.books),
      toBookProgress(cloudVault.books)
    );

    const mergedVault = VaultSnapshotService.buildDeterministicSnapshot({
      books: mergedBooks as Array<Record<string, unknown>>,
      shelves: mergedShelves as Array<Record<string, unknown>>,
      readingLogs: mergedReadingLogs as Array<Record<string, unknown>>,
      readingSessions: mergedReadingSessions as Array<Record<string, unknown>>,
      goals: mergedGoals as Array<Record<string, unknown>>,
      bookQuotes: mergedQuotes as Array<Record<string, unknown>>,
      bookLoans: mergedLoans as Array<Record<string, unknown>>,
      coverManifest: mergedCovers,
      deviceLabel: localVault.deviceLabel,
      appVersion: localVault.appVersion,
      exportedAt: Math.max(localVault.exportedAt, cloudVault.exportedAt),
    });

    return {
      mergedVault,
      conflicts,
    };
  }

  public static serializeDeterministicJson(vault: BackupVaultPayload): string {
    return JSON.stringify(vault, null, 2);
  }
}
