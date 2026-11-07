import {
  extractTextFromImage,
  MlKitOcrAdapter,
} from '../../src/features/quotes-ocr/services/mlKitOcrAdapter';

jest.mock('expo-image-manipulator', () => ({
  manipulateAsync: jest.fn().mockImplementation((uri) =>
    Promise.resolve({
      uri: `${uri}_normalized.webp`,
      width: 800,
      height: 1200,
    })
  ),
  SaveFormat: {
    WEBP: 'webp',
    JPEG: 'jpeg',
    PNG: 'png',
  },
}));

describe('mlKitOcrAdapter Unit Tests', () => {
  it('normaliza la orientacion de la imagen y extrae texto mediante fallback en Expo Go', async () => {
    const rawMockText = 'Cita impres-\ncindible de la obra.\n\nSegundo parrafo.';
    const result = await extractTextFromImage('file:///test_image.jpg', {
      mockText: rawMockText,
      forceFallback: true,
    });

    expect(result.normalizedImageUri).toBe('file:///test_image.jpg_normalized.webp');
    expect(result.usedFallbackAdapter).toBe(true);
    expect(result.rawText).toBe(rawMockText);
    expect(result.hyphensJoinedCount).toBe(1);
    expect(result.cleanedText).toBe('Cita imprescindible de la obra.\n\nSegundo parrafo.');
  });

  it('soporta la clase estatica MlKitOcrAdapter', async () => {
    const result = await MlKitOcrAdapter.extractText('file:///page.png', {
      mockText: 'Texto simple',
    });

    expect(result.cleanedText).toBe('Texto simple');
  });

  it('maneja de forma segura errores de normalizacion de imagen', async () => {
    const { manipulateAsync } = require('expo-image-manipulator');
    manipulateAsync.mockRejectedValueOnce(new Error('Fallo manipulador nativo'));

    const result = await extractTextFromImage('file:///broken_image.jpg', {
      mockText: 'Texto recuperado',
    });

    // En caso de fallo en manipulador, mantiene la uri original
    expect(result.normalizedImageUri).toBe('file:///broken_image.jpg');
    expect(result.cleanedText).toBe('Texto recuperado');
  });
});
