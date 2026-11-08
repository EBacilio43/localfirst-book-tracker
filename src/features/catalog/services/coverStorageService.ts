import * as FileSystem from 'expo-file-system';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

export class CoverStorageService {
  private static readonly COVERS_SUBDIR = 'covers/';

  /**
   * Obtiene y asegura la existencia del directorio persistente para portadas locales.
   */
  static async getCoversDirectory(): Promise<string> {
    const baseDir = FileSystem.documentDirectory || '';
    const coversDir = `${baseDir}${this.COVERS_SUBDIR}`;

    if (FileSystem.documentDirectory) {
      try {
        const dirInfo = await FileSystem.getInfoAsync(coversDir);
        if (!dirInfo.exists) {
          await FileSystem.makeDirectoryAsync(coversDir, { intermediates: true });
        }
      } catch {
        // Silencioso en caso de restricciones de acceso o entorno de pruebas
      }
    }

    return coversDir;
  }

  /**
   * Optimiza una imagen capturada con la camara a formato WebP (ancho maximo 800px)
   * y la almacena en el directorio permanente de la aplicacion.
   */
  static async optimizeAndSaveCover(
    sourceUri: string,
    isbn13OrId: string
  ): Promise<string> {
    const cleanId = isbn13OrId.replace(/[^a-zA-Z0-9_-]/g, '') || 'cover';
    const timestamp = Date.now();
    const fileName = `cover_${cleanId}_${timestamp}.webp`;

    try {
      // 1. Comprimir y normalizar tamano a WebP
      const manipulated = await manipulateAsync(
        sourceUri,
        [{ resize: { width: 800 } }],
        { compress: 0.85, format: SaveFormat.WEBP }
      );

      // 2. Persistir en carpeta de documentos de la aplicacion
      if (FileSystem.documentDirectory) {
        const coversDir = await this.getCoversDirectory();
        const destination = `${coversDir}${fileName}`;
        await FileSystem.copyAsync({
          from: manipulated.uri,
          to: destination,
        });
        return destination;
      }

      return manipulated.uri;
    } catch {
      // Fallback de resiliencia si la manipulacion nativa no esta disponible en el entorno
      return sourceUri;
    }
  }
}
