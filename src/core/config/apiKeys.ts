/**
 * Configuración centralizada de claves de API obtenidas desde variables de entorno.
 */
export const API_KEYS = {
  gemini:
    typeof process !== 'undefined'
      ? process.env?.EXPO_PUBLIC_GEMINI_API_KEY
      : undefined,
  googleBooks:
    typeof process !== 'undefined'
      ? process.env?.EXPO_PUBLIC_GOOGLE_BOOKS_API_KEY
      : undefined,
};

