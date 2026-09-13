import { useEffect } from 'react';
import { useEnrichmentStore } from '../../state/enrichmentStore';
import { ENRICHMENT_CONFIG } from '../../config/constants';
import type { EnrichmentChannelAdapter, EnrichmentPatch } from '../../types/enrichment';

/**
 * Subscribes to a city's push channel (e.g. the Brno KORDIS stream) and applies its patches in batches.
 * The socket is closed while the tab is hidden and reopened when it becomes visible again.
 */
export const useEnrichmentChannel = (adapter: EnrichmentChannelAdapter | null) => {
    const applyBatchedPatches = useEnrichmentStore(s => s.applyBatchedPatches);
    const clearAll = useEnrichmentStore(s => s.clearAll);
    const pruneExpired = useEnrichmentStore(s => s.pruneExpired);

    useEffect(() => {
        clearAll();
        if (!adapter) return;

        let isActive = true;
        let ws: WebSocket | null = null;
        let flushInterval: number | undefined;
        let reconnectTimeout: number | undefined;
        let attempt = 0;
        let pending: EnrichmentPatch[] = [];

        const flush = () => {
            if (pending.length === 0) return;
            applyBatchedPatches(pending);
            pending = [];
        };

        const disconnect = () => {
            window.clearTimeout(reconnectTimeout);
            window.clearInterval(flushInterval);
            reconnectTimeout = undefined;
            flushInterval = undefined;
            pending = [];

            const socket = ws;
            ws = null;
            if (!socket) return;
            socket.onmessage = null;
            socket.onclose = null;
            socket.onerror = null;
            // Closing a socket that is still connecting logs a browser error, so close it once it opens.
            if (socket.readyState === WebSocket.CONNECTING) {
                socket.onopen = () => socket.close();
            } else {
                socket.onopen = null;
                socket.close();
            }
        };

        const connect = () => {
            if (!isActive || document.hidden) return;

            const socket = new WebSocket(adapter.url);
            ws = socket;

            socket.onopen = () => {
                attempt = 0;
                if (adapter.wsFilterPayload) socket.send(JSON.stringify(adapter.wsFilterPayload));
                flushInterval = window.setInterval(flush, ENRICHMENT_CONFIG.FLUSH_INTERVAL_MS);
            };

            socket.onmessage = (event) => {
                try {
                    const patch = adapter.normalize(JSON.parse(event.data));
                    if (patch) pending.push(patch);
                } catch {
                    // Ignore malformed messages
                }
            };

            socket.onclose = () => {
                window.clearInterval(flushInterval);
                flushInterval = undefined;
                ws = null;
                if (!isActive || document.hidden) return;
                const delay = Math.min(ENRICHMENT_CONFIG.RECONNECT_BASE_MS * 2 ** attempt, ENRICHMENT_CONFIG.RECONNECT_MAX_MS);
                attempt++;
                reconnectTimeout = window.setTimeout(connect, delay);
            };

            // Reconnects are driven by onclose, which always follows an error.
            socket.onerror = () => {};
        };

        const handleVisibilityChange = () => {
            if (document.hidden) {
                disconnect();
            } else if (!ws) {
                attempt = 0;
                connect();
            }
        };

        connect();
        document.addEventListener('visibilitychange', handleVisibilityChange);
        const pruneInterval = window.setInterval(pruneExpired, ENRICHMENT_CONFIG.PRUNE_INTERVAL_MS);

        return () => {
            isActive = false;
            window.clearInterval(pruneInterval);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            disconnect();
        };
    }, [adapter, applyBatchedPatches, clearAll, pruneExpired]);
};
