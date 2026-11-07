import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Image,
  RefreshControl,
  Dimensions,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Play,
  CheckCircle,
  Sparkles,
  Bookmark,
  Compass,
  Cloud,
  BookOpen,
  Smartphone,
  ChevronRight,
  Flame,
  ArrowRight,
  BookMarked,
  CheckSquare,
} from 'lucide-react-native';
import { BooksRepository } from '@/db/repositories/booksRepository';
import { ReadingSessionsRepository } from '@/db/repositories/readingSessionsRepository';
import { ReadingLogsRepository } from '@/db/repositories/readingLogsRepository';
import { BookLoansRepository } from '@/db/repositories/bookLoansRepository';
import { ShelvesRepository } from '@/db/repositories/shelvesRepository';
import { Book } from '@/db/schema/books';
import { ReadingSession } from '@/db/schema/readingSessions';
import { BookLoan } from '@/db/schema/bookLoans';
import { ReadingLog } from '@/db/schema/readingLogs';
import { Shelf } from '@/db/schema/shelves';
import {
  calculateStreakAndHeatmap,
  calculateReaderVelocity,
} from '@/features/goals-analytics/services/forecastingService';
import { evaluateTbrCandidates } from '@/features/shelves/services/tbrRouletteService';
import {
  ReadingTimerModal,
  SavedSessionData,
} from '@/features/reading-tracker/components/ReadingTimerModal';
import { ManualReadingLogModal } from '@/features/reading-tracker/components/ManualReadingLogModal';
import { TbrRouletteModal } from '@/features/shelves/components/TbrRouletteModal';
import { CloudSyncAndSettingsModal } from '@/features/cloud-sync/components/CloudSyncAndSettingsModal';
import { wipeAllUserDataPermanently } from '@/features/cloud-sync/services/privacyDataWipeService';
import { colors } from '@/core/theme/colors';
import { SafeButton } from '@/shared/components/SafeButton';

const { width } = Dimensions.get('window');

