import { Search as SearchIcon, MapPin, Building2, Ticket } from 'lucide-react';
import type { SearchHistoryItem } from '@/types';

/** The icon of a recent search's kind. */
export const HistoryItemIcon = ({ type }: { type: SearchHistoryItem['type'] }) => {
    if (type === 'stop') return <MapPin size={16} strokeWidth={1.5} />;
    if (type === 'place') return <Building2 size={16} strokeWidth={1.5} />;
    if (type === 'pos') return <Ticket size={16} strokeWidth={1.5} />;
    return <SearchIcon size={16} strokeWidth={1.5} />;
};
