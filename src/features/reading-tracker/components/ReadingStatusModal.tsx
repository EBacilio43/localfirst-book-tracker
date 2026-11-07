import React, { useState, useEffect, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ScrollView,
  Switch,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import {
  X,
  BookOpen,
  BookmarkCheck,
  Calendar,
  AlertCircle,
  Eye,
  EyeOff,
  Check,
  RotateCcw,
  BookMarked,
  PauseCircle,
  XCircle,
  Award,
} from 'lucide-react-native';
import { colors } from '@/core/theme/colors';
import { SafeButton } from '@/shared/components/SafeButton';
import { Book } from '@/db/schema/books';
import { ReadingLog } from '@/db/schema/readingLogs';
import { HalfStarRating } from './HalfStarRating';

export type ReadingStatusTab = 'POR_LEER' | 'LEYENDO' | 'EN_ESPERA' | 'LEIDO' | 'ABANDONADO';

export interface ReadingStatusModalProps {
  visible: boolean;
  book: Book;
  readingLogs: ReadingLog[];
  progressDisplayMode: 'PAGES' | 'CHAPTERS';
  onChangeDisplayMode: (mode: 'PAGES' | 'CHAPTERS') => void;
  onClose: () => void;
  onSaveProgress: (params: {
    currentUnit: number;
    totalUnits: number;
    mode: 'PAGES' | 'CHAPTERS';
    when: 'TODAY' | 'YESTERDAY';
  }) => Promise<void>;
  onStartReading: () => Promise<void>;
  onPauseOrAbandon: (params: {
    status: 'EN_ESPERA' | 'ABANDONADO';
    note: string;
    isSpoiler: boolean;
    stoppedAtUnit: number;
  }) => Promise<void>;
  onFinishReading: (params: {
    rating: number | null;
    review: string;
  }) => Promise<void>;
}

const QUICK_DNF_REASONS = [
  'Ritmo lento',
  'Trama predecible',
  'Personajes planos',
  'No conecte con la prosa',
  'Bloqueo lector',
  'Otro motivo',
] as const;

function parseAuthors(authorsJson?: string | null): string {
  if (!authorsJson) return 'Autor desconocido';
  try {
    const list = JSON.parse(authorsJson);
    if (Array.isArray(list) && list.length > 0) {
      return list.join(', ');
    }
  } catch {
    // Ignorar fallo de parseo JSON y retornar fallback
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

export function ReadingStatusModal({
  visible,
  book,
  readingLogs,
  progressDisplayMode,
  onChangeDisplayMode,
  onClose,
  onSaveProgress,
  onStartReading,
  onPauseOrAbandon,
  onFinishReading,
}: ReadingStatusModalProps) {
  const initialTab: ReadingStatusTab = useMemo(() => {
    if (
      book.currentStatus === 'POR_LEER' ||
      book.currentStatus === 'LEYENDO' ||
      book.currentStatus === 'EN_ESPERA' ||
      book.currentStatus === 'LEIDO' ||
      book.currentStatus === 'ABANDONADO'
    ) {
      return book.currentStatus;
    }
    return 'POR_LEER';
  }, [book.currentStatus]);

  const [activeTab, setActiveTab] = useState<ReadingStatusTab>(initialTab);

  // Estados de avance (LEYENDO)
  const [currentUnitInput, setCurrentUnitInput] = useState<string>(
    String(book.currentPage || 0)
  );
  const [totalChaptersInput, setTotalChaptersInput] = useState<string>('30');
  const [whenReading, setWhenReading] = useState<'TODAY' | 'YESTERDAY'>('TODAY');

  // Estados de pausa o abandono (EN_ESPERA / ABANDONADO)
  const [pauseOrDnfNote, setPauseOrDnfNote] = useState<string>(
    book.pauseOrDnfNote || ''
  );
  const [isSpoiler, setIsSpoiler] = useState<boolean>(Boolean(book.isSpoiler));
  const [stoppedAtUnitInput, setStoppedAtUnitInput] = useState<string>(
    String(book.currentPage || 0)
  );

  // Estados de finalización (LEIDO)
  const [finishRating, setFinishRating] = useState<number | null>(book.rating ?? null);
  const [finishReview, setFinishReview] = useState<string>('');

  // Sincronizar estado cuando se abre el modal con un nuevo libro
  useEffect(() => {
    if (visible) {
      setActiveTab(initialTab);
      setCurrentUnitInput(String(book.currentPage || 0));
      setStoppedAtUnitInput(String(book.currentPage || 0));
      setPauseOrDnfNote(book.pauseOrDnfNote || '');
      setIsSpoiler(Boolean(book.isSpoiler));
      setFinishRating(book.rating ?? null);
      setWhenReading('TODAY');

      // Buscar reseña previa del log más reciente
      const latestFinishedLog = readingLogs
        .filter((l) => l.finishedAt !== null)
        .sort((a, b) => (b.finishedAt || 0) - (a.finishedAt || 0))[0];
      if (latestFinishedLog?.review) {
        setFinishReview(latestFinishedLog.review);
      } else {
        setFinishReview('');
      }
    }
  }, [visible, book, initialTab, readingLogs]);

  const isRereadInProgress = useMemo(() => {
    return (
      readingLogs.some((l) => l.finishedAt !== null) || readingLogs.length > 1
    );
  }, [readingLogs]);

  // Cálculos reactivos de progreso y porcentaje automático
  const parsedCurrentUnit = Math.max(0, parseInt(currentUnitInput, 10) || 0);
  const parsedTotalUnits =
    progressDisplayMode === 'PAGES'
      ? Math.max(1, book.pageCount || 1)
      : Math.max(1, parseInt(totalChaptersInput, 10) || 1);

  const calculatedPercentage = Math.min(
    100,
    Math.max(0, (parsedCurrentUnit / parsedTotalUnits) * 100)
  );
  const remainingUnits = Math.max(0, parsedTotalUnits - parsedCurrentUnit);

  const handleQuickDnfReason = (reason: string) => {
    if (pauseOrDnfNote.trim().length === 0) {
      setPauseOrDnfNote(reason);
    } else if (!pauseOrDnfNote.includes(reason)) {
      setPauseOrDnfNote(`${pauseOrDnfNote.trim()} · ${reason}`);
    }
  };

  const authorName = parseAuthors(book.authorsJson);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.modalBackdrop}
      >
        <View style={styles.modalContainer}>
          {/* Cabecera del Modal */}
          <View style={styles.header}>
            <View style={styles.headerTextContainer}>
              <Text style={styles.bookTitle} numberOfLines={1}>
                {book.title}
              </Text>
              <Text style={styles.bookAuthor} numberOfLines={1}>
                {authorName}
              </Text>
            </View>
            <Pressable
              onPress={onClose}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              style={styles.closeButton}
              accessibilityRole="button"
              accessibilityLabel="Cerrar modal"
            >
              <X size={20} color={colors.light.textMuted} />
            </Pressable>
          </View>

          {/* Banner de protección de relectura */}
          {isRereadInProgress ? (
            <View style={styles.rereadBanner}>
              <BookmarkCheck size={18} color={colors.light.primary} />
              <Text style={styles.rereadBannerText}>
                Relectura en curso · Tu lectura previa sigue contando en Libros Leídos
              </Text>
            </View>
          ) : null}

          {/* Selector de pestañas de estado */}
          <View style={styles.tabsRow}>
            {(
              [
                { key: 'POR_LEER', label: 'Por leer', icon: BookMarked },
                { key: 'LEYENDO', label: 'Leyendo', icon: BookOpen },
                { key: 'EN_ESPERA', label: 'En espera', icon: PauseCircle },
                { key: 'LEIDO', label: 'Leído', icon: Award },
                { key: 'ABANDONADO', label: 'Abandonado', icon: XCircle },
              ] as const
            ).map((tab) => {
              const isActive = activeTab === tab.key;
              const TabIcon = tab.icon;
              return (
                <Pressable
                  key={tab.key}
                  onPress={() => setActiveTab(tab.key)}
                  style={[styles.tabButton, isActive && styles.tabButtonActive]}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: isActive }}
                >
                  <TabIcon
                    size={14}
                    color={isActive ? colors.light.primary : colors.light.textMuted}
                  />
                  <Text
                    style={[
                      styles.tabButtonText,
                      isActive && styles.tabButtonTextActive,
                    ]}
                  >
                    {tab.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Contenido scrolleable por pestaña */}
          <ScrollView
            style={styles.scrollContent}
            contentContainerStyle={styles.scrollContentInner}
            keyboardShouldPersistTaps="handled"
          >
            {/* PESTAÑA: POR LEER */}
            {activeTab === 'POR_LEER' ? (
              <View style={styles.sectionContainer}>
                <View style={styles.infoBox}>
                  <Text style={styles.infoBoxTitle}>Libro en lista de pendientes</Text>
                  <Text style={styles.infoBoxText}>
                    Este libro está en tu lista de espera. Puedes dar inicio a tu
                    primera sesión de lectura cuando estés listo.
                  </Text>
                  <View style={styles.metaRow}>
                    <Text style={styles.metaLabel}>Extensión:</Text>
                    <Text style={styles.metaValue}>
                      {book.pageCount > 0
                        ? `${book.pageCount} páginas`
                        : 'Páginas sin registrar'}
                    </Text>
                  </View>
                  <View style={styles.metaRow}>
                    <Text style={styles.metaLabel}>Modalidad:</Text>
                    <Text style={styles.metaValue}>
                      {book.modality === 'PHYSICAL'
                        ? 'Libro Físico'
                        : 'Libro Digital'}
                    </Text>
                  </View>
                </View>

                <SafeButton
                  title="Empezar a leer ahora"
                  variant="primary"
                  size="lg"
                  leftIcon={<BookOpen size={18} color="#FFFFFF" />}
                  onPress={onStartReading}
                  style={styles.actionButtonMargin}
                />
              </View>
            ) : null}

            {/* PESTAÑA: LEYENDO */}
            {activeTab === 'LEYENDO' ? (
              <View style={styles.sectionContainer}>
                {/* Selector de preferencia: Por Páginas vs Por Capítulos */}
                <View style={styles.preferenceRow}>
                  <Text style={styles.fieldLabel}>Modo de avance:</Text>
                  <View style={styles.toggleSegmentContainer}>
                    <Pressable
                      onPress={() => onChangeDisplayMode('PAGES')}
                      style={[
                        styles.toggleSegment,
                        progressDisplayMode === 'PAGES' &&
                          styles.toggleSegmentActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.toggleSegmentText,
                          progressDisplayMode === 'PAGES' &&
                            styles.toggleSegmentTextActive,
                        ]}
                      >
                        Por Páginas
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => onChangeDisplayMode('CHAPTERS')}
                      style={[
                        styles.toggleSegment,
                        progressDisplayMode === 'CHAPTERS' &&
                          styles.toggleSegmentActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.toggleSegmentText,
                          progressDisplayMode === 'CHAPTERS' &&
                            styles.toggleSegmentTextActive,
                        ]}
                      >
                        Por Capítulos
                      </Text>
                    </Pressable>
                  </View>
                </View>

                {/* Campo numérico directo para avance */}
                <View style={styles.numericInputCard}>
                  <Text style={styles.inputTitle}>
                    {progressDisplayMode === 'PAGES'
                      ? 'Página en la que te quedaste'
                      : 'Capítulo en el que te quedaste'}
                  </Text>
                  <View style={styles.directInputRow}>
                    <TextInput
                      style={styles.directNumberInput}
                      keyboardType="number-pad"
                      value={currentUnitInput}
                      onChangeText={setCurrentUnitInput}
                      selectTextOnFocus
                      placeholder="0"
                      placeholderTextColor={colors.light.textSubtle}
                    />
                    <Text style={styles.unitSlashText}>/</Text>
                    {progressDisplayMode === 'PAGES' ? (
                      <View style={styles.totalUnitsDisplay}>
                        <Text style={styles.totalUnitsDisplayText}>
                          {book.pageCount > 0 ? `${book.pageCount} págs` : 'págs'}
                        </Text>
                      </View>
                    ) : (
                      <View style={styles.chapterTotalRow}>
                        <TextInput
                          style={styles.directTotalNumberInput}
                          keyboardType="number-pad"
                          value={totalChaptersInput}
                          onChangeText={setTotalChaptersInput}
                          placeholder="30"
                          placeholderTextColor={colors.light.textSubtle}
                        />
                        <Text style={styles.unitSuffixText}>caps</Text>
                      </View>
                    )}
                  </View>

                  {/* Barra de progreso en tiempo real */}
                  <View style={styles.progressBarBackground}>
                    <View
                      style={[
                        styles.progressBarFill,
                        { width: `${calculatedPercentage}%` },
                      ]}
                    />
                  </View>

                  {/* Píldora de porcentaje automático */}
                  <View style={styles.percentagePill}>
                    <Text style={styles.percentagePillText}>
                      {`${calculatedPercentage.toFixed(1)}% automático · Faltan ${remainingUnits} ${
                        progressDisplayMode === 'PAGES' ? 'páginas' : 'capítulos'
                      }`}
                    </Text>
                  </View>
                </View>

                {/* Selector retroactivo: ¿Cuándo leíste este avance? */}
                <View style={styles.retroactiveContainer}>
                  <View style={styles.retroactiveHeaderRow}>
                    <Calendar size={16} color={colors.light.textMuted} />
                    <Text style={styles.retroactiveLabel}>
                      ¿Cuándo leíste este avance?
                    </Text>
                  </View>
                  <View style={styles.retroactiveButtonsRow}>
                    <Pressable
                      onPress={() => setWhenReading('TODAY')}
                      style={[
                        styles.whenButton,
                        whenReading === 'TODAY' && styles.whenButtonActive,
                      ]}
                    >
                      {whenReading === 'TODAY' ? (
                        <Check size={14} color={colors.light.primary} />
                      ) : null}
                      <Text
                        style={[
                          styles.whenButtonText,
                          whenReading === 'TODAY' && styles.whenButtonTextActive,
                        ]}
                      >
                        Hoy
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => setWhenReading('YESTERDAY')}
                      style={[
                        styles.whenButton,
                        whenReading === 'YESTERDAY' && styles.whenButtonActive,
                      ]}
                    >
                      {whenReading === 'YESTERDAY' ? (
                        <Check size={14} color={colors.light.primary} />
                      ) : null}
                      <Text
                        style={[
                          styles.whenButtonText,
                          whenReading === 'YESTERDAY' &&
                            styles.whenButtonTextActive,
                        ]}
                      >
                        Ayer (Retroactivo)
                      </Text>
                    </Pressable>
                  </View>
                </View>

                <SafeButton
                  title="Guardar avance"
                  variant="primary"
                  size="lg"
                  onPress={() =>
                    onSaveProgress({
                      currentUnit: parsedCurrentUnit,
                      totalUnits: parsedTotalUnits,
                      mode: progressDisplayMode,
                      when: whenReading,
                    })
                  }
                  style={styles.actionButtonMargin}
                />
              </View>
            ) : null}

            {/* PESTAÑA: EN ESPERA */}
            {activeTab === 'EN_ESPERA' ? (
              <View style={styles.sectionContainer}>
                <View style={styles.infoBox}>
                  <Text style={styles.infoBoxTitle}>Pausa de lectura</Text>
                  <Text style={styles.infoBoxText}>
                    Pausa este libro temporalmente sin perder tus páginas leídas.
                    Registra una nota anti-olvido para retomarlo fácilmente.
                  </Text>
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.fieldLabel}>
                    Página o capítulo en que te detuviste:
                  </Text>
                  <TextInput
                    style={styles.singleLineInput}
                    keyboardType="number-pad"
                    value={stoppedAtUnitInput}
                    onChangeText={setStoppedAtUnitInput}
                    placeholder="Número de página o capítulo"
                    placeholderTextColor={colors.light.textSubtle}
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.fieldLabel}>
                    Nota anti-olvido (¿Dónde te quedaste o por qué pausas?):
                  </Text>
                  <TextInput
                    style={styles.multilineInput}
                    multiline
                    numberOfLines={3}
                    textAlignVertical="top"
                    value={pauseOrDnfNote}
                    onChangeText={setPauseOrDnfNote}
                    placeholder="Ej. Me quedé al inicio de la batalla en el puente. Pausado por lecturas pendientes de la universidad..."
                    placeholderTextColor={colors.light.textSubtle}
                  />
                </View>

                {/* Switch de Spoilers */}
                <View style={styles.spoilerRow}>
                  <View style={styles.spoilerTextCol}>
                    <View style={styles.spoilerTitleRow}>
                      {isSpoiler ? (
                        <EyeOff size={16} color={colors.light.accent} />
                      ) : (
                        <Eye size={16} color={colors.light.textMuted} />
                      )}
                      <Text style={styles.spoilerTitle}>Contiene spoilers</Text>
                    </View>
                    <Text style={styles.spoilerSubtitle}>
                      Ocultar con desenfoque en la vista general del libro
                    </Text>
                  </View>
                  <Switch
                    value={isSpoiler}
                    onValueChange={setIsSpoiler}
                    trackColor={{
                      false: colors.light.border,
                      true: colors.light.accent,
                    }}
                    thumbColor={isSpoiler ? '#FFFFFF' : '#FFFFFF'}
                  />
                </View>

                <SafeButton
                  title="Confirmar pausa"
                  variant="accent"
                  size="lg"
                  onPress={() =>
                    onPauseOrAbandon({
                      status: 'EN_ESPERA',
                      note: pauseOrDnfNote,
                      isSpoiler,
                      stoppedAtUnit:
                        parseInt(stoppedAtUnitInput, 10) || book.currentPage,
                    })
                  }
                  style={styles.actionButtonMargin}
                />
              </View>
            ) : null}

            {/* PESTAÑA: ABANDONADO */}
            {activeTab === 'ABANDONADO' ? (
              <View style={styles.sectionContainer}>
                <View style={[styles.infoBox, styles.infoBoxDanger]}>
                  <Text style={[styles.infoBoxTitle, styles.infoBoxTitleDanger]}>
                    Abandono de lectura (DNF)
                  </Text>
                  <Text style={styles.infoBoxText}>
                    No todos los libros son para nosotros en este momento. Al marcar
                    como abandonado, tu historial de páginas leídas se conserva en tus
                    estadísticas generales.
                  </Text>
                </View>

                {/* Chips de motivo rápido */}
                <View style={styles.formGroup}>
                  <Text style={styles.fieldLabel}>Motivo rápido de abandono:</Text>
                  <View style={styles.chipsContainer}>
                    {QUICK_DNF_REASONS.map((reason) => {
                      const isSelected = pauseOrDnfNote.includes(reason);
                      return (
                        <Pressable
                          key={reason}
                          onPress={() => handleQuickDnfReason(reason)}
                          style={[
                            styles.chipButton,
                            isSelected && styles.chipButtonSelected,
                          ]}
                        >
                          <Text
                            style={[
                              styles.chipButtonText,
                              isSelected && styles.chipButtonTextSelected,
                            ]}
                          >
                            {reason}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.fieldLabel}>
                    Página o capítulo en que lo dejaste:
                  </Text>
                  <TextInput
                    style={styles.singleLineInput}
                    keyboardType="number-pad"
                    value={stoppedAtUnitInput}
                    onChangeText={setStoppedAtUnitInput}
                    placeholder="Número de página o capítulo"
                    placeholderTextColor={colors.light.textSubtle}
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.fieldLabel}>
                    Comentario o motivo detallado:
                  </Text>
                  <TextInput
                    style={styles.multilineInput}
                    multiline
                    numberOfLines={3}
                    textAlignVertical="top"
                    value={pauseOrDnfNote}
                    onChangeText={setPauseOrDnfNote}
                    placeholder="Describe los motivos por los que decidiste no continuar este libro..."
                    placeholderTextColor={colors.light.textSubtle}
                  />
                </View>

                {/* Switch de Spoilers */}
                <View style={styles.spoilerRow}>
                  <View style={styles.spoilerTextCol}>
                    <View style={styles.spoilerTitleRow}>
                      {isSpoiler ? (
                        <EyeOff size={16} color={colors.light.danger} />
                      ) : (
                        <Eye size={16} color={colors.light.textMuted} />
                      )}
                      <Text style={styles.spoilerTitle}>Contiene spoilers</Text>
                    </View>
                    <Text style={styles.spoilerSubtitle}>
                      Ocultar con desenfoque en la vista general del libro
                    </Text>
                  </View>
                  <Switch
                    value={isSpoiler}
                    onValueChange={setIsSpoiler}
                    trackColor={{
                      false: colors.light.border,
                      true: colors.light.danger,
                    }}
                    thumbColor={isSpoiler ? '#FFFFFF' : '#FFFFFF'}
                  />
                </View>

                <SafeButton
                  title="Confirmar abandono (DNF)"
                  variant="danger"
                  size="lg"
                  onPress={() =>
                    onPauseOrAbandon({
                      status: 'ABANDONADO',
                      note: pauseOrDnfNote,
                      isSpoiler,
                      stoppedAtUnit:
                        parseInt(stoppedAtUnitInput, 10) || book.currentPage,
                    })
                  }
                  style={styles.actionButtonMargin}
                />
              </View>
            ) : null}

            {/* PESTAÑA: LEIDO */}
            {activeTab === 'LEIDO' ? (
              <View style={styles.sectionContainer}>
                {/* Calificación reactiva directa */}
                <View style={styles.ratingCard}>
                  <Text style={styles.ratingCardTitle}>Calificación del libro</Text>
                  <Text style={styles.ratingCardSubtitle}>
                    Toca la mitad izquierda o derecha de cada estrella para asignar
                    medias estrellas
                  </Text>
                  <View style={styles.starsWrapper}>
                    <HalfStarRating
                      value={finishRating ?? 0}
                      onChange={(r) => setFinishRating(r)}
                      size={34}
                    />
                  </View>
                </View>

                {/* Reseña opcional */}
                <View style={styles.formGroup}>
                  <Text style={styles.fieldLabel}>
                    Tu reseña o reflexiones finales (opcional):
                  </Text>
                  <TextInput
                    style={styles.multilineInput}
                    multiline
                    numberOfLines={4}
                    textAlignVertical="top"
                    value={finishReview}
                    onChangeText={setFinishReview}
                    placeholder="Escribe tus impresiones sobre la obra, personajes, estilo narrativo o ritmo..."
                    placeholderTextColor={colors.light.textSubtle}
                  />
                </View>

                {/* Botón de confirmación */}
                <SafeButton
                  title={
                    book.currentStatus === 'LEIDO'
                      ? 'Actualizar calificación y reseña'
                      : 'Marcar como libro terminado'
                  }
                  variant="primary"
                  size="lg"
                  onPress={() =>
                    onFinishReading({
                      rating: finishRating,
                      review: finishReview,
                    })
                  }
                  style={styles.actionButtonMargin}
                />

                {/* Si ya estaba leído, permitir iniciar nueva relectura */}
                {book.currentStatus === 'LEIDO' ? (
                  <SafeButton
                    title="Iniciar una nueva relectura"
                    variant="outline"
                    size="md"
                    leftIcon={
                      <RotateCcw size={16} color={colors.light.primary} />
                    }
                    onPress={onStartReading}
                    style={styles.rereadActionMargin}
                  />
                ) : null}

                {/* Historial de lecturas previas */}
                {readingLogs.length > 0 ? (
                  <View style={styles.logsHistoryContainer}>
                    <Text style={styles.logsHistoryTitle}>
                      Historial de lecturas registradas
                    </Text>
                    {readingLogs.map((log) => (
                      <View key={log.id} style={styles.logCard}>
                        <View style={styles.logCardHeader}>
                          <Text style={styles.logNumberText}>
                            Lectura #{log.readNumber}
                          </Text>
                          <Text style={styles.logDateText}>
                            {formatDate(log.finishedAt || log.createdAt)}
                          </Text>
                        </View>
                        {log.rating !== null && log.rating !== undefined ? (
                          <View style={styles.logRatingRow}>
                            <HalfStarRating
                              value={log.rating}
                              readOnly
                              size={16}
                            />
                          </View>
                        ) : null}
                        {log.review ? (
                          <Text style={styles.logReviewText} numberOfLines={3}>
                            {log.review}
                          </Text>
                        ) : null}
                      </View>
                    ))}
                  </View>
                ) : null}
              </View>
            ) : null}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(28, 25, 23, 0.55)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
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
  headerTextContainer: {
    flex: 1,
    marginRight: 12,
  },
  bookTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.light.text,
  },
  bookAuthor: {
    fontSize: 13,
    color: colors.light.textMuted,
    marginTop: 2,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.light.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rereadBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.light.badgeBg,
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.light.border,
  },
  rereadBannerText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: colors.light.primary,
  },
  tabsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.light.borderSubtle,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: colors.light.surface,
    borderWidth: 1,
    borderColor: colors.light.borderSubtle,
  },
  tabButtonActive: {
    backgroundColor: colors.light.badgeBg,
    borderColor: colors.light.primary,
  },
  tabButtonText: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.light.textMuted,
  },
  tabButtonTextActive: {
    color: colors.light.primary,
    fontWeight: '700',
  },
  scrollContent: {
    paddingHorizontal: 16,
  },
  scrollContentInner: {
    paddingVertical: 16,
    gap: 16,
  },
  sectionContainer: {
    gap: 16,
  },
  infoBox: {
    backgroundColor: colors.light.surface,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.light.border,
    gap: 8,
  },
  infoBoxDanger: {
    borderColor: colors.light.dangerBg,
    backgroundColor: colors.light.dangerBg,
  },
  infoBoxTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.light.text,
  },
  infoBoxTitleDanger: {
    color: colors.light.danger,
  },
  infoBoxText: {
    fontSize: 13,
    color: colors.light.textMuted,
    lineHeight: 18,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: colors.light.borderSubtle,
  },
  metaLabel: {
    fontSize: 12,
    color: colors.light.textMuted,
  },
  metaValue: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.light.text,
  },
  preferenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.light.text,
  },
  toggleSegmentContainer: {
    flexDirection: 'row',
    backgroundColor: colors.light.surfaceAlt,
    borderRadius: 10,
    padding: 2,
    borderWidth: 1,
    borderColor: colors.light.border,
  },
  toggleSegment: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  toggleSegmentActive: {
    backgroundColor: colors.light.surface,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  toggleSegmentText: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.light.textMuted,
  },
  toggleSegmentTextActive: {
    color: colors.light.primary,
    fontWeight: '700',
  },
  numericInputCard: {
    backgroundColor: colors.light.surface,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.light.border,
    alignItems: 'center',
    gap: 12,
  },
  inputTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.light.textMuted,
  },
  directInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  directNumberInput: {
    backgroundColor: colors.light.surfaceAlt,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.light.primary,
    fontSize: 28,
    fontWeight: '800',
    color: colors.light.primary,
    textAlign: 'center',
    minWidth: 90,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  unitSlashText: {
    fontSize: 24,
    color: colors.light.textSubtle,
    fontWeight: '400',
  },
  totalUnitsDisplay: {
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  totalUnitsDisplayText: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.light.textMuted,
  },
  chapterTotalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  directTotalNumberInput: {
    backgroundColor: colors.light.surfaceAlt,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.light.border,
    fontSize: 20,
    fontWeight: '700',
    color: colors.light.text,
    textAlign: 'center',
    minWidth: 60,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  unitSuffixText: {
    fontSize: 13,
    color: colors.light.textMuted,
    fontWeight: '500',
  },
  progressBarBackground: {
    width: '100%',
    height: 8,
    backgroundColor: colors.light.surfaceAlt,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: colors.light.primary,
    borderRadius: 4,
  },
  percentagePill: {
    backgroundColor: colors.light.badgeBg,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.light.borderSubtle,
  },
  percentagePillText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.light.primary,
  },
  retroactiveContainer: {
    backgroundColor: colors.light.surface,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.light.border,
    gap: 10,
  },
  retroactiveHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  retroactiveLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.light.text,
  },
  retroactiveButtonsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  whenButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: colors.light.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.light.border,
  },
  whenButtonActive: {
    backgroundColor: colors.light.badgeBg,
    borderColor: colors.light.primary,
  },
  whenButtonText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.light.textMuted,
  },
  whenButtonTextActive: {
    color: colors.light.primary,
    fontWeight: '700',
  },
  actionButtonMargin: {
    marginTop: 8,
  },
  rereadActionMargin: {
    marginTop: 4,
  },
  formGroup: {
    gap: 6,
  },
  singleLineInput: {
    backgroundColor: colors.light.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.light.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.light.text,
  },
  multilineInput: {
    backgroundColor: colors.light.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.light.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.light.text,
    minHeight: 80,
  },
  spoilerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.light.surface,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.light.border,
  },
  spoilerTextCol: {
    flex: 1,
    marginRight: 10,
    gap: 2,
  },
  spoilerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  spoilerTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.light.text,
  },
  spoilerSubtitle: {
    fontSize: 11,
    color: colors.light.textMuted,
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chipButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: colors.light.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.light.border,
  },
  chipButtonSelected: {
    backgroundColor: colors.light.dangerBg,
    borderColor: colors.light.danger,
  },
  chipButtonText: {
    fontSize: 12,
    color: colors.light.textMuted,
  },
  chipButtonTextSelected: {
    color: colors.light.danger,
    fontWeight: '700',
  },
  ratingCard: {
    backgroundColor: colors.light.surface,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.light.border,
    alignItems: 'center',
    gap: 8,
  },
  ratingCardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.light.text,
  },
  ratingCardSubtitle: {
    fontSize: 12,
    color: colors.light.textMuted,
    textAlign: 'center',
  },
  starsWrapper: {
    marginVertical: 6,
  },
  logsHistoryContainer: {
    marginTop: 12,
    gap: 8,
  },
  logsHistoryTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.light.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  logCard: {
    backgroundColor: colors.light.surface,
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.light.borderSubtle,
    gap: 6,
  },
  logCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  logNumberText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.light.text,
  },
  logDateText: {
    fontSize: 12,
    color: colors.light.textMuted,
  },
  logRatingRow: {
    marginVertical: 2,
  },
  logReviewText: {
    fontSize: 12,
    color: colors.light.textMuted,
    lineHeight: 16,
  },
});
