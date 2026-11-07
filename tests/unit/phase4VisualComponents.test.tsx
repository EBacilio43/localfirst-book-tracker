import React from 'react';
import { render, fireEvent, act, cleanup } from '@testing-library/react-native';
import { Share } from 'react-native';
import { QuoteOcrModal } from '../../src/features/quotes-ocr/components/QuoteOcrModal';
import { QuotePostcardModal } from '../../src/features/quotes-ocr/components/QuotePostcardModal';
import { BookQuotesAndGlossarySection } from '../../src/features/quotes-ocr/components/BookQuotesAndGlossarySection';
import { LoanCoverRibbon } from '../../src/features/loans/components/LoanCoverRibbon';
import { LoanManagerModal } from '../../src/features/loans/components/LoanManagerModal';
import { BookQuote } from '../../src/db/schema/bookQuotes';
import { BookLoan } from '../../src/db/schema/bookLoans';

jest.mock('../../src/db/client', () => {
  return {
    db: {
      select: jest.fn(),
      insert: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    rawDb: {
      getAllSync: jest.fn(),
    },
  };
});

const mockQuotes: BookQuote[] = [
  {
    id: 'quote-1',
    bookId: 'book-dune-1',
    entryType: 'QUOTE',
    content: 'No debo tener miedo. El miedo es el asesino de la mente.',
    pageNumber: 42,
    chapterOrSection: 'Capítulo 1',
    personalNote: 'Frase clave de la letanía contra el miedo.',
    highlightColor: '#F3E8CB',
    isSpoiler: false,
    isFavorite: true,
    createdAt: 1700000000000,
    updatedAt: 1700000000000,
  },
  {
    id: 'quote-2',
    bookId: 'book-dune-1',
    entryType: 'CHARACTER',
    content: 'Paul Atreides: Hijo del duque Leto y dama Jessica. Destinado a ser Muad Dib.',
    pageNumber: 15,
    chapterOrSection: null,
    personalNote: 'Protagonista de la saga.',
    highlightColor: '#D8EAD8',
    isSpoiler: true,
    isFavorite: false,
    createdAt: 1700000100000,
    updatedAt: 1700000100000,
  },
  {
    id: 'quote-3',
    bookId: 'book-dune-1',
    entryType: 'NOTE',
    content: 'Melange: Especia geriátrica que otorga facultades presientes.',
    pageNumber: 88,
    chapterOrSection: 'Glosario Arrakis',
    personalNote: 'Recurso central del universo.',
    highlightColor: '#F2D8CE',
    isSpoiler: false,
    isFavorite: false,
    createdAt: 1700000200000,
    updatedAt: 1700000200000,
  },
];

const mockLentLoan: BookLoan = {
  id: 'loan-active-1',
  bookId: 'book-dune-1',
  loanDirection: 'LENT_OUT',
  borrowerName: 'Carlos Gómez',
  borrowerContact: '+52 55 1234 5678',
  loanedAt: 1700000000000,
  dueDate: Date.now() + 5 * 86400000, // En plazo
  returnedAt: null,
  notificationId: 'notif_loan_1',
  notes: 'Cuidar portada de pasta blanda.',
  createdAt: 1700000000000,
  updatedAt: 1700000000000,
};

const mockOverdueBorrowedLoan: BookLoan = {
  id: 'loan-overdue-2',
  bookId: 'book-hyperion-1',
  loanDirection: 'BORROWED_IN',
  borrowerName: 'Biblioteca Vasconcelos',
  borrowerContact: 'biblioteca@cultura.gob.mx',
  loanedAt: 1700000000000,
  dueDate: Date.now() - 3 * 86400000, // Vencido hace 3 dias
  returnedAt: null,
  notificationId: 'notif_loan_2',
  notes: 'Ejemplar en préstamo interbibliotecario.',
  createdAt: 1700000000000,
  updatedAt: 1700000000000,
};

const mockReturnedLoan: BookLoan = {
  ...mockLentLoan,
  id: 'loan-past-3',
  returnedAt: 1700050000000,
};

describe('Fase 4 Componentes Visuales: quotes-ocr y loans', () => {
  afterEach(() => {
    cleanup();
    jest.restoreAllMocks();
  });

  describe('QuoteOcrModal', () => {
    it('se renderiza correctamente y une guiones de corte al escanear pagina', async () => {
      const onSaveQuoteMock = jest.fn();
      const onCloseMock = jest.fn();

      const { getByTestId, getByText } = render(
        <QuoteOcrModal
          visible={true}
          bookTitle="Dune"
          defaultPage={42}
          onClose={onCloseMock}
          onSaveQuote={onSaveQuoteMock}
        />
      );

      expect(getByTestId('quote-ocr-modal')).toBeTruthy();
      expect(getByText('Dune')).toBeTruthy();

      // Simular escaneo de pagina impresa
      const scanButton = getByTestId('ocr-scan-button');
      await act(async () => {
        fireEvent.press(scanButton);
      });

      // Verifica que la insignia muestra los guiones unidos
      expect(getByTestId('ocr-hyphens-badge')).toBeTruthy();
      expect(getByText('2 guiones de corte unidos automáticamente')).toBeTruthy();

      // Cambiar clasificacion a Personaje (CHARACTER)
      fireEvent.press(getByText('Personaje (CHARACTER)'));

      // Activar proteccion anti-spoilers
      fireEvent.press(getByText('Contiene spoiler'));

      // Guardar cita
      const saveButton = getByTestId('quote-save-button');
      await act(async () => {
        fireEvent.press(saveButton);
      });

      expect(onSaveQuoteMock).toHaveBeenCalledWith(
        expect.objectContaining({
          entryType: 'CHARACTER',
          isSpoiler: true,
          pageNumber: 42,
          content: expect.stringContaining('Aquella disciplina resultaba imprescindible'),
        })
      );
    });

    it('permite cerrar el modal con el boton de cierre', () => {
      const onCloseMock = jest.fn();
      const { getByLabelText } = render(
        <QuoteOcrModal
          visible={true}
          bookTitle="Dune"
          onClose={onCloseMock}
          onSaveQuote={jest.fn()}
        />
      );

      fireEvent.press(getByLabelText('Cerrar modal'));
      expect(onCloseMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('QuotePostcardModal', () => {
    it('muestra el contenido de la cita y permite alternar plantillas editoriales', () => {
      const { getByTestId, getByText } = render(
        <QuotePostcardModal
          visible={true}
          quote={mockQuotes[0]}
          bookTitle="Dune"
          bookAuthor="Frank Herbert"
          bookPublisher="Debolsillo"
          onClose={jest.fn()}
        />
      );

      expect(getByTestId('quote-postcard-modal')).toBeTruthy();
      expect(getByText(/No debo tener miedo/)).toBeTruthy();
      expect(getByText('Frank Herbert · Debolsillo')).toBeTruthy();
      expect(getByText('BACIBOOKS')).toBeTruthy();

      // Cambiar a plantilla Noche
      fireEvent.press(getByText('Noche'));
      expect(getByText('Noche')).toBeTruthy();

      // Cambiar a plantilla Bosque
      fireEvent.press(getByText('Bosque'));
      expect(getByText('Bosque')).toBeTruthy();
    });

    it('invoca Share.share al pulsar Compartir postal literaria', async () => {
      const shareSpy = jest.spyOn(Share, 'share').mockResolvedValue({ action: Share.sharedAction });

      const { getByTestId } = render(
        <QuotePostcardModal
          visible={true}
          quote={mockQuotes[0]}
          bookTitle="Dune"
          bookAuthor="Frank Herbert"
          onClose={jest.fn()}
        />
      );

      const shareButton = getByTestId('share-postcard-button');
      await act(async () => {
        fireEvent.press(shareButton);
      });

      expect(shareSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Cita de Dune',
          message: expect.stringContaining('No debo tener miedo'),
        })
      );
    });
  });

  describe('BookQuotesAndGlossarySection', () => {
    it('filtra por pestañas, muestra banner en Personajes y revela spoilers al tocar', async () => {
      const onOpenOcrModalMock = jest.fn();
      const onOpenPostcardMock = jest.fn();
      const onToggleFavoriteMock = jest.fn();

      const { getByTestId, getByText, queryByText } = render(
        <BookQuotesAndGlossarySection
          quotes={mockQuotes}
          currentBookPage={50}
          onOpenOcrModal={onOpenOcrModalMock}
          onOpenPostcard={onOpenPostcardMock}
          onToggleFavorite={onToggleFavoriteMock}
        />
      );

      expect(getByTestId('book-quotes-glossary-section')).toBeTruthy();

      // Pestaña inicial: Citas (debe mostrar quote-1 y quote-3)
      expect(getByText(/No debo tener miedo/)).toBeTruthy();
      expect(getByText(/Melange: Especia geriátrica/)).toBeTruthy();
      expect(queryByText(/Paul Atreides: Hijo del duque/)).toBeNull();

      // Cambiar a pestaña Personajes
      fireEvent.press(getByText(/Personajes \(1\)/));
      expect(getByText('Glosario personal libre de spoilers')).toBeTruthy();

      // El personaje tiene isSpoiler: true, por lo que inicialmente esta oculto
      expect(getByText('Contiene spoiler · Tocar para revelar')).toBeTruthy();
      expect(queryByText(/Paul Atreides: Hijo del duque/)).toBeNull();

      // Tocar para revelar el spoiler
      await act(async () => {
        fireEvent.press(getByText('Contiene spoiler · Tocar para revelar'));
      });
      expect(getByText(/Paul Atreides: Hijo del duque/)).toBeTruthy();

      // Cambiar a pestaña Favoritas
      fireEvent.press(getByText(/Favoritas \(1\)/));
      expect(getByText(/No debo tener miedo/)).toBeTruthy();

      // Crear postal
      const postcardBtn = getByTestId('open-postcard-quote-1');
      await act(async () => {
        fireEvent.press(postcardBtn);
      });
      expect(onOpenPostcardMock).toHaveBeenCalledWith(mockQuotes[0]);

      // Alternar favorita
      const favBtn = getByTestId('toggle-favorite-quote-1');
      await act(async () => {
        fireEvent.press(favBtn);
      });
      expect(onToggleFavoriteMock).toHaveBeenCalledWith('quote-1');
    });

    it('abre el modal OCR al presionar Escanear cita o Nuevo personaje', async () => {
      const onOpenOcrModalMock = jest.fn();

      const { getByTestId } = render(
        <BookQuotesAndGlossarySection
          quotes={[]}
          onOpenOcrModal={onOpenOcrModalMock}
          onOpenPostcard={jest.fn()}
        />
      );

      await act(async () => {
        fireEvent.press(getByTestId('add-quote-ocr-button'));
      });
      expect(onOpenOcrModalMock).toHaveBeenCalledWith('QUOTE');

      await act(async () => {
        fireEvent.press(getByTestId('add-character-button'));
      });
      expect(onOpenOcrModalMock).toHaveBeenCalledWith('CHARACTER');
    });
  });

  describe('LoanCoverRibbon', () => {
    it('retorna null si el prestamo es null o ya fue devuelto', () => {
      const { queryByTestId, rerender } = render(<LoanCoverRibbon loan={null} />);
      expect(queryByTestId('loan-cover-ribbon')).toBeNull();

      rerender(<LoanCoverRibbon loan={mockReturnedLoan} />);
      expect(queryByTestId('loan-cover-ribbon')).toBeNull();
    });

    it('muestra cintillo de Prestado si es LENT_OUT y en plazo', () => {
      const { getByTestId, getByText, queryByText } = render(
        <LoanCoverRibbon loan={mockLentLoan} />
      );

      expect(getByTestId('loan-cover-ribbon')).toBeTruthy();
      expect(getByText('Prestado')).toBeTruthy();
      expect(queryByText('Vencido')).toBeNull();
    });

    it('muestra indicador de Vencido y Me prestaron para prestamo vencido', () => {
      const { getByTestId, getByText } = render(
        <LoanCoverRibbon loan={mockOverdueBorrowedLoan} />
      );

      expect(getByTestId('loan-cover-ribbon')).toBeTruthy();
      expect(getByText('Me prestaron')).toBeTruthy();
      expect(getByText('Vencido')).toBeTruthy();
    });
  });

  describe('LoanManagerModal', () => {
    it('permite registrar un nuevo prestamo con plazo y direccion', async () => {
      const onCreateLoanMock = jest.fn();
      const onCloseMock = jest.fn();

      const { getByTestId, getByText } = render(
        <LoanManagerModal
          visible={true}
          bookTitle="Dune"
          activeLoan={null}
          onClose={onCloseMock}
          onCreateLoan={onCreateLoanMock}
          onMarkReturned={jest.fn()}
          onExtendLoan={jest.fn()}
        />
      );

      expect(getByTestId('loan-manager-modal')).toBeTruthy();
      expect(getByText('Registrar préstamo')).toBeTruthy();

      // Cambiar a Me prestaron / Biblioteca
      fireEvent.press(getByText('Me prestaron / Biblioteca'));
      expect(
        getByText(/Los libros prestados por terceros o bibliotecas no se contabilizan/)
      ).toBeTruthy();

      // Ingresar nombre de la entidad que presta
      fireEvent.changeText(
        getByTestId('borrower-name-input'),
        'Biblioteca Vasconcelos'
      );

      // Seleccionar 30 dias de plazo
      fireEvent.press(getByText('30 días'));

      // Guardar prestamo
      const saveBtn = getByTestId('save-loan-button');
      await act(async () => {
        fireEvent.press(saveBtn);
      });

      expect(onCreateLoanMock).toHaveBeenCalledWith(
        expect.objectContaining({
          loanDirection: 'BORROWED_IN',
          borrowerName: 'Biblioteca Vasconcelos',
          dueDays: 30,
        })
      );
    });

    it('muestra detalles de prestamo activo y permite extender plazo o devolver', async () => {
      const onExtendLoanMock = jest.fn();
      const onMarkReturnedMock = jest.fn();

      const { getByTestId, getByText } = render(
        <LoanManagerModal
          visible={true}
          bookTitle="Dune"
          activeLoan={mockLentLoan}
          onClose={jest.fn()}
          onCreateLoan={jest.fn()}
          onMarkReturned={onMarkReturnedMock}
          onExtendLoan={onExtendLoanMock}
        />
      );

      expect(getByTestId('loan-manager-modal')).toBeTruthy();
      expect(getByText('Control de préstamo')).toBeTruthy();
      expect(getByText('Presté este libro')).toBeTruthy();
      expect(getByText('Carlos Gómez')).toBeTruthy();
      expect(getByText('+52 55 1234 5678')).toBeTruthy();
      expect(getByText('En plazo')).toBeTruthy();

      // Extender +7 dias plazo
      const extendBtn = getByTestId('extend-loan-button');
      await act(async () => {
        fireEvent.press(extendBtn);
      });
      expect(onExtendLoanMock).toHaveBeenCalledWith('loan-active-1', 7);

      // Marcar como devuelto
      const returnBtn = getByTestId('mark-returned-button');
      await act(async () => {
        fireEvent.press(returnBtn);
      });
      expect(onMarkReturnedMock).toHaveBeenCalledWith('loan-active-1');
    });
  });
});
