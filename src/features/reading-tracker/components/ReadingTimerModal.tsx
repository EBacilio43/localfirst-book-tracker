import React, { useState, useEffect, useRef, useMemo } from 'react';
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
  Clock,
  Play,
  Pause,
  Check,
  AlertTriangle,
  BookOpen,
  Sparkles,
  EyeOff,
  FastForward,
  Timer,
  CheckCircle2,
} from 'lucide-react-native';
import { colors } from '@/core/theme/colors';
import { SafeButton } from '@/shared/components/SafeButton';
import { Book } from '@/db/schema/books';

export type ReadingTimerTab = 'ACTIVE' | 'FINISH' | 'OUTLIER';

export type OutlierResolution = 'NORMAL' | 'ADJUST_TO_AVERAGE' | 'EXCLUDE_SPEED' | 'KEEP_RAW';

export interface SavedSessionData {
  bookId: string;
  startPage: number;
  endPage: number;
  pagesRead: number;
  durationSeconds: number;
  startedAtEpochMs: number;
  localDate: string;
  outlierResolution: OutlierResolution;
  speedPagesPerHour: number;
}

export interface ReadingTimerModalProps {
  visible: boolean;
  book: Book;
  userAverageSpeed?: number;
  dailyGoalMinutes?: number;
  initialStartedAtEpochMs?: number;
  initialAccumulatedSeconds?: number;
  onClose: () => void;
  onSaveSession: (data: SavedSessionData) => Promise<void> | void;
}

function padTwo(n: number): string {
  return String(n).padStart(2, '0');
}

function formatDigitalClock(totalSeconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;
  return `${padTwo(hours)}:${padTwo(minutes)}:${padTwo(seconds)}`;
}

