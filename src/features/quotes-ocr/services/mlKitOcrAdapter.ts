import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { sanitizeOcrText } from '../utils/ocrTextSanitizer';

export interface OcrExtractionResult {
  rawText: string;
  cleanedText: string;
  hyphensJoinedCount: number;
  normalizedImageUri: string;
  usedFallbackAdapter: boolean;
}

export interface OcrExtractionOptions {
  mockText?: string;
  forceFallback?: boolean;
}

interface MlKitTextRecognitionModule {
  recognize: (imageUri: string) => Promise<{ text: string }>;
}

let nativeRecognitionModule: MlKitTextRecognitionModule | null = null;
try {
  // Intenta resolver el modulo nativo on-device si esta presente en el bundle
  const mlKit = require('@react-native-ml-kit/text-recognition');
  nativeRecognitionModule = (mlKit.default || mlKit) as MlKitTextRecognitionModule;
} catch {
  nativeRecognitionModule = null;
}

/**
 * Normaliza la orientacion de la imagen y comprime a WebP antes del OCR.
 */
async function normalizeImageOrientation(imageUri: string): Promise<string> {
  try {
    const result = await manipulateAsync(
      imageUri,
      [],
      { compress: 0.9, format: SaveFormat.WEBP }
    );
    return result?.uri || imageUri;
  } catch {
    // Entorno de test o fallback si expo-image-manipulator no esta disponible
    return imageUri;
  }
}

/**
 * Extrae texto de una imagen utilizando ML Kit On-Device con fallback automatico para Expo Go.
 */
export async function extractTextFromImage(
  imageUri: string,
  options?: OcrExtractionOptions
): Promise<OcrExtractionResult> {
  const normalizedImageUri = await normalizeImageOrientation(imageUri);

  let rawText = '';
  let usedFallbackAdapter = false;

  if (options?.forceFallback || !nativeRecognitionModule) {
    usedFallbackAdapter = true;
    rawText = options?.mockText ?? '';
  } else {
    try {
      const response = await nativeRecognitionModule.recognize(normalizedImageUri);
      rawText = response?.text ?? '';
      usedFallbackAdapter = false;
    } catch {
      usedFallbackAdapter = true;
      rawText = options?.mockText ?? '';
    }
  }

  const { cleanedText, hyphensJoinedCount } = sanitizeOcrText(rawText);

  return {
    rawText,
    cleanedText,
    hyphensJoinedCount,
    normalizedImageUri,
    usedFallbackAdapter,
  };
}

export class MlKitOcrAdapter {
  static extractText = extractTextFromImage;

  static isNativeAvailable(): boolean {
    return nativeRecognitionModule !== null;
  }
}
