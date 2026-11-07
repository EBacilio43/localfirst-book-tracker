import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Image,
  RefreshControl,
  Dimensions,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { isNotNull } from 'drizzle-orm';
import {
  BookOpen,
  Layers,
  Sparkles,
  Smartphone,
  Plus,
  Bookmark,
  Library,
  Compass,
  MapPin,
  ShoppingBag,
  ShieldAlert,
  Check,
  Tag,
  Cloud,
} from 'lucide-react-native';
import { db } from '@/db/client';
import { readingLogs } from '@/db/schema/readingLogs';
import { BooksRepository, SeriesGroup } from '@/db/repositories/booksRepository';
import {
  ShelvesRepository,
  FurnitureShelvesGroup,
} from '@/db/repositories/shelvesRepository';
import { ReadingLogsRepository } from '@/db/repositories/readingLogsRepository';
import {
  BookLoansRepository,
  shouldCountInOwnedPhysicalInventory,
} from '@/db/repositories/bookLoansRepository';
import { Book } from '@/db/schema/books';
import { Shelf } from '@/db/schema/shelves';
import { ReadingLog } from '@/db/schema/readingLogs';
import { BookLoan } from '@/db/schema/bookLoans';
import { LoanCoverRibbon } from '@/features/loans/components/LoanCoverRibbon';
import {
  evaluateTbrCandidates,
  detectSagaGaps,
  SagaGapReport,
} from '@/features/shelves/services/tbrRouletteService';
import { TbrRouletteModal } from '@/features/shelves/components/TbrRouletteModal';
import {
  ShelvesManagerModal,
  DigitalCollectionKey,
} from '@/features/shelves/components/ShelvesManagerModal';
import { CloudSyncAndSettingsModal } from '@/features/cloud-sync/components/CloudSyncAndSettingsModal';
import { wipeAllUserDataPermanently } from '@/features/cloud-sync/services/privacyDataWipeService';
import { colors } from '@/core/theme/colors';
import { SafeButton } from '@/shared/components/SafeButton';
import { LibraryGridSkeleton } from '@/shared/components/Skeleton';

type FilterType =
  | 'TODOS'
  | 'FISICOS'
  | 'DIGITALES'
  | 'SAGAS'
  | 'ESTANTERIAS'
  | 'WISHLIST';

const { width } = Dimensions.get('window');
const COLUMN_WIDTH = (width - 48) / 2;

function parseAuthors(authorsJson?: string | null): string {
  if (!authorsJson) return 'Autor desconocido';
  try {
    const list = JSON.parse(authorsJson);
    if (Array.isArray(list) && list.length > 0) {
      return list[0];
    }
  } catch {
    // Retornar fallback seguro
  }
  return 'Autor desconocido';
}

