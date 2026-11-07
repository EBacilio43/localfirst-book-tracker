import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  Pressable,
  StyleProp,
  ViewStyle,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Star } from 'lucide-react-native';
import { colors } from '@/core/theme/colors';

export interface HalfStarRatingProps {
  value: number;
  onChange?: (newRating: number) => void;
  readOnly?: boolean;
  size?: number;
  style?: StyleProp<ViewStyle>;
  showText?: boolean;
}

const TOTAL_STARS = 5;
const DEFAULT_SIZE = 30;

export function HalfStarRating({
  value,
  onChange,
  readOnly = false,
  size = DEFAULT_SIZE,
  style,
  showText = true,
}: HalfStarRatingProps) {
  const normalizedValue = Math.max(0, Math.min(5, Math.round(value * 2) / 2));

  const handleSelectHalf = (starIndex: number) => {
    if (readOnly || !onChange) return;
    Haptics.selectionAsync().catch(() => {});
    const targetRating = starIndex - 0.5;
    // Si toca exactamente el valor actual, permite desmarcar a 0
    const nextRating = normalizedValue === targetRating ? 0 : targetRating;
    onChange(nextRating);
  };

  const handleSelectFull = (starIndex: number) => {
    if (readOnly || !onChange) return;
    Haptics.selectionAsync().catch(() => {});
    const targetRating = starIndex;
    // Si toca exactamente el valor actual, permite desmarcar a 0
    const nextRating = normalizedValue === targetRating ? 0 : targetRating;
    onChange(nextRating);
  };

  const renderStar = (starIndex: number) => {
    const isFull = normalizedValue >= starIndex;
    const isHalf = normalizedValue === starIndex - 0.5;

    return (
      <View
        key={`star-${starIndex}`}
        style={[styles.starContainer, { width: size, height: size }]}
      >
        {/* Estrella base (vacia o completa) */}
        {isFull ? (
          <Star
            size={size}
            color={colors.light.gold}
            fill={colors.light.gold}
            strokeWidth={1.5}
          />
        ) : (
          <Star
            size={size}
            color={colors.light.border}
            fill="transparent"
            strokeWidth={1.5}
          />
        )}

        {/* Capa superpuesta recortada a la mitad para estrella media */}
        {isHalf ? (
          <View
            pointerEvents="none"
            style={[
              styles.halfOverlay,
              { width: size / 2, height: size },
            ]}
          >
            <Star
              size={size}
              color={colors.light.gold}
              fill={colors.light.gold}
              strokeWidth={1.5}
            />
          </View>
        ) : null}

        {/* Zonas interactivas de toque (mitad izquierda y derecha) */}
        {!readOnly && onChange ? (
          <>
            <Pressable
              onPress={() => handleSelectHalf(starIndex)}
              hitSlop={{ top: 8, bottom: 8, left: 2, right: 0 }}
              style={styles.touchHalfLeft}
              accessibilityRole="button"
              accessibilityLabel={`${starIndex - 0.5} estrellas`}
            />
            <Pressable
              onPress={() => handleSelectFull(starIndex)}
              hitSlop={{ top: 8, bottom: 8, left: 0, right: 2 }}
              style={styles.touchHalfRight}
              accessibilityRole="button"
              accessibilityLabel={`${starIndex} estrellas`}
            />
          </>
        ) : null}
      </View>
    );
  };

  return (
    <View
      style={[styles.root, style]}
      accessibilityRole="adjustable"
      accessibilityLabel={`Calificación: ${
        normalizedValue > 0
          ? `${normalizedValue.toFixed(1)} de 5 estrellas`
          : 'Sin calificar'
      }`}
    >
      <View style={styles.starsRow}>
        {Array.from({ length: TOTAL_STARS }, (_, i) => renderStar(i + 1))}
      </View>

      {showText ? (
        <View style={styles.labelContainer}>
          <Text style={styles.labelText}>
            {normalizedValue > 0
              ? `${normalizedValue.toFixed(1)} / 5.0`
              : 'Sin calificar'}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  starsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  starContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  halfOverlay: {
    position: 'absolute',
    left: 0,
    top: 0,
    overflow: 'hidden',
  },
  touchHalfLeft: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: '50%',
    height: '100%',
    zIndex: 2,
  },
  touchHalfRight: {
    position: 'absolute',
    right: 0,
    top: 0,
    width: '50%',
    height: '100%',
    zIndex: 2,
  },
  labelContainer: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: colors.light.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.light.borderSubtle,
  },
  labelText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.light.text,
  },
});
