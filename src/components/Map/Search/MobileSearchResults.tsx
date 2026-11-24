import { useTranslation } from 'react-i18next';
import { Search as SearchIcon } from 'lucide-react';
import { useHistoryLines } from '@/hooks/derived/useHistoryLines';
import type { useSearch } from '@/hooks/features/useSearch';
import { STOP_SEARCH } from '@/config/constants';
import { getStopDistanceInfo } from '@/domain/stops';
import { WalkDistance } from '@/components/WalkDistance';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Item, ItemActions, ItemMedia } from '@/components/ui/item';
import { SheetSection as Section } from '@/components/Map/HomeSheet/SheetSection';
import { EmptyState } from '@/components/EmptyState';
import { SearchRowBody } from './SearchItem';
import { hasNoResults, searchSections, type SearchRow } from './searchSections';

interface MobileSearchResultsProps {
    search: ReturnType<typeof useSearch>;
    location: [number, number] | null;
    onClearHistory: () => void;
}

const ResultRow = ({ row, location }: { row: SearchRow; location: [number, number] | null }) => {
    const distance = row.stop ? getStopDistanceInfo(location, row.stop.pos) : null;
    return (
        <Item render={<button type="button" onClick={row.onSelect} data-testid={row.testId} />}>
            <ItemMedia variant="icon">{row.icon}</ItemMedia>
            <SearchRowBody row={row} />
            {distance && <ItemActions className="shrink-0"><WalkDistance info={distance} className="type-meta" /></ItemActions>}
        </Item>
    );
};

/**
 * The phone's full-screen search results: recent searches and favourites before typing,
 * then grouped cards for lines, stops, vehicles, places and points of sale.
 */
export const MobileSearchResults = ({ search, location, onClearHistory }: MobileSearchResultsProps) => {
    const { t } = useTranslation();
    const historyLines = useHistoryLines(search.searchHistory);
    const stops = search.query === '' ? search.pinnedStopList : search.stopResults;
    const sections = searchSections({ search, stops, t, historyLines });

    return (
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain scroll-edge px-(--panel-gutter) pt-1 pb-[45dvh] flex flex-col gap-5" data-testid="search-results">
            {sections.map(section => (
                <Section
                    key={section.id}
                    title={section.title}
                    count={section.count}
                    action={section.id === 'recent' && (
                        <Button variant="ghost" size="chip" className="-mr-1" onClick={onClearHistory} data-testid="search-clear-history">
                            {t('search.clearRecent')}
                        </Button>
                    )}
                >
                    <Card size="none">
                        {section.rows.map(row => <ResultRow key={row.key} row={row} location={location} />)}
                    </Card>
                </Section>
            ))}

            {search.query === '' && search.searchHistory.length === 0 && (
                <p className="px-1 pt-2 type-meta text-muted-foreground">{t('search.emptyHint')}</p>
            )}

            {hasNoResults(sections, search.query, STOP_SEARCH.MIN_QUERY_LENGTH) && (
                <EmptyState icon={SearchIcon} title={t('search.noResults')} description={t('search.noResultsHint')} />
            )}
        </div>
    );
};
