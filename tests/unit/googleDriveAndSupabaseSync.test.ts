import {
  GoogleDriveAppDataAdapter,
  InMemoryGoogleDriveStorage,
} from '../../src/features/cloud-sync/services/googleDriveAppDataAdapter';
import {
  evaluateConsensusProtection,
  hydratePendingOfflineBooks,
  SupabaseCommunityCatalogService,
  IsbnContributionProposal,
} from '../../src/features/cloud-sync/services/supabaseCommunityCatalogService';
import { VaultSnapshotService } from '../../src/features/cloud-sync/services/vaultSnapshotService';

describe('Sincronizacion Hibrida: Google Drive y Catalogo Supabase', () => {
  describe('GoogleDriveAppDataAdapter', () => {
    let adapter: GoogleDriveAppDataAdapter;
    let storage: InMemoryGoogleDriveStorage;

    beforeEach(() => {
      storage = new InMemoryGoogleDriveStorage();
      adapter = new GoogleDriveAppDataAdapter(null, storage);
    });

    it('inicia en estado desconectado sin cuenta vinculada', () => {
      const status = adapter.getStatus();
      expect(status.isConnected).toBe(false);
      expect(status.accountEmail).toBeNull();
      expect(status.lastSyncedAt).toBeNull();
      expect(status.backedUpBooksCount).toBe(0);
    });

    it('falla la renovacion silenciosa de sesion si no existe cuenta previa', async () => {
      const session = await adapter.refreshSessionSilently();
      expect(session.ok).toBe(false);
      expect(session.email).toBe('');
    });

    it('vincula una cuenta y renueva la sesion silenciosamente', async () => {
      adapter.connectAccount('lector@bacibooks.com');

      const session = await adapter.refreshSessionSilently();
      expect(session.ok).toBe(true);
      expect(session.email).toBe('lector@bacibooks.com');
      expect(adapter.getStatus().isConnected).toBe(true);
    });

    it('sube un snapshot a Google Drive y actualiza las metricas de respaldo', async () => {
      adapter.connectAccount('lector@bacibooks.com');

      const vault = VaultSnapshotService.buildDeterministicSnapshot({
        books: [
          { id: 'b1', title: 'Cronica de una muerte anunciada' },
          { id: 'b2', title: 'Cien anos de soledad' },
        ],
        coverManifest: [
          { bookId: 'b1', fileName: 'cronica.webp', sizeBytes: 34000 },
        ],
      });

      const uploadResult = await adapter.uploadVaultSnapshot(vault);

      expect(uploadResult.fileName).toBe('bacibooks_vault_backup.json');
      expect(uploadResult.sizeBytes).toBeGreaterThan(0);
      expect(uploadResult.syncedAt).toBeGreaterThan(0);

      const status = adapter.getStatus();
      expect(status.backedUpBooksCount).toBe(2);
      expect(status.backedUpCoversCount).toBe(1);
      expect(status.usedBytes).toBe(uploadResult.sizeBytes);
      expect(status.lastSyncedAt).toBe(uploadResult.syncedAt);
    });

    it('descarga el snapshot mas reciente y lo valida correctamente', async () => {
      adapter.connectAccount('lector@bacibooks.com');

      const vault = VaultSnapshotService.buildDeterministicSnapshot({
        books: [{ id: 'b1', title: 'La metamorfosis' }],
      });

      await adapter.uploadVaultSnapshot(vault);

      const downloaded = await adapter.downloadLatestVaultSnapshot();
      expect(downloaded).not.toBeNull();
      expect(downloaded?.books).toHaveLength(1);
      expect(downloaded?.books[0].title).toBe('La metamorfosis');
    });

    it('elimina la copia remota y reinicia el estado de almacenamiento', async () => {
      adapter.connectAccount('lector@bacibooks.com');

      const vault = VaultSnapshotService.buildDeterministicSnapshot({
        books: [{ id: 'b1', title: 'El tunel' }],
      });

      await adapter.uploadVaultSnapshot(vault);
      const deleted = await adapter.deleteCloudVault();

      expect(deleted).toBe(true);
      const downloadedAfterDelete = await adapter.downloadLatestVaultSnapshot();
      expect(downloadedAfterDelete).toBeNull();

      const status = adapter.getStatus();
      expect(status.backedUpBooksCount).toBe(0);
      expect(status.usedBytes).toBe(0);
      expect(status.lastSyncedAt).toBeNull();
    });

    it('rechaza la subida si el usuario no tiene sesion vinculada', async () => {
      const vault = VaultSnapshotService.buildDeterministicSnapshot({ books: [] });

      await expect(adapter.uploadVaultSnapshot(vault)).rejects.toThrow(
        'No hay una cuenta vinculada para guardar la copia de seguridad.'
      );
    });
  });

  describe('Proteccion por Consenso en el Catalogo Comunitario Supabase', () => {
    it('protege registros con 3 o mas confirmaciones comunitarias contra sobreescritura no verificada', () => {
      const result = evaluateConsensusProtection(4, 1);
      expect(result.canOverwriteVerifiedRecord).toBe(false);
      expect(result.statusLabel).toBe('Confirmada por la comunidad');
    });

    it('permite actualizar un registro verificado si el aporte entrante tambien cuenta con suficiente consenso', () => {
      const result = evaluateConsensusProtection(3, 3);
      expect(result.canOverwriteVerifiedRecord).toBe(true);
      expect(result.statusLabel).toBe('Confirmada por la comunidad');
    });

    it('admite propuestas en revision cuando el registro existente aun no alcanza consenso', () => {
      const result = evaluateConsensusProtection(1, 1);
      expect(result.canOverwriteVerifiedRecord).toBe(true);
      expect(result.statusLabel).toBe('En revisión');
    });

    it('marca inmediatamente confirmada si el aporte entrante cumple con el umbral de 3 confirmaciones', () => {
      const result = evaluateConsensusProtection(0, 3);
      expect(result.canOverwriteVerifiedRecord).toBe(true);
      expect(result.statusLabel).toBe('Confirmada por la comunidad');
    });
  });

  describe('Cola de Sincronizacion Offline (hydratePendingOfflineBooks)', () => {
    it('hidrata libros escaneados sin conexion resolviendo sus metadatos', async () => {
      const pendingBooks = [
        { id: 'book-1', isbn13: '9788437604947', title: 'Libro Escaneado 1' },
        { id: 'book-2', isbn13: '9788420658421', title: 'Libro Escaneado 2' },
        { id: 'book-3', isbn13: null, title: 'Libro sin codigo' },
        { id: 'book-4', isbn13: '9780000000000', title: 'Libro Desconocido' },
      ];

      const mockResolver = async (isbn: string) => {
        if (isbn === '9788437604947') {
          return {
            title: 'Cien anos de soledad',
            publisher: 'Catedra',
            pageCount: 496,
          };
        }
        if (isbn === '9788420658421') {
          return {
            title: 'El aleph',
            publisher: 'Alianza',
            pageCount: 220,
          };
        }
        return null;
      };

      const result = await hydratePendingOfflineBooks(pendingBooks, mockResolver);

      expect(result.hydratedCount).toBe(2);
      expect(result.remainingCount).toBe(2);
      expect(result.updatedIds).toEqual(['book-1', 'book-2']);
    });
  });

  describe('SupabaseCommunityCatalogService', () => {
    it('gestiona propuestas comunitarias y protege registros consolidados', () => {
      const service = new SupabaseCommunityCatalogService();

      const initialProposal: IsbnContributionProposal = {
        isbn13: '9788437604947',
        title: 'Cien anos de soledad',
        publisher: 'Catedra',
        pageCount: 496,
        confirmationsCount: 4,
      };

      const firstSubmit = service.submitContribution(initialProposal);
      expect(firstSubmit.ok).toBe(true);
      expect(firstSubmit.statusLabel).toBe('Confirmada por la comunidad');

      const weakProposal: IsbnContributionProposal = {
        isbn13: '9788437604947',
        title: 'Titulo vandalizado',
        publisher: 'Editorial falsa',
        pageCount: 10,
        confirmationsCount: 1,
      };

      const secondSubmit = service.submitContribution(weakProposal);
      expect(secondSubmit.ok).toBe(false);
      expect(service.getRecord('9788437604947')?.title).toBe('Cien anos de soledad');
    });
  });
});
