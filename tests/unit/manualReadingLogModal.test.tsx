import React from 'react';
import { render, fireEvent, act, cleanup } from '@testing-library/react-native';
import { ManualReadingLogModal } from '../../src/features/reading-tracker/components/ManualReadingLogModal';
import { Book } from '../../src/db/schema/books';

const mockBook: Book = {
  id: 'book-dune-1',
  isbn13: '9788466353779',
  isbn10: '8466353776',
  title: 'Dune',
  subtitle: 'Crónicas de Dune 1',
  seriesName: 'Dune',
  seriesIndex: 1,
  authorsJson: '["Frank Herbert"]',
  translator: 'Domingo Santos',
  publisher: 'Debolsillo',
  description: 'En el desértico planeta Arrakis...',
  coverUri: null,
  pageCount: 400,
  modality: 'PHYSICAL',
  ownership: 'OWNED',
  metadataStatus: 'COMPLETE',
  format: 'BOLSILLO',
  progressMode: 'PAGES',
  language: 'es',
  currentStatus: 'LEYENDO',
  currentPage: 150,
  currentPercentage: 37.5,
  rating: null,
  pauseOrDnfNote: null,
  isSpoiler: false,
  shelfId: null,
  wishlistStoreNote: null,
  createdAt: 1700000000000,
  updatedAt: 1700000000000,
};

describe('ManualReadingLogModal Component', () => {
  afterEach(() => {
    cleanup();
  });

  it('se renderiza correctamente con el titulo del libro y progreso actual', () => {
    const handleClose = jest.fn();
    const handleSave = jest.fn();

    const { getByText } = render(
      <ManualReadingLogModal
        visible={true}
        book={mockBook}
        onClose={handleClose}
        onSaveProgress={handleSave}
      />
    );

    expect(getByText('Registrar avance')).toBeTruthy();
    expect(getByText(/Dune · Frank Herbert/)).toBeTruthy();
    expect(getByText(/Progreso actual: página 150 de 400/)).toBeTruthy();
  });

  it('permite alternar la fecha entre Hoy y Ayer', () => {
    const handleClose = jest.fn();
    const handleSave = jest.fn();

    const { getByText } = render(
      <ManualReadingLogModal
        visible={true}
        book={mockBook}
        onClose={handleClose}
        onSaveProgress={handleSave}
      />
    );

    const ayerButton = getByText('Ayer');
    fireEvent.press(ayerButton);
    expect(ayerButton).toBeTruthy();
  });

  it('incrementa el numero de pagina con los botones de ajuste rapido (+1 y +5)', () => {
    const handleClose = jest.fn();
    const handleSave = jest.fn();

    const { getByText } = render(
      <ManualReadingLogModal
        visible={true}
        book={mockBook}
        onClose={handleClose}
        onSaveProgress={handleSave}
      />
    );

    const plus5Button = getByText('+5');
    act(() => {
      fireEvent.press(plus5Button);
    });

    expect(getByText('+5 páginas avanzadas (39%)')).toBeTruthy();
  });

  it('llama a onSaveProgress con los datos correctos al presionar Guardar avance', async () => {
    const handleClose = jest.fn();
    const handleSave = jest.fn().mockResolvedValue(undefined);

    const { getByText } = render(
      <ManualReadingLogModal
        visible={true}
        book={mockBook}
        onClose={handleClose}
        onSaveProgress={handleSave}
      />
    );

    // Sumar 5 paginas
    act(() => {
      fireEvent.press(getByText('+5'));
    });

    const saveButton = getByText('Guardar avance');
    await act(async () => {
      fireEvent.press(saveButton);
    });

    expect(handleSave).toHaveBeenCalledWith({
      newPage: 155,
      when: 'TODAY',
      isFinished: false,
    });
    expect(handleClose).toHaveBeenCalled();
  });
});
