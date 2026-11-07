import React from 'react';
import { render, fireEvent, act, cleanup } from '@testing-library/react-native';
import { StatsDashboardSkeleton } from '../../src/shared/components/Skeleton';
import { ReadingTimerModal } from '../../src/features/reading-tracker/components/ReadingTimerModal';
import { BookCompletionEtaCard } from '../../src/features/goals-analytics/components/BookCompletionEtaCard';
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
  pageCount: 412,
  modality: 'PHYSICAL',
  ownership: 'OWNED',
  metadataStatus: 'COMPLETE',
  format: 'BOLSILLO',
  progressMode: 'PAGES',
  language: 'es',
  currentStatus: 'LEYENDO',
  currentPage: 142,
  currentPercentage: 34.5,
  rating: null,
  pauseOrDnfNote: null,
  isSpoiler: false,
  shelfId: 'shelf-scifi',
  wishlistStoreNote: null,
  createdAt: 1700000000000,
  updatedAt: 1700000000000,
};

describe('Fase 3 Componentes Visuales', () => {
  afterEach(() => {
    cleanup();
  });
  describe('StatsDashboardSkeleton', () => {
    it('se renderiza correctamente con testID stats-dashboard-skeleton', () => {
      const { getByTestId } = render(<StatsDashboardSkeleton />);
      expect(getByTestId('stats-dashboard-skeleton')).toBeTruthy();
    });
  });

  describe('BookCompletionEtaCard', () => {
    it('muestra las paginas restantes, tiempo neto y fecha estimada', async () => {
      const onOpenTimerMock = jest.fn();
      const { getByText, getByTestId } = render(
        <BookCompletionEtaCard
          book={mockBook}
          pagesPerHour={28.4}
          pagesPerDay={25}
          isColdStart={false}
          onOpenTimer={onOpenTimerMock}
        />
      );

      expect(getByTestId('book-completion-eta-card')).toBeTruthy();
      expect(getByText('Dune')).toBeTruthy();
      expect(getByText('Faltan 270 páginas')).toBeTruthy();
      expect(getByText('A 28.4 págs/hora')).toBeTruthy();
      expect(getByText(/En 11 días/)).toBeTruthy();

      const timerButton = getByText('Iniciar sesión con cronómetro');
      await act(async () => {
        fireEvent.press(timerButton);
      });
      expect(onOpenTimerMock).toHaveBeenCalledTimes(1);
    });

    it('muestra la insignia y nota de cold start cuando isColdStart es true', () => {
      const { getByText } = render(
        <BookCompletionEtaCard
          book={mockBook}
          pagesPerHour={0}
          pagesPerDay={0}
          isColdStart={true}
          onOpenTimer={jest.fn()}
        />
      );

      expect(getByText(/Estimación inicial/)).toBeTruthy();
      expect(getByText(/Se calibrará con tu velocidad real tras registrar tu primera sesión/)).toBeTruthy();
    });

    it('muestra el estado completado si el libro esta en estado LEIDO', () => {
      const finishedBook: Book = {
        ...mockBook,
        currentStatus: 'LEIDO',
        currentPage: 412,
        currentPercentage: 100,
      };

      const { getByText } = render(
        <BookCompletionEtaCard
          book={finishedBook}
          pagesPerHour={25}
          pagesPerDay={20}
          isColdStart={false}
          onOpenTimer={jest.fn()}
        />
      );

      expect(getByText('¡Libro completado!')).toBeTruthy();
    });
  });

  describe('ReadingTimerModal', () => {
    it('renderiza el modal en estado ACTIVE con reloj digital y controles de pausa', async () => {
      const onSaveMock = jest.fn();
      const onCloseMock = jest.fn();

      const { getByTestId, getByText } = render(
        <ReadingTimerModal
          visible={true}
          book={mockBook}
          userAverageSpeed={28.4}
          dailyGoalMinutes={30}
          initialAccumulatedSeconds={10}
          onClose={onCloseMock}
          onSaveSession={onSaveMock}
        />
      );

      expect(getByTestId('reading-timer-modal')).toBeTruthy();
      expect(getByText('Timestamp activo · Pantalla apagada segura')).toBeTruthy();

      // Pausar reloj
      const pauseBtn = getByText('Pausar reloj');
      await act(async () => {
        fireEvent.press(pauseBtn);
        await new Promise((r) => setTimeout(r, 20));
      });
      expect(getByText('Sesión en pausa')).toBeTruthy();
      expect(getByText('Reanudar reloj')).toBeTruthy();

      // Simular +15m off
      const simBtn = getByText('Simular +15m off');
      await act(async () => {
        fireEvent.press(simBtn);
      });

      // Pasar a Guardar sesión
      const finishBtn = getByText('Terminar sesión y anotar página final');
      await act(async () => {
        fireEvent.press(finishBtn);
      });
      expect(getByText('Cerrar sesión de lectura')).toBeTruthy();
    });

    it('detecta una sesion outlier y permite resolver con las opciones', async () => {
      const onSaveMock = jest.fn();
      const onCloseMock = jest.fn();

      const { getByText } = render(
        <ReadingTimerModal
          visible={true}
          book={mockBook}
          userAverageSpeed={28.4}
          initialAccumulatedSeconds={18000} // 5h medidas para solo 4 paginas => outlier!
          onClose={onCloseMock}
          onSaveSession={onSaveMock}
        />
      );

      // Cambiar a pestaña Guardar sesion
      fireEvent.press(getByText('Guardar sesión'));

      // Tocar boton de guardar sesion (al ser outlier de 5h para 10 paginas a 2 pags/h, dispara OUTLIER)
      const saveBtn = getByText('Guardar sesión y actualizar predicciones');
      await act(async () => {
        fireEvent.press(saveBtn);
      });

      // Verificar elementos de la vista OUTLIER
      expect(getByText('¿Olvidaste pausar el reloj?')).toBeTruthy();
      expect(getByText('Medido')).toBeTruthy();
      expect(getByText('A tu ritmo')).toBeTruthy();

      // Opcion 1: Ajustar a ritmo promedio
      const adjustBtn = getByText(/Ajustar a \d+ min y guardar/);
      await act(async () => {
        fireEvent.press(adjustBtn);
      });

      expect(onSaveMock).toHaveBeenCalledWith(
        expect.objectContaining({
          bookId: 'book-dune-1',
          outlierResolution: 'ADJUST_TO_AVERAGE',
        })
      );
      expect(onCloseMock).toHaveBeenCalled();
    });

    it('permite guardar sesion normal directamente desde FINISH', async () => {
      const onSaveMock = jest.fn();
      const onCloseMock = jest.fn();

      const { getByText } = render(
        <ReadingTimerModal
          visible={true}
          book={mockBook}
          userAverageSpeed={28.4}
          initialAccumulatedSeconds={1200} // 20 min para 10 paginas = 30 pags/h (normal)
          onClose={onCloseMock}
          onSaveSession={onSaveMock}
        />
      );

      // Pasar a FINISH
      fireEvent.press(getByText('Guardar sesión'));

      // Guardar sesion normal
      const saveBtn = getByText('Guardar sesión y actualizar predicciones');
      await act(async () => {
        fireEvent.press(saveBtn);
      });

      expect(onSaveMock).toHaveBeenCalledWith(
        expect.objectContaining({
          bookId: 'book-dune-1',
          outlierResolution: 'NORMAL',
          localDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        })
      );
      expect(onCloseMock).toHaveBeenCalled();
    });
  });
});
