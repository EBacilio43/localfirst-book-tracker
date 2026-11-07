export interface CoverStorageAuditReport {
  activeFilesCount: number;
  orphanFilesCount: number;
  orphanFileUris: string[];
  reclaimableBytes: number;
}

/**
 * Normaliza una URI de portada removiendo prefijos de esquema y estandarizando diagonales.
 */
export function normalizeCoverUri(uri: string): string {
  return uri.trim().replace(/^file:\/\//i, '').replace(/\\/g, '/');
}

/**
 * Extrae el nombre base de archivo de una URI o ruta local.
 */
export function extractFilename(uri: string): string {
  const parts = uri.replace(/\\/g, '/').split('/');
  return parts[parts.length - 1] ?? uri;
}

/**
 * Audita los archivos de portadas en disco para identificar aquellos que ya no estan
 * referenciados por ningun libro en la biblioteca (archivos huerfanos).
 */
export function auditOrphanCoverFiles(
  filesOnDisk: Array<{ uri: string; sizeBytes: number }>,
  activeCoverUrisInDb: Array<string | null | undefined>
): CoverStorageAuditReport {
  const activeExactSet = new Set<string>();
  const activeNormalizedSet = new Set<string>();
  const activeFilenamesSet = new Set<string>();

  for (const uri of activeCoverUrisInDb) {
    if (!uri) continue;
    const trimmed = uri.trim();
    if (!trimmed) continue;

    activeExactSet.add(trimmed);
    const norm = normalizeCoverUri(trimmed);
    activeNormalizedSet.add(norm);
    const filename = extractFilename(trimmed);
    if (filename.length > 0) {
      activeFilenamesSet.add(filename);
    }
  }

  let activeFilesCount = 0;
  let orphanFilesCount = 0;
  const orphanFileUris: string[] = [];
  let reclaimableBytes = 0;

  for (const file of filesOnDisk) {
    const isExact = activeExactSet.has(file.uri);
    const isNorm = activeNormalizedSet.has(normalizeCoverUri(file.uri));
    const isFilename = activeFilenamesSet.has(extractFilename(file.uri));

    if (isExact || isNorm || isFilename) {
      activeFilesCount++;
    } else {
      orphanFilesCount++;
      orphanFileUris.push(file.uri);
      reclaimableBytes += file.sizeBytes;
    }
  }

  return {
    activeFilesCount,
    orphanFilesCount,
    orphanFileUris,
    reclaimableBytes,
  };
}

/**
 * Elimina fisicamente los archivos de portadas huerfanos para recuperar espacio de almacenamiento.
 */
export async function purgeOrphanCoverFiles(
  filesOnDisk: Array<{ uri: string; sizeBytes: number }>,
  activeCoverUrisInDb: Array<string | null | undefined>,
  deleteFileFn?: (uri: string) => Promise<void>
): Promise<{ deletedCount: number; freedBytes: number }> {
  const audit = auditOrphanCoverFiles(filesOnDisk, activeCoverUrisInDb);

  if (audit.orphanFilesCount === 0) {
    return { deletedCount: 0, freedBytes: 0 };
  }

  const sizeByUri = new Map<string, number>();
  for (const file of filesOnDisk) {
    sizeByUri.set(file.uri, file.sizeBytes);
  }

  let deletedCount = 0;
  let freedBytes = 0;

  for (const orphanUri of audit.orphanFileUris) {
    try {
      if (deleteFileFn) {
        await deleteFileFn(orphanUri);
      }
      deletedCount++;
      freedBytes += sizeByUri.get(orphanUri) ?? 0;
    } catch {
      // Si un archivo no se puede borrar de inmediato se omite sin detener el proceso
    }
  }

  return {
    deletedCount,
    freedBytes,
  };
}
