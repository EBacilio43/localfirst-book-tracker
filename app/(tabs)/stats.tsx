import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  Share,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  Target,
  TrendingUp,
  BarChart3,
  Flame,
  Award,
  ShieldCheck,
  Shield,
  Clock,
  BookOpen,
  Smartphone,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Share2,
  Calendar,
  RotateCcw,
  Plus,
  Minus,
  Check,
} from 'lucide-react-native';
import { colors } from '@/core/theme/colors';
import { SafeButton } from '@/shared/components/SafeButton';
import { StatsDashboardSkeleton } from '@/shared/components/Skeleton';
import { BooksRepository } from '@/db/repositories/booksRepository';
import { ReadingLogsRepository } from '@/db/repositories/readingLogsRepository';
import { ReadingSessionsRepository } from '@/db/repositories/readingSessionsRepository';
import { ReadingGoalsRepository } from '@/db/repositories/readingGoalsRepository';
import { Book } from '@/db/schema/books';
import { ReadingLog } from '@/db/schema/readingLogs';
import { ReadingSession } from '@/db/schema/readingSessions';
import {
  calculateReaderVelocity,
  calculateBookCompletionEta,
  calculateGoalPacingAndCatchUp,
  calculateStreakAndHeatmap,
  buildAdvancedStatsAndWrapped,
  HeatmapDayCell,
} from '@/features/goals-analytics/services/forecastingService';

type StatsMainTab = 'GOALS' | 'FORECAST' | 'STATS';

const PACE_PRESETS = [15, 20, 25, 35, 50] as const;

function getDayOfYear(date: Date): { elapsed: number; total: number } {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date.getTime() - start.getTime();
  const oneDay = 1000 * 60 * 60 * 24;
  const elapsed = Math.max(1, Math.floor(diff / oneDay));
  const isLeap =
    (date.getFullYear() % 4 === 0 && date.getFullYear() % 100 !== 0) ||
    date.getFullYear() % 400 === 0;
  return { elapsed, total: isLeap ? 366 : 365 };
}

function getDayOfMonth(date: Date): { elapsed: number; total: number } {
  const elapsed = Math.max(1, date.getDate());
  const total = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  return { elapsed, total };
}

function formatReadableIsoDate(isoDate: string): string {
  try {
    const [y, m, d] = isoDate.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    return dt.toLocaleDateString('es-ES', {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
    });
  } catch {
    return isoDate;
  }
}