function formatHoursMinutes(totalSeconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes} min`;
}

function getLocalDateString(date = new Date()): string {
  const year = date.getFullYear();
  const month = padTwo(date.getMonth() + 1);
  const day = padTwo(date.getDate());
  return `${year}-${month}-${day}`;
}

function getYesterdayDateString(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return getLocalDateString(d);
}

function formatShortDate(date: Date): string {
  const day = padTwo(date.getDate());
  const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  const month = months[date.getMonth()];
  return `${day} ${month}`;
}

export const ReadingTimerModal: React.FC<ReadingTimerModalProps> = ({
  visible,
  book,
  userAverageSpeed = 28.4,
  dailyGoalMinutes = 30,
  initialStartedAtEpochMs,
  initialAccumulatedSeconds = 0,
  onClose,
  onSaveSession,
}) => {
  const [activeTab, setActiveTab] = useState<ReadingTimerTab>('ACTIVE');

  // Timestamps para persistencia inmune a bloqueo de pantalla
  const [startedAtEpochMs, setStartedAtEpochMs] = useState<number>(() => initialStartedAtEpochMs || Date.now());
  const [accumulatedSeconds, setAccumulatedSeconds] = useState<number>(initialAccumulatedSeconds);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [tick, setTick] = useState<number>(0);

  // Sub-vista FINISH
  const startPage = book.currentPage || 0;
  const initialEndPage = Math.min(book.pageCount > 0 ? book.pageCount : 9999, startPage + 10);
  const [endPageInput, setEndPageInput] = useState<string>(String(initialEndPage));
  const [selectedWhen, setSelectedWhen] = useState<'TODAY' | 'YESTERDAY'>('TODAY');

  // Intervalo ligero de refresco visual
  useEffect(() => {
    if (!visible) return;

    const interval = setInterval(() => {
      setTick((prev) => prev + 1);
    }, 500);

    if (typeof (interval as unknown as { unref?: () => void }).unref === 'function') {
      (interval as unknown as { unref: () => void }).unref();
    }

    return () => clearInterval(interval);
  }, [visible]);

  // Reiniciar estado al abrir el modal con un libro nuevo
  useEffect(() => {
    if (visible) {
      setActiveTab('ACTIVE');
      setStartedAtEpochMs(initialStartedAtEpochMs || Date.now());
      setAccumulatedSeconds(initialAccumulatedSeconds || 0);
      setIsPaused(false);
      const defaultNextPage = Math.min(book.pageCount > 0 ? book.pageCount : 9999, startPage + 10);
      setEndPageInput(String(defaultNextPage));
      setSelectedWhen('TODAY');
    }
  }, [visible, book.id, initialStartedAtEpochMs, initialAccumulatedSeconds, startPage, book.pageCount]);

  // Cálculo preciso de segundos transcurridos basado en Date.now()
  const totalSeconds = useMemo(() => {
    if (isPaused) {
      return accumulatedSeconds;
    }
    const elapsedSinceStarted = Math.max(0, Math.floor((Date.now() - startedAtEpochMs) / 1000));
    return accumulatedSeconds + elapsedSinceStarted;
  }, [isPaused, accumulatedSeconds, startedAtEpochMs, tick]);

  // Pausar / Reanudar cronómetro
  const handleTogglePause = () => {
    if (isPaused) {
      // Reanudar reloj: nuevo punto de partida timestamp
      setStartedAtEpochMs(Date.now());
      setIsPaused(false);
    } else {
      // Pausar reloj: consolidar segundos transcurridos
      const elapsedSinceStarted = Math.max(0, Math.floor((Date.now() - startedAtEpochMs) / 1000));
      setAccumulatedSeconds((prev) => prev + elapsedSinceStarted);
      setIsPaused(true);
    }
  };

  // Simular +15 minutos con pantalla apagada
  const handleSimulateBackgroundMinutes = (minutes = 15) => {
    setAccumulatedSeconds((prev) => prev + minutes * 60);
  };

  // Cálculos en vivo para la sub-vista FINISH
  const parsedEndPage = parseInt(endPageInput, 10);
  const endPage = Number.isNaN(parsedEndPage) ? startPage : parsedEndPage;
  const pagesRead = Math.max(0, endPage - startPage);

  const newPercentage = useMemo(() => {
    if (book.pageCount > 0) {
      return Math.min(100, Math.max(0, Math.round((endPage / book.pageCount) * 1000) / 10));
    }
    return 0;
  }, [endPage, book.pageCount]);

  const durationHours = Math.max(0.001, totalSeconds / 3600);
  const sessionSpeed = Math.round((pagesRead / durationHours) * 10) / 10;
  const speedDifference = Math.round((sessionSpeed - userAverageSpeed) * 10) / 10;

  // Fecha local seleccionada
  const localDate = selectedWhen === 'TODAY' ? getLocalDateString(new Date()) : getYesterdayDateString();

  // Detección de outliers
  const isOutlier = (sessionSpeed < 3 && totalSeconds >= 300) || sessionSpeed > 180;

  // Tiempo estimado a ritmo medio del usuario para avance de páginas
  const estimatedSeconds = Math.max(60, Math.round((pagesRead / Math.max(1, userAverageSpeed)) * 3600));
  const estimatedMinutes = Math.max(1, Math.round(estimatedSeconds / 60));

  // Guardar desde sub-vista FINISH
  const handleFinishSubmit = async () => {
    if (isOutlier) {
      setActiveTab('OUTLIER');
      return;
    }

    await onSaveSession({
      bookId: book.id,
      startPage,
      endPage,
      pagesRead,
      durationSeconds: totalSeconds,
      startedAtEpochMs,
      localDate,
      outlierResolution: 'NORMAL',
      speedPagesPerHour: sessionSpeed,
    });
    onClose();
  };

  // Guardar resolviendo outlier
  const handleResolveOutlier = async (resolution: OutlierResolution) => {
    let finalDuration = totalSeconds;
    let finalSpeed = sessionSpeed;

    if (resolution === 'ADJUST_TO_AVERAGE') {
      finalDuration = estimatedSeconds;
      finalSpeed = userAverageSpeed;
    } else if (resolution === 'EXCLUDE_SPEED') {
      finalDuration = totalSeconds;
      finalSpeed = 0;
    } else if (resolution === 'KEEP_RAW') {
      finalDuration = totalSeconds;
      finalSpeed = sessionSpeed;
    }

    await onSaveSession({
      bookId: book.id,
      startPage,
      endPage,
      pagesRead,
      durationSeconds: finalDuration,
      startedAtEpochMs,
      localDate,
      outlierResolution: resolution,
      speedPagesPerHour: finalSpeed,
    });
    onClose();
  };

  // Páginas aproximadas estimadas en sesión activa
  const approxPagesReadInSession = Math.max(
    0,
    Math.round((totalSeconds / 3600) * userAverageSpeed)
  );

  // Progreso de hábito diario
  const currentSessionMinutes = Math.floor(totalSeconds / 60);
  const dailyProgressPct = Math.min(
    200,
    Math.round((currentSessionMinutes / Math.max(1, dailyGoalMinutes)) * 100)
  );
  const isDailyGoalMet = currentSessionMinutes >= dailyGoalMinutes;

  // Fechas legibles para píldoras Hoy / Ayer
  const todayLabel = `Hoy (${formatShortDate(new Date())})`;
  const yesterdayDate = new Date();
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterdayLabel = `Ayer (${formatShortDate(yesterdayDate)})`;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
      testID="reading-timer-modal"
    >
      <View style={styles.modalOverlay}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.keyboardContainer}
        >
          <View style={styles.sheetContainer}>
            {/* Barra superior con botón de cierre */}
            <View style={styles.topBar}>
              <View>
                <Text style={styles.sheetTitle}>Cronómetro Lector</Text>
                <Text style={styles.sheetSubtitle}>Inmune al bloqueo de pantalla</Text>
              </View>
              <Pressable
                onPress={onClose}
                style={({ pressed }) => [styles.closeButton, pressed && styles.pressedOpacity]}
                accessibilityLabel="Cerrar cronómetro"
                accessibilityRole="button"
              >
                <X size={20} color={colors.light.textMuted} />
              </Pressable>
            </View>

            {/* Pestañas de sub-vistas */}
            <View style={styles.tabBar}>
              <Pressable
                onPress={() => setActiveTab('ACTIVE')}
                style={[styles.tabButton, activeTab === 'ACTIVE' && styles.tabButtonActive]}
              >
                <Text
                  style={[styles.tabButtonText, activeTab === 'ACTIVE' && styles.tabButtonTextActive]}
                >
                  En curso
                </Text>
              </Pressable>

              <Pressable
                onPress={() => setActiveTab('FINISH')}
                style={[styles.tabButton, activeTab === 'FINISH' && styles.tabButtonActive]}
              >
                <Text
                  style={[styles.tabButtonText, activeTab === 'FINISH' && styles.tabButtonTextActive]}
                >
                  Guardar sesión
                </Text>
              </Pressable>

              <Pressable
                onPress={() => setActiveTab('OUTLIER')}
                style={[styles.tabButton, activeTab === 'OUTLIER' && styles.tabButtonActive]}
              >
                <Text
                  style={[styles.tabButtonText, activeTab === 'OUTLIER' && styles.tabButtonTextActive]}
                >
                  Sesión atípica
                </Text>
              </Pressable>
            </View>

            <ScrollView
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {/* =========================================================================
                  SUB-VISTA A: SESIÓN EN CURSO (ACTIVE)
                  ========================================================================= */}
              {activeTab === 'ACTIVE' && (
                <View style={styles.paneContainer}>
                  {/* Tarjeta del libro activo */}
                  <View style={styles.bookHeaderCard}>
                    <View style={styles.bookInfoCol}>
                      <View style={styles.bookTitleRow}>
                        <Text style={styles.bookTitle} numberOfLines={1}>
                          {book.title}
                        </Text>
                        <View style={styles.pillSoft}>
                          <Text style={styles.pillSoftText}>Inicio: Pág. {startPage}</Text>
                        </View>
                      </View>
                      <Text style={styles.bookMeta} numberOfLines={1}>
                        {book.publisher ? `${book.publisher} · ` : ''}
                        {book.pageCount > 0 ? `${book.pageCount} págs. ` : ''}
                        ({book.currentPercentage ? book.currentPercentage.toFixed(1) : '0.0'}%)
                      </Text>
                    </View>
                  </View>

                  {/* Reloj digital y dial central */}
                  <View style={styles.timerDialCard}>
                    <View style={styles.statusIndicatorRow}>
                      <View
                        style={[
                          styles.pulseDot,
                          isPaused ? styles.pulseDotPaused : styles.pulseDotActive,
                        ]}
                      />
                      <Text style={styles.statusIndicatorText}>
                        {isPaused
                          ? 'Sesión en pausa'
                          : 'Cronómetro activo · Sigue contando con pantalla apagada'}
                      </Text>
                    </View>

                    <Text style={styles.timerDigits}>{formatDigitalClock(totalSeconds)}</Text>

                    <Text style={styles.subCalcText}>
                      A tu velocidad media ({userAverageSpeed.toFixed(1)} págs/h), llevas aprox. ~
                      {approxPagesReadInSession} páginas en esta sesión
                    </Text>

                    {/* Controles de pausa y simulación */}
                    <View style={styles.controlsRow}>
                      <View style={styles.controlCol}>
                        <SafeButton
                          onPress={handleTogglePause}
                          variant="secondary"
                          size="md"
                          cooldownMs={0}
                          leftIcon={
                            isPaused ? (
                              <Play size={16} color={colors.light.text} />
                            ) : (
                              <Pause size={16} color={colors.light.text} />
                            )
                          }
                          title={isPaused ? 'Reanudar reloj' : 'Pausar reloj'}
                        />
                      </View>

                      <View style={styles.controlCol}>
                        <SafeButton
                          onPress={() => handleSimulateBackgroundMinutes(15)}
                          variant="secondary"
                          size="md"
                          cooldownMs={0}
                          leftIcon={<FastForward size={16} color={colors.light.text} />}
                          title="Simular +15m off"
                        />
                      </View>
                    </View>
                  </View>

                  {/* Tarjeta de hábito diario */}
                  <View style={styles.habitCard}>
                    <View style={styles.habitHeaderRow}>
                      <Text style={styles.habitTitle}>
                        Hábito diario de lectura ({dailyGoalMinutes} min/día)
                      </Text>
                      <View style={[styles.pillSmall, isDailyGoalMet && styles.pillSuccess]}>
                        <Text
                          style={[
                            styles.pillSmallText,
                            isDailyGoalMet && styles.pillSuccessText,
                          ]}
                        >
                          {isDailyGoalMet
                            ? `Meta hoy cumplida (${dailyProgressPct}%)`
                            : `${currentSessionMinutes} / ${dailyGoalMinutes} min (${dailyProgressPct}%)`}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.progressBarTrack}>
                      <View
                        style={[
                          styles.progressBarFill,
                          { width: `${Math.min(100, dailyProgressPct)}%` },
                          isDailyGoalMet && styles.progressBarFillSuccess,
                        ]}
                      />
                    </View>
                    <Text style={styles.habitNote}>
                      Tu lectura se guarda de forma segura en tu teléfono.
                    </Text>
                  </View>

                  {/* Botón principal para pasar a finalizar */}
                  <View style={styles.actionContainer}>
                    <SafeButton
                      onPress={() => setActiveTab('FINISH')}
                      variant="accent"
                      size="lg"
                      leftIcon={<Check size={18} color="#FFFFFF" />}
                      title="Terminar sesión y anotar página final"
                    />
                  </View>
                </View>
              )}

              {/* =========================================================================
                  SUB-VISTA B: GUARDAR SESIÓN (FINISH)
                  ========================================================================= */}
              {activeTab === 'FINISH' && (
                <View style={styles.paneContainer}>
                  <View style={styles.cardContainer}>
                    <View style={styles.finishSummaryRow}>
                      <View style={styles.finishSummaryTextCol}>
                        <Text style={styles.cardHeaderTitle}>Cerrar sesión de lectura</Text>
                        <Text style={styles.cardHeaderSubtitle}>
                          Tiempo total medido:{' '}
                          <Text style={styles.boldText}>
                            {formatHoursMinutes(totalSeconds)} ({durationHours.toFixed(2)} h)
                          </Text>
                        </Text>
                      </View>
                      <View style={styles.pillAccent}>
                        <Text style={styles.pillAccentText}>
                          {sessionSpeed.toFixed(1)} págs/h
                        </Text>
                      </View>
                    </View>

                    {/* Campo numérico directo para página final */}
                    <View style={styles.directInputContainer}>
                      <View style={styles.directInputLabelCol}>
                        <Text style={styles.directInputTitle}>
                          ¿En qué página te quedaste?
                        </Text>
                        <Text style={styles.directInputSubtitle}>
                          Iniciaste en pág. {startPage}
                          {book.pageCount > 0 ? ` de ${book.pageCount}` : ''}
                        </Text>
                      </View>
                      <TextInput
                        style={styles.directInputField}
                        keyboardType="number-pad"
                        value={endPageInput}
                        onChangeText={setEndPageInput}
                        maxLength={5}
                        selectTextOnFocus
                        placeholder={String(startPage)}
                        placeholderTextColor={colors.light.textSubtle}
                      />
                    </View>

                    {/* KPIs de avance en vivo */}
                    <View style={styles.kpiGrid}>
                      <View style={styles.kpiCard}>
                        <Text style={styles.kpiLabel}>Páginas avanzadas</Text>
                        <Text style={styles.kpiValue}>+{pagesRead} págs.</Text>
                        <Text style={styles.kpiSub}>Nuevo avance: {newPercentage}%</Text>
                      </View>

                      <View style={styles.kpiCard}>
                        <Text style={styles.kpiLabel}>Velocidad de sesión</Text>
                        <Text style={styles.kpiValue}>{sessionSpeed.toFixed(1)} págs/h</Text>
                        <Text style={styles.kpiSub}>
                          {speedDifference >= 0
                            ? `+${speedDifference.toFixed(1)} vs tu media`
                            : `${speedDifference.toFixed(1)} vs tu media`}
                        </Text>
                      </View>
                    </View>

                    {/* Selector de fecha local (Hoy vs Ayer) */}
                    <View style={styles.retroDateContainer}>
                      <View style={styles.retroTextCol}>
                        <Text style={styles.retroTitle}>Fecha de lectura</Text>
                        <Text style={styles.retroSubtitle}>
                          Si leíste anoche antes de dormir, elige Ayer
                        </Text>
                      </View>
                      <View style={styles.retroPillsRow}>
                        <Pressable
                          onPress={() => setSelectedWhen('TODAY')}
                          style={[
                            styles.retroPill,
                            selectedWhen === 'TODAY' && styles.retroPillSelected,
                          ]}
                        >
                          <Text
                            style={[
                              styles.retroPillText,
                              selectedWhen === 'TODAY' && styles.retroPillTextSelected,
                            ]}
                          >
                            {todayLabel}
                          </Text>
                        </Pressable>

                        <Pressable
                          onPress={() => setSelectedWhen('YESTERDAY')}
                          style={[
                            styles.retroPill,
                            selectedWhen === 'YESTERDAY' && styles.retroPillSelected,
                          ]}
                        >
                          <Text
                            style={[
                              styles.retroPillText,
                              selectedWhen === 'YESTERDAY' && styles.retroPillTextSelected,
                            ]}
                          >
                            {yesterdayLabel}
                          </Text>
                        </Pressable>
                      </View>
                    </View>
                  </View>

                  <View style={styles.actionContainer}>
                    <SafeButton
                      onPress={handleFinishSubmit}
                      variant="primary"
                      size="lg"
                      leftIcon={<CheckCircle2 size={18} color="#FFFFFF" />}
                      title="Guardar sesión y actualizar predicciones"
                    />

                    <View style={styles.mt8}>
                      <SafeButton
                        onPress={() => setActiveTab('OUTLIER')}
                        variant="ghost"
                        size="md"
                        leftIcon={<AlertTriangle size={16} color={colors.light.accent} />}
                        title="Simular olvido de pausa (Ajustar tiempo)"
                      />
                    </View>
                  </View>
                </View>
              )}

              {/* =========================================================================
                  SUB-VISTA C: DETECTOR DE SESIONES ATÍPICAS (OUTLIER GUARD)
                  ========================================================================= */}
              {activeTab === 'OUTLIER' && (
                <View style={styles.paneContainer}>
                  <View style={styles.outlierBox}>
                    <View style={styles.outlierHeaderRow}>
                      <View style={styles.outlierTitleGroup}>
                        <AlertTriangle size={18} color={colors.light.danger} />
                        <Text style={styles.outlierTitle}>¿Olvidaste pausar el reloj?</Text>
                      </View>
                      <View style={styles.pillDanger}>
                        <Text style={styles.pillDangerText}>
                          {sessionSpeed.toFixed(1)} págs/h
                        </Text>
                      </View>
                    </View>

                    {/* Tira visual de 3 bloques con iconos */}
                    <View style={styles.outlierStrip}>
                      <View style={styles.outlierStatCard}>
                        <Clock size={14} color={colors.light.danger} />
                        <Text style={styles.outlierStatVal}>
                          {formatHoursMinutes(totalSeconds)}
                        </Text>
                        <Text style={styles.outlierStatMuted}>Medido</Text>
                      </View>

                      <View style={styles.outlierStatCard}>
                        <BookOpen size={14} color={colors.light.primary} />
                        <Text style={styles.outlierStatVal}>+{pagesRead} págs.</Text>
                        <Text style={styles.outlierStatMuted}>
                          {startPage} a {endPage}
                        </Text>
                      </View>

                      <View style={styles.outlierStatCard}>
                        <Sparkles size={14} color={colors.light.gold} />
                        <Text style={styles.outlierStatVal}>~{estimatedMinutes} min</Text>
                        <Text style={styles.outlierStatMuted}>A tu ritmo</Text>
                      </View>
                    </View>
                  </View>

                  {/* Opción 1: Acción recomendada principal (Ajustar al ritmo promedio) */}
                  <View style={styles.outlierActionSection}>
                    <SafeButton
                      onPress={() => handleResolveOutlier('ADJUST_TO_AVERAGE')}
                      variant="primary"
                      size="lg"
                      leftIcon={<Sparkles size={18} color="#FFFFFF" />}
                      title={`Ajustar a ${estimatedMinutes} min y guardar +${pagesRead} págs.`}
                      rightIcon={
                        <View style={styles.idealBadge}>
                          <Text style={styles.idealBadgeText}>Ideal</Text>
                        </View>
                      }
                    />
                  </View>

                  {/* Opciones secundarias en mosaico 1x2 */}
                  <View style={styles.outlierGrid2}>
                    <Pressable
                      onPress={() => handleResolveOutlier('EXCLUDE_SPEED')}
                      style={({ pressed }) => [
                        styles.optTile,
                        pressed && styles.pressedTile,
                      ]}
                      accessibilityRole="button"
                    >
                      <View style={styles.optTileHeader}>
                        <EyeOff size={15} color={colors.light.accent} />
                        <Text style={styles.optTileTitle}>Solo sumar +{pagesRead} págs.</Text>
                      </View>
                      <Text style={styles.optTileSubtitle}>Sin promediar velocidad</Text>
                    </Pressable>

                    <Pressable
                      onPress={() => handleResolveOutlier('KEEP_RAW')}
                      style={({ pressed }) => [
                        styles.optTile,
                        pressed && styles.pressedTile,
                      ]}
                      accessibilityRole="button"
                    >
                      <View style={styles.optTileHeader}>
                        <Check size={15} color={colors.light.primary} />
                        <Text style={styles.optTileTitle}>
                          Dejar las {formatHoursMinutes(totalSeconds)}
                        </Text>
                      </View>
                      <Text style={styles.optTileSubtitle}>Fue estudio denso</Text>
                    </Pressable>
                  </View>
                </View>
              )}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'flex-end',
  },
  keyboardContainer: {
    width: '100%',
    maxHeight: '94%',
  },
  sheetContainer: {
    backgroundColor: colors.light.background,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderColor: colors.light.border,
    paddingTop: 16,
    paddingBottom: 24,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  sheetTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.light.text,
  },
  sheetSubtitle: {
    fontSize: 12,
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
  pressedOpacity: {
    opacity: 0.7,
  },
  tabBar: {
    flexDirection: 'row',
    marginHorizontal: 20,
    backgroundColor: colors.light.surfaceAlt,
    borderRadius: 14,
    padding: 4,
    gap: 4,
    marginBottom: 14,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabButtonActive: {
    backgroundColor: colors.light.surface,
    shadowColor: '#000000',
    shadowOpacity: 0.08,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  tabButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.light.textMuted,
  },
  tabButtonTextActive: {
    color: colors.light.text,
    fontWeight: '700',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  paneContainer: {
    gap: 12,
  },
  bookHeaderCard: {
    backgroundColor: colors.light.surface,
    borderWidth: 1,
    borderColor: colors.light.border,
    borderRadius: 16,
    padding: 12,
  },
  bookInfoCol: {
    gap: 4,
  },
  bookTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  bookTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: colors.light.text,
  },
  pillSoft: {
    backgroundColor: colors.light.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.light.border,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  pillSoftText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.light.textMuted,
  },
  bookMeta: {
    fontSize: 12,
    color: colors.light.textMuted,
  },
  timerDialCard: {
    backgroundColor: colors.light.surface,
    borderWidth: 2,
    borderColor: colors.light.primary,
    borderRadius: 22,
    padding: 18,
    alignItems: 'center',
  },
  statusIndicatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.light.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.light.border,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  pulseDotActive: {
    backgroundColor: colors.light.success,
  },
  pulseDotPaused: {
    backgroundColor: colors.light.warning,
  },
  statusIndicatorText: {
    fontSize: 12,
    color: colors.light.textMuted,
    fontWeight: '600',
  },
  timerDigits: {
    fontSize: 42,
    fontWeight: '800',
    color: colors.light.text,
    letterSpacing: 1,
    marginVertical: 8,
  },
  subCalcText: {
    fontSize: 12,
    color: colors.light.textMuted,
    textAlign: 'center',
    lineHeight: 17,
  },
  controlsRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
    marginTop: 14,
  },
  controlCol: {
    flex: 1,
  },
  habitCard: {
    backgroundColor: colors.light.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.light.border,
    borderRadius: 14,
    padding: 12,
  },
  habitHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  habitTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.light.text,
  },
  pillSmall: {
    backgroundColor: colors.light.badgeBg,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  pillSmallText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.light.badgeText,
  },
  pillSuccess: {
    backgroundColor: colors.light.successBg,
  },
  pillSuccessText: {
    color: colors.light.success,
  },
  progressBarTrack: {
    height: 8,
    backgroundColor: colors.light.border,
    borderRadius: 999,
    overflow: 'hidden',
    marginVertical: 8,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: colors.light.primary,
    borderRadius: 999,
  },
  progressBarFillSuccess: {
    backgroundColor: colors.light.success,
  },
  habitNote: {
    fontSize: 12,
    color: colors.light.textMuted,
  },
  actionContainer: {
    marginTop: 6,
  },
  cardContainer: {
    backgroundColor: colors.light.surface,
    borderWidth: 1,
    borderColor: colors.light.border,
    borderRadius: 18,
    padding: 14,
    gap: 12,
  },
  finishSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  finishSummaryTextCol: {
    flex: 1,
  },
  cardHeaderTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.light.text,
  },
  cardHeaderSubtitle: {
    fontSize: 12,
    color: colors.light.textMuted,
    marginTop: 2,
  },
  boldText: {
    fontWeight: '700',
    color: colors.light.text,
  },
  pillAccent: {
    backgroundColor: colors.light.accent,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  pillAccentText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  directInputContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.light.surfaceAlt,
    borderWidth: 1.5,
    borderColor: colors.light.primary,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  directInputLabelCol: {
    flex: 1,
  },
  directInputTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.light.text,
  },
  directInputSubtitle: {
    fontSize: 12,
    color: colors.light.textMuted,
    marginTop: 2,
  },
  directInputField: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.light.text,
    backgroundColor: 'transparent',
    borderBottomWidth: 2,
    borderBottomColor: colors.light.accent,
    minWidth: 70,
    textAlign: 'center',
    paddingVertical: 2,
  },
  kpiGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  kpiCard: {
    flex: 1,
    backgroundColor: colors.light.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.light.border,
    borderRadius: 12,
    padding: 10,
  },
  kpiLabel: {
    fontSize: 12,
    color: colors.light.textMuted,
  },
  kpiValue: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.light.text,
    marginVertical: 2,
  },
  kpiSub: {
    fontSize: 12,
    color: colors.light.textMuted,
  },
  retroDateContainer: {
    backgroundColor: colors.light.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.light.border,
    borderRadius: 12,
    padding: 10,
    gap: 8,
  },
  retroTextCol: {
    gap: 2,
  },
  retroTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.light.text,
  },
  retroSubtitle: {
    fontSize: 12,
    color: colors.light.textMuted,
  },
  retroPillsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  retroPill: {
    flex: 1,
    backgroundColor: colors.light.surface,
    borderWidth: 1,
    borderColor: colors.light.border,
    borderRadius: 8,
    paddingVertical: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retroPillSelected: {
    backgroundColor: colors.light.accent,
    borderColor: colors.light.accent,
  },
  retroPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.light.textMuted,
  },
  retroPillTextSelected: {
    color: '#FFFFFF',
  },
  mt8: {
    marginTop: 8,
  },
  outlierBox: {
    backgroundColor: colors.light.dangerBg,
    borderWidth: 1.5,
    borderColor: colors.light.danger,
    borderRadius: 18,
    padding: 14,
    gap: 10,
  },
  outlierHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  outlierTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  outlierTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.light.danger,
  },
  pillDanger: {
    backgroundColor: colors.light.danger,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  pillDangerText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  outlierStrip: {
    flexDirection: 'row',
    gap: 8,
  },
  outlierStatCard: {
    flex: 1,
    backgroundColor: colors.light.surface,
    borderWidth: 1,
    borderColor: colors.light.border,
    borderRadius: 12,
    padding: 8,
    alignItems: 'center',
    gap: 2,
  },
  outlierStatVal: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.light.text,
  },
  outlierStatMuted: {
    fontSize: 12,
    color: colors.light.textMuted,
  },
  outlierActionSection: {
    marginTop: 4,
  },
  idealBadge: {
    backgroundColor: '#FAF7F2',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginLeft: 6,
  },
  idealBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.light.text,
  },
  outlierGrid2: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  optTile: {
    flex: 1,
    backgroundColor: colors.light.surface,
    borderWidth: 1,
    borderColor: colors.light.border,
    borderRadius: 14,
    padding: 11,
    gap: 4,
  },
  pressedTile: {
    borderColor: colors.light.primary,
  },
  optTileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  optTileTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.light.text,
    flexShrink: 1,
  },
  optTileSubtitle: {
    fontSize: 12,
    color: colors.light.textMuted,
  },
});
