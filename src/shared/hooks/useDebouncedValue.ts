import { useState, useEffect } from 'react';

/**
 * Retrasa la actualización de un valor reactivo hasta que transcurra `delayMs`
 * sin nuevos cambios. Ideal para búsquedas locales (SQLite FTS5: 250-300ms)
 * y consultas a APIs externas o IA (400-500ms) evitando sobrecarga y condiciones de carrera.
 */
export function useDebouncedValue<T>(value: T, delayMs: number = 280): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    // Si el valor se limpia a cadena vacía, actualiza de inmediato para limpiar resultados sin espera
    if (typeof value === 'string' && value.trim().length === 0) {
      setDebouncedValue(value);
      return;
    }

    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delayMs);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delayMs]);

  return debouncedValue;
}
