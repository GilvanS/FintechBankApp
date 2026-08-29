import { useState, useCallback, useEffect, useRef } from 'react';
import { Preferences } from '@capacitor/preferences';
import { PurchasedItem } from '../types';

const CART_STORAGE_KEY = 'volt_cart_items';

export interface CartItem extends PurchasedItem {
    quantity: number;
}

/**
 * Carrinho de compras persistido em storage nativo (@capacitor/preferences).
 * Portado de WEB/hooks/useCart.ts, com hidratacao e persistencia adicionais
 * para que o carrinho sobreviva ao fechamento do app no dispositivo.
 */
export function useCart() {
    const [items, setItems] = useState<CartItem[]>([]);
    const hydrated = useRef(false);

    // Hidrata do storage nativo na montagem
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const { value } = await Preferences.get({ key: CART_STORAGE_KEY });
                if (!cancelled && value) {
                    const parsed = JSON.parse(value);
                    if (Array.isArray(parsed)) setItems(parsed as CartItem[]);
                }
            } catch (error) {
                console.warn('Falha ao hidratar carrinho:', error);
            } finally {
                if (!cancelled) hydrated.current = true;
            }
        })();
        return () => { cancelled = true; };
    }, []);

    // Persiste no storage nativo a cada mudanca (apos hidratar)
    useEffect(() => {
        if (!hydrated.current) return;
        Preferences.set({ key: CART_STORAGE_KEY, value: JSON.stringify(items) })
            .catch(error => console.warn('Falha ao persistir carrinho:', error));
    }, [items]);

    const addItem = useCallback((product: PurchasedItem) => {
        setItems(prev => {
            const existing = prev.find(i => i.id === product.id);
            if (existing) {
                return prev.map(i => i.id === product.id ? { ...i, quantity: i.quantity + 1 } : i);
            }
            return [...prev, { ...product, quantity: 1 }];
        });
    }, []);

    const removeItem = useCallback((productId: string) => {
        setItems(prev => prev.filter(i => i.id !== productId));
    }, []);

    const updateQuantity = useCallback((productId: string, quantity: number) => {
        if (quantity <= 0) {
            setItems(prev => prev.filter(i => i.id !== productId));
        } else {
            setItems(prev => prev.map(i => i.id === productId ? { ...i, quantity } : i));
        }
    }, []);

    const clearCart = useCallback(() => setItems([]), []);

    const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

    return { items, addItem, removeItem, updateQuantity, clearCart, total, itemCount };
}