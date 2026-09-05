import { useState, useCallback } from 'react';

export function useCardOrder<T extends string>(
  storageKey: string,
  defaultOrder: readonly T[]
): [T[], (nextOrder: T[]) => void] {
  const [order, setOrderState] = useState<T[]>(() => {
    try {
      const raw = localStorage.getItem(`allure_card_order_${storageKey}`);
      if (!raw) return [...defaultOrder];
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [...defaultOrder];

      const allowed = new Set<T>(defaultOrder);
      const kept = parsed.filter((item): item is T => typeof item === 'string' && allowed.has(item as T));
      const missing = defaultOrder.filter((item) => !kept.includes(item));
      return kept.length > 0 ? [...kept, ...missing] : [...defaultOrder];
    } catch {
      return [...defaultOrder];
    }
  });

  const setOrder = useCallback(
    (nextOrder: T[]) => {
      setOrderState(nextOrder);
      try {
        localStorage.setItem(`allure_card_order_${storageKey}`, JSON.stringify(nextOrder));
      } catch {
        // Ignora erro de localStorage
      }
    },
    [storageKey]
  );

  return [order, setOrder];
}
