import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Share,
} from 'react-native';
import { X, Share2, Quote, BookOpen } from 'lucide-react-native';
import { colors } from '@/core/theme/colors';
import { SafeButton } from '@/shared/components/SafeButton';
import { BookQuote } from '@/db/schema/bookQuotes';

export type PostcardThemeKey = 'Crema' | 'Noche' | 'Bosque';

interface PostcardTheme {
  key: PostcardThemeKey;
  name: string;
  bgColor: string;
  textColor: string;
  authorColor: string;
  sealColor: string;
  borderColor: string;
  accentBg: string;
}

const POSTCARD_THEMES: Record<PostcardThemeKey, PostcardTheme> = {
  Crema: {
    key: 'Crema',
    name: 'Crema',
    bgColor: '#FAF6EE',
    textColor: '#2C2523',
    authorColor: '#786C65',
    sealColor: '#B85F30',
    borderColor: '#E8DEC8',
    accentBg: '#F3E8CB',
  },
  Noche: {
    key: 'Noche',
    name: 'Noche',
    bgColor: '#1E1F29',
    textColor: '#F3F4F6',
    authorColor: '#9CA3AF',
    sealColor: '#E0A34A',
    borderColor: '#373A4D',
    accentBg: '#282A3A',
  },
  Bosque: {
    key: 'Bosque',
    name: 'Bosque',
    bgColor: '#16281E',
    textColor: '#EAF2EC',
    authorColor: '#8FA896',
    sealColor: '#52A77A',
    borderColor: '#264434',
    accentBg: '#1E382A',
  },
};

export interface QuotePostcardModalProps {
  visible: boolean;
  quote: BookQuote | null;
  bookTitle: string;
  bookAuthor: string;
  bookPublisher?: string | null;
  onClose: () => void;
}

