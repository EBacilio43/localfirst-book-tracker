/**
 * Utilidades para normalizar y limpiar metadatos de libros (títulos en mayúsculas sostenidas,
 * eliminación de espacios extra, etc.).
 */

const LOWERCASE_WORDS = new Set([
  'de', 'del', 'la', 'las', 'el', 'los', 'en', 'y', 'o', 'un', 'una', 'unos', 'unas', 'a', 'con', 'por', 'para', 'sin', 'sobre'
]);

/**
 * Corrige títulos escritos íntegramente en MAYÚSCULAS SOSTENIDAS (comunes en catálogos antiguos)
 * convirtiéndolos a Title Case legible en español y elimina colas bilingües de exportación
 * comunes en Google Books (ej. "Título en Español / English Title").
 */
export function normalizeTitle(title: string): string {
  if (!title) return '';
  let trimmed = title.trim();

  // Eliminar colas de catálogos de exportación bilingüe ("Título en Español / English Title")
  if (trimmed.includes(' / ')) {
    const parts = trimmed.split(' / ');
    if (parts.length === 2 && parts[0].trim().length > 0) {
      trimmed = parts[0].trim();
    }
  }

  // Si no está completamente en mayúsculas, devolvemos el título original limpio
  const isAllCaps = trimmed === trimmed.toUpperCase() && /[A-ZÁÉÍÓÚÑ]/.test(trimmed);
  if (!isAllCaps) {
    return trimmed;
  }

  const words = trimmed.toLowerCase().split(/\s+/);
  return words
    .map((word, index) => {
      if (index > 0 && LOWERCASE_WORDS.has(word)) {
        return word;
      }
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
}

/**
 * Asegura que una URL de portada use siempre HTTPS para evitar bloqueos de contenido mixto en Android/iOS.
 */
export function ensureHttpsCoverUrl(url?: string): string | undefined {
  if (!url) return undefined;
  if (url.startsWith('http://')) {
    return url.replace('http://', 'https://');
  }
  return url;
}
