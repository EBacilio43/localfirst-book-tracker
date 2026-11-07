import React, { useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  Animated,
  Dimensions,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { colors } from '@/core/theme/colors';

const { width } = Dimensions.get('window');
const COLUMN_WIDTH = (width - 48) / 2;

export interface SkeletonBoxProps {
  width?: number | `${number}%`;
  height: number;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * Bloque base con animación de pulso suave para estados de carga editoriales.
 */
export const SkeletonBox: React.FC<SkeletonBoxProps> = ({
  width: boxWidth = '100%',
  height,
  borderRadius = 8,
  style,
}) => {
  const opacity = useRef(new Animated.Value(0.45)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.9,
          duration: 750,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.45,
          duration: 750,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        styles.baseBox,
        {
          width: boxWidth,
          height,
          borderRadius,
          opacity,
        },
        style,
      ]}
    />
  );
};

/**
 * Skeleton para la cuadrícula de portadas en Mi Librero (proporción 2:3).
 */
export const LibraryGridSkeleton: React.FC<{ count?: number }> = ({ count = 6 }) => {
  const items = Array.from({ length: count }, (_, idx) => idx);

  return (
    <View style={styles.gridContainer} testID="library-grid-skeleton">
      {items.map((item) => (
        <View key={item} style={styles.bookCardSkeleton}>
          <SkeletonBox
            width={COLUMN_WIDTH}
            height={COLUMN_WIDTH * 1.5}
            borderRadius={10}
          />
          <SkeletonBox
            width="85%"
            height={14}
            borderRadius={6}
            style={styles.mt8}
          />
          <SkeletonBox
            width="60%"
            height={12}
            borderRadius={5}
            style={styles.mt6}
          />
        </View>
      ))}
    </View>
  );
};

/**
 * Skeleton para la pantalla de detalle de un libro (app/book/[id].tsx).
 */
export const BookDetailSkeleton: React.FC = () => {
  return (
    <View style={styles.detailContainer} testID="book-detail-skeleton">
      <View style={styles.detailCoverSection}>
        <SkeletonBox width={150} height={225} borderRadius={12} />
        <SkeletonBox width="75%" height={22} borderRadius={8} style={styles.mt16} />
        <SkeletonBox width="45%" height={16} borderRadius={6} style={styles.mt8} />
        <View style={styles.badgesSkeletonRow}>
          <SkeletonBox width={88} height={26} borderRadius={8} />
          <SkeletonBox width={74} height={26} borderRadius={8} />
          <SkeletonBox width={96} height={26} borderRadius={8} />
        </View>
      </View>

      <View style={styles.cardSkeleton}>
        <SkeletonBox width="50%" height={16} borderRadius={6} />
        <SkeletonBox width="100%" height={10} borderRadius={999} style={styles.mt12} />
        <SkeletonBox width="100%" height={46} borderRadius={12} style={styles.mt12} />
      </View>

      <View style={styles.cardSkeleton}>
        <SkeletonBox width="42%" height={16} borderRadius={6} />
        <SkeletonBox width="90%" height={14} borderRadius={6} style={styles.mt12} />
        <SkeletonBox width="65%" height={14} borderRadius={6} style={styles.mt8} />
      </View>
    </View>
  );
};

/**
 * Skeleton para filas de resultados en la pantalla de búsqueda.
 */
export const SearchListSkeleton: React.FC<{ count?: number }> = ({ count = 5 }) => {
  const rows = Array.from({ length: count }, (_, idx) => idx);

  return (
    <View style={styles.searchListContainer} testID="search-list-skeleton">
      {rows.map((row) => (
        <View key={row} style={styles.searchRowSkeleton}>
          <SkeletonBox width={52} height={76} borderRadius={6} />
          <View style={styles.searchInfoCol}>
            <SkeletonBox width="80%" height={15} borderRadius={6} />
            <SkeletonBox width="50%" height={13} borderRadius={5} style={styles.mt6} />
            <SkeletonBox width="35%" height={12} borderRadius={4} style={styles.mt8} />
          </View>
        </View>
      ))}
    </View>
  );
};

