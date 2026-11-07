import {
  CURRENT_BACKUP_SCHEMA_VERSION,
  migrateAndValidateVault,
  BackupVaultSchema,
} from '../../src/features/cloud-sync/schemas/backupVaultSchema';
import {
  mergeCollectionByUpdatedAt,
  detectBookProgressConflicts,
  VaultSnapshotService,
} from '../../src/features/cloud-sync/services/vaultSnapshotService';

describe('Esquema de Respaldo y Snapshot Determinista (VaultSnapshotService)', () => {
  describe('Esquema Zod y Migraciones de Versiones', () => {
    it('define la version actual del esquema en 5', () => {
      expect(CURRENT_BACKUP_SCHEMA_VERSION).toBe(5);
    });

    it('valida exitosamente un respaldo moderno con version 5 completa', () => {
      const validPayload = {
        schemaVersion: 5,
        exportedAt: 1710000000000,
        appVersion: '1.0.0',
        deviceLabel: 'Dispositivo BaciBooks',
        books: [{ id: 'b1', title: 'Fahrenheit 451', pageCount: 250 }],
        shelves: [{ id: 's1', name: 'Favoritos' }],
        readingLogs: [{ id: 'l1', bookId: 'b1', pagesRead: 30 }],
        readingSessions: [{ id: 'rs1', bookId: 'b1', durationSeconds: 1800 }],
        goals: [{ id: 'g1', targetBooks: 24, year: 2026 }],
        bookQuotes: [{ id: 'q1', bookId: 'b1', quoteText: 'Era un placer quemar.' }],
        bookLoans: [{ id: 'bl1', bookId: 'b1', borrowerName: 'Valeria' }],
        coverManifest: [{ bookId: 'b1', fileName: 'cover_b1.webp', sizeBytes: 54200 }],
      };

      const parsed = migrateAndValidateVault(validPayload);
      expect(parsed.schemaVersion).toBe(5);
      expect(parsed.books).toHaveLength(1);
      expect(parsed.shelves).toHaveLength(1);
      expect(parsed.bookQuotes).toHaveLength(1);
      expect(parsed.bookLoans).toHaveLength(1);
      expect(parsed.coverManifest).toHaveLength(1);
    });

    it('migra limpiamente respaldos historicos de version 1 completando colecciones faltantes', () => {
      const legacyV1Payload = {
        schemaVersion: 1,
        exportedAt: 1680000000000,
        books: [{ id: 'b-leg', title: 'Rayuela', pageCount: 600 }],
        shelves: [{ id: 's-leg', name: 'Clasicos' }],
      };

      const migrated = migrateAndValidateVault(legacyV1Payload);
      expect(migrated.schemaVersion).toBe(5);
      expect(migrated.books).toHaveLength(1);
      expect(migrated.shelves).toHaveLength(1);
      expect(migrated.readingLogs).toEqual([]);
      expect(migrated.readingSessions).toEqual([]);
      expect(migrated.goals).toEqual([]);
      expect(migrated.bookQuotes).toEqual([]);
      expect(migrated.bookLoans).toEqual([]);
      expect(migrated.coverManifest).toEqual([]);
      expect(migrated.deviceLabel).toBe('Dispositivo BaciBooks');
      expect(migrated.appVersion).toBe('1.0.0');
    });

    it('rechaza respaldos con versiones futuras no compatibles o formatos danados', () => {
      expect(() =>
        migrateAndValidateVault({ schemaVersion: 6, books: [] })
      ).toThrow('El archivo de respaldo fue creado con una version mas reciente');

      expect(() =>
        migrateAndValidateVault({ schemaVersion: 0, books: [] })
      ).toThrow('La version del archivo de respaldo no es valida');

      expect(() => migrateAndValidateVault(null)).toThrow(
        'El archivo de respaldo no tiene un formato valido'
      );

      expect(() => migrateAndValidateVault('contenido invalido')).toThrow(
        'El archivo de respaldo no tiene un formato valido'
      );
    });
  });

  describe('mergeCollectionByUpdatedAt', () => {
    it('combina colecciones locales y remotas respetando el elemento mas reciente', () => {
      const local = [
        { id: '1', title: 'Libro A', updatedAt: 100 },
        { id: '2', title: 'Libro B local', updatedAt: 500 },
      ];

      const cloud = [
        { id: '2', title: 'Libro B remoto', updatedAt: 600 },
        { id: '3', title: 'Libro C', updatedAt: 300 },
      ];

      const merged = mergeCollectionByUpdatedAt(local, cloud);

      expect(merged).toHaveLength(3);
      expect(merged.find((i) => i.id === '1')?.title).toBe('Libro A');
      expect(merged.find((i) => i.id === '2')?.title).toBe('Libro B remoto');
      expect(merged.find((i) => i.id === '3')?.title).toBe('Libro C');
    });

    it('ordena la coleccion resultante de manera determinista por id', () => {
      const local = [{ id: 'z1', name: 'Z' }];
      const cloud = [{ id: 'a1', name: 'A' }, { id: 'm1', name: 'M' }];

      const merged = mergeCollectionByUpdatedAt(local, cloud);
      expect(merged.map((i) => i.id)).toEqual(['a1', 'm1', 'z1']);
    });
  });

  describe('detectBookProgressConflicts', () => {
    it('detecta discrepancias en la pagina leida recomendando la fuente mas actualizada', () => {
      const localBooks = [
        {
          id: 'b1',
          title: 'El nombre de la rosa',
          currentPage: 150,
          pageCount: 500,
          updatedAt: 2000,
        },
        {
          id: 'b2',
          title: 'Dune',
          currentPage: 300,
          pageCount: 600,
          updatedAt: 1000,
        },
      ];

      const cloudBooks = [
        {
          id: 'b1',
          title: 'El nombre de la rosa',
          currentPage: 120,
          pageCount: 500,
          updatedAt: 1500,
        },
        {
          id: 'b2',
          title: 'Dune',
          currentPage: 350,
          pageCount: 600,
          updatedAt: 3000,
        },
      ];

      const conflicts = detectBookProgressConflicts(localBooks, cloudBooks);

      expect(conflicts).toHaveLength(2);

      const conflictB1 = conflicts.find((c) => c.bookId === 'b1');
      expect(conflictB1?.localPage).toBe(150);
      expect(conflictB1?.cloudPage).toBe(120);
      expect(conflictB1?.recommendedSource).toBe('LOCAL');

      const conflictB2 = conflicts.find((c) => c.bookId === 'b2');
      expect(conflictB2?.localPage).toBe(300);
      expect(conflictB2?.cloudPage).toBe(350);
      expect(conflictB2?.recommendedSource).toBe('CLOUD');
    });

    it('no genera conflictos cuando las paginas coinciden o no hay interseccion', () => {
      const localBooks = [
        { id: 'b1', title: 'Libro 1', currentPage: 50, updatedAt: 100 },
      ];
      const cloudBooks = [
        { id: 'b1', title: 'Libro 1', currentPage: 50, updatedAt: 200 },
        { id: 'b2', title: 'Libro 2', currentPage: 10, updatedAt: 200 },
      ];

      const conflicts = detectBookProgressConflicts(localBooks, cloudBooks);
      expect(conflicts).toHaveLength(0);
    });
  });

  describe('VaultSnapshotService', () => {
    it('construye un snapshot determinista con metadatos y listas ordenadas', () => {
      const snapshot = VaultSnapshotService.buildDeterministicSnapshot({
        books: [
          { id: 'b2', title: 'Libro Z' },
          { id: 'b1', title: 'Libro A' },
        ],
        shelves: [{ id: 's1', name: 'Estante 1' }],
        coverManifest: [
          { bookId: 'b2', fileName: 'z_cover.webp', sizeBytes: 1200 },
          { bookId: 'b1', fileName: 'a_cover.webp', sizeBytes: 1500 },
        ],
      });

      expect(snapshot.schemaVersion).toBe(5);
      expect(snapshot.books[0].id).toBe('b1');
      expect(snapshot.books[1].id).toBe('b2');
      expect(snapshot.coverManifest[0].fileName).toBe('a_cover.webp');
      expect(snapshot.coverManifest[1].fileName).toBe('z_cover.webp');
    });

    it('fusiona dos snapshots completos detectando conflictos de lectura', () => {
      const localVault = VaultSnapshotService.buildDeterministicSnapshot({
        books: [
          { id: 'book-1', title: 'Ensayo sobre la ceguera', currentPage: 80, updatedAt: 100 },
        ],
        shelves: [{ id: 'shelf-1', name: 'Favoritos', updatedAt: 100 }],
        coverManifest: [{ bookId: 'book-1', fileName: 'blindness.webp', sizeBytes: 20000 }],
      });

      const cloudVault = VaultSnapshotService.buildDeterministicSnapshot({
        books: [
          { id: 'book-1', title: 'Ensayo sobre la ceguera', currentPage: 110, updatedAt: 200 },
        ],
        shelves: [{ id: 'shelf-2', name: 'Por leer', updatedAt: 200 }],
        coverManifest: [{ bookId: 'book-1', fileName: 'blindness.webp', sizeBytes: 20000 }],
      });

      const { mergedVault, conflicts } = VaultSnapshotService.mergeSnapshots(
        localVault,
        cloudVault
      );

      expect(mergedVault.shelves).toHaveLength(2);
      expect(conflicts).toHaveLength(1);
      expect(conflicts[0].recommendedSource).toBe('CLOUD');
    });

    it('serializa el snapshot a JSON formateado', () => {
      const snapshot = VaultSnapshotService.buildDeterministicSnapshot({
        books: [{ id: 'b1', title: '1984' }],
      });

      const json = VaultSnapshotService.serializeDeterministicJson(snapshot);
      expect(typeof json).toBe('string');
      expect(json).toContain('"schemaVersion": 5');
      expect(json).toContain('1984');
    });
  });
});
