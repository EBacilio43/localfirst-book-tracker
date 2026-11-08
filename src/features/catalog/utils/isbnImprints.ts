/**
 * Mapeo determinista de sellos editoriales basado en los prefijos de registro ISBN
 * de la Agencia del ISBN (España: 84, México: 607, etc.).
 * Permite resolver el sello exacto (ej. Debolsillo, Alfaguara, Penguin Clásicos)
 * de forma instantánea y 100% offline, corrigiendo además artefactos de distribuidores erróneos.
 */

export function resolveImprintFromIsbn(
  isbn13: string,
  title?: string,
  rawPublisher?: string
): string | undefined {
  const cleanIsbn = isbn13.replace(/[-\s]/g, '');

  // 1. Prefijos de editoriales en España (978-84-...)
  if (
    cleanIsbn.startsWith('97884663') || // Debolsillo
    cleanIsbn.startsWith('978849759') || // Debolsillo
    cleanIsbn.startsWith('978849908') || // Debolsillo
    cleanIsbn.startsWith('978849793')    // Debolsillo
  ) {
    return 'Debolsillo';
  }

  if (cleanIsbn.startsWith('97884204') || cleanIsbn.startsWith('97860738')) {
    return 'Alfaguara';
  }

  if (cleanIsbn.startsWith('9788401')) {
    return 'Plaza & Janés';
  }

  if (cleanIsbn.startsWith('97884397')) {
    return 'Literatura Random House';
  }

  if (cleanIsbn.startsWith('97884339')) {
    return 'Anagrama';
  }

  if (cleanIsbn.startsWith('97884206')) {
    return 'Alianza Editorial';
  }

  if (cleanIsbn.startsWith('97884376')) {
    return 'Cátedra';
  }

  if (cleanIsbn.startsWith('978847888')) {
    return 'Salamandra';
  }

  if (cleanIsbn.startsWith('97884450')) {
    return 'Minotauro';
  }

  if (cleanIsbn.startsWith('9788408') || cleanIsbn.startsWith('97860707')) {
    return 'Planeta';
  }

  if (cleanIsbn.startsWith('97860716')) {
    return 'Fondo de Cultura Económica';
  }

  // 2. Prefijo 978-607-31-... (Penguin Random House México)
  if (cleanIsbn.startsWith('97860731')) {
    const lowerTitle = (title || '').toLowerCase();
    if (
      lowerTitle.includes('cuentos') ||
      lowerTitle.includes('dostoievski') ||
      lowerTitle.includes('clasicos') ||
      lowerTitle.includes('poesia')
    ) {
      return 'Penguin Clásicos';
    }
    return 'Debolsillo';
  }

  // 3. Si Google Books devolvió un distribuidor erróneo como National Geographic Books
  if (rawPublisher && rawPublisher.toLowerCase().includes('national geographic')) {
    return 'Penguin Random House';
  }

  return rawPublisher;
}

