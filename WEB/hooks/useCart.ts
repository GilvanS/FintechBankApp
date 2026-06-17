import { useState, useCallback } from 'react';
import { PurchasedItem } from '../types';

export interface CartItem extends PurchasedItem {
    quantity: number;
}

export function useCart() {
    const [items, setItems] = useState<CartItem[]>([]);

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
