/**
 * Hook React para receber eventos SSE em tempo real do backend.
 * 
 * Uso:
 *   const { connected, lastEvent } = useRealtimeEvents();
 * 
 *   // Em qualquer componente:
 *   useEffect(() => {
 *     if (lastEvent?.type === 'purchase.completed') {
 *       // Atualizar dados...
 *     }
 *   }, [lastEvent]);
 */

import { useState, useEffect, useCallback, useRef } from 'react';

export interface RealtimeEvent {
    type: 'purchase.completed' | 'payment.completed' | 'invoice.updated' | 'user.updated' | 'connected';
    data: Record<string, unknown>;
    timestamp: string;
}

interface UseRealtimeEventsOptions {
    /** Reconnect automatically on disconnect (default: true) */
    autoReconnect?: boolean;
    /** Reconnect interval in ms (default: 3000) */
    reconnectInterval?: number;
    /** Callback when event is received */
    onEvent?: (event: RealtimeEvent) => void;
}

interface UseRealtimeEventsReturn {
    /** Whether the SSE connection is active */
    connected: boolean;
    /** Last event received (null if none yet) */
    lastEvent: RealtimeEvent | null;
    /** All events received in this session */
    events: RealtimeEvent[];
    /** Manually disconnect */
    disconnect: () => void;
    /** Manually reconnect */
    reconnect: () => void;
}

export function useRealtimeEvents(options: UseRealtimeEventsOptions = {}): UseRealtimeEventsReturn {
    const {
        autoReconnect = true,
        reconnectInterval = 3000,
        onEvent,
    } = options;

    const [connected, setConnected] = useState(false);
    const [lastEvent, setLastEvent] = useState<RealtimeEvent | null>(null);
    const [events, setEvents] = useState<RealtimeEvent[]>([]);
    
    const eventSourceRef = useRef<EventSource | null>(null);
    const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null);
    const mountedRef = useRef(true);

    const cleanup = useCallback(() => {
        if (reconnectTimerRef.current) {
            clearTimeout(reconnectTimerRef.current);
            reconnectTimerRef.current = null;
        }
        if (eventSourceRef.current) {
            eventSourceRef.current.close();
            eventSourceRef.current = null;
        }
    }, []);

    const connect = useCallback(() => {
        // Não conectar se não há token
        const token = localStorage.getItem('authToken');
        if (!token) return;

        cleanup();

        const es = new EventSource(`/api/events/stream?token=${encodeURIComponent(token)}`);
        eventSourceRef.current = es;

        es.onopen = () => {
            if (mountedRef.current) setConnected(true);
        };

        // Escutar eventos específicos
        const eventTypes = ['purchase.completed', 'payment.completed', 'invoice.updated', 'user.updated', 'connected'];
        
        for (const eventType of eventTypes) {
            es.addEventListener(eventType, ((e: MessageEvent) => {
                if (!mountedRef.current) return;
                try {
                    const data = JSON.parse(e.data);
                    const event: RealtimeEvent = {
                        type: eventType as RealtimeEvent['type'],
                        data,
                        timestamp: data.timestamp || new Date().toISOString(),
                    };
                    setLastEvent(event);
                    setEvents(prev => [...prev.slice(-49), event]); // Manter últimos 50
                    onEvent?.(event);
                } catch (_err) { /* evento malformado */ }
            }) as EventListener);
        }

        es.onerror = () => {
            if (mountedRef.current) setConnected(false);
            es.close();
            eventSourceRef.current = null;

            if (autoReconnect && mountedRef.current) {
                reconnectTimerRef.current = setTimeout(connect, reconnectInterval);
            }
        };
    }, [cleanup, autoReconnect, reconnectInterval, onEvent]);

    useEffect(() => {
        mountedRef.current = true;
        connect();

        return () => {
            mountedRef.current = false;
            cleanup();
        };
    }, [connect, cleanup]);

    const disconnect = useCallback(() => {
        autoReconnect && (reconnectTimerRef.current && clearTimeout(reconnectTimerRef.current));
        cleanup();
        setConnected(false);
    }, [cleanup]);

    const reconnect = useCallback(() => {
        cleanup();
        connect();
    }, [cleanup, connect]);

    return { connected, lastEvent, events, disconnect, reconnect };
}
