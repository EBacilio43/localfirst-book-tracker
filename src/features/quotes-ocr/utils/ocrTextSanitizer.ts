export interface SanitizedOcrResult {
  cleanedText: string;
  hyphensJoinedCount: number;
}

/**
 * Limpia y normaliza el texto extraido por OCR on-device:
 * 1. Une palabras cortadas con guion al final de linea (ej. "impres-\ncindible" -> "imprescindible").
 * 2. Une saltos de linea simples dentro de un mismo parrafo convirtiendolos en un espacio simple.
 * 3. Preserva los saltos de parrafo dobles (\n\n).
 * 4. Colapsa multiples espacios contiguos y recorta espacios residuales.
 */
export function sanitizeOcrText(rawText: string): SanitizedOcrResult {
  if (!rawText || typeof rawText !== 'string') {
    return {
      cleanedText: '',
      hyphensJoinedCount: 0,
    };
  }

  // 1. Detectar y contar uniones de palabras cortadas con guion al final de linea
  const hyphenMatches = rawText.match(/\-\s*\r?\n\s*/g);
  const hyphensJoinedCount = hyphenMatches ? hyphenMatches.length : 0;
  const withoutHyphenBreaks = rawText.replace(/\-\s*\r?\n\s*/g, '');

  // 2. Normalizar retornos de carro a saltos de linea estandar
  const normalizedNewlines = withoutHyphenBreaks.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // 3. Separar por parrafos (dos o mas saltos de linea)
  const rawParagraphs = normalizedNewlines.split(/\n\s*\n+/);

  // 4. Procesar cada parrafo: convertir saltos de linea simples en espacios y colapsar espacios
  const cleanedParagraphs = rawParagraphs
    .map((paragraph) =>
      paragraph
        .replace(/\n+/g, ' ')
        .replace(/[ \t]+/g, ' ')
        .trim()
    )
    .filter((paragraph) => paragraph.length > 0);

  return {
    cleanedText: cleanedParagraphs.join('\n\n'),
    hyphensJoinedCount,
  };
}
