import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  Pressable,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  BookOpen,
  Smartphone,
  Bookmark,
  Trash2,
  Sparkles,
  RotateCcw,
  Eye,
  EyeOff,
  MapPin,
  Layers,
  ShoppingBag,
  Clock,
  Award,
  ArrowLeftRight,
  RefreshCw,
  AlertCircle,
} from 'lucide-react-native';
import { CatalogResolver } from '@/features/catalog/services/catalogResolver';
import { BooksRepository } from '@/db/repositories/booksRepository';
import { ReadingLogsRepository } from '@/db/repositories/readingLogsRepository';
import { ReadingSessionsRepository } from '@/db/repositories/readingSessionsRepository';
import { ShelvesRepository } from '@/db/repositories/shelvesRepository';
import { BookQuotesRepository } from '@/db/repositories/bookQuotesRepository';
import {
  BookLoansRepository,
  evaluateLoanDueStatus,
} from '@/db/repositories/bookLoansRepository';
import { Book } from '@/db/schema/books';
import { Shelf } from '@/db/schema/shelves';
import { ReadingLog } from '@/db/schema/readingLogs';
import { ReadingSession } from '@/db/schema/readingSessions';
import { BookQuote } from '@/db/schema/bookQuotes';
import { BookLoan } from '@/db/schema/bookLoans';
import { colors } from '@/core/theme/colors';
import { SafeButton } from '@/shared/components/SafeButton';
import { BookDetailSkeleton } from '@/shared/components/Skeleton';
import { HalfStarRating } from '@/features/reading-tracker/components/HalfStarRating';
import { ReadingStatusModal } from '@/features/reading-tracker/components/ReadingStatusModal';
import {
  ReadingTimerModal,
  SavedSessionData,
} from '@/features/reading-tracker/components/ReadingTimerModal';
import { BookCompletionEtaCard } from '@/features/goals-analytics/components/BookCompletionEtaCard';
import { calculateReaderVelocity } from '@/features/goals-analytics/services/forecastingService';
import {
  ShelvesManagerModal,
  DigitalCollectionKey,
} from '@/features/shelves/components/ShelvesManagerModal';
import { BookQuotesAndGlossarySection } from '@/features/quotes-ocr/components/BookQuotesAndGlossarySection';
import { QuoteOcrModal } from '@/features/quotes-ocr/components/QuoteOcrModal';
import { QuotePostcardModal } from '@/features/quotes-ocr/components/QuotePostcardModal';
import { LoanCoverRibbon } from '@/features/loans/components/LoanCoverRibbon';
import { LoanManagerModal } from '@/features/loans/components/LoanManagerModal';
import { useReaderPreferencesStore } from '@/features/reading-tracker/store/readerPreferencesStore';

type BookStatus =
  | 'POR_LEER'
  | 'LEYENDO'
  | 'EN_ESPERA'
  | 'LEIDO'
  | 'ABANDONADO'
  | 'WISHLIST';

const STATUS_LABELS: Record<BookStatus, string> = {
  POR_LEER: 'Por leer',
  LEYENDO: 'Leyendo',
  EN_ESPERA: 'En pausa',
  LEIDO: 'Leído',
  ABANDONADO: 'Abandonado',
  WISHLIST: 'En lista de deseos',
};

const DIGITAL_FORMAT_NAMES: Record<string, string> = {
  KINDLE: 'Amazon Kindle',
  KOBO: 'Rakuten Kobo',
  APPLE_BOOKS: 'Apple Books',
  EPUB_PDF: 'ePub / PDF',
};

function parseAuthors(authorsJson?: string | null): string {
  if (!authorsJson) return 'Autor desconocido';
  try {
    const list = JSON.parse(authorsJson);
    if (Array.isArray(list) && list.length > 0) {
      return list.join(', ');
    }
  } catch {
    // Retornar fallback seguro
  }
  return 'Autor desconocido';
}

function formatDate(timestamp: number | null): string {
  if (!timestamp) return 'Fecha no registrada';
  try {
    const date = new Date(timestamp);
    return date.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return 'Fecha no registrada';
  }
}

