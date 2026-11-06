/**
 * Utilidades de validación, sanitización y conversión de códigos ISBN (ISBN-10 e ISBN-13).
 * Cumple con el estándar Bookland EAN-13 y reglas de BaciBooks.
 */

/**
 * Limpia y normaliza un string de ISBN (elimina guiones, espacios y convierte 'x' a mayúscula).
 */
export function normalizeIsbn(raw: string): string {
  if (!raw) return '';
  return raw.replace(/[-\s]/g, '').trim().toUpperCase();
}

/**
 * Valida si un string es un código de barras de librería interna (ej. prefijo 200, 201...)
 * que no corresponde a un libro comercial publicado.
 */
export function isInternalStoreBarcode(code: string): boolean {
  const clean = normalizeIsbn(code);
  return clean.startsWith('200') || clean.startsWith('201') || clean.startsWith('290');
}

/**
 * Valida el checksum de un ISBN-10.
 */
export function isValidIsbn10(isbn: string): boolean {
  const clean = normalizeIsbn(isbn);
  if (clean.length !== 10) return false;

  let sum = 0;
  for (let i = 0; i < 9; i++) {
    const digit = parseInt(clean[i], 10);
    if (isNaN(digit)) return false;
    sum += digit * (10 - i);
  }

  const lastChar = clean[9];
  let checkDigit: number;
  if (lastChar === 'X') {
    checkDigit = 10;
  } else {
    checkDigit = parseInt(lastChar, 10);
    if (isNaN(checkDigit)) return false;
  }

  sum += checkDigit;
  return sum % 11 === 0;
}

/**
 * Valida el checksum de un ISBN-13 (EAN-13 estándar Bookland con prefijos 978 o 979).
 */
export function isValidIsbn13(isbn: string): boolean {
  const clean = normalizeIsbn(isbn);
  if (clean.length !== 13) return false;
  if (!clean.startsWith('978') && !clean.startsWith('979')) return false;

  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const digit = parseInt(clean[i], 10);
    if (isNaN(digit)) return false;
    sum += digit * (i % 2 === 0 ? 1 : 3);
  }

  const checkDigit = parseInt(clean[12], 10);
  if (isNaN(checkDigit)) return false;

  const calculatedCheck = (10 - (sum % 10)) % 10;
  return checkDigit === calculatedCheck;
}

/**
 * Convierte un ISBN-10 válido a su equivalente estándar ISBN-13 con prefijo 978.
 */
export function convertIsbn10ToIsbn13(isbn10: string): string | null {
  const clean = normalizeIsbn(isbn10);
  if (!isValidIsbn10(clean)) return null;

  const base9 = clean.substring(0, 9);
  const prefixAndBase = `978${base9}`;

  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const digit = parseInt(prefixAndBase[i], 10);
    sum += digit * (i % 2 === 0 ? 1 : 3);
  }

  const checkDigit = (10 - (sum % 10)) % 10;
  return `${prefixAndBase}${checkDigit}`;
}

/**
 * Valida cualquier código ISBN (10 o 13) y devuelve el código normalizado de 13 dígitos
 * para almacenamiento estándar.
 */
export function parseAndValidateIsbn(raw: string): {
  isValid: boolean;
  isbn13: string | null;
  isbn10: string | null;
  isStoreCode: boolean;
} {
  const clean = normalizeIsbn(raw);
  const isStore = isInternalStoreBarcode(clean);

  if (clean.length === 13 && isValidIsbn13(clean)) {
    return {
      isValid: true,
      isbn13: clean,
      isbn10: null,
      isStoreCode: false,
    };
  }

  if (clean.length === 10 && isValidIsbn10(clean)) {
    const isbn13 = convertIsbn10ToIsbn13(clean);
    return {
      isValid: true,
      isbn13,
      isbn10: clean,
      isStoreCode: false,
    };
  }

  return {
    isValid: false,
    isbn13: null,
    isbn10: null,
    isStoreCode: isStore,
  };
}
