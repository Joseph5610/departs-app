import { useEffect, useState } from 'react';

/** True for `durationMs` after `key` changes to a defined value, for a one-off flash of UI; false otherwise. */
export const useFlash = (key: number | string | undefined, durationMs: number): boolean => {
    const [isOn, setIsOn] = useState(false);
    const [prevKey, setPrevKey] = useState(key);

    if (key !== prevKey) {
        setPrevKey(key);
        setIsOn(key !== undefined);
    }

    useEffect(() => {
        if (!isOn) return;
        const timer = setTimeout(() => setIsOn(false), durationMs);
        return () => clearTimeout(timer);
    }, [isOn, key, durationMs]);

    return isOn;
};