export default function LibraryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [activeFilter, setActiveFilter] = useState<FilterType>('TODOS');
  const [allBooksList, setAllBooksList] = useState<Book[]>([]);
  const [seriesList, setSeriesList] = useState<SeriesGroup[]>([]);
  const [furnitureGroups, setFurnitureGroups] = useState<FurnitureShelvesGroup[]>([]);
  const [shelvesList, setShelvesList] = useState<Shelf[]>([]);
  const [completedLogs, setCompletedLogs] = useState<ReadingLog[]>([]);
  const [totalCompletedCount, setTotalCompletedCount] = useState<number>(0);
  const [activeLoansMap, setActiveLoansMap] = useState<Record<string, BookLoan>>({});

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Estados de Modales
  const [isTbrModalVisible, setIsTbrModalVisible] = useState(false);
  const [rouletteModality, setRouletteModality] = useState<
    'ALL' | 'PHYSICAL' | 'DIGITAL'
  >('ALL');
  const [rouletteLength, setRouletteLength] = useState<
    'ANY' | 'SHORT' | 'LONG'
  >('ANY');

  const [isShelvesModalVisible, setIsShelvesModalVisible] = useState(false);
  const [selectedBookForShelves, setSelectedBookForShelves] =
    useState<Book | null>(null);
  const [isCloudModalVisible, setIsCloudModalVisible] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [
        all,
        series,
        groupedShelves,
        allShelves,
        completedCount,
        finishedLogs,
        loansMap,
      ] = await Promise.all([
        BooksRepository.getAll(),
        BooksRepository.getSeriesGrouped(),
        ShelvesRepository.getGroupedWithBookCounts(),
        ShelvesRepository.getAll(),
        ReadingLogsRepository.getTotalCompletedBooksCount(),
        db.select().from(readingLogs).where(isNotNull(readingLogs.finishedAt)),
        BookLoansRepository.getActiveLoansByBookMap(),
      ]);

      setAllBooksList(all);
      setSeriesList(series);
      setFurnitureGroups(groupedShelves);
      setShelvesList(allShelves);
      setTotalCompletedCount(completedCount);
      setCompletedLogs(finishedLogs);
      setActiveLoansMap(loansMap);
    } catch (err) {
      console.error('Error cargando biblioteca:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = () => {
    setIsRefreshing(true);
    loadData();
  };

  // Separación estricta de libros propios vs lista de deseos
  const ownedBooks = useMemo(() => {
    return allBooksList.filter(
      (b) => b.ownership !== 'WISHLIST' && b.currentStatus !== 'WISHLIST'
    );
  }, [allBooksList]);

  const wishlistBooks = useMemo(() => {
    return allBooksList.filter(
      (b) => b.ownership === 'WISHLIST' || b.currentStatus === 'WISHLIST'
    );
  }, [allBooksList]);

  // Detector de huecos de saga
  const sagaGaps: SagaGapReport[] = useMemo(() => {
    return detectSagaGaps(allBooksList);
  }, [allBooksList]);

  // Candidatos para la Ruleta TBR
  const tbrCandidates = useMemo(() => {
    const minPages = rouletteLength === 'LONG' ? 300 : undefined;
    const maxPages = rouletteLength === 'SHORT' ? 299 : undefined;
    return evaluateTbrCandidates(ownedBooks, completedLogs, {
      modality: rouletteModality,
      minPages,
      maxPages,
    });
  }, [ownedBooks, completedLogs, rouletteModality, rouletteLength]);

  // Manejo de ganador de Ruleta TBR
  const handleStartReadingWinner = async (winner: Book) => {
    try {
      await ReadingLogsRepository.startReading(winner.id);
      setIsTbrModalVisible(false);
      router.push(`/book/${winner.id}`);
    } catch {
      Alert.alert('Error', 'No se pudo iniciar la lectura del libro seleccionado');
    }
  };

  // Convertir libro de Wishlist a Propio
  const handleQuickBuyWishlistBook = async (wishlistBook: Book) => {
    try {
      await BooksRepository.convertWishlistToOwned({
        bookId: wishlistBook.id,
        modality: wishlistBook.modality,
        shelfId: wishlistBook.shelfId,
        format: wishlistBook.format,
      });
      await loadData();
      Alert.alert(
        'Movido a Mi Librero',
        `"${wishlistBook.title}" se ha trasladado a tu biblioteca en estado Por leer.`
      );
    } catch {
      Alert.alert('Error', 'No se pudo mover el libro a la biblioteca');
    }
  };

  // Filtro de libros propios
  const filteredOwnedBooks = useMemo(() => {
    if (activeFilter === 'FISICOS') {
      return ownedBooks.filter((b) => b.modality === 'PHYSICAL');
    }
    if (activeFilter === 'DIGITALES') {
      return ownedBooks.filter((b) => b.modality === 'DIGITAL');
    }
    return ownedBooks;
  }, [ownedBooks, activeFilter]);

  // Libros físicos propios sin estantería asignada (excluye libros prestados por terceros)
  const unassignedPhysicalBooks = useMemo(() => {
    return ownedBooks.filter(
      (b) => shouldCountInOwnedPhysicalInventory(b) && !b.shelfId
    );
  }, [ownedBooks]);

  const totalSagasCount = seriesList.length;
  const pendingOfflineCount = useMemo(
    () =>
      allBooksList.filter((b) => b.metadataStatus === 'PENDING_OFFLINE_SYNC')
        .length,
    [allBooksList]
  );

  // Libro de referencia para abrir ShelvesManagerModal
  const shelfModalReferenceBook = selectedBookForShelves || ownedBooks[0] || null;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Encabezado Principal */}
      <View style={styles.header}>
        <View style={styles.headerTitleCol}>
          <Text style={styles.headerTitle}>Mi Librero</Text>
          <Text style={styles.headerSubtitle}>
            {ownedBooks.length}{' '}
            {ownedBooks.length === 1 ? 'ejemplar' : 'ejemplares'}
            {totalSagasCount > 0
              ? ` · ${totalSagasCount} ${
                  totalSagasCount === 1 ? 'saga' : 'sagas'
                }`
              : ''}{' '}
            · {totalCompletedCount}{' '}
            {totalCompletedCount === 1 ? 'leído' : 'leídos'}
          </Text>
        </View>

        <View style={styles.headerActions}>
          <SafeButton
            size="sm"
            variant="outline"
            onPress={() => setIsCloudModalVisible(true)}
            leftIcon={<Cloud size={15} color={colors.light.primary} />}
            title="Respaldo"
          />

          <SafeButton
            size="sm"
            variant="outline"
            onPress={() => setIsTbrModalVisible(true)}
            leftIcon={<Compass size={16} color={colors.light.primary} />}
            title="¿Qué leo hoy?"
          />

          <SafeButton
            size="sm"
            variant="primary"
            onPress={() => router.push('/scan')}
            leftIcon={<Plus size={16} color="#FFFFFF" />}
            title="Agregar"
          />
        </View>
      </View>

      {/* Píldoras de Filtros */}
      <View style={styles.filtersWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterPills}
        >
          <Pressable
            onPress={() => setActiveFilter('TODOS')}
            style={[styles.pill, activeFilter === 'TODOS' && styles.pillActive]}
          >
            <Text
              style={[
                styles.pillText,
                activeFilter === 'TODOS' && styles.pillTextActive,
              ]}
            >
              Todos
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setActiveFilter('FISICOS')}
            style={[
              styles.pill,
              activeFilter === 'FISICOS' && styles.pillActive,
            ]}
          >
            <BookOpen
              size={14}
              color={
                activeFilter === 'FISICOS' ? '#FFFFFF' : colors.light.textMuted
              }
            />
            <Text
              style={[
                styles.pillText,
                activeFilter === 'FISICOS' && styles.pillTextActive,
              ]}
            >
              Físicos
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setActiveFilter('DIGITALES')}
            style={[
              styles.pill,
              activeFilter === 'DIGITALES' && styles.pillActive,
            ]}
          >
            <Smartphone
              size={14}
              color={
                activeFilter === 'DIGITALES'
                  ? '#FFFFFF'
                  : colors.light.textMuted
              }
            />
            <Text
              style={[
                styles.pillText,
                activeFilter === 'DIGITALES' && styles.pillTextActive,
              ]}
            >
              eBooks
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setActiveFilter('SAGAS')}
            style={[styles.pill, activeFilter === 'SAGAS' && styles.pillActive]}
          >
            <Sparkles
              size={14}
              color={
                activeFilter === 'SAGAS' ? '#FFFFFF' : colors.light.accent
              }
            />
            <Text
              style={[
                styles.pillText,
                activeFilter === 'SAGAS' && styles.pillTextActive,
              ]}
            >
              Por Sagas
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setActiveFilter('ESTANTERIAS')}
            style={[
              styles.pill,
              activeFilter === 'ESTANTERIAS' && styles.pillActive,
            ]}
          >
            <Library
              size={14}
              color={
                activeFilter === 'ESTANTERIAS'
                  ? '#FFFFFF'
                  : colors.light.primary
              }
            />
            <Text
              style={[
                styles.pillText,
                activeFilter === 'ESTANTERIAS' && styles.pillTextActive,
              ]}
            >
              Estanterías
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setActiveFilter('WISHLIST')}
            style={[
              styles.pill,
              activeFilter === 'WISHLIST' && styles.pillActive,
            ]}
          >
            <Bookmark
              size={14}
              color={
                activeFilter === 'WISHLIST' ? '#FFFFFF' : colors.light.accent
              }
            />
            <Text
              style={[
                styles.pillText,
                activeFilter === 'WISHLIST' && styles.pillTextActive,
              ]}
            >
              Wishlist ({wishlistBooks.length})
            </Text>
          </Pressable>
        </ScrollView>
      </View>

      {/* Contenido según filtro activo */}
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            tintColor={colors.light.primary}
          />
        }
      >
        {/* SKELETON DE CARGA INICIAL */}
        {isLoading ? (
          <LibraryGridSkeleton count={6} />
        ) : ownedBooks.length === 0 &&
        !isLoading &&
        activeFilter !== 'WISHLIST' ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconCircle}>
              <Library
                size={44}
                color={colors.light.primary}
                strokeWidth={1.5}
              />
            </View>
            <Text style={styles.emptyTitle}>
              Tu librero está esperando sus primeras historias
            </Text>
            <Text style={styles.emptySubtitle}>
              Escanea el código de barras ISBN de tus libros físicos o registra
              tus eBooks digitales con portada real.
            </Text>
            <SafeButton
              variant="primary"
              size="lg"
              onPress={() => router.push('/scan')}
              leftIcon={<Plus size={20} color="#FFFFFF" />}
              title="Escanear primer libro"
              style={styles.emptyButton}
            />
          </View>
        ) : activeFilter === 'SAGAS' ? (
          /* VISTA POR SAGAS */
          <View style={styles.sagasContainer}>
            {seriesList.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Layers size={40} color={colors.light.textMuted} />
                <Text style={styles.emptyTitle}>No tienes sagas agrupadas aún</Text>
                <Text style={styles.emptySubtitle}>
                  Los libros con nombre de saga se agruparán automáticamente aquí
                  en su orden numérico de lectura.
                </Text>
              </View>
            ) : (
              seriesList.map((group) => (
                <View key={group.seriesName} style={styles.sagaCard}>
                  <View style={styles.sagaHeader}>
                    <View>
                      <Text style={styles.sagaName}>{group.seriesName}</Text>
                      <Text style={styles.sagaCount}>
                        {group.totalBooks}{' '}
                        {group.totalBooks === 1
                          ? 'tomo en tu biblioteca'
                          : 'tomos en tu biblioteca'}
                      </Text>
                    </View>
                    <View style={styles.sagaBadge}>
                      <Text style={styles.sagaBadgeText}>Saga</Text>
                    </View>
                  </View>

                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.sagaScroll}
                  >
                    {group.books.map((book) => (
                      <Pressable
                        key={book.id}
                        onPress={() => router.push(`/book/${book.id}`)}
                        style={styles.sagaBookCard}
                      >
                        {book.coverUri ? (
                          <Image
                            source={{ uri: book.coverUri }}
                            style={styles.sagaCover}
                            resizeMode="cover"
                          />
                        ) : (
                          <View style={[styles.sagaCover, styles.coverFallback]}>
                            <Bookmark size={20} color={colors.light.primary} />
                            <Text style={styles.fallbackTitle} numberOfLines={2}>
                              {book.title}
                            </Text>
                          </View>
                        )}
                        <Text style={styles.sagaBookIndex}>
                          {book.seriesIndex !== null
                            ? `#${book.seriesIndex}`
                            : 'Tomo'}
                        </Text>
                        <Text style={styles.sagaBookTitle} numberOfLines={1}>
                          {book.title}
                        </Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>
              ))
            )}
          </View>
        ) : activeFilter === 'ESTANTERIAS' ? (
          /* VISTA POR ESTANTERÍAS */
          <View style={styles.shelvesContainer}>
            <View style={styles.shelvesTopHeader}>
              <View>
                <Text style={styles.shelvesSectionTitle}>
                  Muebles y Repisas Físicas
                </Text>
                <Text style={styles.shelvesSectionSubtitle}>
                  Organización espacial de tus libros en casa
                </Text>
              </View>
              {shelfModalReferenceBook ? (
                <SafeButton
                  size="sm"
                  variant="outline"
                  leftIcon={<MapPin size={14} color={colors.light.primary} />}
                  title="Administrar estanterías"
                  onPress={() => {
                    setSelectedBookForShelves(shelfModalReferenceBook);
                    setIsShelvesModalVisible(true);
                  }}
                />
              ) : null}
            </View>

            {furnitureGroups.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Library size={40} color={colors.light.textMuted} />
                <Text style={styles.emptyTitle}>
                  No tienes estanterías físicas registradas
                </Text>
                <Text style={styles.emptySubtitle}>
                  Crea tus muebles y baldas pulsando en Administrar estanterías o
                  desde la ficha técnica de un libro físico.
                </Text>
              </View>
            ) : (
              furnitureGroups.map((group) => (
                <View key={group.furnitureName} style={styles.furnitureCard}>
                  <View style={styles.furnitureHeader}>
                    <View style={styles.furnitureTitleRow}>
                      <Library size={18} color={colors.light.primary} />
                      <Text style={styles.furnitureNameText}>
                        {group.furnitureName}
                      </Text>
                    </View>
                    <Text style={styles.furnitureCountText}>
                      {group.totalBooks}{' '}
                      {group.totalBooks === 1 ? 'libro' : 'libros'}
                    </Text>
                  </View>

                  <View style={styles.compartmentsList}>
                    {group.compartments.map((comp) => (
                      <View key={comp.id} style={styles.compartmentCard}>
                        <View style={styles.compartmentHeader}>
                          <View
                            style={[
                              styles.compColorDot,
                              { backgroundColor: comp.colorTag },
                            ]}
                          />
                          <Text style={styles.compLevelText}>
                            {comp.shelfLevel || 'Sin nivel'}
                          </Text>
                          <Text style={styles.compBookCountText}>
                            ({comp.bookCount}{' '}
                            {comp.bookCount === 1 ? 'ejemplar' : 'ejemplares'})
                          </Text>
                        </View>

                        {comp.books.length > 0 ? (
                          <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            style={styles.compBooksScroll}
                          >
                            {comp.books.map((b) => (
                              <Pressable
                                key={b.id}
                                onPress={() => router.push(`/book/${b.id}`)}
                                style={styles.shelfBookItem}
                              >
                                {b.coverUri ? (
                                  <Image
                                    source={{ uri: b.coverUri }}
                                    style={styles.shelfBookCover}
                                    resizeMode="cover"
                                  />
                                ) : (
                                  <View
                                    style={[
                                      styles.shelfBookCover,
                                      styles.coverFallback,
                                    ]}
                                  >
                                    <Bookmark
                                      size={18}
                                      color={colors.light.primary}
                                    />
                                  </View>
                                )}
                                <Text
                                  style={styles.shelfBookTitle}
                                  numberOfLines={1}
                                >
                                  {b.title}
                                </Text>
                              </Pressable>
                            ))}
                          </ScrollView>
                        ) : (
                          <Text style={styles.emptyCompText}>
                            Repisa sin libros asignados
                          </Text>
                        )}
                      </View>
                    ))}
                  </View>
                </View>
              ))
            )}

            {/* Libros físicos sin estantería asignada */}
            {unassignedPhysicalBooks.length > 0 ? (
              <View style={styles.unassignedCard}>
                <View style={styles.unassignedHeader}>
                  <MapPin size={16} color={colors.light.accent} />
                  <Text style={styles.unassignedTitle}>
                    Libros físicos sin repisa asignada (
                    {unassignedPhysicalBooks.length})
                  </Text>
                </View>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.sagaScroll}
                >
                  {unassignedPhysicalBooks.map((b) => (
                    <Pressable
                      key={b.id}
                      onPress={() => router.push(`/book/${b.id}`)}
                      style={styles.shelfBookItem}
                    >
                      {b.coverUri ? (
                        <Image
                          source={{ uri: b.coverUri }}
                          style={styles.shelfBookCover}
                          resizeMode="cover"
                        />
                      ) : (
                        <View
                          style={[styles.shelfBookCover, styles.coverFallback]}
                        >
                          <Bookmark size={18} color={colors.light.primary} />
                        </View>
                      )}
                      <Text style={styles.shelfBookTitle} numberOfLines={1}>
                        {b.title}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            ) : null}
          </View>
        ) : activeFilter === 'WISHLIST' ? (
          /* VISTA WISHLIST */
          <View style={styles.wishlistSection}>
            {/* Detector de Huecos en Sagas */}
            {sagaGaps.length > 0 ? (
              <View style={styles.sagaGapsCard}>
                <View style={styles.sagaGapsHeader}>
                  <ShieldAlert size={20} color={colors.light.accent} />
                  <Text style={styles.sagaGapsTitle}>
                    Huecos detectados en tus sagas
                  </Text>
                </View>
                <Text style={styles.sagaGapsDescription}>
                  Faltan tomos intermedios en tu biblioteca para completar estas
                  sagas:
                </Text>

                <View style={styles.sagaGapsList}>
                  {sagaGaps.map((gap) => (
                    <View key={gap.seriesName} style={styles.gapItemRow}>
                      <Text style={styles.gapSeriesName}>
                        {gap.seriesName}
                      </Text>
                      <Text style={styles.gapIndicesText}>
                        Tomos faltantes: #{gap.missingIndices.join(', #')}
                      </Text>
                      {gap.wishlistMatches.length > 0 ? (
                        <View style={styles.wishlistMatchBadge}>
                          <Check size={12} color={colors.light.primary} />
                          <Text style={styles.wishlistMatchText}>
                            En tu lista de deseos:{' '}
                            {gap.wishlistMatches
                              .map((m) => `${m.title} (#${m.seriesIndex})`)
                              .join(', ')}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  ))}
                </View>
              </View>
            ) : null}

            {/* Listado de libros en Wishlist */}
            {wishlistBooks.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Bookmark size={40} color={colors.light.textMuted} />
                <Text style={styles.emptyTitle}>Tu lista de deseos está vacía</Text>
                <Text style={styles.emptySubtitle}>
                  Guarda libros que planeas comprar o leer en el futuro para dar
                  seguimiento a tiendas y precios.
                </Text>
              </View>
            ) : (
              <View style={styles.wishlistGrid}>
                {wishlistBooks.map((book) => {
                  return (
                    <View key={book.id} style={styles.wishlistBookCard}>
                      <Pressable
                        onPress={() => router.push(`/book/${book.id}`)}
                        style={styles.wishlistCoverWrap}
                      >
                        {book.coverUri ? (
                          <Image
                            source={{ uri: book.coverUri }}
                            style={styles.wishlistCover}
                            resizeMode="cover"
                          />
                        ) : (
                          <View
                            style={[
                              styles.wishlistCover,
                              styles.coverFallback,
                            ]}
                          >
                            <Bookmark size={24} color={colors.light.primary} />
                          </View>
                        )}
                      </Pressable>

                      <View style={styles.wishlistBookDetails}>
                        <Pressable
                          onPress={() => router.push(`/book/${book.id}`)}
                        >
                          <Text
                            style={styles.wishlistBookTitle}
                            numberOfLines={2}
                          >
                            {book.title}
                          </Text>
                          <Text
                            style={styles.wishlistBookAuthor}
                            numberOfLines={1}
                          >
                            {parseAuthors(book.authorsJson)}
                          </Text>
                        </Pressable>

                        {book.seriesName ? (
                          <Text
                            style={styles.wishlistBookSeries}
                            numberOfLines={1}
                          >
                            {book.seriesName}{' '}
                            {book.seriesIndex ? `#${book.seriesIndex}` : ''}
                          </Text>
                        ) : null}

                        {book.wishlistStoreNote ? (
                          <View style={styles.storeNotePill}>
                            <Tag size={11} color={colors.light.accent} />
                            <Text
                              style={styles.storeNoteText}
                              numberOfLines={1}
                            >
                              {book.wishlistStoreNote}
                            </Text>
                          </View>
                        ) : null}

                        <SafeButton
                          title="Ya lo compré"
                          variant="primary"
                          size="sm"
                          leftIcon={<Check size={14} color="#FFFFFF" />}
                          onPress={() => handleQuickBuyWishlistBook(book)}
                          style={styles.buyButtonMargin}
                        />
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        ) : (
          /* GRID ESTÁNDAR DE LIBROS PROPIOS (TODOS, FÍSICOS O DIGITALES) */
          <View style={styles.gridContainer}>
            {filteredOwnedBooks.map((book) => {
              const authorLabel = parseAuthors(book.authorsJson);

              return (
                <Pressable
                  key={book.id}
                  onPress={() => router.push(`/book/${book.id}`)}
                  style={styles.bookCard}
                >
                  <View style={styles.coverWrapper}>
                    {book.coverUri ? (
                      <Image
                        source={{ uri: book.coverUri }}
                        style={styles.coverImage}
                        resizeMode="cover"
                      />
                    ) : (
                      <View style={[styles.coverImage, styles.coverFallback]}>
                        <Bookmark size={28} color={colors.light.primary} />
                        <Text style={styles.fallbackTitle} numberOfLines={3}>
                          {book.title}
                        </Text>
                      </View>
                    )}

                    {/* Cintillo de préstamo activo (LENT_OUT / BORROWED_IN) */}
                    {activeLoansMap[book.id] ? (
                      <LoanCoverRibbon loan={activeLoansMap[book.id]} />
                    ) : null}

                    {/* Badge de Modalidad (Físico / Digital) */}
                    <View style={styles.modalityBadge}>
                      {book.modality === 'PHYSICAL' ? (
                        <BookOpen size={12} color="#FFFFFF" />
                      ) : (
                        <Smartphone size={12} color="#FFFFFF" />
                      )}
                    </View>
                  </View>

                  <Text style={styles.bookTitle} numberOfLines={2}>
                    {book.title}
                  </Text>
                  <Text style={styles.bookAuthor} numberOfLines={1}>
                    {authorLabel}
                  </Text>
                  {book.publisher ? (
                    <Text style={styles.bookPublisher} numberOfLines={1}>
                      {book.publisher}
                    </Text>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Modal de Ruleta TBR */}
      <TbrRouletteModal
        visible={isTbrModalVisible}
        eligibleBooks={tbrCandidates.eligible}
        blockedSequels={tbrCandidates.blockedSequels}
        shelves={shelvesList}
        modalityFilter={rouletteModality}
        lengthFilter={rouletteLength}
        onChangeModality={setRouletteModality}
        onChangeLength={setRouletteLength}
        onClose={() => setIsTbrModalVisible(false)}
        onStartReadingWinner={handleStartReadingWinner}
      />

      {/* Modal de Gestión de Estanterías */}
      {shelfModalReferenceBook ? (
        <ShelvesManagerModal
          visible={isShelvesModalVisible}
          book={shelfModalReferenceBook}
          shelves={shelvesList}
          onClose={() => setIsShelvesModalVisible(false)}
          onAssignPhysicalShelf={async (shelfId) => {
            if (shelfModalReferenceBook) {
              await ShelvesRepository.assignBookToShelf(
                shelfModalReferenceBook.id,
                shelfId
              );
              await loadData();
            }
          }}
          onAssignDigitalCollection={async (collection: DigitalCollectionKey) => {
            if (shelfModalReferenceBook) {
              await BooksRepository.update(shelfModalReferenceBook.id, {
                format: collection,
                shelfId: null,
              });
              await loadData();
            }
          }}
          onCreateShelf={async (data) => {
            await ShelvesRepository.create(data);
            await loadData();
          }}
          onRemoveFromShelf={async () => {
            if (shelfModalReferenceBook) {
              await ShelvesRepository.assignBookToShelf(
                shelfModalReferenceBook.id,
                null
              );
              await loadData();
            }
          }}
        />
      ) : null}

      {/* Modal de Respaldo en la Nube, Libros Pendientes, Importar y Privacidad */}
      <CloudSyncAndSettingsModal
        visible={isCloudModalVisible}
        onClose={() => setIsCloudModalVisible(false)}
        backupSummary={{
          booksCount: ownedBooks.length,
          sessionsCount: completedLogs.length,
          quotesCount: 0,
        }}
        pendingOfflineBooksCount={pendingOfflineCount}
        onWipeAllData={async () => {
          await wipeAllUserDataPermanently();
          setIsCloudModalVisible(false);
          await loadData();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.light.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerTitleCol: {
    flex: 1,
    marginRight: 8,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.light.text,
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 12,
    color: colors.light.textMuted,
    marginTop: 2,
    fontWeight: '500',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  filtersWrapper: {
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.light.borderSubtle,
  },
  filterPills: {
    paddingHorizontal: 16,
    gap: 8,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: colors.light.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.light.border,
  },
  pillActive: {
    backgroundColor: colors.light.primary,
    borderColor: colors.light.primary,
  },
  pillText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.light.textMuted,
  },
  pillTextActive: {
    color: '#FFFFFF',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  bookCard: {
    width: COLUMN_WIDTH,
    marginBottom: 8,
  },
  coverWrapper: {
    width: COLUMN_WIDTH,
    height: COLUMN_WIDTH * 1.5,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: colors.light.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.light.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
    position: 'relative',
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  coverFallback: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#F2EDE4',
  },
  fallbackTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.light.text,
    textAlign: 'center',
    marginTop: 8,
  },
  modalityBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(30, 70, 53, 0.85)',
    padding: 4,
    borderRadius: 6,
  },
  bookTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.light.text,
    marginTop: 8,
    lineHeight: 18,
  },
  bookAuthor: {
    fontSize: 12,
    color: colors.light.textMuted,
    marginTop: 2,
  },
  bookPublisher: {
    fontSize: 11,
    color: colors.light.accent,
    fontWeight: '500',
    marginTop: 1,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  emptyIconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.light.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.light.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.light.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: colors.light.textMuted,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  emptyButton: {
    minWidth: 200,
  },
  sagasContainer: {
    gap: 20,
  },
  sagaCard: {
    backgroundColor: colors.light.surface,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.light.border,
  },
  sagaHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  sagaName: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.light.text,
  },
  sagaCount: {
    fontSize: 12,
    color: colors.light.textMuted,
    marginTop: 2,
  },
  sagaBadge: {
    backgroundColor: colors.light.badgeBg,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  sagaBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.light.badgeText,
  },
  sagaScroll: {
    marginTop: 4,
  },
  sagaBookCard: {
    width: 104,
    marginRight: 12,
  },
  sagaCover: {
    width: 104,
    height: 156,
    borderRadius: 8,
    backgroundColor: colors.light.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.light.border,
  },
  sagaBookIndex: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.light.primary,
    marginTop: 6,
  },
  sagaBookTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.light.text,
    marginTop: 2,
  },
  shelvesContainer: {
    gap: 16,
  },
  shelvesTopHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  shelvesSectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.light.text,
  },
  shelvesSectionSubtitle: {
    fontSize: 12,
    color: colors.light.textMuted,
  },
  furnitureCard: {
    backgroundColor: colors.light.surface,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.light.border,
    gap: 12,
  },
  furnitureHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  furnitureTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  furnitureNameText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.light.text,
  },
  furnitureCountText: {
    fontSize: 12,
    color: colors.light.textMuted,
    fontWeight: '600',
  },
  compartmentsList: {
    gap: 10,
  },
  compartmentCard: {
    backgroundColor: colors.light.surfaceAlt,
    borderRadius: 10,
    padding: 10,
    gap: 8,
  },
  compartmentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  compColorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  compLevelText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.light.text,
  },
  compBookCountText: {
    fontSize: 11,
    color: colors.light.textMuted,
  },
  compBooksScroll: {
    marginTop: 4,
  },
  emptyCompText: {
    fontSize: 12,
    color: colors.light.textMuted,
    fontStyle: 'italic',
    paddingVertical: 4,
  },
  shelfBookItem: {
    width: 80,
    marginRight: 10,
  },
  shelfBookCover: {
    width: 80,
    height: 120,
    borderRadius: 6,
    backgroundColor: colors.light.surface,
    borderWidth: 1,
    borderColor: colors.light.border,
  },
  shelfBookTitle: {
    fontSize: 11,
    color: colors.light.text,
    fontWeight: '600',
    marginTop: 4,
  },
  unassignedCard: {
    backgroundColor: colors.light.surface,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.light.border,
    gap: 10,
  },
  unassignedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  unassignedTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.light.accent,
  },
  wishlistSection: {
    gap: 16,
  },
  sagaGapsCard: {
    backgroundColor: '#FFF7F4',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.light.accent,
    gap: 8,
  },
  sagaGapsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sagaGapsTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.light.accent,
  },
  sagaGapsDescription: {
    fontSize: 12,
    color: colors.light.textMuted,
    lineHeight: 16,
  },
  sagaGapsList: {
    gap: 8,
    marginTop: 4,
  },
  gapItemRow: {
    backgroundColor: colors.light.surface,
    borderRadius: 8,
    padding: 10,
    gap: 4,
    borderWidth: 1,
    borderColor: colors.light.borderSubtle,
  },
  gapSeriesName: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.light.text,
  },
  gapIndicesText: {
    fontSize: 12,
    color: colors.light.accent,
    fontWeight: '600',
  },
  wishlistMatchBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.light.badgeBg,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginTop: 2,
  },
  wishlistMatchText: {
    fontSize: 11,
    color: colors.light.primary,
    fontWeight: '600',
  },
  wishlistGrid: {
    gap: 12,
  },
  wishlistBookCard: {
    flexDirection: 'row',
    backgroundColor: colors.light.surface,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.light.border,
    gap: 12,
  },
  wishlistCoverWrap: {
    width: 72,
    height: 108,
  },
  wishlistCover: {
    width: 72,
    height: 108,
    borderRadius: 6,
    backgroundColor: colors.light.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.light.border,
  },
  wishlistBookDetails: {
    flex: 1,
    justifyContent: 'space-between',
  },
  wishlistBookTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.light.text,
  },
  wishlistBookAuthor: {
    fontSize: 12,
    color: colors.light.textMuted,
    marginTop: 1,
  },
  wishlistBookSeries: {
    fontSize: 11,
    color: colors.light.accent,
    fontWeight: '600',
    marginTop: 2,
  },
  storeNotePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFF5F0',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  storeNoteText: {
    fontSize: 11,
    color: colors.light.accent,
    fontWeight: '600',
  },
  buyButtonMargin: {
    marginTop: 8,
    alignSelf: 'flex-start',
  },
});
