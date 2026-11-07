import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  ViewStyle,
  TextStyle,
  StyleProp,
} from 'react-native';
import { useSafePress } from '../hooks/useSafePress';
import { colors } from '@/core/theme/colors';

export type SafeButtonVariant = 'primary' | 'secondary' | 'accent' | 'outline' | 'ghost' | 'danger';
export type SafeButtonSize = 'sm' | 'md' | 'lg';

export interface SafeButtonProps {
  onPress: () => Promise<void> | void;
  title?: string;
  children?: React.ReactNode;
  variant?: SafeButtonVariant;
  size?: SafeButtonSize;
  disabled?: boolean;
  isLoading?: boolean;
  cooldownMs?: number;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export function SafeButton({
  onPress,
  title,
  children,
  variant = 'primary',
  size = 'md',
  disabled = false,
  isLoading = false,
  cooldownMs = 500,
  style,
  textStyle,
  leftIcon,
  rightIcon,
}: SafeButtonProps) {
  const { handlePress, isSubmitting } = useSafePress(onPress, { cooldownMs });
  const busy = isLoading || isSubmitting;
  const isButtonDisabled = disabled || busy;

  const buttonStyle = [
    styles.base,
    styles[size],
    styles[variant],
    isButtonDisabled && styles.disabled,
    style,
  ];

  const labelStyle = [
    styles.baseText,
    styles[`${size}Text`],
    styles[`${variant}Text`],
    isButtonDisabled && styles.disabledText,
    textStyle,
  ];

  return (
    <Pressable
      onPress={handlePress}
      disabled={isButtonDisabled}
      style={({ pressed }) => [
        buttonStyle,
        pressed && !isButtonDisabled && styles.pressed,
      ]}
      accessibilityRole="button"
      accessibilityState={{ disabled: isButtonDisabled, busy }}
    >
      {busy ? (
        <ActivityIndicator
          size="small"
          color={variant === 'outline' || variant === 'ghost' ? colors.light.primary : '#FFFFFF'}
        />
      ) : (
        <>
          {leftIcon}
          {title ? <Text style={labelStyle}>{title}</Text> : null}
          {children}
          {rightIcon}
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    gap: 8,
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.985 }],
  },
  disabled: {
    opacity: 0.5,
  },
  // Tamaños
  sm: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  md: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  lg: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 14,
  },
  // Variantes
  primary: {
    backgroundColor: colors.light.primary,
  },
  secondary: {
    backgroundColor: colors.light.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.light.border,
  },
  accent: {
    backgroundColor: colors.light.accent,
  },
  outline: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: colors.light.primary,
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  danger: {
    backgroundColor: colors.light.danger,
  },
  // Textos
  baseText: {
    fontWeight: '600',
  },
  smText: {
    fontSize: 13,
  },
  mdText: {
    fontSize: 15,
  },
  lgText: {
    fontSize: 16,
  },
  primaryText: {
    color: '#FFFFFF',
  },
  secondaryText: {
    color: colors.light.text,
  },
  accentText: {
    color: '#FFFFFF',
  },
  outlineText: {
    color: colors.light.primary,
  },
  ghostText: {
    color: colors.light.primary,
  },
  dangerText: {
    color: '#FFFFFF',
  },
  disabledText: {
    opacity: 0.8,
  },
});