/**
 * Skeleton para la carga inicial del panel de Metas, Predicciones y Estadísticas.
 */
export const StatsDashboardSkeleton: React.FC = () => {
  return (
    <View style={styles.statsContainer} testID="stats-dashboard-skeleton">
      {/* Cabecera y badge superior */}
      <View style={styles.statsHeaderRow}>
        <View style={styles.statsHeaderCol}>
          <SkeletonBox width={160} height={24} borderRadius={6} />
          <SkeletonBox width={210} height={14} borderRadius={5} style={styles.mt6} />
        </View>
        <SkeletonBox width={90} height={28} borderRadius={999} />
      </View>

      {/* Selector de pestañas / segmentos */}
      <SkeletonBox width="100%" height={40} borderRadius={12} style={styles.mt8} />

      {/* Tarjeta principal de progreso de meta anual / mensual */}
      <View style={styles.cardSkeleton}>
        <View style={styles.rowBetween}>
          <SkeletonBox width={150} height={18} borderRadius={6} />
          <SkeletonBox width={85} height={22} borderRadius={999} />
        </View>
        <SkeletonBox width="100%" height={10} borderRadius={999} style={styles.mt12} />
        <View style={styles.kpiGridSkeleton}>
          <View style={styles.kpiItemSkeleton}>
            <SkeletonBox width={72} height={12} borderRadius={4} />
            <SkeletonBox width={64} height={20} borderRadius={6} style={styles.mt6} />
            <SkeletonBox width={96} height={12} borderRadius={4} style={styles.mt6} />
          </View>
          <View style={styles.kpiItemSkeleton}>
            <SkeletonBox width={72} height={12} borderRadius={4} />
            <SkeletonBox width={64} height={20} borderRadius={6} style={styles.mt6} />
            <SkeletonBox width={96} height={12} borderRadius={4} style={styles.mt6} />
          </View>
        </View>
      </View>

      {/* Tira de Racha, Récord y Escudo */}
      <View style={styles.streakStripSkeleton}>
        <View style={styles.streakBadgeSkeleton}>
          <SkeletonBox width={32} height={32} borderRadius={10} />
          <View style={styles.searchInfoCol}>
            <SkeletonBox width={34} height={16} borderRadius={4} />
            <SkeletonBox width={46} height={12} borderRadius={4} style={styles.mt6} />
          </View>
        </View>
        <View style={styles.streakBadgeSkeleton}>
          <SkeletonBox width={32} height={32} borderRadius={10} />
          <View style={styles.searchInfoCol}>
            <SkeletonBox width={34} height={16} borderRadius={4} />
            <SkeletonBox width={46} height={12} borderRadius={4} style={styles.mt6} />
          </View>
        </View>
        <View style={styles.streakBadgeSkeleton}>
          <SkeletonBox width={32} height={32} borderRadius={10} />
          <View style={styles.searchInfoCol}>
            <SkeletonBox width={34} height={16} borderRadius={4} />
            <SkeletonBox width={46} height={12} borderRadius={4} style={styles.mt6} />
          </View>
        </View>
      </View>

      {/* Cuadrícula de actividad / Mapa de calor */}
      <View style={styles.cardSkeleton}>
        <View style={styles.rowBetween}>
          <SkeletonBox width={140} height={16} borderRadius={6} />
          <SkeletonBox width={80} height={16} borderRadius={6} />
        </View>
        <View style={styles.heatmapSkeleton}>
          {Array.from({ length: 4 }).map((_, rIdx) => (
            <View key={rIdx} style={styles.heatmapRowSkeleton}>
              <SkeletonBox width={56} height={26} borderRadius={6} />
              {Array.from({ length: 7 }).map((_, cIdx) => (
                <SkeletonBox key={cIdx} width={28} height={28} borderRadius={6} />
              ))}
            </View>
          ))}
        </View>
      </View>
    </View>
  );
};

