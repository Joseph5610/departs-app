import { useTranslation } from 'react-i18next';
import { Accessibility } from 'lucide-react';
import { FactRow } from '@/components/FactRow';
import { SectionHeading } from '@/components/SectionHeading';
import type { CarSpan, MetroExitAdvice } from '@/domain/rides';

/** Which metro car to ride for each way out at the user's exit, and the one avoiding stairs. */
export const MetroExitHint = ({ advice }: { advice: MetroExitAdvice }) => {
    const { t } = useTranslation();
    const cars = (spans: CarSpan[]) => t('metroExit.cars', {
        cars: spans.map(([from, to]) => (from === to ? t('metroExit.car', { n: from }) : t('metroExit.span', { from, to }))).join(', '),
        count: spans.reduce((sum, [from, to]) => sum + to - from + 1, 0),
    });
    return (
        <div className="flex flex-col" data-testid="metro-exit-hint">
            <SectionHeading className="px-4 pt-3 pb-1">{t('metroExit.title')}</SectionHeading>
            {advice.exits.map(exit => (
                <FactRow
                    key={exit.name}
                    label={<span className="truncate"><span className="text-foreground">{exit.name}</span>{exit.sign && ` · ${exit.sign}`}</span>}
                    value={cars(exit.cars)}
                />
            ))}
            {advice.stepFree && (
                <FactRow
                    label={(
                        <span className="flex min-w-0 items-center gap-1.5">
                            <Accessibility size={15} strokeWidth={2} className="shrink-0" aria-label={t('metroExit.stepFree')} />
                            <span className="truncate text-foreground">{advice.stepFree.name}</span>
                        </span>
                    )}
                    value={cars(advice.stepFree.cars)}
                />
            )}
        </div>
    );
};
