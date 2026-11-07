import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Clock, Calendar, Sparkles, CheckCircle, Info } from 'lucide-react-native';
import { colors } from '@/core/theme/colors';
import { SafeButton } from '@/shared/components/SafeButton';
import { Book } from '@/db/schema/books';

export interface BookCompletionEtaCardProps {
  book: Book;
  pagesPerHour: number;
  pagesPerDay: number;
  isColdStart: boolean;
  onOpenTimer: () => void;
}

function padTwo(n: number): string {
  return String(n).padStart(2, '0');
}

function formatEtaDate(date: Date): string {
  const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

  const dayName = dayNames[date.getDay()];
  const day = padTwo(date.getDate());
  const monthName = months[date.getMonth()];

  return `${dayName} ${day} ${monthName}`;
}

function formatHoursMinutes(hoursTotal: number): string {
  const safeHours = Math.max(0, hoursTotal);
  const totalMinutes = Math.round(safeHours * 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes} min`;
}

export const BookCompletionEtaCard: React.FC<BookCompletionEtaCardProps> = ({
  book,
  pagesPerHour,
  pagesPerDay,
  isColdStart,
  onOpenTimer,
}) => {
  const pageCount = book.pageCount || 0;
  const currentPage = book.currentPage || 0;

  // Cálculo de páginas restantes y porcentaje de avance
  const { remainingPages, progressPct, isCompleted } = useMemo(() => {
    let pagesLeft = 0;
    let pct = 0;

    if (book.progressMode === 'PERCENTAGE') {
      pct = Math.min(100, Math.max(0, book.currentPercentage || 0));
      if (pageCount > 0) {
        const equivRead = Math.round((pct / 100) * pageCount);
        pagesLeft = Math.max(0, pageCount - equivRead);
      } else {
        pagesLeft = 0;
      }
    } else {
      pagesLeft = pageCount > 0 ? Math.max(0, pageCount - currentPage) : 0;
      pct = pageCount > 0 ? Math.min(100, Math.max(0, Math.round((currentPage / pageCount) * 1000) / 10)) : 0;
    }

    const completed =
      book.currentStatus === 'LEIDO' ||
      pct >= 100 ||
      (pageCount > 0 && pagesLeft === 0);

    return {
      remainingPages: pagesLeft,
      progressPct: pct,
      isCompleted: completed,
    };
  }, [book.progressMode, book.currentPercentage, book.currentPage, book.currentStatus, pageCount, currentPage]);

  // Constantes de arranque en frío o velocidad del usuario
  const effectiveSpeed = useMemo(() => {
    if (pagesPerHour > 0) return pagesPerHour;
    return isColdStart ? 25 : 25;
  }, [pagesPerHour, isColdStart]);

  const effectiveDailyPace = useMemo(() => {
    if (pagesPerDay > 0) return pagesPerDay;
    return isColdStart ? 20 : 20;
  }, [pagesPerDay, isColdStart]);

  // Cálculos de tiempo restante y fecha estimada
  const netHoursRemaining = effectiveSpeed > 0 ? remainingPages / effectiveSpeed : 0;
  const daysRemaining = effectiveDailyPace > 0 ? Math.ceil(remainingPages / effectiveDailyPace) : 0;

  const estimatedFinishDate = useMemo(() => {
    const target = new Date();
    target.setDate(target.getDate() + daysRemaining);
    return formatEtaDate(target);
  }, [daysRemaining]);

  const modalityLabel = book.modality === 'DIGITAL' ? 'Digital' : 'Físico';

  return (
    <View style={styles.card} testID="book-completion-eta-card">
      {/* Encabezado con título del libro y porcentaje actual */}
      <View style={styles.headerRow}>
        <View style={styles.headerTitleCol}>
          <Text style={styles.sectionOverline}>Predicción de Finalización</Text>
          <Text style={styles.bookTitle} numberOfLines={1}>
            {book.title}
          </Text>
        </View>

        <View style={styles.badgePill}>
          <Text style={styles.badgePillText}>
            {modalityLabel} · {progressPct.toFixed(1)}%
          </Text>
        </View>
      </View>

      {/* Páginas y avance */}
      <View style={styles.pagesRow}>
        <Text style={styles.pagesText}>
          {book.progressMode === 'PERCENTAGE'
            ? `${progressPct.toFixed(1)}% completado`
            : `Pág. ${currentPage} de ${pageCount > 0 ? pageCount : '?'}`}
        </Text>
        <Text style={styles.pagesRemainingText}>
          {isCompleted ? 'Lectura completada' : `Faltan ${remainingPages} páginas`}
        </Text>
      </View>

      {/* Barra de progreso */}
      <View style={styles.progressTrack}>
        <View
          style={[
            styles.progressFill,
            { width: `${Math.min(100, Math.max(0, progressPct))}%` },
            isCompleted && styles.progressFillComplete,
          ]}
        />
      </View>

      {/* Si el libro ya está terminado */}
      {isCompleted ? (
        <View style={styles.completedBanner}>
          <CheckCircle size={18} color={colors.light.success} />
          <View style={styles.completedTextCol}>
            <Text style={styles.completedTitle}>¡Libro completado!</Text>
            <Text style={styles.completedSubtitle}>
              Completaste todas las páginas de este libro.
            </Text>
          </View>
        </View>
      ) : (
        <>
          {/* Métricas clave de predicción (Tiempo neto restante y Fecha estimada) */}
          <View style={styles.metricsGrid}>
            <View style={styles.metricCard}>
              <View style={styles.metricLabelRow}>
                <Clock size={13} color={colors.light.textMuted} />
                <Text style={styles.metricLabel}>Tiempo neto restante</Text>
              </View>
              <Text style={styles.metricValue}>
                {formatHoursMinutes(netHoursRemaining)}
              </Text>
              <Text style={styles.metricSub}>
                A {effectiveSpeed.toFixed(1)} págs/hora
              </Text>
            </View>

            <View style={styles.metricCard}>
              <View style={styles.metricLabelRow}>
                <Calendar size={13} color={colors.light.primary} />
                <Text style={styles.metricLabel}>Fecha estimada fin</Text>
              </View>
              <Text style={[styles.metricValue, styles.primaryValue]}>
                {estimatedFinishDate}
              </Text>
              <Text style={styles.metricSub}>
                En {daysRemaining} {daysRemaining === 1 ? 'día' : 'días'} (a {effectiveDailyPace.toFixed(0)} págs/día)
              </Text>
            </View>
          </View>

          {/* Insignia y nota explicativa si está en modo Cold Start (0 sesiones previas) */}
          {isColdStart && (
            <View style={styles.coldStartBanner}>
              <View style={styles.coldStartBadgeRow}>
                <Sparkles size={14} color={colors.light.gold} />
                <Text style={styles.coldStartBadgeText}>
                  Estimación inicial ({effectiveSpeed.toFixed(0)} págs/h)
                </Text>
              </View>
              <Text style={styles.coldStartNote}>
                Se calibrará con tu velocidad real tras registrar tu primera sesión con el cronómetro.
              </Text>
            </View>
          )}

          {/* Botón de acción para iniciar el cronómetro */}
          <View style={styles.actionContainer}>
            <SafeButton
              onPress={onOpenTimer}
              variant="primary"
              size="md"
              leftIcon={<Clock size={16} color="#FFFFFF" />}
              title="Iniciar sesión con cronómetro"
            />
          </View>
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.light.surface,
    borderWidth: 1,
    borderColor: colors.light.border,
    borderRadius: 18,
    padding: 16,
    gap: 12,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  headerTitleCol: {
    flex: 1,
  },
  sectionOverline: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.light.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  bookTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.light.text,
    marginTop: 2,
  },
  badgePill: {
    backgroundColor: colors.light.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.light.border,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgePillText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.light.text,
  },
  pagesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pagesText: {
    fontSize: 12,
    color: colors.light.textMuted,
  },
  pagesRemainingText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.light.text,
  },
  progressTrack: {
    height: 8,
    backgroundColor: colors.light.border,
    borderRadius: 999,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.light.primary,
    borderRadius: 999,
  },
  progressFillComplete: {
    backgroundColor: colors.light.success,
  },
  completedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.light.successBg,
    borderRadius: 12,
    padding: 12,
  },
  completedTextCol: {
    flex: 1,
  },
  completedTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.light.success,
  },
  completedSubtitle: {
    fontSize: 12,
    color: colors.light.textMuted,
    marginTop: 2,
  },
  metricsGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  metricCard: {
    flex: 1,
    backgroundColor: colors.light.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.light.border,
    borderRadius: 12,
    padding: 10,
    gap: 2,
  },
  metricLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metricLabel: {
    fontSize: 12,
    color: colors.light.textMuted,
  },
  metricValue: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.light.text,
    marginTop: 2,
  },
  primaryValue: {
    color: colors.light.primary,
  },
  metricSub: {
    fontSize: 12,
    color: colors.light.textMuted,
  },
  coldStartBanner: {
    backgroundColor: 'rgba(201, 138, 44, 0.1)',
    borderWidth: 1,
    borderColor: colors.light.gold,
    borderRadius: 12,
    padding: 10,
    gap: 4,
  },
  coldStartBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  coldStartBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.light.gold,
  },
  coldStartNote: {
    fontSize: 12,
    color: colors.light.textMuted,
    lineHeight: 16,
  },
  actionContainer: {
    marginTop: 4,
  },
});
