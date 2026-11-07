import React, { useState, useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Platform,
} from 'react-native';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import {
  X,
  Sparkles,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  RotateCw,
  BookOpen,
  MapPin,
  Tablet,
  AlertCircle,
  Compass,
} from 'lucide-react-native';
import { colors } from '@/core/theme/colors';
import { SafeButton } from '@/shared/components/SafeButton';
import { Book } from '@/db/schema/books';
import { Shelf } from '@/db/schema/shelves';

export interface BlockedSequelItem {
  book: Book;
  reason: string;
  missingOrUnreadIndex: number;
}

export interface TbrRouletteModalProps {
  visible: boolean;
  eligibleBooks: Book[];
  blockedSequels: BlockedSequelItem[];
  shelves: Shelf[];
  modalityFilter: 'ALL' | 'PHYSICAL' | 'DIGITAL';
  lengthFilter: 'ANY' | 'SHORT' | 'LONG';
  onChangeModality: (m: 'ALL' | 'PHYSICAL' | 'DIGITAL') => void;
  onChangeLength: (l: 'ANY' | 'SHORT' | 'LONG') => void;
  onClose: () => void;
  onStartReadingWinner: (book: Book) => Promise<void>;
}

function parseAuthors(authorsJson?: string | null): string {
  if (!authorsJson) return 'Autor desconocido';
  try {
    const list = JSON.parse(authorsJson);
    if (Array.isArray(list) && list.length > 0) {
      return list.join(', ');
    }
  } catch {
    // Retornar fallback
  }
  return 'Autor desconocido';
}