export const QuotePostcardModal: React.FC<QuotePostcardModalProps> = ({
  visible,
  quote,
  bookTitle,
  bookAuthor,
  bookPublisher,
  onClose,
}) => {
  const [selectedThemeKey, setSelectedThemeKey] = useState<PostcardThemeKey>('Crema');
  const currentTheme = POSTCARD_THEMES[selectedThemeKey];

  if (!quote) {
    return null;
  }

  const handleShare = async () => {
    const citationParts = [
      quote.chapterOrSection,
      quote.pageNumber ? `pág. ${quote.pageNumber}` : null,
    ].filter(Boolean).join(', ');

    const citation = citationParts ? ` (${citationParts})` : '';
    const message = `"${quote.content}"\n\n— ${bookAuthor}, ${bookTitle}${citation}\n\nCompartido desde BaciBooks`;

    try {
      await Share.share({
        title: `Cita de ${bookTitle}`,
        message,
      });
    } catch {
      // Manejo seguro ante cancelacion
    }
  };

  const citationDetails = [
    quote.chapterOrSection,
    quote.pageNumber ? `Página ${quote.pageNumber}` : null,
  ].filter(Boolean).join(' · ');

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent} testID="quote-postcard-modal">
          <View style={styles.header}>
            <View style={styles.headerTitleContainer}>
              <Text style={styles.headerTitle}>Postal literaria</Text>
              <Text style={styles.headerSubtitle} numberOfLines={1}>
                Diseño para compartir en redes
              </Text>
            </View>
            <Pressable
              onPress={onClose}
              style={styles.closeButton}
              accessibilityLabel="Cerrar postal"
              accessibilityRole="button"
            >
              <X size={20} color={colors.light.textMuted} />
            </Pressable>
          </View>

          <ScrollView
            style={styles.scrollArea}
            contentContainerStyle={styles.scrollContent}
          >
            {/* Selector de Plantillas */}
            <Text style={styles.sectionLabel}>Plantilla editorial</Text>
            <View style={styles.themeSelectorRow}>
              {(['Crema', 'Noche', 'Bosque'] as PostcardThemeKey[]).map((themeKey) => {
                const isSelected = selectedThemeKey === themeKey;
                const themeData = POSTCARD_THEMES[themeKey];
                return (
                  <Pressable
                    key={themeKey}
                    onPress={() => setSelectedThemeKey(themeKey)}
                    style={[
                      styles.themePill,
                      { backgroundColor: themeData.bgColor, borderColor: themeData.borderColor },
                      isSelected && styles.themePillSelected,
                    ]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                  >
                    <View
                      style={[
                        styles.themeColorDot,
                        { backgroundColor: themeData.sealColor },
                      ]}
                    />
                    <Text
                      style={[
                        styles.themePillText,
                        { color: themeData.textColor },
                        isSelected && styles.themePillTextSelected,
                      ]}
                    >
                      {themeKey}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Lienzo visual de la postal */}
            <View
              style={[
                styles.postcardCanvas,
                {
                  backgroundColor: currentTheme.bgColor,
                  borderColor: currentTheme.borderColor,
                },
              ]}
              testID="postcard-canvas"
            >
              <View style={styles.postcardHeader}>
                <Quote size={24} color={currentTheme.sealColor} />
                {citationDetails ? (
                  <Text
                    style={[
                      styles.postcardCitationBadge,
                      { color: currentTheme.authorColor },
                    ]}
                  >
                    {citationDetails}
                  </Text>
                ) : null}
              </View>

              <Text
                style={[styles.postcardQuoteText, { color: currentTheme.textColor }]}
              >
                &ldquo;{quote.content}&rdquo;
              </Text>

              {quote.personalNote ? (
                <View
                  style={[
                    styles.personalNoteBox,
                    { backgroundColor: currentTheme.accentBg },
                  ]}
                >
                  <Text
                    style={[
                      styles.personalNoteText,
                      { color: currentTheme.textColor },
                    ]}
                  >
                    {quote.personalNote}
                  </Text>
                </View>
              ) : null}

              <View
                style={[
                  styles.postcardDivider,
                  { backgroundColor: currentTheme.borderColor },
                ]}
              />

              <View style={styles.postcardFooter}>
                <View style={styles.bookInfoCol}>
                  <Text
                    style={[
                      styles.postcardBookTitle,
                      { color: currentTheme.textColor },
                    ]}
                    numberOfLines={2}
                  >
                    {bookTitle}
                  </Text>
                  <Text
                    style={[
                      styles.postcardBookAuthor,
                      { color: currentTheme.authorColor },
                    ]}
                  >
                    {bookAuthor}
                    {bookPublisher ? ` · ${bookPublisher}` : ''}
                  </Text>
                </View>

                <View style={styles.sealContainer}>
                  <BookOpen size={12} color={currentTheme.sealColor} />
                  <Text
                    style={[
                      styles.postcardSealText,
                      { color: currentTheme.sealColor },
                    ]}
                  >
                    BACIBOOKS
                  </Text>
                </View>
              </View>
            </View>
          </ScrollView>

          {/* Botón de Compartir */}
          <View style={styles.footer}>
            <SafeButton
              title="Compartir postal literaria"
              variant="primary"
              size="lg"
              leftIcon={<Share2 size={18} color="#FFFFFF" />}
              onPress={handleShare}
              testID="share-postcard-button"
            />
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    padding: 16,
  },
  modalContent: {
    backgroundColor: colors.light.surface,
    borderRadius: 20,
    maxHeight: '90%',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.light.border,
  },
  headerTitleContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.light.text,
  },
  headerSubtitle: {
    fontSize: 12,
    color: colors.light.textMuted,
    marginTop: 2,
  },
  closeButton: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: colors.light.surfaceAlt,
  },
  scrollArea: {
    flexGrow: 0,
  },
  scrollContent: {
    padding: 20,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.light.text,
    marginBottom: 8,
  },
  themeSelectorRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  themePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1.5,
    gap: 8,
  },
  themePillSelected: {
    borderWidth: 2,
    borderColor: colors.light.primary,
  },
  themeColorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  themePillText: {
    fontSize: 13,
    fontWeight: '500',
  },
  themePillTextSelected: {
    fontWeight: '700',
  },
  postcardCanvas: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 24,
    minHeight: 280,
    justifyContent: 'space-between',
  },
  postcardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  postcardCitationBadge: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  postcardQuoteText: {
    fontSize: 17,
    fontStyle: 'italic',
    lineHeight: 26,
    marginBottom: 16,
  },
  personalNoteBox: {
    borderRadius: 8,
    padding: 10,
    marginBottom: 16,
  },
  personalNoteText: {
    fontSize: 12,
    lineHeight: 16,
    fontStyle: 'normal',
  },
  postcardDivider: {
    height: 1,
    width: '100%',
    marginVertical: 14,
  },
  postcardFooter: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  bookInfoCol: {
    flex: 1,
    marginRight: 12,
  },
  postcardBookTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 2,
  },
  postcardBookAuthor: {
    fontSize: 12,
  },
  sealContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: 'rgba(128, 128, 128, 0.25)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  postcardSealText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1,
  },
  footer: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: colors.light.border,
  },
});
