import { useRef, useState, useMemo, memo } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useUiStore } from '@/state/uiStore';
import { useAlerts } from '@/hooks/data/useAlerts';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Virtuoso } from 'react-virtuoso';
import { CondensedAlertItem } from '@/components/Alerts/CondensedAlertItem';
import { cn } from '@/lib/cn';
import { ROUTE_TYPE_ICONS } from '@/components/routeTypeIcons';
import { ALERTS_LIST } from '@/config/constants';
import { SectionHeading } from '@/components/SectionHeading';
import { SegmentedControl } from '@/components/SegmentedControl';
import { alertSections, type AlertFilterMode } from '@/domain/alerts';
import { Card } from '@/components/ui/card';
import { useIsMobile } from '@/hooks/useIsMobile';
import { SearchField } from '@/components/SearchField';
import { EmptyState } from '@/components/EmptyState';

type AlertSection = ReturnType<typeof alertSections>[number];
type ListRow =
    | { kind: 'header'; section: number; mode: string; count: number }
    | { kind: 'item'; section: number; item: AlertSection['items'][number]; isFirst: boolean; isLast: boolean };

/** The list's rows, each section opening with its header. */
const listRows = (sections: AlertSection[]): ListRow[] => sections.flatMap((section, idx) => [
    { kind: 'header' as const, section: idx, mode: section.mode, count: section.items.length },
    ...section.items.map((item, itemIdx) => ({ kind: 'item' as const, section: idx, item, isFirst: itemIdx === 0, isLast: itemIdx === section.items.length - 1 })),
]);

/** Room after the last section, so a short one can still scroll up to the pinned heading. */
const ListTail = ({ context }: { context: number }) => <div style={{ height: context }} />;

const LIST_COMPONENTS = { Footer: ListTail };

const SectionHeader = ({ mode, count }: { mode: string; count: number }) => {
    const { t } = useTranslation();
    const Icon = ROUTE_TYPE_ICONS[mode as keyof typeof ROUTE_TYPE_ICONS] ?? AlertTriangle;
    return (
        <SectionHeading lead={<Icon size={14} strokeWidth={2} className="shrink-0 text-tint-mint" />} count={count} className="pt-3 pb-2" style={{ height: ALERTS_LIST.HEADING_PX }}>
            {t(`transportModes.${mode}`)}
        </SectionHeading>
    );
};

