import { useTranslation } from 'react-i18next';
import { Accessibility, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Item } from '@/components/ui/item';
import { SectionHeading } from '@/components/SectionHeading';
import { METRO_TRAIN_CARS } from '@/config/constants';
import type { CarSpan, MetroExitAdvice } from '@/domain/rides';

/** Which metro car to ride for each way out at the user's exit, and the one avoiding stairs. */
export const MetroExitHint = ({ advice }: { advice: MetroExitAdvice }) => {
    const { t } = useTranslation();
    return (
        <div className="flex flex-col" data-testid="metro-exit-hint">
            <div className="flex items-center justify-between gap-3 px-4 pt-3 pb-1">
                <SectionHeading>{t('metroExit.title')}</SectionHeading>
                <span className="flex items-center gap-1 type-note text-muted-foreground">
                    {t('metroExit.direction')}
                    <ArrowRight size={13} strokeWidth={2} aria-hidden />
                </span>
            </div>
            {advice.exits.map(exit => (
                <ExitRow key={exit.name} name={exit.name} sign={exit.sign} cars={exit.cars} />
            ))}
            {advice.stepFree && <ExitRow name={advice.stepFree.name} sign={null} cars={advice.stepFree.cars} isStepFree />}
        </div>
    );
};

const ExitRow = ({ name, sign, cars, isStepFree = false }: { name: string; sign: string | null; cars: CarSpan[]; isStepFree?: boolean }) => {
    const { t } = useTranslation();
    return (
        <Item className="justify-between gap-3 [--row-sep:0.875rem]">
            <span className="flex min-w-0 flex-col">
                <span className="flex min-w-0 items-center gap-1.5 type-row text-foreground">
                    {isStepFree && <Accessibility size={15} strokeWidth={2} className="shrink-0 text-muted-foreground" aria-label={t('metroExit.stepFree')} />}
                    <span className="truncate">{name}</span>
                </span>
                {sign && <span className="line-clamp-2 type-note text-muted-foreground">{sign}</span>}
            </span>
            <TrainCars cars={cars} />
        </Item>
    );
};

/** The train drawn left to right with its front on the right, each car numbered and the given ones lit; read out as their numbers. */
const TrainCars = ({ cars }: { cars: CarSpan[] }) => {
    const { t } = useTranslation();
    const label = t('metroExit.cars', {
        cars: cars.map(([from, to]) => (from === to ? t('metroExit.car', { n: from }) : t('metroExit.span', { from, to }))).join(', '),
        count: cars.reduce((sum, [from, to]) => sum + to - from + 1, 0),
    });
    const numbers = Array.from({ length: METRO_TRAIN_CARS }, (_, i) => METRO_TRAIN_CARS - i);
    return (
        <span role="img" aria-label={label} title={label} className="flex shrink-0 items-center">
            {numbers.map(n => {
                const isLit = cars.some(([from, to]) => n >= from && n <= to);
                const isFront = n === 1;
                return (
                    <span key={n} className="flex items-center">
                        <span
                            className={cn(
                                "relative flex h-4 items-center type-micro tabular-nums",
                                isFront ? "w-7 rounded-tr-full rounded-br-badge pl-1.5" : "w-5 justify-center",
                                isLit ? "bg-tint-mint text-primary-foreground" : "bg-fill-2 text-muted-foreground",
                            )}
                        >
                            {n}
                            {isFront && <span className={cn("absolute top-0.75 right-1.5 h-1.5 w-2 rounded-tr-full", isLit ? "bg-card/60" : "bg-card/40")} />}
                        </span>
                        {!isFront && <span className="h-0.5 w-0.75 bg-fill-2" />}
                    </span>
                );
            })}
        </span>
    );
};
