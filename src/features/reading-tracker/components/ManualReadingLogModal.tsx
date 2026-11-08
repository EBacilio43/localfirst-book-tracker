import React, { useState, useEffect, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { X, BookOpen, Check, Calendar, Plus, Minus, CheckCircle } from 'lucide-react-native';
import { colors } from '@/core/theme/colors';
import { SafeButton } from '@/shared/components/SafeButton';
import { Book } from '@/db/schema/books';

export interface ManualReadingLogModalProps {
  visible: boolean;
  book: Book;
  onClose: () => void;
  onSaveProgress: (params: {
    newPage: number;
    when: 'TODAY' | 'YESTERDAY';
    isFinished: boolean;
  }) => Promise<void>;
}

export function ManualReadingLogModal({
  visible,
  book,
  onClose,
  onSaveProgress,
}: ManualReadingLogModalProps) {
  const [selectedDate, setSelectedDate] = useState<'TODAY' | 'YESTERDAY'>('TODAY');
  const [pageInput, setPageInput] = useState<string>('');
  const [isFinished, setIsFinished] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const currentPage = book.currentPage ?? 0;
  const totalPages = book.pageCount ?? 0;

  useEffect(() => {
    if (visible) {
      setSelectedDate('TODAY');
      setPageInput(String(currentPage));
      setIsFinished(false);
      setIsSubmitting(false);
    }
  }, [visible, currentPage]);

  const parsedNewPage = useMemo(() => {
    const num = parseInt(pageInput, 10);
    return isNaN(num) ? currentPage : Math.max(0, num);
  }, [pageInput, currentPage]);

  const deltaPages = useMemo(() => {
    return Math.max(0, parsedNewPage - currentPage);
  }, [parsedNewPage, currentPage]);

  const progressPercentage = useMemo(() => {
    if (totalPages <= 0) return 0;
    return Math.min(100, Math.round((parsedNewPage / totalPages) * 100));
  }, [parsedNewPage, totalPages]);

  const handleAdjustPage = (delta: number) => {
    const nextVal = Math.max(0, parsedNewPage + delta);
    const cappedVal = totalPages > 0 ? Math.min(totalPages, nextVal) : nextVal;
    setPageInput(String(cappedVal));
    if (totalPages > 0 && cappedVal >= totalPages) {
      setIsFinished(true);
    } else {
      setIsFinished(false);
    }
  };

  const handleInputChange = (text: string) => {
    const clean = text.replace(/[^0-9]/g, '');
    setPageInput(clean);
    const num = parseInt(clean, 10);
    if (!isNaN(num) && totalPages > 0 && num >= totalPages) {
      setIsFinished(true);
    }
  };

  const handleSave = async () => {
    if (parsedNewPage < currentPage) {
      Alert.alert(
        'Confirmar avance',
        'La página ingresada es menor a tu progreso actual. ¿Deseas guardar este valor?',
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Guardar de todos modos',
            onPress: async () => {
              await executeSave();
            },
          },
        ]
      );
      return;
    }
    await executeSave();
  };

  const executeSave = async () => {
    try {
      setIsSubmitting(true);
      await onSaveProgress({
        newPage: parsedNewPage,
        when: selectedDate,
        isFinished: isFinished || (totalPages > 0 && parsedNewPage >= totalPages),
      });
      onClose();
    } catch {
      Alert.alert('Error', 'No se pudo guardar el avance de lectura');
    } finally {
      setIsSubmitting(false);
    }
  };

  const authorName = useMemo(() => {
    if (!book.authorsJson) return 'Autor desconocido';
    try {
      const parsed = JSON.parse(book.authorsJson);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed[0];
    } catch {
      // fallback
    }
    return 'Autor desconocido';
  }, [book.authorsJson]);

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.overlay}
      >
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={styles.sheetContainer}>
          {/* Cabecera */}
          <View style={styles.header}>
            <View style={styles.headerTitleContainer}>
              <Text style={styles.title} numberOfLines={1}>
                Registrar avance
              </Text>
              <Text style={styles.subtitle} numberOfLines={1}>
                {book.title} · {authorName}
              </Text>
            </View>
            <Pressable
              onPress={onClose}
              style={styles.closeButton}
              accessibilityRole="button"
              accessibilityLabel="Cerrar ventana"
            >
              <X size={20} color={colors.light.textMuted} />
            </Pressable>
          </View>

          {/* Selector de Fecha: Hoy vs Ayer */}
          <View style={styles.dateSelectorContainer}>
            <Text style={styles.sectionLabel}>¿Cuándo leíste?</Text>
            <View style={styles.dateToggleRow}>
              <Pressable
                onPress={() => setSelectedDate('TODAY')}
                style={[
                  styles.dateOption,
                  selectedDate === 'TODAY' && styles.dateOptionActive,
                ]}
              >
                <Calendar
                  size={16}
                  color={
                    selectedDate === 'TODAY'
                      ? colors.light.surface
                      : colors.light.textMuted
                  }
                />
                <Text
                  style={[
                    styles.dateOptionText,
                    selectedDate === 'TODAY' && styles.dateOptionTextActive,
                  ]}
                >
                  Hoy
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setSelectedDate('YESTERDAY')}
                style={[
                  styles.dateOption,
                  selectedDate === 'YESTERDAY' && styles.dateOptionActive,
                ]}
              >
                <Calendar
                  size={16}
                  color={
                    selectedDate === 'YESTERDAY'
                      ? colors.light.surface
                      : colors.light.textMuted
                  }
                />
                <Text
                  style={[
                    styles.dateOptionText,
                    selectedDate === 'YESTERDAY' && styles.dateOptionTextActive,
                  ]}
                >
                  Ayer
                </Text>
              </Pressable>
            </View>
          </View>

          {/* Estado actual de la lectura */}
          <View style={styles.progressInfoCard}>
            <View style={styles.progressRow}>
              <BookOpen size={18} color={colors.light.primary} />
              <Text style={styles.currentPositionText}>
                Progreso actual: página {currentPage}
                {totalPages > 0 ? ` de ${totalPages}` : ''}
              </Text>
            </View>
            {totalPages > 0 && (
              <View style={styles.progressBarBackground}>
                <View
                  style={[
                    styles.progressBarFill,
                    { width: `${progressPercentage}%` },
                  ]}
                />
              </View>
            )}
          </View>

          {/* Ajuste de Nueva Pagina */}
          <View style={styles.stepperContainer}>
            <Text style={styles.sectionLabel}>Nueva página alcanzada</Text>
            <View style={styles.stepperRow}>
              <Pressable
                onPress={() => handleAdjustPage(-5)}
                style={styles.stepperButton}
                accessibilityRole="button"
                accessibilityLabel="Restar 5 páginas"
              >
                <Text style={styles.stepperButtonText}>-5</Text>
              </Pressable>
              <Pressable
                onPress={() => handleAdjustPage(-1)}
                style={styles.stepperButton}
                accessibilityRole="button"
                accessibilityLabel="Restar 1 página"
              >
                <Text style={styles.stepperButtonText}>-1</Text>
              </Pressable>

              <View style={styles.inputWrapper}>
                <TextInput
                  style={styles.pageInput}
                  value={pageInput}
                  onChangeText={handleInputChange}
                  keyboardType="numeric"
                  maxLength={5}
                  selectTextOnFocus
                />
                {totalPages > 0 && (
                  <Text style={styles.inputTotalLabel}>/ {totalPages}</Text>
                )}
              </View>

              <Pressable
                onPress={() => handleAdjustPage(1)}
                style={styles.stepperButton}
                accessibilityRole="button"
                accessibilityLabel="Sumar 1 página"
              >
                <Text style={styles.stepperButtonText}>+1</Text>
              </Pressable>
              <Pressable
                onPress={() => handleAdjustPage(5)}
                style={styles.stepperButton}
                accessibilityRole="button"
                accessibilityLabel="Sumar 5 páginas"
              >
                <Text style={styles.stepperButtonText}>+5</Text>
              </Pressable>
            </View>

            {/* Resumen de paginas leidas */}
            <View style={styles.deltaBadgeContainer}>
              <Text style={styles.deltaBadgeText}>
                {deltaPages > 0
                  ? `+${deltaPages} páginas avanzadas (${progressPercentage}%)`
                  : 'Sin páginas adicionales'}
              </Text>
            </View>
          </View>

          {/* Checkbox: Libro Terminado */}
          <Pressable
            onPress={() => setIsFinished((prev) => !prev)}
            style={styles.finishCheckboxRow}
          >
            <View
              style={[
                styles.checkboxBox,
                isFinished && styles.checkboxBoxActive,
              ]}
            >
              {isFinished && <Check size={14} color="#ffffff" strokeWidth={3} />}
            </View>
            <Text style={styles.finishCheckboxLabel}>
              Marcar libro como terminado
            </Text>
          </Pressable>

          {/* Accion Guardar */}
          <View style={styles.footer}>
            <SafeButton
              onPress={handleSave}
              isLoading={isSubmitting}
              style={styles.saveButton}
            >
              <CheckCircle size={18} color="#ffffff" />
              <Text style={styles.saveButtonText}>Guardar avance</Text>
            </SafeButton>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  sheetContainer: {
    backgroundColor: colors.light.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerTitleContainer: {
    flex: 1,
    marginRight: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.light.text,
  },
  subtitle: {
    fontSize: 13,
    color: colors.light.textMuted,
    marginTop: 2,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.light.surfaceAlt,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.light.textMuted,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  dateSelectorContainer: {
    marginBottom: 16,
  },
  dateToggleRow: {
    flexDirection: 'row',
    backgroundColor: colors.light.surfaceAlt,
    borderRadius: 12,
    padding: 4,
  },
  dateOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  dateOptionActive: {
    backgroundColor: colors.light.primary,
  },
  dateOptionText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.light.textMuted,
  },
  dateOptionTextActive: {
    color: colors.light.surface,
  },
  progressInfoCard: {
    backgroundColor: colors.light.surfaceAlt,
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  currentPositionText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.light.text,
  },
  progressBarBackground: {
    height: 6,
    backgroundColor: colors.light.border,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: colors.light.primary,
    borderRadius: 3,
  },
  stepperContainer: {
    marginBottom: 16,
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  stepperButton: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: colors.light.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.light.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepperButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.light.text,
  },
  inputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.light.surfaceAlt,
    borderWidth: 1.5,
    borderColor: colors.light.primary,
    borderRadius: 12,
    height: 48,
    paddingHorizontal: 12,
  },
  pageInput: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.light.text,
    textAlign: 'center',
    minWidth: 50,
  },
  inputTotalLabel: {
    fontSize: 13,
    color: colors.light.textMuted,
    marginLeft: 4,
  },
  deltaBadgeContainer: {
    alignItems: 'center',
    marginTop: 8,
  },
  deltaBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.light.primary,
  },
  finishCheckboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 20,
    paddingVertical: 4,
  },
  checkboxBox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.light.border,
    backgroundColor: colors.light.surfaceAlt,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxBoxActive: {
    backgroundColor: colors.light.primary,
    borderColor: colors.light.primary,
  },
  finishCheckboxLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.light.text,
  },
  footer: {
    marginTop: 4,
  },
  saveButton: {
    backgroundColor: colors.light.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    gap: 8,
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
});
