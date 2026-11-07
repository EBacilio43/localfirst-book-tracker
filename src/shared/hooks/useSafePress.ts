import { useCallback, useRef, useState } from 'react';
import * as Haptics from 'expo-haptics';

export interface UseSafePressOptions {
  cooldownMs?: number;
  enableHaptics?: boolean;
}

export function useSafePress(
  handler?: (() => Promise<void> | void) | null,
  options: UseSafePressOptions = {}
) {
  const { cooldownMs = 500, enableHaptics = true } = options;
  const isLockedRef = useRef<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const safePress = useCallback(async () => {
    // 1. Bloqueo síncrono inmediato en memoria (0ms lag, sin esperar al re-render)
    if (isLockedRef.current || !handler) {
      return;
    }
    isLockedRef.current = true;
    setIsSubmitting(true);

    if (enableHaptics) {
      try {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch {
        // En plataformas sin haptics no bloquea el flujo
      }
    }

    try {
      await handler();
    } finally {
      // 2. Cooldown mínimo de seguridad antes de permitir un nuevo toque
      setTimeout(() => {
        isLockedRef.current = false;
        setIsSubmitting(false);
      }, cooldownMs);
    }
  }, [handler, cooldownMs, enableHaptics]);

  return {
    handlePress: safePress,
    isSubmitting,
  };
}
