import { useEffect } from 'react';
import { useEnrichmentStore } from '../../state/enrichmentStore';
import type { EnrichmentChannelAdapter, EnrichmentPatch } from '../../types/enrichment';

export const useEnrichmentChannel = (adapter: EnrichmentChannelAdapter | null) => {
    const applyBatchedPatches = useEnrichmentStore(s => s.applyBatchedPatches);
    const clearAll = useEnrichmentStore(s => s.clearAll);

    useEffect(() => {
        if (!adapter) {
            clearAll();
            return;
        }

        if (adapter.transport !== 'websocket') return;

        clearAll();

        let isUnmounted = false;
        let ws: WebSocket | null = null;
        let reconnectTimeout: number | undefined;
        let attempt = 0;

        const connect = () => {
            if (isUnmounted) return;

            ws = new WebSocket(adapter.url);

            let pendingPatches: EnrichmentPatch[] = [];
            let flushInterval: number | undefined;

            ws.onopen = () => {
                console.info(`[Enrichment] Connected to ${adapter.url}`);
                attempt = 0;
                flushInterval = window.setInterval(() => {
                    if (pendingPatches.length > 0) {
                        applyBatchedPatches(pendingPatches);
                        pendingPatches = [];
                    }
                }, 500);
            };

            ws.onmessage = (event) => {
                if (isUnmounted) return;
                try {
                    const data = JSON.parse(event.data);
                    const patch = adapter.normalize(data);
                    if (patch) pendingPatches.push(patch);
                } catch {
                    // Ignore parse errors
                }
            };

            ws.onclose = () => {
                if (isUnmounted) return;
                if (flushInterval) clearInterval(flushInterval);
                const delay = Math.min(1000 * Math.pow(2, attempt), 30000);
                attempt++;
                reconnectTimeout = window.setTimeout(connect, delay);
            };

            ws.onerror = () => {
                // Errors handled by onclose reconnect loop
            };
        };

        connect();

        return () => {
            isUnmounted = true;
            if (reconnectTimeout) clearTimeout(reconnectTimeout);
            
            if (ws) {
                // In React Strict Mode, unmounting happens immediately. 
                // Calling close() on a CONNECTING socket throws a native browser console error.
                if (ws.readyState === WebSocket.CONNECTING) {
                    ws.onopen = () => { ws?.close(); };
                    ws.onerror = () => {};
                } else {
                    ws.close();
                }
            }
        };
    }, [adapter, applyBatchedPatches, clearAll]);
};
