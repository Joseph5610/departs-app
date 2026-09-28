/** The Network Information API; only Chromium exposes it, Safari and Firefox have no `navigator.connection`. */
interface NetworkInformation extends EventTarget {
    type?: string;
    saveData?: boolean;
}

const getConnection = (): NetworkInformation | undefined =>
    'connection' in navigator ? (navigator.connection as NetworkInformation | undefined) : undefined;

/** True when the platform reports mobile data or the user's data saver; false when it reports nothing. */
export function isMeteredConnection(): boolean {
    const connection = getConnection();
    return connection?.saveData === true || connection?.type === 'cellular';
}

/** Calls `listener` whenever the connection type or data saver changes; a no-op where the platform reports nothing. */
export function onConnectionChange(listener: () => void): void {
    getConnection()?.addEventListener('change', listener);
}
