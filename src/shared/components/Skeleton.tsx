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
});

