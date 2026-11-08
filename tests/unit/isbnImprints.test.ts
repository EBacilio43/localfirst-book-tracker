import { resolveImprintFromIsbn } from '../../src/features/catalog/utils/isbnImprints';

describe('resolveImprintFromIsbn - Mapeo determinista de sellos editoriales', () => {
  it('resuelve Debolsillo para prefijos 978-84-663', () => {
    expect(
      resolveImprintFromIsbn('9788466359443', 'Dios emperador de Dune', 'National Geographic Books')
    ).toBe('Debolsillo');
  });

  it('resuelve Penguin Clásicos para prefijos 978-607-31 con títulos clásicos', () => {
    expect(
      resolveImprintFromIsbn('9786073140638', 'Cuentos de Fiodor Dostoievski', 'National Geographic Books')
    ).toBe('Penguin Clásicos');
  });

  it('resuelve Alfaguara para prefijo 978-84-204', () => {
    expect(resolveImprintFromIsbn('9788420412345')).toBe('Alfaguara');
  });

  it('resuelve Planeta para prefijo 978-84-08', () => {
    expect(resolveImprintFromIsbn('9788408123456')).toBe('Planeta');
  });

  it('resuelve Anagrama para prefijo 978-84-339', () => {
    expect(resolveImprintFromIsbn('9788433912345')).toBe('Anagrama');
  });

  it('corrige National Geographic Books a Penguin Random House si el prefijo no es especifico', () => {
    expect(
      resolveImprintFromIsbn('9781234567890', 'Novela Cualquiera', 'National Geographic Books')
    ).toBe('Penguin Random House');
  });

  it('mantiene la editorial original si no es un artefacto de distribuidor', () => {
    expect(resolveImprintFromIsbn('9781234567890', 'Novela', 'Editorial Siruela')).toBe('Editorial Siruela');
  });
});

