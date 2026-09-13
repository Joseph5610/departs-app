import { Suspense, useState, type ReactNode } from 'react';

/**
 * Renders `children` from the first time `when` is true and keeps them mounted afterwards, so a
 * lazily loaded modal is only downloaded once it is needed and its close animation still plays.
 */
export const MountWhenOpened = ({ when, children }: { when: boolean; children: ReactNode }) => {
    const [hasOpened, setHasOpened] = useState(when);
    if (when && !hasOpened) setHasOpened(true);
    return hasOpened ? <Suspense fallback={null}>{children}</Suspense> : null;
};
