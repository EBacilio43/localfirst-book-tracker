import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import {
  X,
  Camera,
  Sparkles,
  ShieldAlert,
  Check,
  BookOpen,
  User,
  FileText,
} from 'lucide-react-native';
import { colors } from '@/core/theme/colors';
import { SafeButton } from '@/shared/components/SafeButton';
import { extractTextFromImage } from '../services/mlKitOcrAdapter';
import { sanitizeOcrText } from '../utils/ocrTextSanitizer';

export type QuoteEntryType = 'QUOTE' | 'CHARACTER' | 'GLOSSARY' | 'NOTE';

export interface QuoteOcrModalProps {
  visible: boolean;
  bookTitle: string;
  defaultPage?: number;
  onClose: () => void;
  onSaveQuote: (data: {
    entryType: QuoteEntryType;
    content: string;
    pageNumber: number | null;
    chapterOrSection: string | null;
    personalNote: string | null;
    highlightColor: string;
    isSpoiler: boolean;
  }) => Promise<void> | void;
}

const ENTRY_TYPES: Array<{
  key: QuoteEntryType;
  label: string;
  icon: typeof BookOpen;
}> = [
  { key: 'QUOTE', label: 'Cita literaria', icon: BookOpen },
  { key: 'CHARACTER', label: 'Personaje', icon: User },
  { key: 'NOTE', label: 'Nota o término', icon: FileText },
];

const HIGHLIGHT_PALETTE = [
  { key: '#F3E8CB', name: 'Crema' },
  { key: '#D8EAD8', name: 'Menta' },
  { key: '#F2D8CE', name: 'Terracota' },
  { key: '#E2DCF2', name: 'Lavanda' },
];

const REALISTIC_OCR_SAMPLE =
  'Aquella disciplina resultaba impres-\ncindible para sobrevivir en el desier-\nto con escasos recursos.';

