import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
} from 'react-native';
import {
  BookOpen,
  Camera,
  UserPlus,
  EyeOff,
  Star,
  Trash2,
  Share2,
  ShieldCheck,
  Tag,
  User,
  FileText,
} from 'lucide-react-native';
import { colors } from '@/core/theme/colors';
import { SafeButton } from '@/shared/components/SafeButton';
import { BookQuote } from '@/db/schema/bookQuotes';

export type QuotesTabKey = 'CITAS' | 'PERSONAJES' | 'FAVORITAS';

export interface BookQuotesAndGlossarySectionProps {
  quotes: BookQuote[];
  currentBookPage?: number;
  onOpenOcrModal: (defaultType?: 'QUOTE' | 'CHARACTER') => void;
  onOpenPostcard: (quote: BookQuote) => void;
  onToggleFavorite?: (quoteId: string) => void;
  onDeleteQuote?: (quoteId: string) => void;
}

export const BookQuotesAndGlossarySection: React.FC<BookQuotesAndGlossarySectionProps> = ({
  quotes,
  currentBookPage,
  onOpenOcrModal,
  onOpenPostcard,
  onToggleFavorite,
  onDeleteQuote,
}) => {
  const [activeTab, setActiveTab] = useState<QuotesTabKey>('CITAS');
  const [revealedSpoilerIds, setRevealedSpoilerIds] = useState<Set<string>>(new Set());

  const filteredQuotes = useMemo(() => {
    switch (activeTab) {
      case 'CITAS':
        return quotes.filter((q) => q.entryType !== 'CHARACTER');
      case 'PERSONAJES':
        return quotes.filter((q) => q.entryType === 'CHARACTER');
      case 'FAVORITAS':
        return quotes.filter((q) => q.isFavorite);
      default:
        return quotes;
    }
  }, [quotes, activeTab]);

  const toggleRevealSpoiler = (quoteId: string) => {
    setRevealedSpoilerIds((prev) => {
      const next = new Set(prev);
      if (next.has(quoteId)) {
        next.delete(quoteId);
      } else {
        next.add(quoteId);
      }
      return next;
    });
  };

  const getEntryTypeLabel = (type: string) => {
    switch (type) {
      case 'CHARACTER':
        return 'Personaje';
      case 'NOTE':
      case 'GLOSSARY':
        return 'Nota';
      case 'QUOTE':
      default:
        return 'Cita';
    }
  };

  return (
    <View style={styles.container} testID="book-quotes-glossary-section">
      {/* Encabezado y botones de acción principal */}
      <View style={styles.headerRow}>
        <View style={styles.titleCol}>
          <Text style={styles.sectionTitle}>Citas y glosario</Text>
          <Text style={styles.sectionSubtitle}>
            {quotes.length === 1 ? '1 apunte registrado' : `${quotes.length} apuntes registrados`}
          </Text>
        </View>
        <View style={styles.actionButtonsRow}>
          <SafeButton
            title="Escanear cita"
            variant="outline"
            size="sm"
            leftIcon={<Camera size={14} color={colors.light.primary} />}
            onPress={() => onOpenOcrModal('QUOTE')}
            testID="add-quote-ocr-button"
          />
          <SafeButton
            title="Nuevo personaje"
            variant="secondary"
            size="sm"
            leftIcon={<UserPlus size={14} color={colors.light.text} />}
            onPress={() => onOpenOcrModal('CHARACTER')}
            testID="add-character-button"
          />
        </View>
      </View>

      {/* Pestañas de filtro */}
      <View style={styles.tabsRow}>
        <Pressable
          onPress={() => setActiveTab('CITAS')}
          style={[styles.tabButton, activeTab === 'CITAS' && styles.tabButtonActive]}
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === 'CITAS' }}
        >
          <Text
            style={[
              styles.tabButtonText,
              activeTab === 'CITAS' && styles.tabButtonTextActive,
            ]}
          >
            Citas ({quotes.filter((q) => q.entryType !== 'CHARACTER').length})
          </Text>
        </Pressable>

        <Pressable
          onPress={() => setActiveTab('PERSONAJES')}
          style={[styles.tabButton, activeTab === 'PERSONAJES' && styles.tabButtonActive]}
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === 'PERSONAJES' }}
        >
          <Text
            style={[
              styles.tabButtonText,
              activeTab === 'PERSONAJES' && styles.tabButtonTextActive,
            ]}
          >
            Personajes ({quotes.filter((q) => q.entryType === 'CHARACTER').length})
          </Text>
        </Pressable>

        <Pressable
          onPress={() => setActiveTab('FAVORITAS')}
          style={[styles.tabButton, activeTab === 'FAVORITAS' && styles.tabButtonActive]}
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === 'FAVORITAS' }}
        >
          <Text
            style={[
              styles.tabButtonText,
              activeTab === 'FAVORITAS' && styles.tabButtonTextActive,
            ]}
          >
            Favoritas ({quotes.filter((q) => q.isFavorite).length})
          </Text>
        </Pressable>
      </View>

      {/* Banner informativo de la pestaña Personajes */}
      {activeTab === 'PERSONAJES' ? (
        <View style={styles.spoilerFreeBanner}>
          <ShieldCheck size={18} color={colors.light.primary} />
          <View style={styles.bannerTextCol}>
            <Text style={styles.bannerTitle}>Glosario personal libre de spoilers</Text>
            <Text style={styles.bannerSubtitle}>
              Consulta tus notas de personajes y relaciones clave con protección activa contra revelaciones futuras.
            </Text>
          </View>
        </View>
      ) : null}

      {/* Lista de citas y notas */}
      {filteredQuotes.length === 0 ? (
        <View style={styles.emptyState}>
          <BookOpen size={28} color={colors.light.textSubtle} />
          <Text style={styles.emptyTitle}>
            {activeTab === 'PERSONAJES'
              ? 'No hay personajes anotados aún'
              : activeTab === 'FAVORITAS'
              ? 'No tienes citas marcadas como favoritas'
              : 'Aún no has registrado citas para este libro'}
          </Text>
          <Text style={styles.emptySubtitle}>
            Usa el escáner OCR on-device para capturar pasajes sin escribir a mano.
          </Text>
        </View>
      ) : (
        <View style={styles.cardsList}>
          {filteredQuotes.map((item) => {
            const isRevealed = revealedSpoilerIds.has(item.id);
            const isSpoilerBlocked = item.isSpoiler && !isRevealed;

            return (
              <View
                key={item.id}
                style={[
                  styles.quoteCard,
                  { borderLeftColor: item.highlightColor || colors.light.primary },
                ]}
                testID={`quote-card-${item.id}`}
              >
                {/* Meta cabecera de la cita */}
                <View style={styles.cardMetaRow}>
                  <View style={styles.metaBadges}>
                    <View style={styles.entryTypeBadge}>
                      {item.entryType === 'CHARACTER' ? (
                        <User size={12} color={colors.light.primary} />
                      ) : (
                        <Tag size={12} color={colors.light.primary} />
                      )}
                      <Text style={styles.entryTypeBadgeText}>
                        {getEntryTypeLabel(item.entryType)}
                      </Text>
                    </View>

                    {item.pageNumber !== null ? (
                      <Text style={styles.pageBadge}>Pág. {item.pageNumber}</Text>
                    ) : null}

                    {item.chapterOrSection ? (
                      <Text style={styles.chapterBadge} numberOfLines={1}>
                        {item.chapterOrSection}
                      </Text>
                    ) : null}
                  </View>

                  <View style={styles.cardActionsRow}>
                    {onToggleFavorite ? (
                      <Pressable
                        onPress={() => onToggleFavorite(item.id)}
                        style={styles.iconAction}
                        accessibilityLabel={item.isFavorite ? 'Quitar favorita' : 'Marcar favorita'}
                        accessibilityRole="button"
                        testID={`toggle-favorite-${item.id}`}
                      >
                        <Star
                          size={16}
                          color={item.isFavorite ? colors.light.gold : colors.light.textMuted}
                          fill={item.isFavorite ? colors.light.gold : 'transparent'}
                        />
                      </Pressable>
                    ) : null}

                    {onDeleteQuote ? (
                      <Pressable
                        onPress={() => onDeleteQuote(item.id)}
                        style={styles.iconAction}
                        accessibilityLabel="Eliminar apunte"
                        accessibilityRole="button"
                        testID={`delete-quote-${item.id}`}
                      >
                        <Trash2 size={16} color={colors.light.textMuted} />
                      </Pressable>
                    ) : null}
                  </View>
                </View>

                {/* Contenido con protección Anti-Spoilers */}
                {isSpoilerBlocked ? (
                  <Pressable
                    onPress={() => toggleRevealSpoiler(item.id)}
                    style={styles.spoilerWarningBox}
                    testID={`spoiler-warning-${item.id}`}
                    accessibilityRole="button"
                  >
                    <EyeOff size={16} color={colors.light.accent} />
                    <Text style={styles.spoilerWarningText}>
                      Contiene spoiler · Tocar para revelar
                    </Text>
                  </Pressable>
                ) : (
                  <View>
                    <Text style={styles.quoteContentText}>
                      &ldquo;{item.content}&rdquo;
                    </Text>
                    {item.personalNote ? (
                      <View style={styles.noteBox}>
                        <FileText size={12} color={colors.light.textMuted} />
                        <Text style={styles.noteText}>{item.personalNote}</Text>
                      </View>
                    ) : null}
                  </View>
                )}

                {/* Pie de tarjeta: Botón Crear Postal */}
                <View style={styles.cardFooter}>
                  <SafeButton
                    title="Crear postal"
                    variant="ghost"
                    size="sm"
                    leftIcon={<Share2 size={14} color={colors.light.primary} />}
                    onPress={() => onOpenPostcard(item)}
                    testID={`open-postcard-${item.id}`}
                  />
                </View>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.light.surface,
    borderRadius: 16,
    padding: 16,
    marginVertical: 12,
    borderWidth: 1,
    borderColor: colors.light.border,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
    flexWrap: 'wrap',
    gap: 8,
  },
  titleCol: {
    flex: 1,
    minWidth: 140,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.light.text,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: colors.light.textMuted,
    marginTop: 2,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  tabsRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.light.border,
    marginBottom: 14,
  },
  tabButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabButtonActive: {
    borderBottomColor: colors.light.primary,
  },
  tabButtonText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.light.textMuted,
  },
  tabButtonTextActive: {
    color: colors.light.primary,
    fontWeight: '700',
  },
  spoilerFreeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EBF4F0',
    borderRadius: 10,
    padding: 10,
    marginBottom: 14,
    gap: 10,
    borderWidth: 1,
    borderColor: '#D0E3D9',
  },
  bannerTextCol: {
    flex: 1,
  },
  bannerTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.light.primary,
  },
  bannerSubtitle: {
    fontSize: 11,
    color: colors.light.textMuted,
    marginTop: 1,
    lineHeight: 15,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 28,
    gap: 6,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.light.text,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 12,
    color: colors.light.textMuted,
    textAlign: 'center',
    maxWidth: 260,
  },
  cardsList: {
    gap: 12,
  },
  quoteCard: {
    backgroundColor: colors.light.surfaceAlt,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.light.border,
    borderLeftWidth: 4,
    padding: 12,
  },
  cardMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  metaBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    flex: 1,
  },
  entryTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.light.surface,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    gap: 4,
    borderWidth: 1,
    borderColor: colors.light.border,
  },
  entryTypeBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.light.primary,
  },
  pageBadge: {
    fontSize: 11,
    color: colors.light.textMuted,
    backgroundColor: colors.light.surface,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.light.border,
  },
  chapterBadge: {
    fontSize: 11,
    color: colors.light.textMuted,
    fontStyle: 'italic',
    maxWidth: 120,
  },
  cardActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  iconAction: {
    padding: 4,
    borderRadius: 6,
  },
  spoilerWarningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FDF2ED',
    borderWidth: 1,
    borderColor: '#F7D7C8',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 8,
    marginVertical: 4,
  },
  spoilerWarningText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.light.accent,
  },
  quoteContentText: {
    fontSize: 14,
    fontStyle: 'italic',
    color: colors.light.text,
    lineHeight: 20,
    marginVertical: 4,
  },
  noteBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.light.surface,
    borderRadius: 6,
    padding: 6,
    marginTop: 6,
    gap: 6,
  },
  noteText: {
    fontSize: 12,
    color: colors.light.textMuted,
    flex: 1,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 6,
    borderTopWidth: 1,
    borderTopColor: colors.light.border,
    paddingTop: 4,
  },
});
