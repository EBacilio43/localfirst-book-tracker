import {
  auditOrphanCoverFiles,
  purgeOrphanCoverFiles,
  normalizeCoverUri,
  extractFilename,
} from '../../src/features/cloud-sync/services/webpCoverGarbageCollector';
import { wipeAllUserDataPermanently } from '../../src/features/cloud-sync/services/privacyDataWipeService';
import { db } from '../../src/db/client';
import {
  bookLoans,
  bookQuotes,
  readingSessions,
  readingLogs,
  readingGoals,
  books,
  shelves,
} from '../../src/db/schema';

jest.mock('../../src/db/client', () => {
  const mockDb = {
    delete: jest.fn().mockResolvedValue(undefined),
  };
  return {
    db: mockDb,
    rawDb: {},
  };
});

describe('WebP Cover Garbage Collector', () => {
  describe('normalizeCoverUri & extractFilename', () => {
    it('normaliza URIs con prefijos file:// y diagonales invertidas', () => {
      expect(normalizeCoverUri('file:///data/user/0/covers/book-1.webp')).toBe(
        '/data/user/0/covers/book-1.webp'
      );
      expect(normalizeCoverUri('C:\\app\\covers\\book-2.webp')).toBe(
        'C:/app/covers/book-2.webp'
      );
    });

    it('extrae el nombre de archivo correctamente', () => {
      expect(extractFilename('file:///covers/don-quijote.webp')).toBe('don-quijote.webp');
      expect(extractFilename('C:\\data\\covers\\cien-anos.webp')).toBe('cien-anos.webp');
    });
  });

  describe('auditOrphanCoverFiles', () => {
    it('identifica con precision portadas activas y archivos huerfanos', () => {
      const filesOnDisk = [
        { uri: 'file:///covers/book-1.webp', sizeBytes: 65000 },
        { uri: 'file:///covers/book-2.webp', sizeBytes: 80000 },
        { uri: 'file:///covers/orphan-old.webp', sizeBytes: 120000 },
        { uri: 'file:///covers/deleted-book.webp', sizeBytes: 50000 },
      ];

      const activeCoverUrisInDb = [
        'file:///covers/book-1.webp',
        'book-2.webp',
        null,
        undefined,
      ];

      const audit = auditOrphanCoverFiles(filesOnDisk, activeCoverUrisInDb);

      expect(audit.activeFilesCount).toBe(2);
      expect(audit.orphanFilesCount).toBe(2);
      expect(audit.orphanFileUris).toEqual([
        'file:///covers/orphan-old.webp',
        'file:///covers/deleted-book.webp',
      ]);
      expect(audit.reclaimableBytes).toBe(170000);
    });

    it('devuelve cero huerfanos cuando todos los archivos en disco estan referenciados', () => {
      const filesOnDisk = [
        { uri: 'file:///covers/active.webp', sizeBytes: 70000 },
      ];
      const activeUris = ['file:///covers/active.webp'];

      const audit = auditOrphanCoverFiles(filesOnDisk, activeUris);

      expect(audit.activeFilesCount).toBe(1);
      expect(audit.orphanFilesCount).toBe(0);
      expect(audit.orphanFileUris).toEqual([]);
      expect(audit.reclaimableBytes).toBe(0);
    });
  });

  describe('purgeOrphanCoverFiles', () => {
    it('ejecuta el borrado fisico de cada archivo huerfano y calcula los bytes liberados', async () => {
      const filesOnDisk = [
        { uri: 'file:///covers/active.webp', sizeBytes: 40000 },
        { uri: 'file:///covers/orphan-1.webp', sizeBytes: 60000 },
        { uri: 'file:///covers/orphan-2.webp', sizeBytes: 90000 },
      ];
      const activeUris = ['file:///covers/active.webp'];

      const mockDeleteFn = jest.fn().mockResolvedValue(undefined);

      const result = await purgeOrphanCoverFiles(filesOnDisk, activeUris, mockDeleteFn);

      expect(mockDeleteFn).toHaveBeenCalledTimes(2);
      expect(mockDeleteFn).toHaveBeenCalledWith('file:///covers/orphan-1.webp');
      expect(mockDeleteFn).toHaveBeenCalledWith('file:///covers/orphan-2.webp');
      expect(result.deletedCount).toBe(2);
      expect(result.freedBytes).toBe(150000);
    });

    it('continua de forma resiliente si un archivo falla al eliminarse', async () => {
      const filesOnDisk = [
        { uri: 'file:///covers/orphan-locked.webp', sizeBytes: 50000 },
        { uri: 'file:///covers/orphan-ok.webp', sizeBytes: 70000 },
      ];

      const mockDeleteFn = jest
        .fn()
        .mockRejectedValueOnce(new Error('Archivo bloqueado'))
        .mockResolvedValueOnce(undefined);

      const result = await purgeOrphanCoverFiles(filesOnDisk, [], mockDeleteFn);

      expect(result.deletedCount).toBe(1);
      expect(result.freedBytes).toBe(70000);
    });
  });
});

describe('Privacy Data Wipe Service (Right to be Forgotten)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('elimina permanentemente todos los datos de SQLite en el orden requerido por llaves foraneas', async () => {
    const result = await wipeAllUserDataPermanently();

    expect(result.wipedLocalDb).toBe(true);
    expect(result.deletedCoverFilesCount).toBe(0);
    expect(result.wipedCloudVault).toBe(false);
    expect(result.completedAt).toBeGreaterThan(0);

    // Verifica que se invoco db.delete para cada una de las tablas del esquema
    expect(db.delete).toHaveBeenCalledWith(bookLoans);
    expect(db.delete).toHaveBeenCalledWith(bookQuotes);
    expect(db.delete).toHaveBeenCalledWith(readingSessions);
    expect(db.delete).toHaveBeenCalledWith(readingLogs);
    expect(db.delete).toHaveBeenCalledWith(readingGoals);
    expect(db.delete).toHaveBeenCalledWith(books);
    expect(db.delete).toHaveBeenCalledWith(shelves);
  });

  it('soporta inyeccion de funciones personalizadas para base de datos, portadas y nube', async () => {
    const mockClearDb = jest.fn().mockResolvedValue(undefined);
    const mockClearFiles = jest.fn().mockResolvedValue(15);
    const mockClearCloud = jest.fn().mockResolvedValue(true);

    const result = await wipeAllUserDataPermanently({
      includeCloudVault: true,
      clearDbFn: mockClearDb,
      clearFilesFn: mockClearFiles,
      clearCloudFn: mockClearCloud,
    });

    expect(mockClearDb).toHaveBeenCalledTimes(1);
    expect(mockClearFiles).toHaveBeenCalledTimes(1);
    expect(mockClearCloud).toHaveBeenCalledTimes(1);

    expect(result.wipedLocalDb).toBe(true);
    expect(result.deletedCoverFilesCount).toBe(15);
    expect(result.wipedCloudVault).toBe(true);
  });
});
