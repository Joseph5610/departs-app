import { useTranslation } from 'react-i18next';
import { Search as SearchIcon } from 'lucide-react';
import { Autocomplete } from '@base-ui/react/autocomplete';
import { useHistoryLines } from '@/hooks/derived/useHistoryLines';
import type { useSearch } from '@/hooks/features/useSearch';
import { SectionHeading } from '@/components/SectionHeading';
import { EmptyState } from '@/components/EmptyState';
import { STOP_SEARCH } from '@/config/constants';
import type { Stop } from '@/types';
import { SearchItem } from './SearchItem';
import { hasNoResults, searchSections } from './searchSections';

interface SearchDropdownProps {
    search: ReturnType<typeof useSearch>;
    /** The stops the box lists: the pinned ones before typing, the matches after. */
    stops: readonly Stop[];
}

/** The dropdown under the desktop search box, as the Base UI Autocomplete list owned by Search. */
export const SearchDropdown = ({ search, stops }: SearchDropdownProps) => {
    const { t } = useTranslation();
    const historyLines = useHistoryLines(search.searchHistory);
    const sections = searchSections({ search, stops, hidesHistory: !!search.activeFilter, t, historyLines });

    return (
        <div className="mt-2 overflow-hidden rounded-surface glassy p-1.5">
            <Autocomplete.List className="max-h-[60vh] overflow-y-auto scroll-edge custom-scrollbar space-y-1">
                {sections.map(section => (
                    <Autocomplete.Group key={section.id} className="overflow-hidden p-0 text-foreground">
                        <Autocomplete.GroupLabel render={<SectionHeading count={section.count} className="px-3.5 pt-3 pb-2">{section.title}</SectionHeading>} />
                        {section.rows.map(row => <SearchItem key={row.key} row={row} />)}
                    </Autocomplete.Group>
                ))}
                {hasNoResults(sections, search.query, STOP_SEARCH.MIN_QUERY_LENGTH) && (
                    <EmptyState icon={SearchIcon} title={t('search.noResults')} description={t('search.noResultsHint')} className="py-8" />
                )}
            </Autocomplete.List>
        </div>
    );
};
