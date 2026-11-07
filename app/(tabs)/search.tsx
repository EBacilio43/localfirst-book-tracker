import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  FlatList,
  Pressable,
  Image,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Search, X, BookOpen, Smartphone, Bookmark, ScanBarcode } from 'lucide-react-native';
import { BooksRepository } from '@/db/repositories/booksRepository';
import { Book } from '@/db/schema/books';
import { colors } from '@/core/theme/colors';
import { SafeButton } from '@/shared/components/SafeButton';
import { SearchListSkeleton } from '@/shared/components/Skeleton';

export default function SearchScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Book[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    debounceTimerRef.current = setTimeout(async () => {
      try {
        const matches = await BooksRepository.search(trimmed);
        setResults(matches);
      } catch (err) {
        console.error('Error buscando libros:', err);
      } finally {
        setIsSearching(false);
      }
    }, 250);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [query]);

  const clearQuery = () => {
    setQuery('');
    setResults([]);
  };

  const renderBookItem = ({ item }: { item: Book }) => {
    const authors = JSON.parse(item.authorsJson || '[]');
    const authorLabel = authors.length > 0 ? authors[0] : 'Autor desconocido';

    return (
      <Pressable
        onPress={() => router.push(`/book/${item.id}`)}
        style={styles.resultItem}
      >
        <View style={styles.coverWrapper}>
          {item.coverUri ? (
            <Image source={{ uri: item.coverUri }} style={styles.coverImage} resizeMode="cover" />
          ) : (
            <View style={[styles.coverImage, styles.coverFallback]}>
              <Bookmark size={20} color={colors.light.primary} />
            </View>
          )}
        </View>

        <View style={styles.infoWrapper}>
          <Text style={styles.bookTitle} numberOfLines={2}>
            {item.title}
          </Text>
          <Text style={styles.bookAuthor} numberOfLines={1}>
            {authorLabel}
          </Text>

          <View style={styles.metadataRow}>
            {item.publisher ? (
              <Text style={styles.bookPublisher} numberOfLines={1}>
                {item.publisher}
              </Text>
            ) : null}

            <View style={styles.badge}>
              {item.modality === 'PHYSICAL' ? (
                <>
                  <BookOpen size={11} color={colors.light.primary} />
                  <Text style={styles.badgeText}>Físico</Text>
                </>
              ) : (
                <>
                  <Smartphone size={11} color={colors.light.accent} />
                  <Text style={styles.badgeText}>eBook</Text>
                </>
              )}
            </View>
          </View>
        </View>
      </Pressable>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Barra de búsqueda */}
      <View style={styles.header}>
        <View style={styles.searchBar}>
          <Search size={20} color={colors.light.textMuted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Buscar por título, autor, editorial o saga..."
            placeholderTextColor={colors.light.textSubtle}
            style={styles.input}
            returnKeyType="search"
            autoCapitalize="none"
            autoCorrect={false}
          />
          {query.length > 0 ? (
            <Pressable onPress={clearQuery} hitSlop={10} style={styles.clearButton}>
              <X size={18} color={colors.light.textMuted} />
            </Pressable>
          ) : null}
        </View>
      </View>

      {/* Indicador de carga */}
      {isSearching ? (
        <View style={styles.searchingBar}>
          <ActivityIndicator size="small" color={colors.light.primary} />
          <Text style={styles.searchingText}>Buscando en tu biblioteca...</Text>
        </View>
      ) : null}

      {/* Resultados, Skeleton de Carga o Estados Vacíos */}
      {isSearching && results.length === 0 ? (
        <SearchListSkeleton count={5} />
      ) : query.trim().length === 0 ? (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconCircle}>
            <Search size={36} color={colors.light.primary} strokeWidth={1.5} />
          </View>
          <Text style={styles.emptyTitle}>Búsqueda Instantánea</Text>
          <Text style={styles.emptySubtitle}>
            Encuentra cualquier libro en tu biblioteca local buscando por título, autor, saga o editorial.
          </Text>
        </View>
      ) : results.length === 0 && !isSearching ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.noResultsTitle}>No encontramos "{query}"</Text>
          <Text style={styles.noResultsSubtitle}>
            Verifica la ortografía o escanea el código de barras para agregarlo a tu colección.
          </Text>
          <SafeButton
            variant="secondary"
            onPress={() => router.push('/scan')}
            leftIcon={<ScanBarcode size={18} color={colors.light.primary} />}
            title="Escanear libro con cámara"
            style={styles.noResultsButton}
          />
        </View>
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item) => item.id}
          renderItem={renderBookItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.light.background,
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.light.borderSubtle,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.light.surfaceAlt,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.light.border,
    paddingHorizontal: 12,
    height: 48,
    gap: 8,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: colors.light.text,
  },
  clearButton: {
    padding: 4,
  },
  searchingBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 8,
    backgroundColor: colors.light.surfaceAlt,
  },
  searchingText: {
    fontSize: 12,
    color: colors.light.textMuted,
  },
  listContent: {
    padding: 16,
    gap: 12,
  },
  resultItem: {
    flexDirection: 'row',
    backgroundColor: colors.light.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.light.border,
    padding: 10,
    gap: 12,
    alignItems: 'center',
  },
  coverWrapper: {
    width: 52,
    height: 76,
    borderRadius: 6,
    overflow: 'hidden',
    backgroundColor: colors.light.surfaceAlt,
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
  infoWrapper: {
    flex: 1,
  },
  bookTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.light.text,
    lineHeight: 19,
  },
  bookAuthor: {
    fontSize: 13,
    color: colors.light.textMuted,
    marginTop: 2,
  },
  metadataRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
  bookPublisher: {
    fontSize: 11,
    color: colors.light.accent,
    fontWeight: '600',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.light.badgeBg,
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.light.badgeText,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 72,
    paddingHorizontal: 32,
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
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
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: colors.light.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
  noResultsTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.light.text,
    marginBottom: 8,
  },
  noResultsSubtitle: {
    fontSize: 14,
    color: colors.light.textMuted,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  noResultsButton: {
    marginTop: 8,
  },
});
