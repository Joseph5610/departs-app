import { useTranslation } from 'react-i18next';
import type { LineBadgeData } from '@/domain/routes';
import { LineBadges } from './SearchItem';

/** The active line filter as the search box shows it: the line badges, then "on the map". */
export const LineFilterLabel = ({ lines }: { lines: LineBadgeData[] }) => {
    const { t } = useTranslation();
    return (
        <span className="flex min-w-0 items-center" data-testid="search-line-filter">
            <LineBadges lines={lines} />
            <span className="truncate text-title text-muted-foreground">{t('search.lineOnMap', { count: lines.length })}</span>
        </span>
    );
};