export function TbrRouletteModal({
  visible,
  eligibleBooks,
  blockedSequels,
  shelves,
  modalityFilter,
  lengthFilter,
  onChangeModality,
  onChangeLength,
  onClose,
  onStartReadingWinner,
}: TbrRouletteModalProps) {
  const [isSpinning, setIsSpinning] = useState<boolean>(false);
  const [winnerBook, setWinnerBook] = useState<Book | null>(null);
  const [cyclingIndex, setCyclingIndex] = useState<number>(0);
  const [isShieldExpanded, setIsShieldExpanded] = useState<boolean>(false);

  const spinTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Limpiar timer al desmontar o cerrar
  useEffect(() => {
    return () => {
      if (spinTimerRef.current) {
        clearTimeout(spinTimerRef.current);
      }
    };
  }, []);

  // Reiniciar ganador cuando cambia visibilidad
  useEffect(() => {
    if (!visible) {
      if (spinTimerRef.current) {
        clearTimeout(spinTimerRef.current);
      }
      setIsSpinning(false);
      setWinnerBook(null);
    }
  }, [visible]);

  const spinRoulette = async () => {
    if (eligibleBooks.length === 0 || isSpinning) return;

    setIsSpinning(true);
    setWinnerBook(null);

    // Secuencia de deceleración progresiva
    const totalTicks = 22;
    let currentTick = 0;

    const runTick = () => {
      currentTick += 1;
      setCyclingIndex((prev) => (prev + 1) % eligibleBooks.length);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

      if (currentTick >= totalTicks) {
        // Seleccionar ganador al azar
        const randomIndex = Math.floor(Math.random() * eligibleBooks.length);
        const selectedWinner = eligibleBooks[randomIndex];
        setWinnerBook(selectedWinner);
        setIsSpinning(false);
        Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success
        ).catch(() => {});
      } else {
        // Curva de deceleración de la ruleta
        const delay = Math.round(50 + Math.pow(currentTick / totalTicks, 2.5) * 320);
        spinTimerRef.current = setTimeout(runTick, delay);
      }
    };

    runTick();
  };

  const currentCyclingBook = eligibleBooks[cyclingIndex] || null;

  const getLocationDescription = (book: Book): string => {
    if (book.modality === 'PHYSICAL') {
      if (book.shelfId) {
        const found = shelves.find((s) => s.id === book.shelfId);
        if (found) {
          return `${found.furnitureName} · ${found.shelfLevel || 'Sin nivel'}`;
        }
      }
      return 'Libro físico · Sin estantería asignada';
    }
    return `Libro Digital · Formato ${book.format || 'eBook'}`;
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View style={styles.sheetContainer}>
          {/* Cabecera */}
          <View style={styles.header}>
            <View style={styles.headerTitles}>
              <View style={styles.headerBadge}>
                <Compass size={14} color={colors.light.primary} />
                <Text style={styles.headerBadgeText}>¿Qué leo hoy?</Text>
              </View>
              <Text style={styles.titleText}>¿Qué leo hoy?</Text>
            </View>
            <Pressable
              onPress={onClose}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              style={styles.closeButton}
              accessibilityRole="button"
              accessibilityLabel="Cerrar ruleta"
            >
              <X size={20} color={colors.light.textMuted} />
            </Pressable>
          </View>

          <ScrollView
            style={styles.scrollArea}
            contentContainerStyle={styles.scrollContent}
          >
            {/* Escudo de Orden de Sagas */}
            {blockedSequels.length > 0 ? (
              <View style={styles.shieldCard}>
                <Pressable
                  onPress={() => setIsShieldExpanded(!isShieldExpanded)}
                  style={styles.shieldHeaderRow}
                >
                  <View style={styles.shieldIconWrap}>
                    <ShieldCheck size={20} color={colors.light.primary} />
                  </View>
                  <View style={styles.shieldTitleCol}>
                    <Text style={styles.shieldTitle}>
                      Escudo de Orden de Sagas activo
                    </Text>
                    <Text style={styles.shieldSubtitle}>
                      {blockedSequels.length}{' '}
                      {blockedSequels.length === 1
                        ? 'secuela protegida'
                        : 'secuelas protegidas'}{' '}
                      de spoilers
                    </Text>
                  </View>
                  {isShieldExpanded ? (
                    <ChevronUp size={18} color={colors.light.textMuted} />
                  ) : (
                    <ChevronDown size={18} color={colors.light.textMuted} />
                  )}
                </Pressable>

                {isShieldExpanded ? (
                  <View style={styles.shieldExpandedContent}>
                    <Text style={styles.shieldExplanation}>
                      La ruleta omite automáticamente tomos posteriores de sagas
                      cuyos volúmenes iniciales aún no has completado:
                    </Text>
                    {blockedSequels.map((item) => (
                      <View key={item.book.id} style={styles.blockedSequelRow}>
                        <View style={styles.blockedBullet} />
                        <View style={styles.blockedTextWrap}>
                          <Text style={styles.blockedBookTitle}>
                            {item.book.title}{' '}
                            {item.book.seriesIndex
                              ? `(#${item.book.seriesIndex})`
                              : ''}
                          </Text>
                          <Text style={styles.blockedReasonText}>
                            {item.reason}
                          </Text>
                        </View>
                      </View>
                    ))}
                  </View>
                ) : null}
              </View>
            ) : null}

            {/* Filtros de selección */}
            <View style={styles.filtersSection}>
              <View style={styles.filterGroup}>
                <Text style={styles.filterLabel}>Modalidad de lectura:</Text>
                <View style={styles.segmentContainer}>
                  {(
                    [
                      { key: 'ALL', label: 'Todos' },
                      { key: 'PHYSICAL', label: 'Físicos' },
                      { key: 'DIGITAL', label: 'Digitales' },
                    ] as const
                  ).map((opt) => {
                    const isSelected = modalityFilter === opt.key;
                    return (
                      <Pressable
                        key={opt.key}
                        onPress={() => onChangeModality(opt.key)}
                        style={[
                          styles.segmentButton,
                          isSelected && styles.segmentButtonActive,
                        ]}
                      >
                        <Text
                          style={[
                            styles.segmentButtonText,
                            isSelected && styles.segmentButtonTextActive,
                          ]}
                        >
                          {opt.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <View style={styles.filterGroup}>
                <Text style={styles.filterLabel}>Extensión de páginas:</Text>
                <View style={styles.segmentContainer}>
                  {(
                    [
                      { key: 'ANY', label: 'Cualquiera' },
                      { key: 'SHORT', label: '< 300 págs' },
                      { key: 'LONG', label: '300+ págs' },
                    ] as const
                  ).map((opt) => {
                    const isSelected = lengthFilter === opt.key;
                    return (
                      <Pressable
                        key={opt.key}
                        onPress={() => onChangeLength(opt.key)}
                        style={[
                          styles.segmentButton,
                          isSelected && styles.segmentButtonActive,
                        ]}
                      >
                        <Text
                          style={[
                            styles.segmentButtonText,
                            isSelected && styles.segmentButtonTextActive,
                          ]}
                        >
                          {opt.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            </View>

            {/* Contador de candidatos elegibles */}
            <View style={styles.candidateCountRow}>
              <Text style={styles.candidateCountText}>
                {eligibleBooks.length}{' '}
                {eligibleBooks.length === 1
                  ? 'libro candidato disponible'
                  : 'libros candidatos disponibles'}{' '}
                en tu lista Por Leer
              </Text>
            </View>

            {/* Estado vacío si no hay libros elegibles */}
            {eligibleBooks.length === 0 ? (
              <View style={styles.emptyStateCard}>
                <AlertCircle size={28} color={colors.light.warning} />
                <Text style={styles.emptyStateTitle}>
                  Sin libros pendientes disponibles
                </Text>
                <Text style={styles.emptyStateDescription}>
                  No hay libros en tu lista Por Leer que coincidan con los
                  filtros seleccionados o que no estén protegidos por el Escudo
                  de Sagas. Intenta ajustar los filtros de modalidad o páginas.
                </Text>
              </View>
            ) : null}

            {/* Tarjeta de visualización / Animación o Ganador */}
            {eligibleBooks.length > 0 ? (
              <View style={styles.rouletteDisplayArea}>
                {isSpinning && currentCyclingBook ? (
                  <View style={styles.spinningCard}>
                    <RotateCw
                      size={24}
                      color={colors.light.primary}
                      style={styles.spinningIcon}
                    />
                    <Text style={styles.spinningLabel}>
                      Eligiendo próxima lectura...
                    </Text>
                    <Text style={styles.cyclingBookTitle} numberOfLines={1}>
                      {currentCyclingBook.title}
                    </Text>
                    <Text style={styles.cyclingBookAuthor} numberOfLines={1}>
                      {parseAuthors(currentCyclingBook.authorsJson)}
                    </Text>
                  </View>
                ) : winnerBook ? (
                  <View style={styles.winnerCard}>
                    <View style={styles.winnerHeaderBadge}>
                      <Sparkles size={16} color={colors.light.gold} />
                      <Text style={styles.winnerBadgeText}>
                        ¡Tu próxima lectura seleccionada!
                      </Text>
                    </View>

                    <View style={styles.winnerBodyRow}>
                      {winnerBook.coverUri ? (
                        <Image
                          source={{ uri: winnerBook.coverUri }}
                          style={styles.coverImage}
                          contentFit="cover"
                        />
                      ) : (
                        <View style={styles.coverPlaceholder}>
                          <BookOpen
                            size={28}
                            color={colors.light.primaryHover}
                          />
                        </View>
                      )}

                      <View style={styles.winnerDetails}>
                        <Text style={styles.winnerTitle} numberOfLines={2}>
                          {winnerBook.title}
                        </Text>
                        <Text style={styles.winnerAuthor} numberOfLines={1}>
                          {parseAuthors(winnerBook.authorsJson)}
                        </Text>

                        {winnerBook.seriesName ? (
                          <View style={styles.seriesPill}>
                            <Text style={styles.seriesPillText} numberOfLines={1}>
                              {winnerBook.seriesName}{' '}
                              {winnerBook.seriesIndex
                                ? `#${winnerBook.seriesIndex}`
                                : ''}
                            </Text>
                          </View>
                        ) : null}

                        <View style={styles.winnerMetaRow}>
                          <Text style={styles.winnerMetaText}>
                            {winnerBook.pageCount > 0
                              ? `${winnerBook.pageCount} págs`
                              : 'Extensión sin registrar'}
                          </Text>
                        </View>

                        <View style={styles.locationPill}>
                          {winnerBook.modality === 'PHYSICAL' ? (
                            <MapPin size={12} color={colors.light.primary} />
                          ) : (
                            <Tablet size={12} color={colors.light.primary} />
                          )}
                          <Text
                            style={styles.locationPillText}
                            numberOfLines={1}
                          >
                            {getLocationDescription(winnerBook)}
                          </Text>
                        </View>
                      </View>
                    </View>

                    <View style={styles.winnerActionsRow}>
                      <SafeButton
                        title="Empezar a leer ahora"
                        variant="primary"
                        size="md"
                        leftIcon={<BookOpen size={16} color="#FFFFFF" />}
                        onPress={() => onStartReadingWinner(winnerBook)}
                        style={styles.flexButton}
                      />
                      <SafeButton
                        title="Girar de nuevo"
                        variant="outline"
                        size="md"
                        leftIcon={
                          <RotateCw size={15} color={colors.light.primary} />
                        }
                        onPress={spinRoulette}
                      />
                    </View>
                  </View>
                ) : (
                  /* Tarjeta inicial previa al giro */
                  <View style={styles.initialRouletteCard}>
                    <View style={styles.rouletteGraphicCircle}>
                      <Compass size={40} color={colors.light.primary} />
                    </View>
                    <Text style={styles.initialCardTitle}>
                      Deja que la ruleta decida tu próxima historia
                    </Text>
                    <Text style={styles.initialCardSubtitle}>
                      La ruleta respeta tus sagas en orden y los filtros
                      seleccionados.
                    </Text>
                    <SafeButton
                      title="Girar ruleta"
                      variant="primary"
                      size="lg"
                      leftIcon={<Sparkles size={18} color="#FFFFFF" />}
                      onPress={spinRoulette}
                      style={styles.spinButton}
                    />
                  </View>
                )}
              </View>
            ) : null}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(28, 25, 23, 0.55)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: colors.light.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '92%',
    paddingBottom: Platform.OS === 'ios' ? 32 : 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.light.borderSubtle,
  },
  headerTitles: {
    flex: 1,
  },
  headerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 2,
  },
  headerBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.light.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  titleText: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.light.text,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.light.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollArea: {
    paddingHorizontal: 16,
  },
  scrollContent: {
    paddingVertical: 14,
    gap: 14,
  },
  shieldCard: {
    backgroundColor: colors.light.badgeBg,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.light.border,
  },
  shieldHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  shieldIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.light.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shieldTitleCol: {
    flex: 1,
  },
  shieldTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.light.primary,
  },
  shieldSubtitle: {
    fontSize: 11,
    color: colors.light.badgeText,
  },
  shieldExpandedContent: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.light.borderSubtle,
    gap: 8,
  },
  shieldExplanation: {
    fontSize: 11,
    color: colors.light.textMuted,
    lineHeight: 15,
  },
  blockedSequelRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: colors.light.surface,
    padding: 8,
    borderRadius: 8,
  },
  blockedBullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.light.accent,
    marginTop: 5,
  },
  blockedTextWrap: {
    flex: 1,
  },
  blockedBookTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.light.text,
  },
  blockedReasonText: {
    fontSize: 11,
    color: colors.light.textMuted,
    marginTop: 1,
  },
  filtersSection: {
    backgroundColor: colors.light.surface,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.light.border,
    gap: 12,
  },
  filterGroup: {
    gap: 6,
  },
  filterLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.light.textMuted,
  },
  segmentContainer: {
    flexDirection: 'row',
    backgroundColor: colors.light.surfaceAlt,
    borderRadius: 10,
    padding: 3,
  },
  segmentButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 7,
    borderRadius: 8,
  },
  segmentButtonActive: {
    backgroundColor: colors.light.surface,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  segmentButtonText: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.light.textMuted,
  },
  segmentButtonTextActive: {
    color: colors.light.primary,
    fontWeight: '700',
  },
  candidateCountRow: {
    paddingHorizontal: 4,
  },
  candidateCountText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.light.textMuted,
  },
  emptyStateCard: {
    backgroundColor: colors.light.surface,
    borderRadius: 14,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.light.border,
    alignItems: 'center',
    gap: 8,
  },
  emptyStateTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.light.text,
    textAlign: 'center',
  },
  emptyStateDescription: {
    fontSize: 12,
    color: colors.light.textMuted,
    textAlign: 'center',
    lineHeight: 17,
  },
  rouletteDisplayArea: {
    gap: 12,
  },
  initialRouletteCard: {
    backgroundColor: colors.light.surface,
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: colors.light.border,
    alignItems: 'center',
    gap: 10,
  },
  rouletteGraphicCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.light.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  initialCardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.light.text,
    textAlign: 'center',
  },
  initialCardSubtitle: {
    fontSize: 12,
    color: colors.light.textMuted,
    textAlign: 'center',
    lineHeight: 16,
  },
  spinButton: {
    marginTop: 8,
    width: '100%',
  },
  spinningCard: {
    backgroundColor: colors.light.surface,
    borderRadius: 16,
    padding: 28,
    borderWidth: 2,
    borderColor: colors.light.primary,
    alignItems: 'center',
    gap: 10,
  },
  spinningIcon: {
    marginBottom: 4,
  },
  spinningLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.light.primary,
  },
  cyclingBookTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.light.text,
    textAlign: 'center',
  },
  cyclingBookAuthor: {
    fontSize: 13,
    color: colors.light.textMuted,
  },
  winnerCard: {
    backgroundColor: colors.light.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 2,
    borderColor: colors.light.gold,
    gap: 14,
    shadowColor: colors.light.gold,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 6,
  },
  winnerHeaderBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.light.warningBg,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    alignSelf: 'center',
  },
  winnerBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.light.gold,
  },
  winnerBodyRow: {
    flexDirection: 'row',
    gap: 14,
  },
  coverImage: {
    width: 80,
    height: 120,
    borderRadius: 8,
    backgroundColor: colors.light.surfaceAlt,
  },
  coverPlaceholder: {
    width: 80,
    height: 120,
    borderRadius: 8,
    backgroundColor: colors.light.badgeBg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.light.border,
  },
  winnerDetails: {
    flex: 1,
    gap: 4,
  },
  winnerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.light.text,
    lineHeight: 20,
  },
  winnerAuthor: {
    fontSize: 13,
    color: colors.light.textMuted,
  },
  seriesPill: {
    alignSelf: 'flex-start',
    backgroundColor: colors.light.surfaceAlt,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginTop: 2,
  },
  seriesPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.light.primary,
  },
  winnerMetaRow: {
    marginTop: 2,
  },
  winnerMetaText: {
    fontSize: 12,
    color: colors.light.textMuted,
  },
  locationPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.light.badgeBg,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  locationPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.light.primary,
  },
  winnerActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  flexButton: {
    flex: 1,
  },
});