/**
 * Skeleton para las tarjetas de candidatos del Detective Literario IA.
 * Respeta la geometria exacta: portada 2:3 (68x102), insignia de coincidencia, titulo/autor y bloque de explicacion sin spoilers.
 */
export const AiDetectiveSkeleton: React.FC<{ count?: number }> = ({ count = 3 }) => {
  const items = Array.from({ length: count }, (_, idx) => idx);

  return (
    <View style={styles.aiDetectiveContainer} testID="ai-detective-skeleton">
      {items.map((item) => (
        <View key={item} style={styles.aiCandidateCardSkeleton}>
          {/* Miniatura de portada 2:3 de 68x102 */}
          <SkeletonBox width={68} height={102} borderRadius={8} />

          {/* Columna con insignia, titulo, autor y bloque de explicacion */}
          <View style={styles.aiCandidateContentCol}>
            {/* Insignia de coincidencia y status */}
            <View style={styles.aiHeaderRowSkeleton}>
              <SkeletonBox width={76} height={20} borderRadius={999} />
              <SkeletonBox width={64} height={16} borderRadius={4} />
            </View>

            {/* Titulo y autor */}
            <SkeletonBox width="88%" height={16} borderRadius={6} style={styles.mt6} />
            <SkeletonBox width="55%" height={13} borderRadius={5} style={styles.mt6} />

            {/* Bloque de explicacion sin spoilers */}
            <View style={styles.aiReasonBlockSkeleton}>
              <SkeletonBox width="100%" height={12} borderRadius={4} />
              <SkeletonBox width="80%" height={12} borderRadius={4} style={styles.mt4} />
            </View>
          </View>
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  baseBox: {
    backgroundColor: colors.light.border,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  bookCardSkeleton: {
    width: COLUMN_WIDTH,
    marginBottom: 8,
  },
  detailContainer: {
    padding: 20,
    gap: 20,
  },
  detailCoverSection: {
    alignItems: 'center',
  },
  badgesSkeletonRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  cardSkeleton: {
    backgroundColor: colors.light.surface,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.light.border,
  },
  searchListContainer: {
    padding: 16,
    gap: 12,
  },
  searchRowSkeleton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.light.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.light.border,
    padding: 10,
  },
  searchInfoCol: {
    flex: 1,
  },
  mt6: {
    marginTop: 6,
  },
  mt8: {
    marginTop: 8,
  },
  mt12: {
    marginTop: 12,
  },
  mt16: {
    marginTop: 16,
  },
  statsContainer: {
    padding: 16,
    gap: 14,
  },
  statsHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  statsHeaderCol: {
    flex: 1,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  kpiGridSkeleton: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  kpiItemSkeleton: {
    flex: 1,
    backgroundColor: colors.light.surfaceAlt,
    borderRadius: 12,
    padding: 10,
  },
  streakStripSkeleton: {
    flexDirection: 'row',
    gap: 8,
  },
  streakBadgeSkeleton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.light.surface,
    borderRadius: 14,
    padding: 10,
    borderWidth: 1,
    borderColor: colors.light.border,
  },
  heatmapSkeleton: {
    marginTop: 12,
    gap: 6,
  },
  heatmapRowSkeleton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 4,
  },
  aiDetectiveContainer: {
    padding: 16,
    gap: 14,
  },
  aiCandidateCardSkeleton: {
    flexDirection: 'row',
    backgroundColor: colors.light.surface,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.light.border,
    gap: 12,
    alignItems: 'flex-start',
  },
  aiCandidateContentCol: {
    flex: 1,
  },
  aiHeaderRowSkeleton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  aiReasonBlockSkeleton: {
    marginTop: 8,
    padding: 8,
    backgroundColor: colors.light.surfaceAlt,
    borderRadius: 8,
  },
  mt4: {
    marginTop: 4,
  },
});

