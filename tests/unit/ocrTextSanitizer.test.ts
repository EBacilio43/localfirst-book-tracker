import { sanitizeOcrText } from '../../src/features/quotes-ocr/utils/ocrTextSanitizer';

describe('ocrTextSanitizer Unit Tests', () => {
  it('elimina guiones de corte de palabra al final de linea y los contabiliza', () => {
    const raw = 'Es una obra impres-\ncindible para enten-\r\nder la historia.';
    const result = sanitizeOcrText(raw);

    expect(result.hyphensJoinedCount).toBe(2);
    expect(result.cleanedText).toBe('Es una obra imprescindible para entender la historia.');
  });

  it('soporta espacios accidentales entre el guion y el salto de linea', () => {
    const raw = 'Palabra inmor-   \n   tal de la literatura.';
    const result = sanitizeOcrText(raw);

    expect(result.hyphensJoinedCount).toBe(1);
    expect(result.cleanedText).toBe('Palabra inmortal de la literatura.');
  });

  it('no altera guiones normales en medio de palabras compuestas', () => {
    const raw = 'Un enfoque teorico-practico y socio-economico.';
    const result = sanitizeOcrText(raw);

    expect(result.hyphensJoinedCount).toBe(0);
    expect(result.cleanedText).toBe('Un enfoque teorico-practico y socio-economico.');
  });

  it('convierte saltos de linea simples dentro de un parrafo en espacios simples', () => {
    const raw = 'En un lugar de la Mancha,\nde cuyo nombre no quiero acordarme,\nno ha mucho tiempo que vivia un hidalgo.';
    const result = sanitizeOcrText(raw);

    expect(result.cleanedText).toBe(
      'En un lugar de la Mancha, de cuyo nombre no quiero acordarme, no ha mucho tiempo que vivia un hidalgo.'
    );
  });

  it('preserva parrafos separados por saltos de linea dobles', () => {
    const raw = 'Primer parrafo de la cita.\nSigue en la misma idea.\n\nSegundo parrafo con otra reflexion.\nConclusion del segundo parrafo.';
    const result = sanitizeOcrText(raw);

    expect(result.cleanedText).toBe(
      'Primer parrafo de la cita. Sigue en la misma idea.\n\nSegundo parrafo con otra reflexion. Conclusion del segundo parrafo.'
    );
  });

  it('colapsa multiples espacios y tabulaciones intermedias', () => {
    const raw = 'Texto     con   demasiados \t espacios   intermedios.';
    const result = sanitizeOcrText(raw);

    expect(result.cleanedText).toBe('Texto con demasiados espacios intermedios.');
  });

  it('maneja cadenas vacias de forma segura', () => {
    expect(sanitizeOcrText('')).toEqual({ cleanedText: '', hyphensJoinedCount: 0 });
    // @ts-expect-error probando valor nulo
    expect(sanitizeOcrText(null)).toEqual({ cleanedText: '', hyphensJoinedCount: 0 });
  });
});
