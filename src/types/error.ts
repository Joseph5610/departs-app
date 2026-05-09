/**
 * Error codes for the application to distinguish between different failure modes.
 */
export const AppErrorCode = {
    NETWORK_ERROR: 'NETWORK_ERROR',
    TIMEOUT: 'TIMEOUT',
    UPSTREAM_ERROR: 'UPSTREAM_ERROR', // Golemio is down
    APP_ERROR: 'APP_ERROR',           // Our backend is up but returned an error
    UNAUTHORIZED: 'UNAUTHORIZED',
    UNKNOWN: 'UNKNOWN'
} as const;

export type AppErrorCode = typeof AppErrorCode[keyof typeof AppErrorCode];

/**
 * Standardized application error interface.
 */
export interface AppError extends Error {
    code: AppErrorCode;
    status?: number;
    details?: unknown;
    isUpstream?: boolean;
}

/**
 * Type guard for AppError.
 */
export function isAppError(error: unknown): error is AppError {
    return error !== null && typeof error === 'object' && 'code' in error;
}

/**
 * Creates an AppError from a fetch response or caught error.
 */
export async function parseFetchError(response: Response): Promise<AppError> {
    let message = `HTTP Error ${response.status}`;
    let code: AppErrorCode = AppErrorCode.APP_ERROR;
    let details: unknown = null;

    try {
        const body = await response.json();
        if (body && typeof body === 'object') {
            message = body.message || message;
            // If the backend explicitly marked it as an error
            if (body.error) {
                // Check if it's an upstream error based on message or status
                // The backend uses ERROR_MESSAGES.UPSTREAM_ERROR
                if (message.includes('data provider') || response.status >= 502) {
                    code = AppErrorCode.UPSTREAM_ERROR;
                }
            }
            details = body;
        }
    } catch {
        // Not JSON
    }

    const error = new Error(message) as AppError;
    error.code = code;
    error.status = response.status;
    error.details = details;
    error.isUpstream = code === AppErrorCode.UPSTREAM_ERROR;
    
    return error;
}