/** All of the city's alerts, grouped by mode, filterable by type and searchable; the body of the alerts dialog and mobile card. */
export const AlertsContent = () => {
    const { t } = useTranslation();

    const focusedAlertGuid = useUiStore(s => s.focusedAlertGuid);

    const [filterMode, setFilterMode] = useState<AlertFilterMode>('all');
    const [searchQuery, setSearchQuery] = useState('');

    const [prevFocusedGuid, setPrevFocusedGuid] = useState(focusedAlertGuid);
    if (focusedAlertGuid !== prevFocusedGuid) {
        setPrevFocusedGuid(focusedAlertGuid);
        if (focusedAlertGuid) {
            setFilterMode('all');
            setSearchQuery('');
        }
    }

    const { alerts, isLoading: loadingRSS } = useAlerts();

    const sections = useMemo(() => alertSections(alerts ?? [], filterMode, searchQuery), [alerts, filterMode, searchQuery]);

    const rows = useMemo(() => listRows(sections), [sections]);
    const focusedIndex = useMemo(
        () => focusedAlertGuid ? rows.findIndex(row => row.kind === 'item' && row.item.guid === focusedAlertGuid) : -1,
        [rows, focusedAlertGuid],
    );
    // The section at the top of the list, named by the heading pinned over it.
    const [top, setTop] = useState({ section: 0, offset: 0 });
    const scrollerRef = useRef<HTMLElement | null>(null);
    const [tail, setTail] = useState({ rows, height: 0, measuredAt: 0 });
    const shownSection = sections[Math.min(top.section, sections.length - 1)];

    /** The section of the row crossing the pinned heading's lower edge; a header crossing it carries the heading along, as a last section may stop short of the top. */
    const syncTopSection = () => {
        const scroller = scrollerRef.current;
        if (!scroller) return;
        const scrollerTop = scroller.getBoundingClientRect().top;
        const line = scrollerTop + ALERTS_LIST.HEADING_PX - 1;
        const rendered = [...scroller.querySelectorAll<HTMLElement>('[data-item-index]')];
        const lastHeader = rendered.filter(row => rows[Number(row.dataset.itemIndex)]?.kind === 'header').at(-1);
        const isAtEnd = scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 1;
        if (isAtEnd && lastHeader && rows[Number(lastHeader.dataset.itemIndex)]?.section === sections.length - 1) {
            const gap = lastHeader.getBoundingClientRect().top - scrollerTop;
            const { scrollHeight } = scroller;
            setTail(prev => {
                const height = prev.rows === rows ? prev.height : 0;
                if (prev.measuredAt === scrollHeight || Math.abs(gap) < 1) return prev;
                return { rows, height: Math.max(0, height + gap), measuredAt: scrollHeight };
            });
        }
        for (const row of rendered.reverse()) {
            const rowTop = row.getBoundingClientRect().top;
            if (rowTop >= line) continue;
            const shown = rows[Number(row.dataset.itemIndex)];
            const offset = shown?.kind === 'header' ? Math.max(0, rowTop - scrollerTop) : 0;
            setTop(prev => (prev.section === shown?.section && prev.offset === offset ? prev : { section: shown?.section ?? 0, offset }));
            return;
        }
    };

    return (
        <div className="flex-1 flex flex-col min-h-0">
            <div className="flex shrink-0 flex-col gap-2.5 px-(--panel-gutter) pb-1">
                <SearchField
                    value={searchQuery}
                    onValueChange={setSearchQuery}
                    placeholder={t('alerts.searchPlaceholder')}
                    aria-label={t('alerts.searchPlaceholder')}
                    clearLabel={t('search.clearFilter')}
                />

                <SegmentedControl
                    fill
                    value={filterMode}
                    onChange={setFilterMode}
                    options={[
                        { value: 'all', label: t('alerts.all') },
                        { value: 'incident', label: t('alerts.incidents') },
                        { value: 'exclusion', label: t('alerts.exclusions') },
                    ]}
                />

            </div>

            <div className="flex-1 min-h-0 px-(--panel-gutter)">
                {sections.length === 0 && !loadingRSS ? (
                    <div className="flex flex-1 items-center justify-center py-12 h-full">
                        <EmptyState
                            icon={CheckCircle2}
                            tone="positive"
                            title={t('alerts.noAlerts')}
                            description={searchQuery.trim() ? t('alerts.noAlertsSearchDescription') : t('alerts.noAlertsDescription')}
                        />
                    </div>
                ) : sections.length === 0 ? null : (
                    // Mounted once alerts are in: Virtuoso reads the focused alert's index only when it mounts.
                    <div className="relative h-full">
                        {shownSection && (
                            <div className="pointer-events-none absolute inset-x-0 top-0 z-10" style={{ transform: `translateY(${top.offset}px)` }}>
                                <SectionHeader mode={shownSection.mode} count={shownSection.items.length} />
                            </div>
                        )}
                        <Virtuoso
                            className="h-full"
                            scrollerRef={el => { scrollerRef.current = el as HTMLElement | null; }}
                            onScrollCapture={syncTopSection}
                            rangeChanged={() => requestAnimationFrame(syncTopSection)}
                            // On glass no colour can back the heading, so the rows end at its edge instead.
                            style={{ maskImage: `linear-gradient(to bottom, transparent ${ALERTS_LIST.HEADING_PX}px, #000 ${ALERTS_LIST.HEADING_PX}px)` }}
                            data={rows}
                            components={LIST_COMPONENTS}
                            context={tail.rows === rows ? tail.height : 0}
                            initialTopMostItemIndex={focusedIndex >= 0 ? { index: focusedIndex, align: 'start', offset: -ALERTS_LIST.HEADING_PX } : 0}
                            itemContent={(index, row) => row.kind === 'header' ? (
                                <div className={cn(row.section === top.section && top.offset > 0 && "invisible")}>
                                    <SectionHeader mode={row.mode} count={row.count} />
                                </div>
                            ) : (
                                <Card
                                    size="none"
                                    className={cn(
                                        "rounded-none",
                                        !row.isFirst && "relative before:absolute before:top-0 before:right-0 before:left-11.5 before:h-[0.5px] before:bg-sep",
                                        row.isFirst && "rounded-t-surface",
                                        row.isLast && "rounded-b-surface mb-1"
                                    )}
                                >
                                    <CondensedAlertItem key={row.item.guid ?? `${row.item.title}-${index}`} item={row.item} defaultExpanded={index === focusedIndex} />
                                </Card>
                            )}
                        />
                    </div>
                )}
            </div>
        </div>
    );
};

/** The alerts dialog on desktop; phones show {@link AlertsContent} as a card in the sheet. */
export const AlertsModal = memo(() => {
    const { t } = useTranslation();
    const isAlertsOpen = useUiStore(s => s.isAlertsOpen);
    const { setIsAlertsOpen } = useUiStore(s => s.actions);
    const { hasAlerts } = useAlerts();
    // Stays mounted once opened, so a window narrowed to a phone's width must not reopen it beside the sheet's card.
    const isMobile = useIsMobile();

    return (
        <Dialog open={isAlertsOpen && hasAlerts && !isMobile} onOpenChange={setIsAlertsOpen}>
            <DialogContent aria-describedby={undefined} className="max-w-xl flex flex-col h-[calc(85dvh)] p-0 overflow-hidden gap-0" data-testid="alerts-modal-content">
                <DialogHeader className="px-(--panel-gutter) pt-6 pb-2 shrink-0">
                    <DialogTitle>
                        {t('alerts.title')}
                    </DialogTitle>
                </DialogHeader>
                <AlertsContent />
            </DialogContent>
        </Dialog>
    );
});

AlertsModal.displayName = 'AlertsModal';

