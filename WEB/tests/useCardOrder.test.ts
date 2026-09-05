import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { useCardOrder } from '../hooks/useCardOrder';

describe('useCardOrder', () => {
  const defaultOrder = ['cardA', 'cardB', 'cardC'] as const;

  beforeEach(() => {
    localStorage.clear();
  });

  it('returns default order when localStorage is empty', () => {
    const { result } = renderHook(() => useCardOrder('test_empty', defaultOrder));
    expect(result.current[0]).toEqual(['cardA', 'cardB', 'cardC']);
  });

  it('loads saved order from localStorage', () => {
    localStorage.setItem('allure_card_order_test_saved', JSON.stringify(['cardC', 'cardA', 'cardB']));
    const { result } = renderHook(() => useCardOrder('test_saved', defaultOrder));
    expect(result.current[0]).toEqual(['cardC', 'cardA', 'cardB']);
  });

  it('saves new order to localStorage', () => {
    const { result } = renderHook(() => useCardOrder('test_update', defaultOrder));
    act(() => {
      result.current[1](['cardB', 'cardC', 'cardA']);
    });
    expect(result.current[0]).toEqual(['cardB', 'cardC', 'cardA']);
    expect(localStorage.getItem('allure_card_order_test_update')).toBe(JSON.stringify(['cardB', 'cardC', 'cardA']));
  });

  it('discards invalid keys and appends missing keys', () => {
    localStorage.setItem('allure_card_order_test_invalid', JSON.stringify(['cardC', 'invalidKey']));
    const { result } = renderHook(() => useCardOrder('test_invalid', defaultOrder));
    expect(result.current[0]).toEqual(['cardC', 'cardA', 'cardB']);
  });

  it('falls back to default order if JSON is corrupted', () => {
    localStorage.setItem('allure_card_order_test_corrupt', '{invalid json');
    const { result } = renderHook(() => useCardOrder('test_corrupt', defaultOrder));
    expect(result.current[0]).toEqual(['cardA', 'cardB', 'cardC']);
  });
});