export default function BookDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const { progressDisplayMode, setProgressDisplayMode } =
    useReaderPreferencesStore();

  const [book, setBook] = useState<Book | null>(null);
  const [readingLogs, setReadingLogs] = useState<ReadingLog[]>([]);
  const [readingSessions, setReadingSessions] = useState<ReadingSession[]>([]);
  const [shelves, setShelves] = useState<Shelf[]>([]);
  const [multipleEditions, setMultipleEditions] = useState<Book[]>([]);
  const [bookQuotes, setBookQuotes] = useState<BookQuote[]>([]);
  const [activeLoan, setActiveLoan] = useState<BookLoan | null>(null);
  const [loanHistory, setLoanHistory] = useState<BookLoan[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  const [isReadingStatusModalVisible, setIsReadingStatusModalVisible] =
    useState(false);
  const [isTimerModalVisible, setIsTimerModalVisible] = useState(false);
  const [isShelvesModalVisible, setIsShelvesModalVisible] = useState(false);
  const [isQuoteOcrModalVisible, setIsQuoteOcrModalVisible] = useState(false);
  const [selectedPostcardQuote, setSelectedPostcardQuote] =
    useState<BookQuote | null>(null);
  const [isLoanModalVisible, setIsLoanModalVisible] = useState(false);
  const [isSpoilerNoteRevealed, setIsSpoilerNoteRevealed] = useState(false);

  const loadBookData = useCallback(async () => {
    if (!id) return;
    try {
      const [
        foundBook,
        logs,
        allSessions,
        allShelves,
        editions,
        quotesList,
        currentActiveLoan,
        allBookLoans,
      ] = await Promise.all([
        BooksRepository.getById(id),
        ReadingLogsRepository.getByBookId(id),
        ReadingSessionsRepository.getAll(),
        ShelvesRepository.getAll(),
        BooksRepository.getMultipleEditions(id),
        BookQuotesRepository.getByBookId(id),
        BookLoansRepository.getActiveByBookId(id),
        BookLoansRepository.getAll({ bookId: id }),
      ]);
      setBook(foundBook);
      setReadingLogs(logs);
      setReadingSessions(allSessions);
      setShelves(allShelves);
      setMultipleEditions(editions);
      setBookQuotes(quotesList);
      setActiveLoan(currentActiveLoan);
      setLoanHistory(allBookLoans.filter((l) => l.returnedAt !== null));
    } catch (err) {
      console.error('Error cargando detalle del libro:', err);
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadBookData();
  }, [loadBookData]);

  // Manejo de actualización de avance
  const handleSaveProgress = async (params: {
    currentUnit: number;
    totalUnits: number;
    mode: 'PAGES' | 'CHAPTERS';
    when: 'TODAY' | 'YESTERDAY';
  }) => {
    if (!book) return;
    try {
      await BooksRepository.updateReadingProgress({
        bookId: book.id,
        currentUnit: params.currentUnit,
        totalUnits: params.totalUnits,
        progressMode: params.mode,
        when: params.when,
      });
      setIsReadingStatusModalVisible(false);
      await loadBookData();
    } catch {
      Alert.alert('Error', 'No se pudo guardar el avance de lectura');
    }
  };

  // Manejo de sesión con cronómetro persistente y Outlier Guard
  const handleSaveTimedSession = async (data: SavedSessionData) => {
    if (!book) return;
    try {
      await ReadingSessionsRepository.createTimedSession({
        bookId: book.id,
        startPage: data.startPage,
        endPage: data.endPage,
        durationSeconds: data.durationSeconds,
        startedAtEpochMs: data.startedAtEpochMs,
        localDateOverride: data.localDate,
        outlierResolution:
          data.outlierResolution === 'NORMAL' ? 'NONE' : data.outlierResolution,
        averageSpeedPagesPerHour: readerVelocity.pagesPerHour,
      });
      setIsTimerModalVisible(false);
      await loadBookData();
    } catch {
      Alert.alert('Error', 'No se pudo guardar la sesión del cronómetro');
    }
  };

  // Manejo de inicio de lectura o relectura
  const handleStartReading = async () => {
    if (!book) return;
    try {
      await ReadingLogsRepository.startReading(book.id);
      setIsReadingStatusModalVisible(false);
      await loadBookData();
    } catch {
      Alert.alert('Error', 'No se pudo iniciar la lectura');
    }
  };

  // Manejo de pausa o abandono
  const handlePauseOrAbandon = async (params: {
    status: 'EN_ESPERA' | 'ABANDONADO';
    note: string;
    isSpoiler: boolean;
    stoppedAtUnit: number;
  }) => {
    if (!book) return;
    try {
      await BooksRepository.pauseOrAbandonBook({
        bookId: book.id,
        status: params.status,
        pauseOrDnfNote: params.note,
        isSpoiler: params.isSpoiler,
        stoppedAtUnit: params.stoppedAtUnit,
      });
      setIsReadingStatusModalVisible(false);
      await loadBookData();
    } catch {
      Alert.alert('Error', 'No se pudo actualizar el estado de pausa o abandono');
    }
  };

  // Manejo de finalización de lectura
  const handleFinishReading = async (params: {
    rating: number | null;
    review: string;
  }) => {
    if (!book) return;
    try {
      await ReadingLogsRepository.finishReading({
        bookId: book.id,
        rating: params.rating,
        review: params.review,
      });
      setIsReadingStatusModalVisible(false);
      await loadBookData();
    } catch {
      Alert.alert('Error', 'No se pudo registrar la finalización del libro');
    }
  };

  // Manejo de asignación a estantería física
  const handleAssignPhysicalShelf = async (shelfId: string) => {
    if (!book) return;
    try {
      await ShelvesRepository.assignBookToShelf(book.id, shelfId);
      setIsShelvesModalVisible(false);
      await loadBookData();
    } catch {
      Alert.alert('Error', 'No se pudo asignar a la estantería física');
    }
  };

  // Manejo de asignación a colección digital
  const handleAssignDigitalCollection = async (
    collection: DigitalCollectionKey
  ) => {
    if (!book) return;
    try {
      await BooksRepository.update(book.id, {
        format: collection,
        shelfId: null,
      });
      setIsShelvesModalVisible(false);
      await loadBookData();
    } catch {
      Alert.alert('Error', 'No se pudo asignar el formato digital');
    }
  };

  // Manejo de creación de nueva estantería
  const handleCreateShelf = async (data: {
    furnitureName: string;
    shelfLevel?: string;
    colorTag: string;
  }) => {
    if (!book) return;
    try {
      const created = await ShelvesRepository.create(data);
      if (created) {
        await ShelvesRepository.assignBookToShelf(book.id, created.id);
      }
      setIsShelvesModalVisible(false);
      await loadBookData();
    } catch {
      Alert.alert('Error', 'No se pudo crear la estantería');
    }
  };

  // Manejo de desasignación de estantería
  const handleRemoveFromShelf = async () => {
    if (!book) return;
    try {
      await ShelvesRepository.assignBookToShelf(book.id, null);
      setIsShelvesModalVisible(false);
      await loadBookData();
    } catch {
      Alert.alert('Error', 'No se pudo retirar de la estantería');
    }
  };

  // Manejo de conversión de Wishlist a propiedad
  const handleConvertWishlistToOwned = async () => {
    if (!book) return;
    try {
      await BooksRepository.convertWishlistToOwned({
        bookId: book.id,
        modality: book.modality,
        shelfId: book.shelfId,
        format: book.format,
      });
      await loadBookData();
      Alert.alert(
        'Movido a Mi Librero',
        'El libro ahora forma parte de tu biblioteca propia en estado Por leer.'
      );
    } catch {
      Alert.alert('Error', 'No se pudo actualizar el estado de la lista de deseos');
    }
  };

  // Manejo de citas OCR y glosario de personajes
  const handleSaveQuote = async (data: {
    entryType: 'QUOTE' | 'CHARACTER' | 'GLOSSARY' | 'NOTE';
    content: string;
    pageNumber: number | null;
    chapterOrSection: string | null;
    personalNote: string | null;
    highlightColor: string;
    isSpoiler: boolean;
  }) => {
    if (!book) return;
    try {
      await BookQuotesRepository.create({
        bookId: book.id,
        entryType: data.entryType,
        content: data.content,
        pageNumber: data.pageNumber,
        chapterOrSection: data.chapterOrSection,
        personalNote: data.personalNote,
        highlightColor: data.highlightColor,
        isSpoiler: data.isSpoiler,
      });
      setIsQuoteOcrModalVisible(false);
      await loadBookData();
    } catch {
      Alert.alert('Error', 'No se pudo guardar la cita o nota');
    }
  };

  const handleToggleFavoriteQuote = async (quoteId: string) => {
    try {
      await BookQuotesRepository.toggleFavorite(quoteId);
      await loadBookData();
    } catch {
      Alert.alert('Error', 'No se pudo actualizar favorito');
    }
  };

  const handleDeleteQuote = async (quoteId: string) => {
    try {
      await BookQuotesRepository.delete(quoteId);
      await loadBookData();
    } catch {
      Alert.alert('Error', 'No se pudo eliminar la entrada');
    }
  };

  // Manejo de préstamos bidireccionales
  const handleCreateLoan = async (params: {
    loanDirection: 'LENT_OUT' | 'BORROWED_IN';
    borrowerName: string;
    borrowerContact?: string;
    dueDays: number;
    notes?: string;
  }) => {
    if (!book) return;
    try {
      const now = Date.now();
      const dueDate = now + params.dueDays * 86400000;
      await BookLoansRepository.createLoan({
        bookId: book.id,
        loanDirection: params.loanDirection,
        borrowerName: params.borrowerName,
        borrowerContact: params.borrowerContact ?? null,
        loanedAt: now,
        dueDate,
        notes: params.notes ?? null,
      });
      setIsLoanModalVisible(false);
      await loadBookData();
    } catch {
      Alert.alert('Error', 'No se pudo registrar el préstamo');
    }
  };

  const handleMarkLoanReturned = async (loanId: string) => {
    try {
      await BookLoansRepository.markAsReturned(loanId);
      setIsLoanModalVisible(false);
      await loadBookData();
    } catch {
      Alert.alert('Error', 'No se pudo marcar el préstamo como devuelto');
    }
  };

  const handleExtendLoan = async (loanId: string, extraDays: number) => {
    try {
      await BookLoansRepository.extendDueDate(loanId, extraDays);
      await loadBookData();
    } catch {
      Alert.alert('Error', 'No se pudo extender el plazo del préstamo');
    }
  };

  const confirmDelete = () => {
    Alert.alert(
      'Eliminar libro',
      `¿Deseas eliminar "${book?.title}" de tu biblioteca?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            if (!book) return;
            await BooksRepository.delete(book.id);
            router.back();
          },
        },
      ]
    );
  };

  // Reintentar sincronización de metadatos para libros guardados sin conexión
  const handleRetrySyncMetadata = async () => {
    if (!book || !book.isbn13) {
      Alert.alert(
        'Aviso',
        'Este libro no cuenta con un código ISBN para buscar su información en los catálogos.'
      );
      return;
    }

    try {
      setIsLoading(true);
      const result = await CatalogResolver.resolveByIsbn(book.isbn13);
      if (result.success && result.book) {
        const finalCover =
          result.book.coverUri ||
          (book.coverUri?.includes('books.google.com/books/content')
            ? null
            : book.coverUri);

        const finalPublisher =
          result.book.publisher &&
          result.book.publisher !== 'Editorial no especificada'
            ? result.book.publisher
            : book.publisher !== 'Editorial no especificada'
            ? book.publisher
            : null;

        await BooksRepository.update(book.id, {
          title: result.book.title,
          subtitle: result.book.subtitle,
          authorsJson: JSON.stringify(result.book.authors),
          publisher: finalPublisher,
          description: result.book.description || book.description,
          coverUri: finalCover,
          pageCount:
            result.book.pageCount > 0 ? result.book.pageCount : book.pageCount,
          metadataStatus: 'COMPLETE',
        });
        await loadBookData();
        Alert.alert(
          'Información actualizada',
          `Se han completado los datos de "${result.book.title}" exitosamente.`
        );
      } else {
        Alert.alert(
          'Sin resultados',
          'No se encontró información para este ISBN en los catálogos en este momento. Verifica tu conexión.'
        );
      }
    } catch {
      Alert.alert(
        'Error',
        'No fue posible consultar los catálogos en este momento.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const isRereadInProgress = useMemo(() => {
    if (!book) return false;
    return (
      readingLogs.some((l) => l.finishedAt !== null) &&
      book.currentStatus === 'LEYENDO'
    );
  }, [book, readingLogs]);

  const assignedShelf = useMemo(() => {
    if (!book || !book.shelfId) return null;
    return shelves.find((s) => s.id === book.shelfId) || null;
  }, [book, shelves]);

  const readerVelocity = useMemo(
    () => calculateReaderVelocity(readingSessions),
    [readingSessions]
  );

  if (isLoading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.topBar}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={12}
            style={styles.iconButton}
          >
            <ArrowLeft size={22} color={colors.light.text} />
          </Pressable>
        </View>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <BookDetailSkeleton />
        </ScrollView>
      </View>
    );
  }

  if (!book) {
    return (
      <View style={[styles.centerContainer, { paddingTop: insets.top }]}>
        <Text style={styles.errorText}>No se encontró el libro solicitado.</Text>
        <SafeButton
          title="Volver a la biblioteca"
          onPress={() => router.back()}
          style={styles.backButtonMargin}
        />
      </View>
    );
  }

  const authorsLabel = parseAuthors(book.authorsJson);
  const isWishlist =
    book.ownership === 'WISHLIST' || book.currentStatus === 'WISHLIST';

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Barra Superior */}
      <View style={styles.topBar}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          style={styles.iconButton}
          accessibilityRole="button"
          accessibilityLabel="Regresar"
        >
          <ArrowLeft size={22} color={colors.light.text} />
        </Pressable>

        <View style={styles.topBarActions}>
          {book.isbn13 ? (
            <Pressable
              onPress={handleRetrySyncMetadata}
              hitSlop={12}
              style={styles.iconButton}
              accessibilityRole="button"
              accessibilityLabel="Sincronizar información desde catálogos"
            >
              <RefreshCw size={19} color={colors.light.textMuted} />
            </Pressable>
          ) : null}

          <Pressable
            onPress={confirmDelete}
            hitSlop={12}
            style={styles.iconButton}
            accessibilityRole="button"
            accessibilityLabel="Eliminar libro"
          >
            <Trash2 size={20} color={colors.light.danger} />
          </Pressable>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Cabecera con Portada */}
        <View style={styles.coverSection}>
          <View style={styles.coverWrapper}>
            {book.coverUri ? (
              <Image
                source={{ uri: book.coverUri }}
                style={styles.coverImage}
                resizeMode="cover"
              />
            ) : (
              <View style={[styles.coverImage, styles.coverFallback]}>
                <Bookmark size={48} color={colors.light.primary} />
              </View>
            )}
            <LoanCoverRibbon loan={activeLoan} />
          </View>

          <Text style={styles.title}>{book.title}</Text>
          {book.subtitle ? (
            <Text style={styles.subtitle}>{book.subtitle}</Text>
          ) : null}
          <Text style={styles.author}>{authorsLabel}</Text>

          {/* Calificación si existe */}
          {book.rating !== null && book.rating !== undefined && book.rating > 0 ? (
            <View style={styles.headerRatingRow}>
              <HalfStarRating value={book.rating} readOnly size={18} />
            </View>
          ) : null}

          {/* Badges de Saga, Formato, Modalidad y Múltiples Ediciones */}
          <View style={styles.badgesRow}>
            {book.seriesName ? (
              <View style={styles.sagaBadge}>
                <Sparkles size={12} color={colors.light.accent} />
                <Text style={styles.sagaBadgeText}>
                  {book.seriesName}{' '}
                  {book.seriesIndex ? `#${book.seriesIndex}` : ''}
                </Text>
              </View>
            ) : null}

            <View style={styles.badge}>
              {book.modality === 'PHYSICAL' ? (
                <>
                  <BookOpen size={12} color={colors.light.primary} />
                  <Text style={styles.badgeText}>Físico</Text>
                </>
              ) : (
                <>
                  <Smartphone size={12} color={colors.light.accent} />
                  <Text style={styles.badgeText}>eBook</Text>
                </>
              )}
            </View>

            {book.publisher ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{book.publisher}</Text>
              </View>
            ) : null}

            {multipleEditions.length > 1 ? (
              <View style={styles.editionsBadge}>
                <Layers size={12} color={colors.light.primary} />
                <Text style={styles.editionsBadgeText}>
                  {multipleEditions.length} ediciones en biblioteca
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* Aviso de libro guardado sin conexion con boton de sincronizacion */}
        {book.metadataStatus === 'PENDING_OFFLINE_SYNC' ||
        book.title === 'Libro sin conexión' ? (
          <View style={styles.offlineNoticeCard}>
            <View style={styles.offlineNoticeHeader}>
              <AlertCircle size={20} color={colors.light.warning} />
              <View style={styles.offlineNoticeTextCol}>
                <Text style={styles.offlineNoticeTitle}>
                  Información pendiente de sincronizar
                </Text>
                <Text style={styles.offlineNoticeSubtitle}>
                  Este libro se guardó sin conexión. Puedes actualizar sus datos y portada ahora.
                </Text>
              </View>
            </View>
            <SafeButton
              onPress={handleRetrySyncMetadata}
              style={styles.retrySyncButton}
            >
              <RefreshCw size={14} color="#ffffff" />
              <Text style={styles.retrySyncButtonText}>
                Sincronizar información ahora
              </Text>
            </SafeButton>
          </View>
        ) : null}

        {/* Sección Especial si es Lista de Deseos */}
        {isWishlist ? (
          <View style={[styles.card, styles.wishlistCard]}>
            <View style={styles.wishlistHeaderRow}>
              <ShoppingBag size={18} color={colors.light.accent} />
              <Text style={styles.wishlistHeaderTitle}>
                Libro en Lista de Deseos
              </Text>
            </View>
            <Text style={styles.wishlistDescription}>
              Este ejemplar aún no forma parte de tu biblioteca física o digital.
              No se incluye en el conteo de libros propios ni en metas de lectura.
            </Text>

            {book.wishlistStoreNote ? (
              <View style={styles.wishlistNoteBox}>
                <Text style={styles.wishlistNoteLabel}>
                  Tienda o precio de referencia:
                </Text>
                <Text style={styles.wishlistNoteValue}>
                  {book.wishlistStoreNote}
                </Text>
              </View>
            ) : null}

            <SafeButton
              title="Ya lo compré · Mover a Mi Librero"
              variant="primary"
              size="lg"
              leftIcon={<BookOpen size={18} color="#FFFFFF" />}
              onPress={handleConvertWishlistToOwned}
              style={styles.actionButtonMargin}
            />
          </View>
        ) : null}

        {/* Estado y Barra de Progreso */}
        <View style={styles.card}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Estado de Lectura</Text>
            <View style={styles.currentStatusBadge}>
              <Text style={styles.currentStatusBadgeText}>
                {STATUS_LABELS[book.currentStatus as BookStatus] ||
                  book.currentStatus}
              </Text>
            </View>
          </View>

          {/* Insignia de Relectura en curso */}
          {isRereadInProgress ? (
            <View style={styles.rereadInsignia}>
              <RotateCcw size={15} color={colors.light.primary} />
              <Text style={styles.rereadInsigniaText}>
                Relectura en curso · Contado en libros leídos
              </Text>
            </View>
          ) : null}

          {/* Barra de progreso con porcentaje automático */}
          <View style={styles.progressSection}>
            <View style={styles.progressBarBackground}>
              <View
                style={[
                  styles.progressBarFill,
                  { width: `${Math.min(100, book.currentPercentage || 0)}%` },
                ]}
              />
            </View>
            <View style={styles.progressTextRow}>
              <Text style={styles.progressPercentageText}>
                {(book.currentPercentage || 0).toFixed(1)}% completado
              </Text>
              <Text style={styles.progressUnitsText}>
                {book.currentPage || 0} de {book.pageCount || 0}{' '}
                {book.progressMode === 'CHAPTERS' ? 'capítulos' : 'páginas'}
              </Text>
            </View>
          </View>

          <SafeButton
            title="Actualizar estado y avance"
            variant="primary"
            size="md"
            leftIcon={<Clock size={16} color="#FFFFFF" />}
            onPress={() => setIsReadingStatusModalVisible(true)}
            style={styles.actionButtonMargin}
          />
        </View>

        {/* Tarjeta de Predicción ETA y Acceso al Cronómetro Persistente */}
        {!isWishlist ? (
          <View style={styles.etaCardWrapper}>
            <BookCompletionEtaCard
              book={book}
              pagesPerHour={readerVelocity.pagesPerHour}
              pagesPerDay={readerVelocity.pagesPerDay}
              isColdStart={readerVelocity.isColdStart}
              onOpenTimer={() => setIsTimerModalVisible(true)}
            />
          </View>
        ) : null}

        {/* Tarjeta de Nota Anti-Olvido con soporte para Spoilers */}
        {book.pauseOrDnfNote && book.pauseOrDnfNote.trim().length > 0 ? (
          <View style={styles.card}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>
                {book.currentStatus === 'ABANDONADO'
                  ? 'Motivo de abandono'
                  : 'Nota anti-olvido'}
              </Text>
              {book.isSpoiler ? (
                <View style={styles.spoilerPill}>
                  <Text style={styles.spoilerPillText}>Contiene spoilers</Text>
                </View>
              ) : null}
            </View>

            {book.isSpoiler && !isSpoilerNoteRevealed ? (
              <View style={styles.spoilerHiddenBox}>
                <EyeOff size={20} color={colors.light.accent} />
                <Text style={styles.spoilerHiddenText}>
                  Esta nota contiene spoilers de la trama
                </Text>
                <SafeButton
                  title="Mostrar nota anti-olvido"
                  variant="outline"
                  size="sm"
                  leftIcon={<Eye size={14} color={colors.light.primary} />}
                  onPress={() => setIsSpoilerNoteRevealed(true)}
                />
              </View>
            ) : (
              <View style={styles.noteContentContainer}>
                <Text style={styles.noteText}>{book.pauseOrDnfNote}</Text>
                {book.isSpoiler ? (
                  <Pressable
                    onPress={() => setIsSpoilerNoteRevealed(false)}
                    style={styles.hideSpoilerButton}
                  >
                    <EyeOff size={14} color={colors.light.textMuted} />
                    <Text style={styles.hideSpoilerText}>Ocultar spoiler</Text>
                  </Pressable>
                ) : null}
              </View>
            )}
          </View>
        ) : null}

        {/* Tarjeta de Ubicación Física o Ecosistema Digital */}
        <View style={styles.card}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>
              {book.modality === 'PHYSICAL'
                ? 'Ubicación en Estantería'
                : 'Ecosistema Digital'}
            </Text>
            <SafeButton
              title="Cambiar"
              variant="outline"
              size="sm"
              onPress={() => setIsShelvesModalVisible(true)}
            />
          </View>

          {book.modality === 'PHYSICAL' ? (
            assignedShelf ? (
              <View style={styles.locationDisplayRow}>
                <View
                  style={[
                    styles.shelfColorDot,
                    { backgroundColor: assignedShelf.colorTag },
                  ]}
                />
                <View style={styles.locationDetails}>
                  <Text style={styles.locationMainTitle}>
                    {assignedShelf.furnitureName}
                  </Text>
                  <Text style={styles.locationSubTitle}>
                    {assignedShelf.shelfLevel || 'Nivel sin especificar'}
                  </Text>
                </View>
              </View>
            ) : (
              <View style={styles.unassignedLocationBox}>
                <MapPin size={18} color={colors.light.textMuted} />
                <Text style={styles.unassignedLocationText}>
                  Sin mueble o repisa física asignada
                </Text>
              </View>
            )
          ) : (
            <View style={styles.locationDisplayRow}>
              <Smartphone size={20} color={colors.light.primary} />
              <View style={styles.locationDetails}>
                <Text style={styles.locationMainTitle}>
                  {book.format
                    ? DIGITAL_FORMAT_NAMES[book.format] || book.format
                    : 'Lector Digital Universal'}
                </Text>
                <Text style={styles.locationSubTitle}>
                  Formato de lectura eBook
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* Control de Préstamos Bidireccionales (Solo libros físicos fuera de Wishlist) */}
        {book.modality === 'PHYSICAL' && !isWishlist ? (
          <View style={styles.card}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Control de Préstamos</Text>
              <SafeButton
                title={activeLoan ? 'Gestionar' : 'Registrar'}
                variant="outline"
                size="sm"
                leftIcon={
                  <ArrowLeftRight size={14} color={colors.light.primary} />
                }
                onPress={() => setIsLoanModalVisible(true)}
              />
            </View>

            {activeLoan ? (
              <View style={styles.locationDisplayRow}>
                <View style={styles.locationDetails}>
                  <Text style={styles.locationMainTitle}>
                    {activeLoan.loanDirection === 'LENT_OUT'
                      ? `Prestado a ${activeLoan.borrowerName}`
                      : `Prestado por ${activeLoan.borrowerName}`}
                  </Text>
                  <Text style={styles.locationSubTitle}>
                    {(() => {
                      const due = evaluateLoanDueStatus(activeLoan);
                      if (due.status === 'OVERDUE') {
                        return `Vencido hace ${Math.abs(due.daysRemaining)} días`;
                      }
                      if (due.status === 'DUE_SOON') {
                        return `Próximo a vencer (${due.daysRemaining}d restantes)`;
                      }
                      return `En plazo (${due.daysRemaining}d restantes)`;
                    })()}
                  </Text>
                </View>
              </View>
            ) : (
              <View style={styles.unassignedLocationBox}>
                <ArrowLeftRight size={18} color={colors.light.textMuted} />
                <Text style={styles.unassignedLocationText}>
                  En tu estantería · Sin préstamo activo
                </Text>
              </View>
            )}
          </View>
        ) : null}

        {/* Sección de Citas OCR, Glosario de Personajes sin Spoilers y Postales */}
        {!isWishlist ? (
          <BookQuotesAndGlossarySection
            quotes={bookQuotes}
            currentBookPage={book.currentPage || 0}
            onOpenOcrModal={() => setIsQuoteOcrModalVisible(true)}
            onOpenPostcard={(quote) => setSelectedPostcardQuote(quote)}
            onToggleFavorite={handleToggleFavoriteQuote}
            onDeleteQuote={handleDeleteQuote}
          />
        ) : null}

        {/* Historial de Lecturas Registradas */}
        {readingLogs.length > 0 ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>
              Historial de Lecturas ({readingLogs.length})
            </Text>
            <View style={styles.logsList}>
              {readingLogs.map((log) => (
                <View key={log.id} style={styles.logItem}>
                  <View style={styles.logItemHeader}>
                    <View style={styles.logNumberBadge}>
                      <Award size={13} color={colors.light.primary} />
                      <Text style={styles.logNumberBadgeText}>
                        Lectura #{log.readNumber}
                      </Text>
                    </View>
                    <Text style={styles.logDateText}>
                      {formatDate(log.finishedAt || log.startedAt)}
                    </Text>
                  </View>

                  {log.rating !== null && log.rating !== undefined ? (
                    <View style={styles.logRatingWrapper}>
                      <HalfStarRating
                        value={log.rating}
                        readOnly
                        size={15}
                        showText={false}
                      />
                    </View>
                  ) : null}

                  {log.review ? (
                    <Text style={styles.logReviewText}>{log.review}</Text>
                  ) : null}
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {/* Ficha Técnica */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Ficha Técnica</Text>
          <View style={styles.infoGrid}>
            <View style={styles.infoCol}>
              <Text style={styles.infoLabel}>Páginas</Text>
              <Text style={styles.infoValue}>
                {book.pageCount > 0
                  ? `${book.pageCount} págs`
                  : 'No especificado'}
              </Text>
            </View>
            <View style={styles.infoCol}>
              <Text style={styles.infoLabel}>Idioma</Text>
              <Text style={styles.infoValue}>
                {book.language ? book.language.toUpperCase() : 'ES'}
              </Text>
            </View>
            <View style={styles.infoCol}>
              <Text style={styles.infoLabel}>ISBN-13</Text>
              <Text style={styles.infoValue}>{book.isbn13 || 'Sin ISBN'}</Text>
            </View>
          </View>
        </View>

        {/* Sinopsis */}
        {book.description ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Sinopsis</Text>
            <Text
              style={styles.descriptionText}
              numberOfLines={isDescriptionExpanded ? undefined : 4}
            >
              {book.description}
            </Text>
            {book.description.length > 200 ? (
              <Pressable
                onPress={() => setIsDescriptionExpanded(!isDescriptionExpanded)}
                style={styles.expandButton}
              >
                <Text style={styles.expandText}>
                  {isDescriptionExpanded ? 'Mostrar menos' : 'Leer completa'}
                </Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </ScrollView>

      {/* Modal de Estado de Lectura */}
      {book ? (
        <ReadingStatusModal
          visible={isReadingStatusModalVisible}
          book={book}
          readingLogs={readingLogs}
          progressDisplayMode={progressDisplayMode}
          onChangeDisplayMode={setProgressDisplayMode}
          onClose={() => setIsReadingStatusModalVisible(false)}
          onSaveProgress={handleSaveProgress}
          onStartReading={handleStartReading}
          onPauseOrAbandon={handlePauseOrAbandon}
          onFinishReading={handleFinishReading}
        />
      ) : null}

      {/* Modal de Gestión de Estanterías */}
      {book ? (
        <ShelvesManagerModal
          visible={isShelvesModalVisible}
          book={book}
          shelves={shelves}
          existingEditionsCount={multipleEditions.length || 1}
          onClose={() => setIsShelvesModalVisible(false)}
          onAssignPhysicalShelf={handleAssignPhysicalShelf}
          onAssignDigitalCollection={handleAssignDigitalCollection}
          onCreateShelf={handleCreateShelf}
          onRemoveFromShelf={handleRemoveFromShelf}
        />
      ) : null}

      {/* Modal de Cronómetro Lector Persistente y Outlier Guard */}
      {book ? (
        <ReadingTimerModal
          visible={isTimerModalVisible}
          book={book}
          userAverageSpeed={readerVelocity.pagesPerHour}
          onClose={() => setIsTimerModalVisible(false)}
          onSaveSession={handleSaveTimedSession}
        />
      ) : null}

      {/* Modal de Escáner OCR de Citas y Glosario de Personajes */}
      {book ? (
        <QuoteOcrModal
          visible={isQuoteOcrModalVisible}
          bookTitle={book.title}
          defaultPage={book.currentPage || undefined}
          onClose={() => setIsQuoteOcrModalVisible(false)}
          onSaveQuote={handleSaveQuote}
        />
      ) : null}

      {/* Modal de Postal Literaria Compartible */}
      {book ? (
        <QuotePostcardModal
          visible={selectedPostcardQuote !== null}
          quote={selectedPostcardQuote}
          bookTitle={book.title}
          bookAuthor={authorsLabel}
          bookPublisher={book.publisher}
          onClose={() => setSelectedPostcardQuote(null)}
        />
      ) : null}

      {/* Modal de Control de Préstamos Bidireccionales */}
      {book ? (
        <LoanManagerModal
          visible={isLoanModalVisible}
          bookTitle={book.title}
          activeLoan={activeLoan}
          loanHistory={loanHistory}
          onClose={() => setIsLoanModalVisible(false)}
          onCreateLoan={handleCreateLoan}
          onMarkReturned={handleMarkLoanReturned}
          onExtendLoan={handleExtendLoan}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.light.background,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: colors.light.background,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.light.borderSubtle,
  },
  topBarActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: colors.light.surfaceAlt,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 48,
    gap: 16,
  },
  coverSection: {
    alignItems: 'center',
  },
  coverWrapper: {
    width: 150,
    height: 225,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: colors.light.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.light.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
    marginBottom: 16,
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  coverFallback: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F2EDE4',
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.light.text,
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.light.textMuted,
    textAlign: 'center',
    marginTop: 4,
  },
  author: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.light.accent,
    textAlign: 'center',
    marginTop: 6,
  },
  headerRatingRow: {
    marginTop: 10,
  },
  badgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginTop: 12,
  },
  sagaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FCEFEA',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  sagaBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.light.accent,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.light.badgeBg,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.light.badgeText,
  },
  editionsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.light.surfaceAlt,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.light.border,
  },
  editionsBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.light.primary,
  },
  card: {
    backgroundColor: colors.light.surface,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.light.border,
    gap: 12,
  },
  wishlistCard: {
    borderColor: colors.light.accent,
    backgroundColor: '#FFFBF9',
  },
  wishlistHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  wishlistHeaderTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.light.accent,
  },
  wishlistDescription: {
    fontSize: 13,
    color: colors.light.textMuted,
    lineHeight: 18,
  },
  wishlistNoteBox: {
    backgroundColor: colors.light.surface,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.light.borderSubtle,
    gap: 4,
  },
  wishlistNoteLabel: {
    fontSize: 11,
    color: colors.light.textMuted,
    fontWeight: '600',
  },
  wishlistNoteValue: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.light.text,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.light.text,
  },
  currentStatusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: colors.light.badgeBg,
  },
  currentStatusBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.light.primary,
  },
  rereadInsignia: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.light.badgeBg,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  rereadInsigniaText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.light.primary,
  },
  progressSection: {
    gap: 6,
  },
  progressBarBackground: {
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.light.surfaceAlt,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.light.borderSubtle,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: colors.light.primary,
    borderRadius: 4,
  },
  progressTextRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressPercentageText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.light.primary,
  },
  progressUnitsText: {
    fontSize: 12,
    color: colors.light.textMuted,
  },
  spoilerPill: {
    backgroundColor: '#FCEFEA',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  spoilerPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.light.accent,
  },
  spoilerHiddenBox: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.light.surfaceAlt,
    padding: 16,
    borderRadius: 10,
    gap: 8,
  },
  spoilerHiddenText: {
    fontSize: 12,
    color: colors.light.textMuted,
    fontStyle: 'italic',
  },
  noteContentContainer: {
    gap: 8,
  },
  noteText: {
    fontSize: 14,
    color: colors.light.text,
    lineHeight: 20,
  },
  hideSpoilerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-end',
    paddingVertical: 4,
  },
  hideSpoilerText: {
    fontSize: 11,
    color: colors.light.textMuted,
  },
  locationDisplayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.light.surfaceAlt,
    padding: 12,
    borderRadius: 10,
  },
  shelfColorDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  locationDetails: {
    flex: 1,
  },
  locationMainTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.light.text,
  },
  locationSubTitle: {
    fontSize: 12,
    color: colors.light.textMuted,
    marginTop: 1,
  },
  unassignedLocationBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    backgroundColor: colors.light.surfaceAlt,
    borderRadius: 10,
  },
  unassignedLocationText: {
    fontSize: 13,
    color: colors.light.textMuted,
    fontStyle: 'italic',
  },
  logsList: {
    gap: 10,
  },
  logItem: {
    backgroundColor: colors.light.surfaceAlt,
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.light.borderSubtle,
    gap: 6,
  },
  logItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  logNumberBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  logNumberBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.light.primary,
  },
  logDateText: {
    fontSize: 11,
    color: colors.light.textMuted,
  },
  logRatingWrapper: {
    marginVertical: 2,
  },
  logReviewText: {
    fontSize: 13,
    color: colors.light.text,
    lineHeight: 18,
  },
  infoGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  infoCol: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 11,
    color: colors.light.textMuted,
    fontWeight: '500',
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.light.text,
  },
  descriptionText: {
    fontSize: 14,
    lineHeight: 22,
    color: colors.light.text,
  },
  expandButton: {
    marginTop: 4,
  },
  expandText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.light.primary,
  },
  errorText: {
    fontSize: 16,
    color: colors.light.danger,
    textAlign: 'center',
  },
  backButtonMargin: {
    marginTop: 16,
  },
  actionButtonMargin: {
    marginTop: 4,
  },
  etaCardWrapper: {
    marginBottom: 14,
  },
  offlineNoticeCard: {
    backgroundColor: '#fffbeb',
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#fef3c7',
  },
  offlineNoticeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  offlineNoticeTextCol: {
    flex: 1,
  },
  offlineNoticeTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#92400e',
  },
  offlineNoticeSubtitle: {
    fontSize: 12,
    color: '#b45309',
    marginTop: 2,
  },
  retrySyncButton: {
    backgroundColor: colors.light.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    gap: 6,
  },
  retrySyncButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
});
