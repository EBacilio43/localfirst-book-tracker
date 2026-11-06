import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Image,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  BookOpen,
  Layers,
  Sparkles,
  Smartphone,
  Plus,
  Bookmark,
  Library,
} from 'lucide-react-native';
import { BooksRepository, SeriesGroup } from '@/db/repositories/booksRepository';
import { Book } from '@/db/schema/books';
import { colors } from '@/core/theme/colors';
import { SafeButton } from '@/shared/components/SafeButton';

type FilterType = 'TODOS' | 'FISICOS' | 'DIGITALES' | 'SAGAS';

const { width } = Dimensions.get('window');
const COLUMN_WIDTH = (width - 48) / 2;

export default function LibraryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [activeFilter, setActiveFilter] = useState<FilterType>('TODOS');
  const [booksList, setBooksList] = useState<Book[]>([]);
  const [seriesList, setSeriesList] = useState<SeriesGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const all = await BooksRepository.getAll();
      setBooksList(all);

      const series = await BooksRepository.getSeriesGrouped();
      setSeriesList(series);
    } catch (err) {
      console.error('Error cargando libros:', err);
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

  const filteredBooks = booksList.filter((b) => {
    if (activeFilter === 'FISICOS') return b.modality === 'PHYSICAL';
    if (activeFilter === 'DIGITALES') return b.modality === 'DIGITAL';
    return true;
  });

  const totalSagasCount = seriesList.length;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Encabezado Principal */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Mi Librero</Text>
          <Text style={styles.headerSubtitle}>
            {booksList.length} {booksList.length === 1 ? 'ejemplar' : 'ejemplares'}
            {totalSagasCount > 0 ? ` · ${totalSagasCount} ${totalSagasCount === 1 ? 'saga' : 'sagas'}` : ''}
          </Text>
        </View>

        <SafeButton
          size="sm"
          variant="secondary"
          onPress={() => router.push('/scan')}
          leftIcon={<Plus size={18} color={colors.light.primary} />}
          title="Agregar"
        />
      </View>

      {/* Píldoras de Filtros */}
      <View style={styles.filtersWrapper}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterPills}>
          <Pressable
            onPress={() => setActiveFilter('TODOS')}
            style={[styles.pill, activeFilter === 'TODOS' && styles.pillActive]}
          >
            <Text style={[styles.pillText, activeFilter === 'TODOS' && styles.pillTextActive]}>
              Todos
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setActiveFilter('FISICOS')}
            style={[styles.pill, activeFilter === 'FISICOS' && styles.pillActive]}
          >
            <BookOpen size={14} color={activeFilter === 'FISICOS' ? '#FFFFFF' : colors.light.textMuted} />
            <Text style={[styles.pillText, activeFilter === 'FISICOS' && styles.pillTextActive]}>
              Físicos
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setActiveFilter('DIGITALES')}
            style={[styles.pill, activeFilter === 'DIGITALES' && styles.pillActive]}
          >
            <Smartphone size={14} color={activeFilter === 'DIGITALES' ? '#FFFFFF' : colors.light.textMuted} />
            <Text style={[styles.pillText, activeFilter === 'DIGITALES' && styles.pillTextActive]}>
              eBooks
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setActiveFilter('SAGAS')}
            style={[styles.pill, activeFilter === 'SAGAS' && styles.pillActive]}
          >
            <Sparkles size={14} color={activeFilter === 'SAGAS' ? '#FFFFFF' : colors.light.accent} />
            <Text style={[styles.pillText, activeFilter === 'SAGAS' && styles.pillTextActive]}>
              Por Sagas
            </Text>
          </Pressable>
        </ScrollView>
      </View>

      {/* Contenido: Grid de Libros, Vista de Sagas o Estado Vacío */}
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={colors.light.primary} />
        }
      >
        {booksList.length === 0 && !isLoading ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconCircle}>
              <Library size={44} color={colors.light.primary} strokeWidth={1.5} />
            </View>
            <Text style={styles.emptyTitle}>Tu librero está esperando sus primeras historias</Text>
            <Text style={styles.emptySubtitle}>
              Escanea el código de barras ISBN de tus libros físicos o registra tus eBooks digitales con portada real.
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
          /* Vista Agrupada por Sagas */
          <View style={styles.sagasContainer}>
            {seriesList.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Layers size={40} color={colors.light.textMuted} />
                <Text style={styles.emptyTitle}>No tienes sagas agrupadas aún</Text>
                <Text style={styles.emptySubtitle}>
                  Los libros con nombre de saga (ej. Dune, El Señor de los Anillos) se agruparán automáticamente aquí.
                </Text>
              </View>
            ) : (
              seriesList.map((group) => (
                <View key={group.seriesName} style={styles.sagaCard}>
                  <View style={styles.sagaHeader}>
                    <View>
                      <Text style={styles.sagaName}>{group.seriesName}</Text>
                      <Text style={styles.sagaCount}>
                        {group.totalBooks} {group.totalBooks === 1 ? 'tomo en tu biblioteca' : 'tomos en tu biblioteca'}
                      </Text>
                    </View>
                    <View style={styles.sagaBadge}>
                      <Text style={styles.sagaBadgeText}>Saga</Text>
                    </View>
                  </View>

                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.sagaScroll}>
                    {group.books.map((book) => (
                      <Pressable
                        key={book.id}
                        onPress={() => router.push(`/book/${book.id}`)}
                        style={styles.sagaBookCard}
                      >
                        {book.coverUri ? (
                          <Image source={{ uri: book.coverUri }} style={styles.sagaCover} resizeMode="cover" />
                        ) : (
                          <View style={[styles.sagaCover, styles.coverFallback]}>
                            <Bookmark size={20} color={colors.light.primary} />
                            <Text style={styles.fallbackTitle} numberOfLines={2}>
                              {book.title}
                            </Text>
                          </View>
                        )}
                        <Text style={styles.sagaBookIndex}>
                          {book.seriesIndex !== null ? `#${book.seriesIndex}` : 'Tomo'}
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
        ) : (
          /* Grid de Libros */
          <View style={styles.gridContainer}>
            {filteredBooks.map((book) => {
              const authors = JSON.parse(book.authorsJson || '[]');
              const authorLabel = authors.length > 0 ? authors[0] : 'Autor desconocido';

              return (
                <Pressable
                  key={book.id}
                  onPress={() => router.push(`/book/${book.id}`)}
                  style={styles.bookCard}
                >
                  <View style={styles.coverWrapper}>
                    {book.coverUri ? (
                      <Image source={{ uri: book.coverUri }} style={styles.coverImage} resizeMode="cover" />
                    ) : (
                      <View style={[styles.coverImage, styles.coverFallback]}>
                        <Bookmark size={28} color={colors.light.primary} />
                        <Text style={styles.fallbackTitle} numberOfLines={3}>
                          {book.title}
                        </Text>
                      </View>
                    )}

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
  headerTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.light.text,
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 13,
    color: colors.light.textMuted,
    marginTop: 2,
    fontWeight: '500',
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
    paddingVertical: 64,
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
});
