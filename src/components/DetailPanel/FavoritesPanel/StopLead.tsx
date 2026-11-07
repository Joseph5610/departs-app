import { PlatformCircle } from '@/components/PlatformCircle';
import { StopModeIcon } from '@/components/StopModeIcon';
import type { BoardStop } from '@/types';

/** What leads a pinned stop's row: its platform code, or its mode's icon where the network has no platform codes. */
export const StopLead = ({ stop }: { stop: BoardStop }) => {
    const { code, lines } = stop;
    if (code) return <PlatformCircle code={code} size="section" />;
    return (
        <span className="flex size-5.5 shrink-0 items-center justify-center rounded-full bg-fill-2 text-muted-foreground" aria-hidden="true">
            <StopModeIcon lines={lines} size={14} />
        </span>
    );
};
