import { type AppError, AppErrorCode, parseFetchError } from '@/types';
import { API_BASE_URL, QUERY_TIMING_MS } from '@/config/constants';

/**
 * Enhanced fetch wrapper with timeout and automatic error normalization.
 */
export async function apiFetch<T>(
    url: string | URL,
    options: RequestInit & { timeout?: number } = {}
): Promise<T> {
    const { timeout = QUERY_TIMING_MS.API_REQUEST_TIMEOUT, signal, ...fetchOptions } = options;

    let finalUrl = url.toString();
    if (finalUrl.startsWith('/')) {
        finalUrl = `${API_BASE_URL}${finalUrl}`;
    } else if (finalUrl.startsWith(window.location.origin)) {
        const path = finalUrl.slice(window.location.origin.length);
        if (path.startsWith('/')) {
             finalUrl = `${window.location.origin}${API_BASE_URL}${path}`;
        }
    }

    // Linked by hand: AbortSignal.any needs iOS 17.4+.
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    const abortFromCaller = () => controller.abort(signal?.reason);
    if (signal?.aborted) abortFromCaller();
    else signal?.addEventListener('abort', abortFromCaller, { once: true });

    try {
        const response = await fetch(finalUrl, {
            ...fetchOptions,
            signal: controller.signal
        });

        if (!response.ok) {
            throw await parseFetchError(response);
        }

        return await response.json();
    } catch (error: unknown) {
        if (signal?.aborted) throw error;

        if (error instanceof Error && error.name === 'AbortError') {
            const timeoutError = new Error('Request timed out') as AppError;
            timeoutError.code = AppErrorCode.TIMEOUT;
            throw timeoutError;
        }

        if (error instanceof TypeError) {
            const networkError = new Error('Network error or server unreachable') as AppError;
            networkError.code = AppErrorCode.NETWORK_ERROR;
            networkError.isUpstream = false;
            throw networkError;
        }

        throw error;
    } finally {
        clearTimeout(id);
        signal?.removeEventListener('abort', abortFromCaller);
    }
}
