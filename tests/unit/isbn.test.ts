import {
  normalizeIsbn,
  isValidIsbn10,
  isValidIsbn13,
  convertIsbn10ToIsbn13,
  parseAndValidateIsbn,
  isInternalStoreBarcode,
} from '../../src/features/catalog/utils/isbn';

describe('ISBN Utilities & Validation', () => {
  describe('normalizeIsbn', () => {
    it('elimina guiones y espacios', () => {
      expect(normalizeIsbn('978-84-450-0066-3')).toBe('9788445000663');
      expect(normalizeIsbn(' 0 306 40615 2 ')).toBe('0306406152');
    });

    it('convierte la x final a mayúscula', () => {
      expect(normalizeIsbn('0-8044-2957-x')).toBe('080442957X');
    });

    it('maneja strings vacíos con resiliencia', () => {
      expect(normalizeIsbn('')).toBe('');
    });
  });

  describe('isValidIsbn10', () => {
    it('valida ISBN-10 correctos con dígito numérico', () => {
      expect(isValidIsbn10('0-306-40615-2')).toBe(true);
      expect(isValidIsbn10('0471958697')).toBe(true);
    });

    it('valida ISBN-10 correctos que terminan en X (checksum 10)', () => {
      expect(isValidIsbn10('0-8044-2957-X')).toBe(true);
      expect(isValidIsbn10('080442957x')).toBe(true);
    });

    it('rechaza ISBN-10 con checksum inválido o longitud incorrecta', () => {
      expect(isValidIsbn10('0-306-40615-3')).toBe(false);
      expect(isValidIsbn10('12345')).toBe(false);
      expect(isValidIsbn10('0-306-40615-20')).toBe(false);
    });
  });

  describe('isValidIsbn13', () => {
    it('valida ISBN-13 correctos con prefijo 978', () => {
      expect(isValidIsbn13('978-84-450-0066-3')).toBe(true);
      expect(isValidIsbn13('9780306406157')).toBe(true);
    });

    it('valida ISBN-13 correctos con prefijo 979 (nuevo rango Bookland)', () => {
      // 979-10-90636-07-1
      expect(isValidIsbn13('9791090636071')).toBe(true);
    });

    it('rechaza ISBN-13 con dígito verificador incorrecto', () => {
      expect(isValidIsbn13('9788445000664')).toBe(false);
    });

    it('rechaza códigos de 13 dígitos que no son Bookland (no inician con 978 o 979)', () => {
      expect(isValidIsbn13('2001234567890')).toBe(false);
      expect(isValidIsbn13('1234567890123')).toBe(false);
    });
  });

  describe('convertIsbn10ToIsbn13', () => {
    it('convierte correctamente ISBN-10 a ISBN-13 con prefijo 978', () => {
      expect(convertIsbn10ToIsbn13('0-306-40615-2')).toBe('9780306406157');
    });

    it('convierte ISBN-10 que termina en X', () => {
      expect(convertIsbn10ToIsbn13('0-8044-2957-X')).toBe('9780804429573');
    });

    it('devuelve null si el ISBN-10 es inválido', () => {
      expect(convertIsbn10ToIsbn13('0-306-40615-9')).toBeNull();
      expect(convertIsbn10ToIsbn13('invalido')).toBeNull();
    });
  });

  describe('isInternalStoreBarcode', () => {
    it('detecta códigos internos de librerías tipo 200/201/290', () => {
      expect(isInternalStoreBarcode('2000000123456')).toBe(true);
      expect(isInternalStoreBarcode('2019999999999')).toBe(true);
      expect(isInternalStoreBarcode('2901234567890')).toBe(true);
    });

    it('no marca ISBN reales como códigos de tienda', () => {
      expect(isInternalStoreBarcode('9788445000663')).toBe(false);
      expect(isInternalStoreBarcode('9791090636071')).toBe(false);
    });
  });

  describe('parseAndValidateIsbn', () => {
    it('parsea un ISBN-13 válido', () => {
      const result = parseAndValidateIsbn('978-84-450-0066-3');
      expect(result.isValid).toBe(true);
      expect(result.isbn13).toBe('9788445000663');
      expect(result.isStoreCode).toBe(false);
    });

    it('parsea un ISBN-10 válido y lo convierte a ISBN-13', () => {
      const result = parseAndValidateIsbn('0-306-40615-2');
      expect(result.isValid).toBe(true);
      expect(result.isbn13).toBe('9780306406157');
      expect(result.isbn10).toBe('0306406152');
      expect(result.isStoreCode).toBe(false);
    });

    it('identifica etiquetas internas de tienda', () => {
      const result = parseAndValidateIsbn('200-1234-5678');
      expect(result.isValid).toBe(false);
      expect(result.isStoreCode).toBe(true);
    });
  });
});
