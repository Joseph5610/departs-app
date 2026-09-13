import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { UI_TIMING_MS } from '../config/constants';

/**
 * Copies text; `copiedKey` names the last successful copy for the button's short "copied" state,
 * so one hook can serve several copy buttons. Only a failure is toasted.
 */
export function useCopyToClipboard() {
    const { t } = useTranslation();
    const [copiedKey, setCopiedKey] = useState<string | null>(null);
    const resetTimer = useRef<number | undefined>(undefined);

    useEffect(() => () => window.clearTimeout(resetTimer.current), []);

    const copy = useCallback(async (text: string, key: string) => {
        try {
            await navigator.clipboard.writeText(text);
        } catch {
            toast.error(t('common.copyFailed'));
            return;
        }
        setCopiedKey(key);
        window.clearTimeout(resetTimer.current);
        resetTimer.current = window.setTimeout(() => setCopiedKey(null), UI_TIMING_MS.COPIED_FEEDBACK);
    }, [t]);

    return { copiedKey, copy };
}
