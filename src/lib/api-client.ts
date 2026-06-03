import { type AppError, AppErrorCode, parseFetchError } from '../types/error';

const DEFAULT_TIMEOUT = 10000; // 10s

import { API_BASE_URL } from '../config/constants';

/**
 * Enhanced fetch wrapper with timeout and automatic error normalization.
 */
export async function apiFetch<T>(
    url: string | URL,
    options: RequestInit & { timeout?: number } = {}
): Promise<T> {
    const { timeout = DEFAULT_TIMEOUT, ...fetchOptions } = options;

    let finalUrl = url.toString();
    if (finalUrl.startsWith('/')) {
        finalUrl = `${API_BASE_URL}${finalUrl}`;
    } else if (finalUrl.startsWith(window.location.origin)) {
        const path = finalUrl.slice(window.location.origin.length);
        if (path.startsWith('/')) {
             finalUrl = `${window.location.origin}${API_BASE_URL}${path}`;
        }
    }

    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);

    try {
        const response = await fetch(finalUrl, {
            ...fetchOptions,
            signal: controller.signal
        });

        clearTimeout(id);

        if (!response.ok) {
            throw await parseFetchError(response);
        }

        return await response.json();
    } catch (error: unknown) {
        clearTimeout(id);

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
    }
}