function parseFirstAuthor(authorsJson?: string | null): string {
  if (!authorsJson) return 'Autor desconocido';
  try {
    const list = JSON.parse(authorsJson);
    if (Array.isArray(list) && list.length > 0) {
      return list[0];
    }
  } catch {
    // fallback seguro
  }
  return 'Autor desconocido';
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Buenos días';
  if (hour < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

function getTodayLocalDate(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export default function DashboardScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [booksList, setBooksList] = useState<Book[]>([]);
  const [sessionsList, setSessionsList] = useState<ReadingSession[]>([]);
  const [logsList, setLogsList] = useState<ReadingLog[]>([]);
  const [shelvesList, setShelvesList] = useState<Shelf[]>([]);
  const [activeLoansList, setActiveLoansList] = useState<BookLoan[]>([]);

  // Modales
  const [isTimerModalVisible, setIsTimerModalVisible] = useState(false);
  const [isManualModalVisible, setIsManualModalVisible] = useState(false);
  const [isRouletteModalVisible, setIsRouletteModalVisible] = useState(false);
  const [isCloudModalVisible, setIsCloudModalVisible] = useState(false);

  // Filtros de la Ruleta TBR
  const [rouletteModality, setRouletteModality] = useState<'ALL' | 'PHYSICAL' | 'DIGITAL'>('ALL');
  const [rouletteLength, setRouletteLength] = useState<'ANY' | 'SHORT' | 'LONG'>('ANY');

  // Carga reactiva de datos del dashboard
  const loadDashboardData = useCallback(async () => {
    try {
      const [allBooks, allSessions, allLogs, allLoans, allShelves] = await Promise.all([
        BooksRepository.getAll(),
        ReadingSessionsRepository.getAll(),
        ReadingLogsRepository.getAll(),
        BookLoansRepository.getAll(),
        ShelvesRepository.getAll(),
      ]);

      setBooksList(allBooks);
      setSessionsList(allSessions);
      setLogsList(allLogs);
      setActiveLoansList(allLoans.filter((loan) => loan.returnedAt === null));
      setShelvesList(allShelves);
    } catch {
      // Manejo silencioso y seguro
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    loadDashboardData();
  }, [loadDashboardData]);

  // Libro activo principal (el que se está leyendo con actualización más reciente)
  const currentlyReadingBooks = useMemo(() => {
    return booksList
      .filter((b) => b.currentStatus === 'LEYENDO')
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }, [booksList]);

  const activeBook = currentlyReadingBooks[0] || null;

  // Calculo de velocidad del lector
  const readerVelocity = useMemo(() => {
    return calculateReaderVelocity(sessionsList);
  }, [sessionsList]);

  // Calculo de racha actual
  const streakInfo = useMemo(() => {
    return calculateStreakAndHeatmap(sessionsList);
  }, [sessionsList]);

  // Estadísticas del día de hoy
  const todayStats = useMemo(() => {
    const todayIso = getTodayLocalDate();
    const todaySessions = sessionsList.filter((s) => s.localDate === todayIso);
    const totalMinutes = Math.round(
      todaySessions.reduce((acc, s) => acc + s.durationSeconds, 0) / 60
    );
    const totalPages = todaySessions.reduce((acc, s) => acc + s.pagesRead, 0);
    return {
      minutes: totalMinutes,
      pages: totalPages,
    };
  }, [sessionsList]);

  // Libros para la ruleta TBR
  const tbrCandidates = useMemo(() => {
    const minPages = rouletteLength === 'LONG' ? 300 : undefined;
    const maxPages = rouletteLength === 'SHORT' ? 299 : undefined;
    return evaluateTbrCandidates(booksList, logsList, {
      modality: rouletteModality,
      minPages,
      maxPages,
    });
  }, [booksList, logsList, rouletteModality, rouletteLength]);

  // Libros pendientes o en mesita de noche
  const bedsideBooks = useMemo(() => {
    if (currentlyReadingBooks.length > 1) {
      return currentlyReadingBooks.slice(1);
    }
    return booksList.filter((b) => b.currentStatus === 'POR_LEER').slice(0, 3);
  }, [currentlyReadingBooks, booksList]);

  // Guardar sesión con cronómetro
  const handleSaveTimedSession = async (data: SavedSessionData) => {
    if (!activeBook) return;
    try {
      await ReadingSessionsRepository.createTimedSession({
        bookId: activeBook.id,
        startPage: data.startPage,
        endPage: data.endPage,
        durationSeconds: data.durationSeconds,
        startedAtEpochMs: data.startedAtEpochMs,
        localDateOverride: data.localDate,
        outlierResolution:
          data.outlierResolution === 'NORMAL' ? 'NONE' : data.outlierResolution,
        averageSpeedPagesPerHour: data.speedPagesPerHour,
      });
      setIsTimerModalVisible(false);
      await loadDashboardData();
    } catch {
      Alert.alert('Error', 'No se pudo guardar la sesión de lectura');
    }
  };

  // Guardar avance de lectura manual
  const handleSaveManualProgress = async (params: {
    newPage: number;
    when: 'TODAY' | 'YESTERDAY';
    isFinished: boolean;
  }) => {
    if (!activeBook) return;
    try {
      await BooksRepository.updateReadingProgress({
        bookId: activeBook.id,
        currentUnit: params.newPage,
        when: params.when,
      });
      setIsManualModalVisible(false);
      await loadDashboardData();
    } catch {
      Alert.alert('Error', 'No se pudo registrar el avance de lectura');
    }
  };

  // Manejo de seleccion de ganador en ruleta TBR
  const handleStartReadingWinner = async (winner: Book) => {
    try {
      await ReadingLogsRepository.startReading(winner.id);
      setIsRouletteModalVisible(false);
      router.push(`/book/${winner.id}`);
    } catch {
      Alert.alert('Error', 'No se pudo iniciar la lectura del libro seleccionado');
    }
  };

  // Borrado permanente de datos
  const handleWipeAllData = async () => {
    try {
      await wipeAllUserDataPermanently();
      setIsCloudModalVisible(false);
      await loadDashboardData();
      Alert.alert(
        'Datos eliminados',
        'Se han restablecido todos los registros locales de tu biblioteca.'
      );
    } catch {
      Alert.alert('Error', 'No se pudieron eliminar los datos');
    }
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* Cabecera del Dashboard */}
      <View style={styles.headerContainer}>
        <View style={styles.greetingCol}>
          <Text style={styles.greetingTitle} numberOfLines={1}>
            {getGreeting()}
          </Text>
          <Text style={styles.greetingSubtitle} numberOfLines={1}>
            ¿Listo para continuar tu lectura?
          </Text>
        </View>

        <Pressable
          onPress={() => setIsCloudModalVisible(true)}
          style={styles.headerIconButton}
          accessibilityRole="button"
          accessibilityLabel="Abrir opciones de respaldo y cuenta"
        >
          <Cloud size={20} color={colors.light.primary} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 90 },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            colors={[colors.light.primary]}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* HERO CARD: Libro Activo o Mesita Despejada */}
        {activeBook ? (
          <View style={styles.heroCard}>
            <View style={styles.heroBadgeRow}>
              <View style={styles.heroStatusPill}>
                <View style={styles.pulsingDot} />
                <Text style={styles.heroStatusText}>Lectura en curso</Text>
              </View>

              <View style={styles.formatBadge}>
                {activeBook.modality === 'DIGITAL' ? (
                  <Smartphone size={12} color={colors.light.textMuted} />
                ) : (
                  <BookOpen size={12} color={colors.light.textMuted} />
                )}
                <Text style={styles.formatBadgeText}>
                  {activeBook.modality === 'DIGITAL' ? 'eBook Digital' : 'Libro Físico'}
                </Text>
              </View>
            </View>

            <Pressable
              onPress={() => router.push(`/book/${activeBook.id}`)}
              style={styles.heroMainRow}
            >
              {activeBook.coverUri ? (
                <Image
                  source={{ uri: activeBook.coverUri }}
                  style={styles.heroCover}
                  resizeMode="cover"
                />
              ) : (
                <View style={styles.heroCoverPlaceholder}>
                  <BookOpen size={28} color={colors.light.primary} />
                </View>
              )}

              <View style={styles.heroInfoCol}>
                <Text style={styles.heroTitle} numberOfLines={2}>
                  {activeBook.title}
                </Text>
                <Text style={styles.heroAuthor} numberOfLines={1}>
                  {parseFirstAuthor(activeBook.authorsJson)}
                </Text>

                {/* Progreso */}
                <View style={styles.heroProgressSection}>
                  <View style={styles.heroProgressLabelRow}>
                    <Text style={styles.heroProgressLabel}>
                      Página {activeBook.currentPage ?? 0}
                      {activeBook.pageCount > 0 ? ` de ${activeBook.pageCount}` : ''}
                    </Text>
                    <Text style={styles.heroProgressPercentage}>
                      {activeBook.currentPercentage ?? 0}%
                    </Text>
                  </View>

                  <View style={styles.heroProgressBarBg}>
                    <View
                      style={[
                        styles.heroProgressBarFill,
                        { width: `${Math.min(100, activeBook.currentPercentage ?? 0)}%` },
                      ]}
                    />
                  </View>
                </View>
              </View>
            </Pressable>

            {/* Acciones principales de 1 toque */}
            <View style={styles.heroActionsRow}>
              <SafeButton
                onPress={() => setIsTimerModalVisible(true)}
                style={styles.heroContinueButton}
              >
                <Play size={18} color="#ffffff" fill="#ffffff" />
                <Text style={styles.heroContinueButtonText}>Continuar Leyendo</Text>
              </SafeButton>

              <Pressable
                onPress={() => setIsManualModalVisible(true)}
                style={styles.heroAdvanceButton}
                accessibilityRole="button"
                accessibilityLabel="Avanzar páginas manualmente"
              >
                <CheckCircle size={18} color={colors.light.primary} />
                <Text style={styles.heroAdvanceButtonText}>Avanzar</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <View style={styles.idleCard}>
            <View style={styles.idleIconCircle}>
              <BookOpen size={28} color={colors.light.primary} />
            </View>
            <Text style={styles.idleTitle}>Tu mesita de noche está despejada</Text>
            <Text style={styles.idleSubtitle}>
              No tienes ninguna lectura en curso en este momento. Elige un libro de tu estantería o déjate guiar por la ruleta.
            </Text>

            <View style={styles.idleButtonsRow}>
              <SafeButton
                onPress={() => setIsRouletteModalVisible(true)}
                style={styles.idlePrimaryButton}
              >
                <Compass size={16} color="#ffffff" />
                <Text style={styles.idlePrimaryButtonText}>Elegir qué leer hoy</Text>
              </SafeButton>

              <Pressable
                onPress={() => router.push('/library')}
                style={styles.idleSecondaryButton}
              >
                <Text style={styles.idleSecondaryButtonText}>Explorar mi librero</Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* ACCIONES RÁPIDAS: Cuadrícula ergonómica de 4 atajos */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionHeaderTitle}>Acciones Rápidas</Text>
        </View>

        <View style={styles.shortcutsGrid}>
          {/* Atajo 1: Avanzar Páginas */}
          <Pressable
            onPress={() => {
              if (activeBook) {
                setIsManualModalVisible(true);
              } else {
                Alert.alert(
                  'Sin lectura activa',
                  'Inicia la lectura de un libro desde tu estantería para registrar avances.'
                );
              }
            }}
            style={styles.shortcutCard}
            accessibilityRole="button"
          >
            <View style={[styles.shortcutIconCircle, { backgroundColor: '#eef6f1' }]}>
              <CheckSquare size={20} color={colors.light.primary} />
            </View>
            <Text style={styles.shortcutTitle}>Avanzar Páginas</Text>
            <Text style={styles.shortcutSubtitle}>Registro manual</Text>
          </Pressable>

          {/* Atajo 2: Capturar Frase (OCR) */}
          <Pressable
            onPress={() => {
              if (activeBook) {
                router.push({
                  pathname: '/book/[id]',
                  params: { id: activeBook.id, openOcr: 'true' },
                });
              } else {
                router.push('/library');
              }
            }}
            style={styles.shortcutCard}
            accessibilityRole="button"
          >
            <View style={[styles.shortcutIconCircle, { backgroundColor: '#fef3e7' }]}>
              <Sparkles size={20} color="#b45309" />
            </View>
            <Text style={styles.shortcutTitle}>Capturar Frase</Text>
            <Text style={styles.shortcutSubtitle}>Cita con cámara</Text>
          </Pressable>

          {/* Atajo 3: Libros Por Leer */}
          <Pressable
            onPress={() => {
              router.push({
                pathname: '/library',
                params: { filter: 'WISHLIST' },
              });
            }}
            style={styles.shortcutCard}
            accessibilityRole="button"
          >
            <View style={[styles.shortcutIconCircle, { backgroundColor: '#eff6ff' }]}>
              <Bookmark size={20} color="#2563eb" />
            </View>
            <Text style={styles.shortcutTitle}>Libros Por Leer</Text>
            <Text style={styles.shortcutSubtitle}>Cola de pendientes</Text>
          </Pressable>

          {/* Atajo 4: Ruleta TBR */}
          <Pressable
            onPress={() => setIsRouletteModalVisible(true)}
            style={styles.shortcutCard}
            accessibilityRole="button"
          >
            <View style={[styles.shortcutIconCircle, { backgroundColor: '#fdf2f8' }]}>
              <Compass size={20} color="#be185d" />
            </View>
            <Text style={styles.shortcutTitle}>¿Qué leo hoy?</Text>
            <Text style={styles.shortcutSubtitle}>Sugerencia al azar</Text>
          </Pressable>
        </View>

        {/* WIDGET DE RACHA Y TIEMPO DE HOY */}
        <Pressable
          onPress={() => router.push('/stats')}
          style={styles.streakWidgetCard}
          accessibilityRole="button"
          accessibilityLabel="Ver estadísticas detalladas de lectura"
        >
          <View style={styles.streakLeftCol}>
            <View style={styles.streakIconCircle}>
              <Flame size={22} color="#ea580c" />
            </View>
            <View style={styles.streakTextCol}>
              <Text style={styles.streakTitle}>
                {streakInfo.currentStreakDays > 0
                  ? `${streakInfo.currentStreakDays} días seguidos`
                  : 'Comienza tu racha hoy'}
              </Text>
              <Text style={styles.streakSubtitle}>
                {todayStats.minutes > 0
                  ? `${todayStats.minutes} min leídos hoy · ${todayStats.pages} páginas`
                  : 'Registra una sesión de lectura hoy para sumar a tu racha'}
              </Text>
            </View>
          </View>
          <ChevronRight size={18} color={colors.light.textMuted} />
        </Pressable>

        {/* ALERTA DE PRÉSTAMOS ACTIVOS (Condicional) */}
        {activeLoansList.length > 0 && (
          <Pressable
            onPress={() => router.push('/library')}
            style={styles.loansAlertCard}
            accessibilityRole="button"
          >
            <View style={styles.loansAlertLeft}>
              <BookMarked size={20} color="#b45309" />
              <View style={styles.loansAlertTextCol}>
                <Text style={styles.loansAlertTitle}>
                  {activeLoansList.length === 1
                    ? 'Tienes 1 libro prestado'
                    : `Tienes ${activeLoansList.length} libros prestados`}
                </Text>
                <Text style={styles.loansAlertSubtitle}>
                  {activeLoansList[0].borrowerName
                    ? `Prestado a ${activeLoansList[0].borrowerName}`
                    : 'Revisa tus préstamos activos en tu estantería'}
                </Text>
              </View>
            </View>
            <ChevronRight size={18} color="#b45309" />
          </Pressable>
        )}

        {/* SECCIÓN: EN MI MESITA DE NOCHE */}
        {bedsideBooks.length > 0 && (
          <View style={styles.bedsideSection}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionHeaderTitle}>En mi mesita de noche</Text>
              <Pressable
                onPress={() => router.push('/library')}
                style={styles.seeAllButton}
              >
                <Text style={styles.seeAllButtonText}>Ver todo</Text>
                <ArrowRight size={14} color={colors.light.primary} />
              </Pressable>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.bedsideScroll}
            >
              {bedsideBooks.map((book) => (
                <Pressable
                  key={book.id}
                  onPress={() => router.push(`/book/${book.id}`)}
                  style={styles.bedsideBookCard}
                >
                  {book.coverUri ? (
                    <Image
                      source={{ uri: book.coverUri }}
                      style={styles.bedsideBookCover}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={styles.bedsideBookCoverPlaceholder}>
                      <BookOpen size={20} color={colors.light.primary} />
                    </View>
                  )}
                  <Text style={styles.bedsideBookTitle} numberOfLines={1}>
                    {book.title}
                  </Text>
                  <Text style={styles.bedsideBookAuthor} numberOfLines={1}>
                    {parseFirstAuthor(book.authorsJson)}
                  </Text>
                  <Text style={styles.bedsideBookStatus}>
                    {book.currentStatus === 'LEYENDO'
                      ? `${book.currentPercentage ?? 0}% leído`
                      : 'Por leer'}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}
      </ScrollView>

      {/* MODALES DEL DASHBOARD */}

      {/* Modal 1: Cronómetro en tiempo real */}
      {activeBook && (
        <ReadingTimerModal
          visible={isTimerModalVisible}
          book={activeBook}
          userAverageSpeed={readerVelocity.pagesPerHour}
          onClose={() => setIsTimerModalVisible(false)}
          onSaveSession={handleSaveTimedSession}
        />
      )}

      {/* Modal 2: Registro de avance manual */}
      {activeBook && (
        <ManualReadingLogModal
          visible={isManualModalVisible}
          book={activeBook}
          onClose={() => setIsManualModalVisible(false)}
          onSaveProgress={handleSaveManualProgress}
        />
      )}

      {/* Modal 3: Ruleta TBR */}
      <TbrRouletteModal
        visible={isRouletteModalVisible}
        eligibleBooks={tbrCandidates.eligible}
        blockedSequels={tbrCandidates.blockedSequels}
        shelves={shelvesList}
        modalityFilter={rouletteModality}
        lengthFilter={rouletteLength}
        onChangeModality={setRouletteModality}
        onChangeLength={setRouletteLength}
        onClose={() => setIsRouletteModalVisible(false)}
        onStartReadingWinner={handleStartReadingWinner}
      />

      {/* Modal 4: Respaldo y Configuración */}
      <CloudSyncAndSettingsModal
        visible={isCloudModalVisible}
        onClose={() => setIsCloudModalVisible(false)}
        backupSummary={{
          booksCount: booksList.length,
          sessionsCount: sessionsList.length,
          quotesCount: 0,
        }}
        onWipeAllData={handleWipeAllData}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.light.background,
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 12,
  },
  greetingCol: {
    flex: 1,
    marginRight: 12,
  },
  greetingTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.light.text,
    letterSpacing: -0.3,
  },
  greetingSubtitle: {
    fontSize: 13,
    color: colors.light.textMuted,
    marginTop: 2,
    fontWeight: '500',
  },
  headerIconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.light.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.light.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  heroCard: {
    backgroundColor: colors.light.surface,
    borderRadius: 20,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: colors.light.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  heroBadgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  heroStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eef6f1',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 6,
  },
  pulsingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.light.primary,
  },
  heroStatusText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.light.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  formatBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  formatBadgeText: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.light.textMuted,
  },
  heroMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  heroCover: {
    width: 68,
    height: 100,
    borderRadius: 8,
    backgroundColor: colors.light.surfaceAlt,
  },
  heroCoverPlaceholder: {
    width: 68,
    height: 100,
    borderRadius: 8,
    backgroundColor: colors.light.surfaceAlt,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroInfoCol: {
    flex: 1,
    marginLeft: 14,
  },
  heroTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.light.text,
    lineHeight: 22,
  },
  heroAuthor: {
    fontSize: 13,
    color: colors.light.textMuted,
    marginTop: 2,
    fontWeight: '500',
  },
  heroProgressSection: {
    marginTop: 10,
  },
  heroProgressLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  heroProgressLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.light.textMuted,
  },
  heroProgressPercentage: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.light.primary,
  },
  heroProgressBarBg: {
    height: 6,
    backgroundColor: colors.light.border,
    borderRadius: 3,
    overflow: 'hidden',
  },
  heroProgressBarFill: {
    height: '100%',
    backgroundColor: colors.light.primary,
    borderRadius: 3,
  },
  heroActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  heroContinueButton: {
    flex: 1,
    backgroundColor: colors.light.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 14,
    gap: 8,
  },
  heroContinueButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  heroAdvanceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.light.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.light.border,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 14,
    gap: 6,
  },
  heroAdvanceButtonText: {
    color: colors.light.primary,
    fontSize: 13,
    fontWeight: '700',
  },
  idleCard: {
    backgroundColor: colors.light.surface,
    borderRadius: 20,
    padding: 24,
    marginBottom: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.light.border,
  },
  idleIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#eef6f1',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  idleTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.light.text,
    textAlign: 'center',
    marginBottom: 6,
  },
  idleSubtitle: {
    fontSize: 13,
    color: colors.light.textMuted,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16,
  },
  idleButtonsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  idlePrimaryButton: {
    backgroundColor: colors.light.primary,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    gap: 6,
  },
  idlePrimaryButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  idleSecondaryButton: {
    backgroundColor: colors.light.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.light.border,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    justifyContent: 'center',
  },
  idleSecondaryButtonText: {
    color: colors.light.text,
    fontSize: 13,
    fontWeight: '600',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionHeaderTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.light.text,
  },
  shortcutsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 20,
  },
  shortcutCard: {
    width: (width - 50) / 2,
    backgroundColor: colors.light.surface,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.light.border,
  },
  shortcutIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  shortcutTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.light.text,
  },
  shortcutSubtitle: {
    fontSize: 11,
    color: colors.light.textMuted,
    marginTop: 2,
  },
  streakWidgetCard: {
    backgroundColor: colors.light.surface,
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.light.border,
    marginBottom: 16,
  },
  streakLeftCol: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  streakIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#fff7ed',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  streakTextCol: {
    flex: 1,
  },
  streakTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.light.text,
  },
  streakSubtitle: {
    fontSize: 11,
    color: colors.light.textMuted,
    marginTop: 2,
  },
  loansAlertCard: {
    backgroundColor: '#fffbeb',
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#fef3c7',
    marginBottom: 16,
  },
  loansAlertLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  loansAlertTextCol: {
    flex: 1,
    marginLeft: 10,
  },
  loansAlertTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#92400e',
  },
  loansAlertSubtitle: {
    fontSize: 11,
    color: '#b45309',
    marginTop: 2,
  },
  bedsideSection: {
    marginTop: 4,
    marginBottom: 10,
  },
  seeAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  seeAllButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.light.primary,
  },
  bedsideScroll: {
    gap: 12,
    paddingRight: 20,
  },
  bedsideBookCard: {
    width: 100,
  },
  bedsideBookCover: {
    width: 100,
    height: 140,
    borderRadius: 8,
    backgroundColor: colors.light.surfaceAlt,
    marginBottom: 6,
  },
  bedsideBookCoverPlaceholder: {
    width: 100,
    height: 140,
    borderRadius: 8,
    backgroundColor: colors.light.surfaceAlt,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  bedsideBookTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.light.text,
  },
  bedsideBookAuthor: {
    fontSize: 11,
    color: colors.light.textMuted,
    marginTop: 1,
  },
  bedsideBookStatus: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.light.primary,
    marginTop: 2,
  },
});
