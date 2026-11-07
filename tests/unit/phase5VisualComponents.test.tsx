import React from 'react';
import { render, fireEvent, act, cleanup } from '@testing-library/react-native';
import { CloudSyncSkeleton } from '../../src/shared/components/Skeleton';
import {
  CloudSyncAndSettingsModal,
  ProgressConflictInfo,
} from '../../src/features/cloud-sync/components/CloudSyncAndSettingsModal';

describe('Fase 5 Componentes Visuales y Copia en la Nube', () => {
  afterEach(() => {
    cleanup();
  });

  describe('CloudSyncSkeleton', () => {
    it('se renderiza correctamente con testID cloud-sync-skeleton', () => {
      const { getByTestId } = render(<CloudSyncSkeleton />);
      expect(getByTestId('cloud-sync-skeleton')).toBeTruthy();
    });
  });

  describe('CloudSyncAndSettingsModal - Pestaña Respaldo', () => {
    it('muestra estado de Google Drive, resumen de copia, nota de privacidad y botones de respaldo', async () => {
      const onBackupNowMock = jest.fn();
      const onRestoreBackupMock = jest.fn();
      const onCloseMock = jest.fn();

      const { getByTestId, getByText } = render(
        <CloudSyncAndSettingsModal
          visible={true}
          onClose={onCloseMock}
          accountEmail="lector.dev@gmail.com"
          isDriveConnected={true}
          backupSummary={{
            booksCount: 154,
            sessionsCount: 92,
            quotesCount: 45,
            lastBackupDate: 'Hoy a las 11:30',
          }}
          onBackupNow={onBackupNowMock}
          onRestoreBackup={onRestoreBackupMock}
        />
      );

      expect(getByTestId('cloud-sync-settings-modal')).toBeTruthy();
      expect(getByText('lector.dev@gmail.com')).toBeTruthy();
      expect(getByText('Respaldo Automático')).toBeTruthy();
      expect(getByText('154')).toBeTruthy();
      expect(getByText('92')).toBeTruthy();
      expect(getByText('45')).toBeTruthy();
      expect(getByText(/Hoy a las 11:30/)).toBeTruthy();
      expect(
        getByText(
          'Tu privacidad primero: BaciBooks guarda tu copia en un espacio privado de tu cuenta y nunca puede ver tus fotos, correos ni archivos personales.'
        )
      ).toBeTruthy();

      // Probar boton Guardar copia ahora
      const backupBtn = getByTestId('backup-now-button');
      await act(async () => {
        fireEvent.press(backupBtn);
      });
      expect(onBackupNowMock).toHaveBeenCalledTimes(1);

      // Probar boton Recuperar biblioteca en este teléfono
      const restoreBtn = getByTestId('restore-backup-button');
      await act(async () => {
        fireEvent.press(restoreBtn);
      });
      expect(onRestoreBackupMock).toHaveBeenCalledTimes(1);
    });

    it('muestra tarjeta amigable de resolucion de conflicto y permite resolver con boton local', async () => {
      const onResolveConflictLocalMock = jest.fn();
      const onResolveConflictCloudMock = jest.fn();
      const conflict: ProgressConflictInfo = {
        bookTitle: 'Dune',
        localPage: 180,
        cloudPage: 145,
        totalPages: 412,
      };

      const { getByTestId, getByText } = render(
        <CloudSyncAndSettingsModal
          visible={true}
          onClose={jest.fn()}
          progressConflict={conflict}
          onResolveConflictLocal={onResolveConflictLocalMock}
          onResolveConflictCloud={onResolveConflictCloudMock}
        />
      );

      expect(getByText('¿En qué página vas?')).toBeTruthy();
      expect(getByText(/Detectamos un avance diferente en "Dune"/)).toBeTruthy();
      expect(getByText('Quedarme en la página 180')).toBeTruthy();

      const resolveLocalBtn = getByTestId('resolve-conflict-local-button');
      await act(async () => {
        fireEvent.press(resolveLocalBtn);
      });
      expect(onResolveConflictLocalMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('CloudSyncAndSettingsModal - Pestaña Pendientes', () => {
    it('muestra libros escaneados sin internet, ediciones comunitarias y sincroniza ISBNs pendientes', async () => {
      const onSyncPendingIsbnMock = jest.fn();

      const { getByTestId, getByText } = render(
        <CloudSyncAndSettingsModal
          visible={true}
          onClose={jest.fn()}
          initialTab="PENDIENTES"
          pendingOfflineBooksCount={3}
          sharedCommunityEditionsCount={8}
          onSyncPendingIsbn={onSyncPendingIsbnMock}
        />
      );

      expect(getByText('Libros escaneados sin internet')).toBeTruthy();
      expect(getByText(/3 ejemplares listos para completar/)).toBeTruthy();
      expect(getByText('Ediciones compartidas con otros lectores')).toBeTruthy();
      expect(getByText('8 aportaciones validadas')).toBeTruthy();

      const syncBtn = getByTestId('sync-pending-isbn-button');
      await act(async () => {
        fireEvent.press(syncBtn);
      });
      expect(onSyncPendingIsbnMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('CloudSyncAndSettingsModal - Pestaña Importar y Espacio', () => {
    it('permite importar/exportar CSV y liberar espacio de portadas no usadas', async () => {
      const onImportCsvMock = jest.fn();
      const onExportCsvMock = jest.fn();
      const onCleanUnusedCoversMock = jest.fn();

      const { getByTestId, getByText } = render(
        <CloudSyncAndSettingsModal
          visible={true}
          onClose={jest.fn()}
          initialTab="IMPORTAR"
          coversStorageMb="18.5 MB"
          reclaimableStorageMb="4.2 MB"
          onImportCsv={onImportCsvMock}
          onExportCsv={onExportCsvMock}
          onCleanUnusedCovers={onCleanUnusedCoversMock}
        />
      );

      expect(
        getByText('Traer mis libros de Goodreads, StoryGraph o Excel')
      ).toBeTruthy();
      expect(getByText('Espacio ocupado por portadas')).toBeTruthy();
      expect(getByText('18.5 MB')).toBeTruthy();
      expect(getByText('4.2 MB')).toBeTruthy();

      // Probar importar CSV
      const importBtn = getByTestId('import-csv-button');
      await act(async () => {
        fireEvent.press(importBtn);
      });
      expect(onImportCsvMock).toHaveBeenCalledTimes(1);

      // Probar exportar CSV
      const exportBtn = getByTestId('export-csv-button');
      await act(async () => {
        fireEvent.press(exportBtn);
      });
      expect(onExportCsvMock).toHaveBeenCalledTimes(1);

      // Probar liberar espacio
      const cleanBtn = getByTestId('clean-unused-covers-button');
      await act(async () => {
        fireEvent.press(cleanBtn);
      });
      expect(onCleanUnusedCoversMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('CloudSyncAndSettingsModal - Pestaña Privacidad y Mi Plan', () => {
    it('muestra membresia, clausulas legales desplegables y confirmacion en 2 pasos para borrar datos', async () => {
      const onWipeAllDataMock = jest.fn();

      const { getByTestId, getByText, queryByText } = render(
        <CloudSyncAndSettingsModal
          visible={true}
          onClose={jest.fn()}
          initialTab="PRIVACIDAD"
          membershipType="BaciBooks Pro"
          onWipeAllData={onWipeAllDataMock}
        />
      );

      expect(getByText('Tu membresía actual')).toBeTruthy();
      expect(getByText('BaciBooks Pro')).toBeTruthy();
      expect(getByText('Sin anuncios')).toBeTruthy();
      expect(getByText('Ilimitado')).toBeTruthy();

      // Verificar clausulas legales
      expect(getByText('Uso personal de portadas y citas')).toBeTruthy();
      expect(getByText('Sobre las sugerencias del Detective Literario')).toBeTruthy();
      expect(getByText('Cómo protegemos tu privacidad y tu nube')).toBeTruthy();
      expect(getByText('Términos de uso y suscripciones')).toBeTruthy();

      // Desplegar clausula
      expect(
        queryByText(/Todas las portadas, títulos, sellos editoriales y sinopsis/)
      ).toBeNull();
      fireEvent.press(getByText('Uso personal de portadas y citas'));
      expect(
        getByText(/Todas las portadas, títulos, sellos editoriales y sinopsis/)
      ).toBeTruthy();

      // Dos pasos para borrado de biblioteca
      const wipeButton = getByTestId('wipe-all-data-button');

      // Primer toque: activa advertencia de confirmacion y cambia texto
      await act(async () => {
        fireEvent.press(wipeButton);
        await new Promise((r) => setTimeout(r, 20));
      });
      expect(onWipeAllDataMock).not.toHaveBeenCalled();
      expect(getByText(/¿Seguro que deseas continuar\?/)).toBeTruthy();
      expect(getByText('Confirmar y eliminar todos mis datos')).toBeTruthy();

      // Segundo toque: confirma y ejecuta la eliminacion total
      await act(async () => {
        fireEvent.press(wipeButton);
        await new Promise((r) => setTimeout(r, 20));
      });
      expect(onWipeAllDataMock).toHaveBeenCalledTimes(1);
    });
  });
});