export const QuoteOcrModal: React.FC<QuoteOcrModalProps> = ({
  visible,
  bookTitle,
  defaultPage,
  onClose,
  onSaveQuote,
}) => {
  const [entryType, setEntryType] = useState<QuoteEntryType>('QUOTE');
  const [content, setContent] = useState('');
  const [pageNumber, setPageNumber] = useState('');
  const [chapterOrSection, setChapterOrSection] = useState('');
  const [personalNote, setPersonalNote] = useState('');
  const [highlightColor, setHighlightColor] = useState(HIGHLIGHT_PALETTE[0].key);
  const [isSpoiler, setIsSpoiler] = useState(false);
  const [hyphensJoinedCount, setHyphensJoinedCount] = useState(0);
  const [isScanning, setIsScanning] = useState(false);

  useEffect(() => {
    if (visible) {
      if (defaultPage !== undefined && defaultPage !== null) {
        setPageNumber(String(defaultPage));
      } else {
        setPageNumber('');
      }
      setContent('');
      setChapterOrSection('');
      setPersonalNote('');
      setIsSpoiler(false);
      setHyphensJoinedCount(0);
      setEntryType('QUOTE');
      setHighlightColor(HIGHLIGHT_PALETTE[0].key);
    }
  }, [visible, defaultPage]);

  const handleScanSamplePage = async () => {
    setIsScanning(true);
    try {
      const result = await extractTextFromImage('mock-page.jpg', {
        mockText: REALISTIC_OCR_SAMPLE,
        forceFallback: true,
      });
      setContent(result.cleanedText);
      setHyphensJoinedCount(result.hyphensJoinedCount);
    } finally {
      setIsScanning(false);
    }
  };

  const handleContentChange = (text: string) => {
    setContent(text);
    const sanitized = sanitizeOcrText(text);
    if (sanitized.hyphensJoinedCount > 0) {
      setHyphensJoinedCount(sanitized.hyphensJoinedCount);
    }
  };

  const handleSave = async () => {
    if (!content.trim()) {
      return;
    }
    const parsedPage = pageNumber.trim() ? parseInt(pageNumber.trim(), 10) : null;
    await onSaveQuote({
      entryType,
      content: content.trim(),
      pageNumber: Number.isNaN(parsedPage) ? null : parsedPage,
      chapterOrSection: chapterOrSection.trim() || null,
      personalNote: personalNote.trim() || null,
      highlightColor,
      isSpoiler,
    });
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.modalOverlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.modalContent} testID="quote-ocr-modal">
          <View style={styles.header}>
            <View style={styles.headerTitleContainer}>
              <Text style={styles.headerTitle}>Nueva cita o apunte</Text>
              <Text style={styles.headerSubtitle} numberOfLines={1}>
                {bookTitle}
              </Text>
            </View>
            <Pressable
              onPress={onClose}
              style={styles.closeButton}
              accessibilityLabel="Cerrar modal"
              accessibilityRole="button"
            >
              <X size={20} color={colors.light.textMuted} />
            </Pressable>
          </View>

          <ScrollView
            style={styles.scrollArea}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            {/* Botón de acción OCR */}
            <View style={styles.ocrActionCard}>
              <View style={styles.ocrInfoCol}>
                <Text style={styles.ocrCardTitle}>Reconocimiento OCR On-Device</Text>
                <Text style={styles.ocrCardSubtitle}>
                  Escanea páginas impresas y une guiones de corte automáticamente.
                </Text>
              </View>
              <SafeButton
                title={isScanning ? 'Escaneando...' : 'Escanear página impresa'}
                variant="outline"
                size="sm"
                leftIcon={<Camera size={16} color={colors.light.primary} />}
                onPress={handleScanSamplePage}
                isLoading={isScanning}
                testID="ocr-scan-button"
              />
            </View>

            {/* Insignia de guiones unidos si corresponde */}
            {hyphensJoinedCount > 0 ? (
              <View style={styles.hyphenBadge} testID="ocr-hyphens-badge">
                <Sparkles size={14} color={colors.light.primary} />
                <Text style={styles.hyphenBadgeText}>
                  {hyphensJoinedCount === 1
                    ? '1 guión de corte unido automáticamente'
                    : `${hyphensJoinedCount} guiones de corte unidos automáticamente`}
                </Text>
              </View>
            ) : null}

            {/* Selector de Clasificación */}
            <Text style={styles.sectionLabel}>Clasificación</Text>
            <View style={styles.typeSelectorRow}>
              {ENTRY_TYPES.map((item) => {
                const isSelected = entryType === item.key;
                const IconComponent = item.icon;
                return (
                  <Pressable
                    key={item.key}
                    onPress={() => setEntryType(item.key)}
                    style={[
                      styles.typeOption,
                      isSelected && styles.typeOptionSelected,
                    ]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                  >
                    <IconComponent
                      size={14}
                      color={isSelected ? colors.light.primary : colors.light.textMuted}
                    />
                    <Text
                      style={[
                        styles.typeOptionText,
                        isSelected && styles.typeOptionTextSelected,
                      ]}
                    >
                      {item.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Input de Contenido */}
            <Text style={styles.sectionLabel}>Texto o fragmento</Text>
            <TextInput
              style={[styles.input, styles.contentInput, { backgroundColor: highlightColor }]}
              value={content}
              onChangeText={handleContentChange}
              placeholder="Escribe o escanea el fragmento del libro..."
              placeholderTextColor={colors.light.textMuted}
              multiline={true}
              numberOfLines={4}
              textAlignVertical="top"
              testID="quote-content-input"
            />

            {/* Metadatos de ubicación: Página y Capítulo */}
            <View style={styles.twoColumnRow}>
              <View style={styles.columnField}>
                <Text style={styles.sectionLabel}>Página</Text>
                <TextInput
                  style={styles.input}
                  value={pageNumber}
                  onChangeText={setPageNumber}
                  placeholder="Ej. 142"
                  placeholderTextColor={colors.light.textMuted}
                  keyboardType="number-pad"
                  testID="quote-page-input"
                />
              </View>
              <View style={styles.columnField}>
                <Text style={styles.sectionLabel}>Capítulo / Sección</Text>
                <TextInput
                  style={styles.input}
                  value={chapterOrSection}
                  onChangeText={setChapterOrSection}
                  placeholder="Ej. Capítulo 3"
                  placeholderTextColor={colors.light.textMuted}
                  testID="quote-chapter-input"
                />
              </View>
            </View>

            {/* Nota Personal */}
            <Text style={styles.sectionLabel}>Nota personal (opcional)</Text>
            <TextInput
              style={[styles.input, styles.noteInput]}
              value={personalNote}
              onChangeText={setPersonalNote}
              placeholder="Reflexión, contexto o apunte privado..."
              placeholderTextColor={colors.light.textMuted}
              multiline={true}
              numberOfLines={2}
              textAlignVertical="top"
              testID="quote-personal-note-input"
            />

            {/* Selector de Color de Marcatextos */}
            <Text style={styles.sectionLabel}>Color de marcatextos</Text>
            <View style={styles.paletteRow}>
              {HIGHLIGHT_PALETTE.map((pal) => {
                const isSelected = highlightColor === pal.key;
                return (
                  <Pressable
                    key={pal.key}
                    onPress={() => setHighlightColor(pal.key)}
                    style={[
                      styles.colorChip,
                      { backgroundColor: pal.key },
                      isSelected && styles.colorChipSelected,
                    ]}
                    accessibilityLabel={`Color ${pal.name}`}
                    accessibilityRole="button"
                  >
                    {isSelected ? (
                      <Check size={14} color={colors.light.text} />
                    ) : null}
                  </Pressable>
                );
              })}
            </View>

            {/* Switch de Protección Anti-Spoilers */}
            <Pressable
              onPress={() => setIsSpoiler(!isSpoiler)}
              style={[styles.spoilerToggle, isSpoiler && styles.spoilerToggleActive]}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: isSpoiler }}
            >
              <View style={styles.spoilerLeft}>
                <ShieldAlert
                  size={18}
                  color={isSpoiler ? colors.light.accent : colors.light.textMuted}
                />
                <View>
                  <Text style={styles.spoilerTitle}>Contiene spoiler</Text>
                  <Text style={styles.spoilerSubtitle}>
                    Oculta el texto tras un velo de advertencia al navegar el libro.
                  </Text>
                </View>
              </View>
              <View
                style={[
                  styles.toggleCheckbox,
                  isSpoiler && styles.toggleCheckboxActive,
                ]}
              >
                {isSpoiler ? <Check size={14} color="#FFFFFF" /> : null}
              </View>
            </Pressable>
          </ScrollView>

          {/* Botón de guardado final con SafeButton */}
          <View style={styles.footer}>
            <SafeButton
              title="Guardar en el libro"
              variant="primary"
              size="lg"
              onPress={handleSave}
              disabled={!content.trim()}
              testID="quote-save-button"
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.light.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
    minHeight: '60%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.light.border,
  },
  headerTitleContainer: {
    flex: 1,
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.light.text,
  },
  headerSubtitle: {
    fontSize: 13,
    color: colors.light.textMuted,
    marginTop: 2,
  },
  closeButton: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: colors.light.surfaceAlt,
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 28,
  },
  ocrActionCard: {
    backgroundColor: colors.light.surfaceAlt,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.light.border,
    padding: 14,
    marginBottom: 14,
    gap: 12,
  },
  ocrInfoCol: {
    gap: 2,
  },
  ocrCardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.light.text,
  },
  ocrCardSubtitle: {
    fontSize: 12,
    color: colors.light.textMuted,
    lineHeight: 16,
  },
  hyphenBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.light.successBg,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    gap: 6,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: colors.light.primaryHover,
  },
  hyphenBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.light.primary,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.light.text,
    marginBottom: 6,
  },
  typeSelectorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  typeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.light.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.light.border,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    gap: 6,
  },
  typeOptionSelected: {
    backgroundColor: '#E7F2EC',
    borderColor: colors.light.primary,
  },
  typeOptionText: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.light.textMuted,
  },
  typeOptionTextSelected: {
    color: colors.light.primary,
    fontWeight: '600',
  },
  input: {
    backgroundColor: colors.light.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.light.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.light.text,
  },
  contentInput: {
    minHeight: 100,
    marginBottom: 16,
    lineHeight: 20,
  },
  twoColumnRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  columnField: {
    flex: 1,
  },
  noteInput: {
    minHeight: 60,
    marginBottom: 16,
  },
  paletteRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 18,
  },
  colorChip: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.light.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorChipSelected: {
    borderColor: colors.light.text,
    borderWidth: 2,
    transform: [{ scale: 1.08 }],
  },
  spoilerToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.light.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.light.border,
    borderRadius: 12,
    padding: 12,
    marginTop: 4,
    marginBottom: 12,
  },
  spoilerToggleActive: {
    borderColor: colors.light.accent,
    backgroundColor: '#FDF6F2',
  },
  spoilerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    marginRight: 10,
  },
  spoilerTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.light.text,
  },
  spoilerSubtitle: {
    fontSize: 11,
    color: colors.light.textMuted,
    marginTop: 2,
  },
  toggleCheckbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.light.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.light.surface,
  },
  toggleCheckboxActive: {
    backgroundColor: colors.light.accent,
    borderColor: colors.light.accent,
  },
  footer: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: colors.light.border,
    backgroundColor: colors.light.surface,
  },
});
