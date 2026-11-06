import React, { useEffect, useState, useCallback } from 'react';
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
  CheckCircle2,
  Clock,
  Sparkles,
} from 'lucide-react-native';
import { BooksRepository } from '@/db/repositories/booksRepository';
import { Book } from '@/db/schema/books';
import { colors } from '@/core/theme/colors';
import { SafeButton } from '@/shared/components/SafeButton';

type BookStatus = 'POR_LEER' | 'LEYENDO' | 'EN_ESPERA' | 'LEIDO' | 'ABANDONADO' | 'WISHLIST';

const STATUS_LABELS: Record<BookStatus, string> = {
  POR_LEER: 'Por leer',
  LEYENDO: 'Leyendo',
  EN_ESPERA: 'En pausa',
  LEIDO: 'Leído',
  ABANDONADO: 'Abandonado',
  WISHLIST: 'Deseado',
};

export default function BookDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [book, setBook] = useState<Book | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);

  const loadBook = useCallback(async () => {
    if (!id) return;
    try {
      const found = await BooksRepository.getById(id);
      setBook(found);
    } catch (err) {
      console.error('Error cargando detalle del libro:', err);
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadBook();
  }, [loadBook]);

  const updateStatus = async (newStatus: BookStatus) => {
    if (!book) return;
    try {
      const updated = await BooksRepository.update(book.id, { currentStatus: newStatus });
      if (updated) {
        setBook(updated);
      }
    } catch (err) {
      Alert.alert('Error', 'No se pudo actualizar el estado de lectura');
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

  if (isLoading) {
    return (
      <View style={[styles.centerContainer, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={colors.light.primary} />
      </View>
    );
  }

  if (!book) {
    return (
      <View style={[styles.centerContainer, { paddingTop: insets.top }]}>
        <Text style={styles.errorText}>No se encontró el libro solicitado.</Text>
        <SafeButton title="Volver a la biblioteca" onPress={() => router.back()} style={{ marginTop: 16 }} />
      </View>
    );
  }

  const authors = JSON.parse(book.authorsJson || '[]');
  const authorsLabel = authors.length > 0 ? authors.join(', ') : 'Autor desconocido';

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Barra Superior */}
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.iconButton}>
          <ArrowLeft size={22} color={colors.light.text} />
        </Pressable>

        <Pressable onPress={confirmDelete} hitSlop={12} style={styles.iconButton}>
          <Trash2 size={20} color={colors.light.danger} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Cabecera con Portada */}
        <View style={styles.coverSection}>
          <View style={styles.coverWrapper}>
            {book.coverUri ? (
              <Image source={{ uri: book.coverUri }} style={styles.coverImage} resizeMode="cover" />
            ) : (
              <View style={[styles.coverImage, styles.coverFallback]}>
                <Bookmark size={48} color={colors.light.primary} />
              </View>
            )}
          </View>

          <Text style={styles.title}>{book.title}</Text>
          {book.subtitle ? <Text style={styles.subtitle}>{book.subtitle}</Text> : null}
          <Text style={styles.author}>{authorsLabel}</Text>

          {/* Badges de Saga, Formato y Modalidad */}
          <View style={styles.badgesRow}>
            {book.seriesName ? (
              <View style={styles.sagaBadge}>
                <Sparkles size={12} color={colors.light.accent} />
                <Text style={styles.sagaBadgeText}>
                  {book.seriesName} {book.seriesIndex ? `#${book.seriesIndex}` : ''}
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
          </View>
        </View>

        {/* Selector de Estado de Lectura */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Estado de Lectura</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.statusRow}>
            {(['POR_LEER', 'LEYENDO', 'LEIDO', 'EN_ESPERA', 'ABANDONADO', 'WISHLIST'] as BookStatus[]).map(
              (status) => {
                const isActive = book.currentStatus === status;
                return (
                  <Pressable
                    key={status}
                    onPress={() => updateStatus(status)}
                    style={[styles.statusPill, isActive && styles.statusPillActive]}
                  >
                    {isActive ? (
                      <CheckCircle2 size={13} color="#FFFFFF" />
                    ) : (
                      <Clock size={13} color={colors.light.textMuted} />
                    )}
                    <Text style={[styles.statusPillText, isActive && styles.statusPillTextActive]}>
                      {STATUS_LABELS[status]}
                    </Text>
                  </Pressable>
                );
              }
            )}
          </ScrollView>
        </View>

        {/* Ficha Técnica */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Ficha Técnica</Text>
          <View style={styles.infoGrid}>
            <View style={styles.infoCol}>
              <Text style={styles.infoLabel}>Páginas</Text>
              <Text style={styles.infoValue}>{book.pageCount > 0 ? `${book.pageCount} págs` : 'No especificado'}</Text>
            </View>
            <View style={styles.infoCol}>
              <Text style={styles.infoLabel}>Idioma</Text>
              <Text style={styles.infoValue}>{book.language.toUpperCase()}</Text>
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
  iconButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: colors.light.surfaceAlt,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 48,
    gap: 20,
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
  card: {
    backgroundColor: colors.light.surface,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.light.border,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.light.text,
    marginBottom: 12,
  },
  statusRow: {
    gap: 8,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: colors.light.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.light.border,
  },
  statusPillActive: {
    backgroundColor: colors.light.primary,
    borderColor: colors.light.primary,
  },
  statusPillText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.light.textMuted,
  },
  statusPillTextActive: {
    color: '#FFFFFF',
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
    marginTop: 8,
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
});
