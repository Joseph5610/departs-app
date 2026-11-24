import { memo } from 'react';
import { useDepartures } from '@/hooks/data/useDepartures';
import { RequestStopMark } from '@/components/RequestStopMark';

interface StopTitleProps {
    title: string | undefined;
}

export const StopTitle = memo(({ title }: StopTitleProps) => {
    const { hasRequestStop } = useDepartures();

    if (!hasRequestStop) return <span className="block truncate">{title}</span>;

    return (
        <span className="flex min-w-0 items-center gap-2">
            <span className="min-w-0 truncate">{title}</span>
            <RequestStopMark size={18} />
        </span>
    );
});
