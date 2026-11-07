import { BookQuotesRepository } from '../../src/db/repositories/bookQuotesRepository';
import { db, rawDb } from '../../src/db/client';
import { BookQuote } from '../../src/db/schema/bookQuotes';

jest.mock('../../src/db/client', () => {
  const mockDb = {
    select: jest.fn(),
    insert: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };
  const mockRawDb = {
    getAllSync: jest.fn(),
  };
  return {
    db: mockDb,
    rawDb: mockRawDb,
  };
});

describe('BookQuotesRepository Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const sampleQuote: BookQuote = {
    id: 'quote-1',
    bookId: 'book-1',
    entryType: 'QUOTE',
    content: 'En un lugar de la Mancha de cuyo nombre no quiero acordarme.',
    pageNumber: 15,
    chapterOrSection: 'Capitulo 1',
    personalNote: 'Frase inicial legendaria.',
    highlightColor: '#F3E8CB',
    isSpoiler: false,
    isFavorite: false,
    createdAt: 1700000000,
    updatedAt: 1700000000,
  };

  it('obtiene una cita por su identificador unico', async () => {
    const mockLimit = jest.fn().mockResolvedValue([sampleQuote]);
    const mockWhere = jest.fn().mockReturnValue({ limit: mockLimit });
    const mockFrom = jest.fn().mockReturnValue({ where: mockWhere });
    (db.select as jest.Mock).mockReturnValue({ from: mockFrom });

    const quote = await BookQuotesRepository.getById('quote-1');

    expect(quote).toEqual(sampleQuote);
  });

  it('crea una cita aplicando sanitizeOcrText de forma obligatoria al contenido', async () => {
    const mockValues = jest.fn().mockResolvedValue(undefined);
    (db.insert as jest.Mock).mockReturnValue({ values: mockValues });

    // Mock para la consulta getById posterior a la insercion
    const mockLimit = jest.fn().mockResolvedValue([sampleQuote]);
    const mockWhere = jest.fn().mockReturnValue({ limit: mockLimit });
    const mockFrom = jest.fn().mockReturnValue({ where: mockWhere });
    (db.select as jest.Mock).mockReturnValue({ from: mockFrom });

    const rawContent = 'Texto con corte de pa-\nlabra por guion.';
    await BookQuotesRepository.create({
      id: 'quote-custom',
      bookId: 'book-1',
      content: rawContent,
      pageNumber: 20,
    });

    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'quote-custom',
        content: 'Texto con corte de palabra por guion.',
      })
    );
  });

  it('actualiza una cita y vuelve a sanitizar si se modifica el contenido', async () => {
    // Primer select para getById existente
    const mockLimit = jest.fn().mockResolvedValue([sampleQuote]);
    const mockWhereSelect = jest.fn().mockReturnValue({ limit: mockLimit });
    const mockFrom = jest.fn().mockReturnValue({ where: mockWhereSelect });
    (db.select as jest.Mock).mockReturnValue({ from: mockFrom });

    const mockWhereUpdate = jest.fn().mockResolvedValue(undefined);
    const mockSet = jest.fn().mockReturnValue({ where: mockWhereUpdate });
    (db.update as jest.Mock).mockReturnValue({ set: mockSet });

    await BookQuotesRepository.update('quote-1', {
      content: 'Nuevo texto con cor-\nte.',
    });

    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({
        content: 'Nuevo texto con corte.',
      })
    );
  });

  it('alterna el estado de favorita', async () => {
    const mockLimit = jest.fn().mockResolvedValue([{ ...sampleQuote, isFavorite: false }]);
    const mockWhereSelect = jest.fn().mockReturnValue({ limit: mockLimit });
    const mockFrom = jest.fn().mockReturnValue({ where: mockWhereSelect });
    (db.select as jest.Mock).mockReturnValue({ from: mockFrom });

    const mockWhereUpdate = jest.fn().mockResolvedValue(undefined);
    const mockSet = jest.fn().mockReturnValue({ where: mockWhereUpdate });
    (db.update as jest.Mock).mockReturnValue({ set: mockSet });

    await BookQuotesRepository.toggleFavorite('quote-1');

    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({
        isFavorite: true,
      })
    );
  });

  it('alterna la marca de spoiler', async () => {
    const mockLimit = jest.fn().mockResolvedValue([{ ...sampleQuote, isSpoiler: false }]);
    const mockWhereSelect = jest.fn().mockReturnValue({ limit: mockLimit });
    const mockFrom = jest.fn().mockReturnValue({ where: mockWhereSelect });
    (db.select as jest.Mock).mockReturnValue({ from: mockFrom });

    const mockWhereUpdate = jest.fn().mockResolvedValue(undefined);
    const mockSet = jest.fn().mockReturnValue({ where: mockWhereUpdate });
    (db.update as jest.Mock).mockReturnValue({ set: mockSet });

    await BookQuotesRepository.toggleSpoiler('quote-1');

    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({
        isSpoiler: true,
      })
    );
  });

  it('elimina una cita de forma idempotente', async () => {
    const mockLimit = jest.fn().mockResolvedValue([sampleQuote]);
    const mockWhereSelect = jest.fn().mockReturnValue({ limit: mockLimit });
    const mockFrom = jest.fn().mockReturnValue({ where: mockWhereSelect });
    (db.select as jest.Mock).mockReturnValue({ from: mockFrom });

    const mockWhereDelete = jest.fn().mockResolvedValue(undefined);
    (db.delete as jest.Mock).mockReturnValue({ where: mockWhereDelete });

    const success = await BookQuotesRepository.delete('quote-1');

    expect(success).toBe(true);
    expect(db.delete).toHaveBeenCalled();
  });

  it('realiza busqueda en quotes_fts y ejecuta fallback NFD cuando no hay coincidencias directas FTS', async () => {
    const quoteWithAccent: BookQuote = {
      ...sampleQuote,
      id: 'quote-2',
      content: 'El corazón tiene razones que la razón ignora.',
    };

    // 1. Simular fallo o resultado vacio en FTS5
    (rawDb.getAllSync as jest.Mock).mockReturnValue([]);

    // 2. Simular retorno de getAll con diacriticos
    const mockOrderBy = jest.fn().mockResolvedValue([quoteWithAccent]);
    (db.select as jest.Mock).mockReturnValue({
      from: jest.fn().mockReturnValue({
        orderBy: mockOrderBy,
      }),
    });

    // Busqueda sin tilde "corazon" debe encontrar "corazón"
    const results = await BookQuotesRepository.searchFts('corazon');

    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('quote-2');
  });
});