export default function StatsAndGoalsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<StatsMainTab>('GOALS');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isEditingGoals, setIsEditingGoals] = useState<boolean>(false);

  const [books, setBooks] = useState<Book[]>([]);
  const [logs, setLogs] = useState<ReadingLog[]>([]);
  const [sessions, setSessions] = useState<ReadingSession[]>([]);

  // Metas configurables (Anual, Mensual y Hábito Diario)
  const [annualTargetBooks, setAnnualTargetBooks] = useState<number>(24);
  const [annualTargetPages, setAnnualTargetPages] = useState<number>(7200);
  const [monthlyTargetBooks, setMonthlyTargetBooks] = useState<number>(2);
  const [monthlyTargetPages, setMonthlyTargetPages] = useState<number>(600);
  const [dailyTargetMinutes, setDailyTargetMinutes] = useState<number>(30);
  const [dailyTargetPages, setDailyTargetPages] = useState<number>(20);

  // Simulador interactivo de páginas por día en Predicciones
  const [simulatedPagesPerDay, setSimulatedPagesPerDay] = useState<number | undefined>(
    undefined
  );

  // Día seleccionado en el inspector del mapa de calor
  const [selectedHeatCell, setSelectedHeatCell] = useState<{
    title: string;
    detail: string;
  } | null>(null);

  const now = useMemo(() => new Date(), []);
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  const loadAnalyticsData = useCallback(async () => {
    try {
      const [allBooks, allLogs, allSessions, annualGoal, monthlyGoal, dailyGoal] =
        await Promise.all([
          BooksRepository.getAll(),
          ReadingLogsRepository.getAll(),
          ReadingSessionsRepository.getAll(),
          ReadingGoalsRepository.getByPeriod('ANNUAL', currentYear, null),
          ReadingGoalsRepository.getByPeriod('MONTHLY', currentYear, currentMonth),
          ReadingGoalsRepository.getByPeriod('DAILY', currentYear, null),
        ]);

      setBooks(allBooks);
      setLogs(allLogs);
      setSessions(allSessions);

      if (annualGoal) {
        if (annualGoal.targetBooks > 0) setAnnualTargetBooks(annualGoal.targetBooks);
        if (annualGoal.targetPages > 0) setAnnualTargetPages(annualGoal.targetPages);
      }
      if (monthlyGoal) {
        if (monthlyGoal.targetBooks > 0) setMonthlyTargetBooks(monthlyGoal.targetBooks);
        if (monthlyGoal.targetPages > 0) setMonthlyTargetPages(monthlyGoal.targetPages);
      }
      if (dailyGoal) {
        if (dailyGoal.targetMinutesPerDay > 0) {
          setDailyTargetMinutes(dailyGoal.targetMinutesPerDay);
        }
        if (dailyGoal.targetPages > 0) {
          setDailyTargetPages(dailyGoal.targetPages);
        }
      }
    } catch (error) {
      console.error('Error cargando metas y estadisticas:', error);
    } finally {
      setIsLoading(false);
    }
  }, [currentYear, currentMonth]);

  useEffect(() => {
    loadAnalyticsData();
  }, [loadAnalyticsData]);

  // Cálculos matemáticos del motor de predicciones y analítica
  const velocity = useMemo(
    () => calculateReaderVelocity(sessions, now),
    [sessions, now]
  );

  const advancedStats = useMemo(
    () =>
      buildAdvancedStatsAndWrapped({
        books,
        logs,
        sessions,
        year: currentYear,
        referenceDate: now,
      }),
    [books, logs, sessions, currentYear, now]
  );

  const streakAndHeatmap = useMemo(
    () => calculateStreakAndHeatmap(sessions, now),
    [sessions, now]
  );

  const activeReadingBooks = useMemo(
    () => books.filter((b) => b.currentStatus === 'LEYENDO'),
    [books]
  );

  // Avance mensual y diario actual
  const monthPrefix = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;
  const todayIso = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(
    now.getDate()
  ).padStart(2, '0')}`;

  const monthlyPagesRead = useMemo(
    () =>
      sessions
        .filter((s) => s.localDate.startsWith(monthPrefix))
        .reduce((acc, s) => acc + Math.max(0, s.pagesRead), 0),
    [sessions, monthPrefix]
  );

  const monthlyBooksRead = useMemo(() => {
    const ids = new Set<string>();
    for (const log of logs) {
      if (log.finishedAt) {
        const dt = new Date(log.finishedAt);
        if (
          dt.getFullYear() === currentYear &&
          dt.getMonth() + 1 === currentMonth
        ) {
          ids.add(log.bookId);
        }
      }
    }
    return ids.size;
  }, [logs, currentYear, currentMonth]);

  const todayStats = useMemo(() => {
    const todaySessions = sessions.filter((s) => s.localDate === todayIso);
    const pages = todaySessions.reduce((acc, s) => acc + Math.max(0, s.pagesRead), 0);
    const seconds = todaySessions.reduce(
      (acc, s) => acc + Math.max(0, s.durationSeconds),
      0
    );
    return {
      pages,
      minutes: Math.round(seconds / 60),
    };
  }, [sessions, todayIso]);

  const yearProgressDays = useMemo(() => getDayOfYear(now), [now]);
  const monthProgressDays = useMemo(() => getDayOfMonth(now), [now]);

  const annualPacing = useMemo(
    () =>
      calculateGoalPacingAndCatchUp({
        targetUnits: annualTargetBooks,
        currentUnits: advancedStats.wrappedCard.totalBooksRead,
        elapsedDaysInPeriod: yearProgressDays.elapsed,
        totalDaysInPeriod: yearProgressDays.total,
        readerSpeedPagesPerHour: velocity.pagesPerHour,
        unitType: 'BOOKS',
      }),
    [
      annualTargetBooks,
      advancedStats.wrappedCard.totalBooksRead,
      yearProgressDays,
      velocity.pagesPerHour,
    ]
  );

  const monthlyPagesPacing = useMemo(
    () =>
      calculateGoalPacingAndCatchUp({
        targetUnits: monthlyTargetPages,
        currentUnits: monthlyPagesRead,
        elapsedDaysInPeriod: monthProgressDays.elapsed,
        totalDaysInPeriod: monthProgressDays.total,
        readerSpeedPagesPerHour: velocity.pagesPerHour,
        unitType: 'PAGES',
      }),
    [monthlyTargetPages, monthlyPagesRead, monthProgressDays, velocity.pagesPerHour]
  );

  const handleSaveGoals = async () => {
    try {
      await Promise.all([
        ReadingGoalsRepository.upsertGoal({
          periodType: 'ANNUAL',
          year: currentYear,
          month: null,
          targetBooks: annualTargetBooks,
          targetPages: annualTargetPages,
        }),
        ReadingGoalsRepository.upsertGoal({
          periodType: 'MONTHLY',
          year: currentYear,
          month: currentMonth,
          targetBooks: monthlyTargetBooks,
          targetPages: monthlyTargetPages,
        }),
        ReadingGoalsRepository.upsertGoal({
          periodType: 'DAILY',
          year: currentYear,
          month: null,
          targetMinutesPerDay: dailyTargetMinutes,
          targetPages: dailyTargetPages,
        }),
      ]);
      setIsEditingGoals(false);
      await loadAnalyticsData();
    } catch {
      Alert.alert('Error', 'No se pudieron guardar las metas de lectura');
    }
  };

  const handleShareWrapped = async () => {
    const w = advancedStats.wrappedCard;
    const message = [
      `BaciBooks Wrapped ${w.year}`,
      `Libros leídos: ${w.totalBooksRead} (${w.physicalBooks} físicos · ${w.digitalBooks} digitales)`,
      `Páginas recorridas: ${w.totalPagesRead}`,
      `Tiempo de lectura: ${w.totalHoursRead} h (${w.averageSpeedPagesPerHour} págs/h)`,
      `Mejor racha: ${w.bestStreakDays} días seguidos`,
      w.topAuthor ? `Autor más leído: ${w.topAuthor}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    try {
      await Share.share({ message });
    } catch {
      Alert.alert('Aviso', 'No se pudo abrir el menú para compartir');
    }
  };

  const handleInspectHeatCell = (weekLabel: string, cell: HeatmapDayCell) => {
    if (cell.isFuture) return;
    const title = `${cell.dayLabel} ${cell.shortDateLabel} (${weekLabel})${
      cell.isToday ? ' · Hoy' : ''
    }`;
    let detail = `${cell.pagesRead} págs. · ${cell.minutesRead} min`;
    if (cell.isShieldUsed) {
      detail = 'Escudo de Racha aplicado (Racha protegida)';
    } else if (cell.isRetroactiveYesterday) {
      detail = `${cell.pagesRead} págs. · Registrado como Ayer`;
    }
    setSelectedHeatCell({ title, detail });
  };

  if (isLoading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <StatsDashboardSkeleton />
      </View>
    );
  }

  const annualBooksPct = Math.min(
    100,
    Math.round(
      (advancedStats.wrappedCard.totalBooksRead / Math.max(1, annualTargetBooks)) * 100
    )
  );
  const monthlyPagesPct = Math.min(
    100,
    Math.round((monthlyPagesRead / Math.max(1, monthlyTargetPages)) * 100)
  );
  const dailyMinutesPct = Math.min(
    100,
    Math.round((todayStats.minutes / Math.max(1, dailyTargetMinutes)) * 100)
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Cabecera */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Metas y Estadísticas</Text>
          <Text style={styles.headerSubtitle}>
            {velocity.isColdStart
              ? `Estimación inicial: ${velocity.pagesPerHour} págs/h · ${velocity.pagesPerDay} págs/día`
              : `Tu ritmo real: ${velocity.pagesPerHour} págs/h · ${velocity.pagesPerDay} págs/día`}
          </Text>
        </View>
        <View style={styles.speedPill}>
          <Clock size={13} color={colors.light.surface} />
          <Text style={styles.speedPillText}>{velocity.pagesPerHour} p/h</Text>
        </View>
      </View>

      {/* Selector de las 3 secciones principales */}
      <View style={styles.segmentedBar}>
        <Pressable
          style={[
            styles.segmentButton,
            activeTab === 'GOALS' && styles.segmentButtonActive,
          ]}
          onPress={() => setActiveTab('GOALS')}
        >
          <Target
            size={15}
            color={activeTab === 'GOALS' ? colors.light.text : colors.light.textMuted}
          />
          <Text
            style={[
              styles.segmentText,
              activeTab === 'GOALS' && styles.segmentTextActive,
            ]}
          >
            Metas
          </Text>
        </Pressable>

        <Pressable
          style={[
            styles.segmentButton,
            activeTab === 'FORECAST' && styles.segmentButtonActive,
          ]}
          onPress={() => setActiveTab('FORECAST')}
        >
          <TrendingUp
            size={15}
            color={
              activeTab === 'FORECAST' ? colors.light.text : colors.light.textMuted
            }
          />
          <Text
            style={[
              styles.segmentText,
              activeTab === 'FORECAST' && styles.segmentTextActive,
            ]}
          >
            Predicciones
          </Text>
        </Pressable>

        <Pressable
          style={[
            styles.segmentButton,
            activeTab === 'STATS' && styles.segmentButtonActive,
          ]}
          onPress={() => setActiveTab('STATS')}
        >
          <BarChart3
            size={15}
            color={activeTab === 'STATS' ? colors.light.text : colors.light.textMuted}
          />
          <Text
            style={[
              styles.segmentText,
              activeTab === 'STATS' && styles.segmentTextActive,
            ]}
          >
            Stats y Racha
          </Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* =================================================================
            SECCIÓN 1: METAS (ANUAL, MENSUAL Y HÁBITO DIARIO) + RITMO
            ================================================================= */}
        {activeTab === 'GOALS' && (
          <View>
            {/* Banner de Indicador de Ritmo en Tiempo Real (Pacing) */}
            <View
              style={[
                styles.pacingBanner,
                annualPacing.status === 'AHEAD' && styles.pacingAhead,
                annualPacing.status === 'ON_TRACK' && styles.pacingOnTrack,
                annualPacing.status === 'BEHIND' && styles.pacingBehind,
              ]}
            >
              {annualPacing.status === 'AHEAD' ? (
                <TrendingUp size={20} color={colors.light.primary} />
              ) : annualPacing.status === 'ON_TRACK' ? (
                <CheckCircle2 size={20} color={colors.light.primary} />
              ) : (
                <AlertCircle size={20} color={colors.light.accent} />
              )}
              <View style={styles.pacingTextCol}>
                <Text style={styles.pacingTitle}>
                  {annualPacing.status === 'AHEAD'
                    ? `Vas Adelantado (+${Math.abs(annualPacing.deltaUnits)} libros sobre el ritmo)`
                    : annualPacing.status === 'ON_TRACK'
                    ? 'Vas En Ritmo Ideal para cumplir tu meta anual'
                    : `Vas Atrasado (${annualPacing.deltaUnits} libros respecto a hoy)`}
                </Text>
                <Text style={styles.pacingSubtitle}>
                  {annualPacing.status === 'BEHIND'
                    ? `Ajuste Catch-up: lee ${monthlyPagesPacing.requiredPagesPerDay} págs/día (~${monthlyPagesPacing.requiredMinutesPerDay} min) para recuperarte.`
                    : `Esperado a hoy: ${annualPacing.expectedByToday} libros · Cierre proyectado: ${annualPacing.projectedEndTotal} libros.`}
                </Text>
              </View>
            </View>

            {/* Tarjeta Meta Anual */}
            <View style={styles.card}>
              <View style={styles.cardHeaderRow}>
                <View>
                  <Text style={styles.cardTitle}>Meta Anual {currentYear}</Text>
                  <Text style={styles.cardMuted}>
                    Día {yearProgressDays.elapsed} de {yearProgressDays.total} · Propios,
                    prestados y relecturas
                  </Text>
                </View>
                <View style={styles.badgePrimary}>
                  <Text style={styles.badgePrimaryText}>{annualBooksPct}%</Text>
                </View>
              </View>

              <View style={styles.progressBarTrack}>
                <View
                  style={[styles.progressBarFill, { width: `${annualBooksPct}%` }]}
                />
              </View>

              <View style={styles.kpiGrid}>
                <View style={styles.kpiBox}>
                  <Text style={styles.cardMuted}>Libros terminados</Text>
                  <Text style={styles.kpiValue}>
                    {advancedStats.wrappedCard.totalBooksRead} / {annualTargetBooks}
                  </Text>
                  <Text style={styles.cardMuted}>
                    Faltan {annualPacing.remainingUnits} libros
                  </Text>
                </View>
                <View style={styles.kpiBox}>
                  <Text style={styles.cardMuted}>Páginas en el año</Text>
                  <Text style={styles.kpiValue}>
                    {advancedStats.wrappedCard.totalPagesRead} / {annualTargetPages}
                  </Text>
                  <Text style={styles.cardMuted}>
                    {Math.min(
                      100,
                      Math.round(
                        (advancedStats.wrappedCard.totalPagesRead /
                          Math.max(1, annualTargetPages)) *
                          100
                      )
                    )}
                    % del objetivo
                  </Text>
                </View>
              </View>
            </View>

            {/* Tarjeta Meta Mensual y Hábito Diario */}
            <View style={styles.card}>
              <View style={styles.cardHeaderRow}>
                <View>
                  <Text style={styles.cardTitle}>Meta Mensual y Hábito Diario</Text>
                  <Text style={styles.cardMuted}>
                    Día {monthProgressDays.elapsed} de {monthProgressDays.total} del mes
                  </Text>
                </View>
                <Pressable
                  style={styles.badgeSoft}
                  onPress={() => setIsEditingGoals((prev) => !prev)}
                >
                  <Text style={styles.badgeSoftText}>
                    {isEditingGoals ? 'Cerrar edición' : 'Configurar'}
                  </Text>
                </Pressable>
              </View>

              <View style={styles.kpiGrid}>
                <View style={styles.kpiBox}>
                  <Text style={styles.cardMuted}>Páginas este mes</Text>
                  <Text style={styles.kpiValue}>
                    {monthlyPagesRead} / {monthlyTargetPages}
                  </Text>
                  <Text style={styles.cardMuted}>
                    {monthlyBooksRead} / {monthlyTargetBooks} libros ({monthlyPagesPct}%)
                  </Text>
                </View>
                <View style={styles.kpiBox}>
                  <Text style={styles.cardMuted}>Hábito de Hoy</Text>
                  <Text style={styles.kpiValue}>
                    {todayStats.minutes} / {dailyTargetMinutes} min
                  </Text>
                  <Text style={styles.cardMuted}>
                    {todayStats.pages} / {dailyTargetPages} págs. ({dailyMinutesPct}%)
                  </Text>
                </View>
              </View>

              {/* Configurador desplegable de metas */}
              {isEditingGoals && (
                <View style={styles.configSection}>
                  <Text style={styles.configTitle}>Ajustar objetivos de lectura</Text>

                  <View style={styles.stepperRow}>
                    <View>
                      <Text style={styles.stepperLabel}>Meta Anual (Libros)</Text>
                      <Text style={styles.cardMuted}>
                        {(annualTargetBooks / 12).toFixed(1)} libros/mes
                      </Text>
                    </View>
                    <View style={styles.stepperControls}>
                      <Pressable
                        style={styles.stepBtn}
                        onPress={() =>
                          setAnnualTargetBooks((v) => Math.max(1, v - 1))
                        }
                      >
                        <Minus size={15} color={colors.light.text} />
                      </Pressable>
                      <Text style={styles.stepVal}>{annualTargetBooks}</Text>
                      <Pressable
                        style={styles.stepBtn}
                        onPress={() => setAnnualTargetBooks((v) => v + 1)}
                      >
                        <Plus size={15} color={colors.light.text} />
                      </Pressable>
                    </View>
                  </View>

                  <View style={styles.stepperRow}>
                    <View>
                      <Text style={styles.stepperLabel}>Meta Mensual (Páginas)</Text>
                      <Text style={styles.cardMuted}>
                        ~{Math.ceil(monthlyTargetPages / monthProgressDays.total)}{' '}
                        págs/día
                      </Text>
                    </View>
                    <View style={styles.stepperControls}>
                      <Pressable
                        style={styles.stepBtn}
                        onPress={() =>
                          setMonthlyTargetPages((v) => Math.max(50, v - 50))
                        }
                      >
                        <Minus size={15} color={colors.light.text} />
                      </Pressable>
                      <Text style={styles.stepVal}>{monthlyTargetPages}</Text>
                      <Pressable
                        style={styles.stepBtn}
                        onPress={() => setMonthlyTargetPages((v) => v + 50)}
                      >
                        <Plus size={15} color={colors.light.text} />
                      </Pressable>
                    </View>
                  </View>

                  <View style={styles.stepperRow}>
                    <View>
                      <Text style={styles.stepperLabel}>Hábito Diario (Minutos)</Text>
                      <Text style={styles.cardMuted}>Protege tu racha diaria</Text>
                    </View>
                    <View style={styles.stepperControls}>
                      <Pressable
                        style={styles.stepBtn}
                        onPress={() =>
                          setDailyTargetMinutes((v) => Math.max(5, v - 5))
                        }
                      >
                        <Minus size={15} color={colors.light.text} />
                      </Pressable>
                      <Text style={styles.stepVal}>{dailyTargetMinutes}m</Text>
                      <Pressable
                        style={styles.stepBtn}
                        onPress={() => setDailyTargetMinutes((v) => v + 5)}
                      >
                        <Plus size={15} color={colors.light.text} />
                      </Pressable>
                    </View>
                  </View>

                  <SafeButton
                    title="Guardar configuración de metas"
                    onPress={handleSaveGoals}
                    variant="primary"
                    style={styles.mt12}
                  />
                </View>
              )}
            </View>
          </View>
        )}

        {/* =================================================================
            SECCIÓN 2: MOTOR DE PREDICCIONES (ETA POR LIBRO, CATCH-UP, COLD START)
            ================================================================= */}
        {activeTab === 'FORECAST' && (
          <View>
            {/* Aviso de ritmo inicial si hay 0 sesiones con cronómetro */}
            {velocity.isColdStart && (
              <View style={styles.coldStartCard}>
                <View style={styles.cardHeaderRow}>
                  <View style={styles.rowCenter}>
                    <Sparkles size={16} color={colors.light.gold} />
                    <Text style={styles.coldStartTitle}>
                      Estimación inicial de ritmo
                    </Text>
                  </View>
                  <View style={styles.badgeGold}>
                    <Text style={styles.badgeGoldText}>0 sesiones</Text>
                  </View>
                </View>
                <Text style={styles.cardMuted}>
                  Calculando con un ritmo estimado de 25 páginas por hora y 20 páginas al día.
                  Registra tu primera sesión con el cronómetro para calcular tu velocidad real.
                </Text>
              </View>
            )}

            {/* Simulador interactivo de ritmo diario */}
            <View style={styles.card}>
              <View style={styles.cardHeaderRow}>
                <Text style={styles.cardTitle}>Simulador: ¿Y si leo más al día?</Text>
                <View style={styles.badgePrimary}>
                  <Text style={styles.badgePrimaryText}>
                    {simulatedPagesPerDay ?? velocity.pagesPerDay} págs/día
                  </Text>
                </View>
              </View>
              <Text style={styles.cardMuted}>
                Toca un ritmo diario para recalcular la fecha exacta de finalización de
                tus lecturas activas:
              </Text>
              <View style={styles.presetRow}>
                {PACE_PRESETS.map((pace) => {
                  const isSelected =
                    (simulatedPagesPerDay ?? Math.round(velocity.pagesPerDay)) === pace;
                  return (
                    <Pressable
                      key={pace}
                      style={[
                        styles.presetChip,
                        isSelected && styles.presetChipActive,
                      ]}
                      onPress={() => setSimulatedPagesPerDay(pace)}
                    >
                      <Text
                        style={[
                          styles.presetChipText,
                          isSelected && styles.presetChipTextActive,
                        ]}
                      >
                        {pace} p/d
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* Tarjetas de ETA por Libro Activo */}
            {activeReadingBooks.length === 0 ? (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Sin libros en estado Leyendo</Text>
                <Text style={styles.cardMuted}>
                  Marca un libro como Leyendo en Mi Librero para ver cuántas horas netas
                  y qué día exacto lo terminarás.
                </Text>
              </View>
            ) : (
              activeReadingBooks.map((book) => {
                const eta = calculateBookCompletionEta(
                  book,
                  velocity,
                  simulatedPagesPerDay,
                  now
                );
                return (
                  <Pressable
                    key={book.id}
                    style={styles.card}
                    onPress={() => router.push(`/book/${book.id}`)}
                  >
                    <View style={styles.cardHeaderRow}>
                      <View style={styles.flex1}>
                        <Text style={styles.cardTitle} numberOfLines={1}>
                          {book.title}
                        </Text>
                        <Text style={styles.cardMuted}>
                          Avance: {book.currentPercentage}% · Faltan{' '}
                          {eta.remainingPages} págs.
                        </Text>
                      </View>
                      <View style={styles.badgeSoft}>
                        <Text style={styles.badgeSoftText}>
                          {book.modality === 'DIGITAL' ? 'eBook' : 'Físico'}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.kpiGrid}>
                      <View style={styles.kpiBox}>
                        <Text style={styles.cardMuted}>Tiempo neto restante</Text>
                        <Text style={styles.kpiValue}>
                          {eta.remainingHoursWhole}h {eta.remainingMinutesPart}m
                        </Text>
                        <Text style={styles.cardMuted}>
                          A {velocity.pagesPerHour} págs/hora
                        </Text>
                      </View>
                      <View style={styles.kpiBox}>
                        <Text style={styles.cardMuted}>Fecha estimada fin</Text>
                        <Text
                          style={[styles.kpiValue, { color: colors.light.primary }]}
                        >
                          {formatReadableIsoDate(eta.estimatedCompletionDateIso)}
                        </Text>
                        <Text style={styles.cardMuted}>
                          En {eta.estimatedDaysRemaining} días ({eta.effectivePagesPerDay}{' '}
                          p/d)
                        </Text>
                      </View>
                    </View>
                  </Pressable>
                );
              })
            )}

            {/* Calculadora Dinámica de Ajuste (Catch-up Calculator) */}
            <View style={styles.card}>
              <View style={styles.cardHeaderRow}>
                <Text style={styles.cardTitle}>
                  Calculadora de Ajuste (Catch-up)
                </Text>
                <View style={styles.badgeAccent}>
                  <Text style={styles.badgePrimaryText}>
                    Quedan {monthlyPagesPacing.remainingDays}d
                  </Text>
                </View>
              </View>
              <Text style={styles.cardMuted}>
                Para alcanzar tu meta mensual de {monthlyTargetPages} páginas antes de
                fin de mes:
              </Text>
              <View style={styles.kpiGrid}>
                <View style={styles.kpiBox}>
                  <Text style={styles.cardMuted}>Cuota diaria necesaria</Text>
                  <Text style={[styles.kpiValue, { color: colors.light.accent }]}>
                    {monthlyPagesPacing.requiredPagesPerDay} págs/día
                  </Text>
                  <Text style={styles.cardMuted}>
                    Faltan {monthlyPagesPacing.remainingUnits} págs.
                  </Text>
                </View>
                <View style={styles.kpiBox}>
                  <Text style={styles.cardMuted}>Tiempo diario requerido</Text>
                  <Text style={styles.kpiValue}>
                    {monthlyPagesPacing.requiredMinutesPerDay} min/día
                  </Text>
                  <Text style={styles.cardMuted}>
                    Según tus {velocity.pagesPerHour} págs/h
                  </Text>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* =================================================================
            SECCIÓN 3: ESTADÍSTICAS AVANZADAS, RACHA CON ICONOS Y WRAPPED
            ================================================================= */}
        {activeTab === 'STATS' && (
          <View>
            {/* 1. Racha y Escudo con Iconos Vectoriales y Guía de Semanas / Días */}
            <View style={styles.card}>
              <View style={styles.streakStrip}>
                <View style={styles.streakBadge}>
                  <View style={[styles.streakIconBox, styles.iconFire]}>
                    <Flame size={18} color={colors.light.accent} />
                  </View>
                  <View>
                    <Text style={styles.streakBadgeVal}>
                      {streakAndHeatmap.currentStreakDays}d
                    </Text>
                    <Text style={styles.cardMuted}>Racha</Text>
                  </View>
                </View>

                <View style={styles.streakBadge}>
                  <View style={[styles.streakIconBox, styles.iconBest]}>
                    <Award size={18} color={colors.light.primary} />
                  </View>
                  <View>
                    <Text style={styles.streakBadgeVal}>
                      {streakAndHeatmap.bestStreakDays}d
                    </Text>
                    <Text style={styles.cardMuted}>Récord</Text>
                  </View>
                </View>

                <View style={styles.streakBadge}>
                  <View style={[styles.streakIconBox, styles.iconShield]}>
                    <ShieldCheck size={18} color={colors.light.gold} />
                  </View>
                  <View>
                    <Text style={styles.streakBadgeVal}>
                      {streakAndHeatmap.availableShields} / 1
                    </Text>
                    <Text style={styles.cardMuted}>Escudo</Text>
                  </View>
                </View>
              </View>

              {/* Barra visual de recarga semanal del escudo con iconos */}
              <View style={styles.shieldBar}>
                <View style={styles.rowCenter}>
                  <Shield size={14} color={colors.light.gold} />
                  <Text style={styles.shieldBarLabel}>
                    Escudo semanal ({streakAndHeatmap.weeklyDaysCompleted}/5 días)
                  </Text>
                </View>
                <View style={styles.shieldDotsRow}>
                  {[1, 2, 3, 4, 5].map((idx) => {
                    const active = idx <= streakAndHeatmap.weeklyDaysCompleted;
                    return (
                      <View
                        key={idx}
                        style={[styles.shieldDot, active && styles.shieldDotActive]}
                      >
                        <Check
                          size={11}
                          color={active ? colors.light.surface : colors.light.textSubtle}
                        />
                      </View>
                    );
                  })}
                </View>
              </View>

              {/* Guía de Semanas (Filas) y Días (Columnas L a D) */}
              <View style={styles.heatmapTable}>
                <View style={styles.heatmapHeaderRow}>
                  <Text style={styles.hmWeekHeader}>Semana</Text>
                  {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((d) => (
                    <Text key={d} style={styles.hmDayHeader}>
                      {d}
                    </Text>
                  ))}
                </View>

                {streakAndHeatmap.weeks.map((week, wIdx) => (
                  <View key={week.weekLabel} style={styles.heatmapWeekRow}>
                    <Text
                      style={[
                        styles.hmWeekLabel,
                        wIdx === streakAndHeatmap.weeks.length - 1 &&
                          styles.hmWeekLabelCurrent,
                      ]}
                      numberOfLines={1}
                    >
                      {week.weekLabel}
                    </Text>
                    {week.days.map((cell) => (
                      <Pressable
                        key={cell.dateIso}
                        style={[
                          styles.hmCell,
                          cell.level === 1 && styles.hmLevel1,
                          cell.level === 2 && styles.hmLevel2,
                          cell.level === 3 && styles.hmLevel3,
                          cell.isShieldUsed && styles.hmCellShield,
                          cell.isRetroactiveYesterday && styles.hmCellRetro,
                          cell.isToday && styles.hmCellToday,
                          cell.isFuture && styles.hmCellFuture,
                        ]}
                        onPress={() => handleInspectHeatCell(week.weekLabel, cell)}
                      >
                        {cell.isShieldUsed ? (
                          <ShieldCheck size={13} color={colors.light.gold} />
                        ) : cell.isRetroactiveYesterday ? (
                          <RotateCcw size={13} color={colors.light.accent} />
                        ) : (
                          <Text
                            style={[
                              styles.hmCellText,
                              (cell.level === 2 || cell.level === 3) &&
                                styles.hmCellTextLight,
                            ]}
                          >
                            {cell.isFuture
                              ? '·'
                              : cell.pagesRead > 0
                              ? cell.pagesRead
                              : cell.shortDateLabel}
                          </Text>
                        )}
                      </Pressable>
                    ))}
                  </View>
                ))}
              </View>

              {/* Inspector interactivo del día seleccionado */}
              <View style={styles.hmInspector}>
                <View style={styles.rowCenter}>
                  <Calendar size={14} color={colors.light.primary} />
                  <Text style={styles.hmInspectorTitle}>
                    {selectedHeatCell ? selectedHeatCell.title : 'Hoy'}
                  </Text>
                </View>
                <Text style={styles.cardMuted}>
                  {selectedHeatCell
                    ? selectedHeatCell.detail
                    : `${todayStats.pages} págs. · ${todayStats.minutes} min (Toca un día)`}
                </Text>
              </View>

              {/* Leyenda visual basada en iconos */}
              <View style={styles.hmLegendRow}>
                <View style={styles.rowCenter}>
                  <ShieldCheck size={13} color={colors.light.gold} />
                  <Text style={styles.cardMuted}>Escudo</Text>
                </View>
                <View style={styles.rowCenter}>
                  <RotateCcw size={13} color={colors.light.accent} />
                  <Text style={styles.cardMuted}>Registro Ayer</Text>
                </View>
                <View style={styles.rowCenter}>
                  <View style={styles.legendSquare} />
                  <Text style={styles.cardMuted}>Págs. leídas</Text>
                </View>
              </View>
            </View>

            {/* 2. Comparativa Libros Físicos vs Digitales */}
            <View style={styles.card}>
              <View style={styles.cardHeaderRow}>
                <Text style={styles.cardTitle}>
                  Libros Físicos vs. Digitales ({currentYear})
                </Text>
                <View style={styles.badgeSoft}>
                  <Text style={styles.badgeSoftText}>
                    {advancedStats.wrappedCard.totalBooksRead} libros
                  </Text>
                </View>
              </View>

              <View style={styles.dualBarTrack}>
                <View
                  style={[
                    styles.dualBarPhysical,
                    {
                      flex: Math.max(
                        1,
                        advancedStats.physicalStats.percentageOfTotal || 50
                      ),
                    },
                  ]}
                />
                <View
                  style={[
                    styles.dualBarDigital,
                    {
                      flex: Math.max(
                        1,
                        advancedStats.digitalStats.percentageOfTotal || 50
                      ),
                    },
                  ]}
                />
              </View>

              <View style={styles.kpiGrid}>
                <View style={styles.kpiBox}>
                  <View style={styles.rowCenter}>
                    <BookOpen size={14} color={colors.light.primary} />
                    <Text style={styles.cardMuted}>
                      Físicos ({advancedStats.physicalStats.percentageOfTotal}%)
                    </Text>
                  </View>
                  <Text style={styles.kpiValue}>
                    {advancedStats.physicalStats.readCount} libros
                  </Text>
                  <Text style={styles.cardMuted}>
                    {advancedStats.physicalStats.totalPages} págs. ·{' '}
                    {advancedStats.physicalStats.averageSpeedPagesPerHour} p/h
                  </Text>
                </View>

                <View style={styles.kpiBox}>
                  <View style={styles.rowCenter}>
                    <Smartphone size={14} color={colors.light.accent} />
                    <Text style={styles.cardMuted}>
                      Digitales ({advancedStats.digitalStats.percentageOfTotal}%)
                    </Text>
                  </View>
                  <Text style={styles.kpiValue}>
                    {advancedStats.digitalStats.readCount} eBooks
                  </Text>
                  <Text style={styles.cardMuted}>
                    {advancedStats.digitalStats.totalPages} págs. ·{' '}
                    {advancedStats.digitalStats.averageSpeedPagesPerHour} p/h
                  </Text>
                </View>
              </View>
            </View>

            {/* 3. Ritmo por Día de la Semana */}
            <View style={styles.card}>
              <View style={styles.cardHeaderRow}>
                <View>
                  <Text style={styles.cardTitle}>Ritmo por Día de la Semana</Text>
                  <Text style={styles.cardMuted}>
                    Día más lector: {advancedStats.peakWeekdayLabel}
                  </Text>
                </View>
                <View style={styles.badgePrimary}>
                  <Text style={styles.badgePrimaryText}>
                    Pico: {advancedStats.peakWeekdayLabel}
                  </Text>
                </View>
              </View>

              <View style={styles.weekdayChart}>
                {advancedStats.weekdayDistribution.map((d) => {
                  const maxPages = Math.max(
                    10,
                    ...advancedStats.weekdayDistribution.map((x) => x.totalPages)
                  );
                  const heightPct = Math.max(
                    14,
                    Math.round((d.totalPages / maxPages) * 100)
                  );
                  const isPeak =
                    d.dayLabel === advancedStats.peakWeekdayLabel && d.totalPages > 0;
                  return (
                    <View key={d.dayLabel} style={styles.weekdayCol}>
                      <View
                        style={[
                          styles.weekdayBar,
                          { height: `${heightPct}%` },
                          isPeak && styles.weekdayBarPeak,
                        ]}
                      />
                      <Text style={styles.weekdayLabel}>{d.dayLabel[0]}</Text>
                    </View>
                  );
                })}
              </View>
            </View>

            {/* 4. Tarjeta Resumen Compartible: BaciBooks Wrapped */}
            <View style={styles.wrappedPoster}>
              <View style={styles.cardHeaderRow}>
                <View style={styles.badgeGold}>
                  <Text style={styles.badgeGoldText}>
                    BACIBOOKS WRAPPED · {currentYear}
                  </Text>
                </View>
                <Text style={styles.wrappedSub}>v0.3.0</Text>
              </View>

              <Text style={styles.wrappedTitle}>Mi Año entre Páginas</Text>
              <Text style={styles.wrappedSub}>
                Resumen verificado con cronómetro Local-First
              </Text>

              <View style={styles.wrappedGrid}>
                <View style={styles.wrappedBox}>
                  <Text style={styles.wrappedBig}>
                    {advancedStats.wrappedCard.totalBooksRead} Libros
                  </Text>
                  <Text style={styles.wrappedSub}>
                    {advancedStats.wrappedCard.physicalBooks} Físicos ·{' '}
                    {advancedStats.wrappedCard.digitalBooks} eBooks
                  </Text>
                </View>

                <View style={styles.wrappedBox}>
                  <Text style={styles.wrappedBig}>
                    {advancedStats.wrappedCard.totalPagesRead} Págs
                  </Text>
                  <Text style={styles.wrappedSub}>Recorridas en el año</Text>
                </View>

                <View style={styles.wrappedBox}>
                  <Text style={styles.wrappedBig}>
                    {advancedStats.wrappedCard.totalHoursRead} Horas
                  </Text>
                  <Text style={styles.wrappedSub}>
                    Ritmo: {advancedStats.wrappedCard.averageSpeedPagesPerHour} págs/h
                  </Text>
                </View>

                <View style={styles.wrappedBox}>
                  <Text style={styles.wrappedBig}>
                    {advancedStats.wrappedCard.bestStreakDays} Días
                  </Text>
                  <Text style={styles.wrappedSub}>Mejor racha continua</Text>
                </View>
              </View>

              <View style={styles.wrappedFooter}>
                <Text style={styles.wrappedSub}>Editorial y Autor destacados</Text>
                <Text style={styles.wrappedFooterBold}>
                  {advancedStats.wrappedCard.topPublisher ?? 'Varias editoriales'} ·{' '}
                  {advancedStats.wrappedCard.topAuthor ?? 'Varios autores'}
                </Text>
              </View>

              <SafeButton
                title="Compartir resumen BaciBooks Wrapped"
                onPress={handleShareWrapped}
                variant="secondary"
                leftIcon={<Share2 size={16} color={colors.light.text} />}
                style={styles.mt12}
              />
            </View>
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
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.light.text,
  },
  headerSubtitle: {
    fontSize: 12,
    color: colors.light.textMuted,
    marginTop: 2,
  },
  speedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.light.primary,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  speedPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.light.surface,
  },
  segmentedBar: {
    flexDirection: 'row',
    backgroundColor: colors.light.surfaceAlt,
    marginHorizontal: 20,
    padding: 4,
    borderRadius: 14,
    gap: 4,
    marginBottom: 12,
  },
  segmentButton: {
    flex: 1,
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 10,
  },
  segmentButtonActive: {
    backgroundColor: colors.light.surface,
  },
  segmentText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.light.textMuted,
  },
  segmentTextActive: {
    color: colors.light.text,
    fontWeight: '700',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  pacingBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 12,
  },
  pacingAhead: {
    backgroundColor: colors.light.successBg,
    borderColor: colors.light.primary,
  },
  pacingOnTrack: {
    backgroundColor: colors.light.surfaceAlt,
    borderColor: colors.light.border,
  },
  pacingBehind: {
    backgroundColor: colors.light.warningBg,
    borderColor: colors.light.accent,
  },
  pacingTextCol: {
    flex: 1,
  },
  pacingTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.light.text,
  },
  pacingSubtitle: {
    fontSize: 12,
    color: colors.light.textMuted,
    marginTop: 2,
  },
  card: {
    backgroundColor: colors.light.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.light.border,
    padding: 14,
    marginBottom: 12,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.light.text,
  },
  cardMuted: {
    fontSize: 12,
    color: colors.light.textMuted,
    marginTop: 2,
  },
  badgePrimary: {
    backgroundColor: colors.light.primary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  badgeAccent: {
    backgroundColor: colors.light.accent,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  badgePrimaryText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.light.surface,
  },
  badgeSoft: {
    backgroundColor: colors.light.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.light.border,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  badgeSoftText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.light.text,
  },
  badgeGold: {
    backgroundColor: colors.light.warningBg,
    borderWidth: 1,
    borderColor: colors.light.gold,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  badgeGoldText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.light.text,
  },
  progressBarTrack: {
    height: 10,
    backgroundColor: colors.light.border,
    borderRadius: 999,
    overflow: 'hidden',
    marginVertical: 10,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: colors.light.primary,
    borderRadius: 999,
  },
  kpiGrid: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  kpiBox: {
    flex: 1,
    backgroundColor: colors.light.surfaceAlt,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.light.border,
    padding: 10,
  },
  kpiValue: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.light.text,
    marginVertical: 2,
  },
  configSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.light.border,
  },
  configTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.light.text,
    marginBottom: 4,
  },
  stepperRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.light.surfaceAlt,
    borderRadius: 12,
    padding: 10,
    marginTop: 8,
  },
  stepperLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.light.text,
  },
  stepperControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stepBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: colors.light.surface,
    borderWidth: 1,
    borderColor: colors.light.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepVal: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.light.text,
    minWidth: 42,
    textAlign: 'center',
  },
  coldStartCard: {
    backgroundColor: colors.light.surface,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: colors.light.gold,
    padding: 14,
    marginBottom: 12,
  },
  coldStartTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.light.text,
  },
  presetRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  presetChip: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: colors.light.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.light.border,
    alignItems: 'center',
  },
  presetChipActive: {
    backgroundColor: colors.light.primary,
    borderColor: colors.light.primary,
  },
  presetChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.light.textMuted,
  },
  presetChipTextActive: {
    color: colors.light.surface,
  },
  streakStrip: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  streakBadge: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.light.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.light.border,
    borderRadius: 14,
    padding: 8,
  },
  streakIconBox: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconFire: {
    backgroundColor: colors.light.warningBg,
  },
  iconBest: {
    backgroundColor: colors.light.successBg,
  },
  iconShield: {
    backgroundColor: colors.light.warningBg,
  },
  streakBadgeVal: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.light.text,
  },
  shieldBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.light.surfaceAlt,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.light.border,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 10,
  },
  shieldBarLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.light.text,
  },
  shieldDotsRow: {
    flexDirection: 'row',
    gap: 4,
  },
  shieldDot: {
    width: 18,
    height: 18,
    borderRadius: 6,
    backgroundColor: colors.light.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shieldDotActive: {
    backgroundColor: colors.light.primary,
  },
  heatmapTable: {
    gap: 5,
  },
  heatmapHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  heatmapWeekRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  hmWeekHeader: {
    width: 72,
    fontSize: 12,
    fontWeight: '700',
    color: colors.light.textMuted,
  },
  hmDayHeader: {
    flex: 1,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '700',
    color: colors.light.textMuted,
  },
  hmWeekLabel: {
    width: 72,
    fontSize: 12,
    fontWeight: '600',
    color: colors.light.textMuted,
  },
  hmWeekLabelCurrent: {
    color: colors.light.text,
    fontWeight: '700',
  },
  hmCell: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 8,
    backgroundColor: colors.light.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.light.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hmLevel1: {
    backgroundColor: '#C5DDD3',
    borderColor: '#C5DDD3',
  },
  hmLevel2: {
    backgroundColor: '#568B73',
    borderColor: '#568B73',
  },
  hmLevel3: {
    backgroundColor: colors.light.primary,
    borderColor: colors.light.primary,
  },
  hmCellShield: {
    backgroundColor: colors.light.warningBg,
    borderWidth: 2,
    borderColor: colors.light.gold,
  },
  hmCellRetro: {
    backgroundColor: colors.light.warningBg,
    borderWidth: 1.5,
    borderColor: colors.light.accent,
  },
  hmCellToday: {
    borderWidth: 2,
    borderColor: colors.light.text,
  },
  hmCellFuture: {
    opacity: 0.4,
  },
  hmCellText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.light.text,
  },
  hmCellTextLight: {
    color: colors.light.surface,
  },
  hmInspector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.light.surfaceAlt,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: colors.light.border,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginTop: 10,
  },
  hmInspectorTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.light.text,
  },
  hmLegendRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  legendSquare: {
    width: 10,
    height: 10,
    borderRadius: 3,
    backgroundColor: colors.light.primary,
  },
  dualBarTrack: {
    flexDirection: 'row',
    height: 12,
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: colors.light.border,
    marginVertical: 10,
  },
  dualBarPhysical: {
    backgroundColor: colors.light.primary,
  },
  dualBarDigital: {
    backgroundColor: colors.light.accent,
  },
  weekdayChart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 104,
    backgroundColor: colors.light.surfaceAlt,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.light.border,
    paddingHorizontal: 10,
    paddingTop: 12,
    paddingBottom: 6,
    marginTop: 10,
  },
  weekdayCol: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    height: '100%',
    gap: 4,
  },
  weekdayBar: {
    width: 20,
    backgroundColor: colors.light.primary,
    borderRadius: 5,
    opacity: 0.75,
  },
  weekdayBarPeak: {
    backgroundColor: colors.light.accent,
    opacity: 1,
  },
  weekdayLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.light.textMuted,
  },
  wrappedPoster: {
    backgroundColor: colors.light.primary,
    borderRadius: 22,
    padding: 16,
    marginBottom: 12,
  },
  wrappedTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.light.surface,
    marginTop: 8,
  },
  wrappedSub: {
    fontSize: 12,
    color: colors.light.badgeBg,
  },
  wrappedGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginVertical: 12,
  },
  wrappedBox: {
    width: '48%',
    backgroundColor: colors.light.primaryHover,
    borderRadius: 12,
    padding: 10,
  },
  wrappedBig: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.light.surface,
  },
  wrappedFooter: {
    backgroundColor: colors.light.primaryHover,
    borderRadius: 12,
    padding: 10,
  },
  wrappedFooterBold: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.light.surface,
    marginTop: 2,
  },
  rowCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  flex1: {
    flex: 1,
  },
  mt12: {
    marginTop: 12,
  },
});
