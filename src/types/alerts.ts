import type { AppAlert, AppInfotext } from '@shared/api';
import type { RouteType } from './vehicles';

/** An alert's line, resolved for its badge; a line routes.json doesn't know keeps its raw id as name. */
export interface AlertLine {
    name: string;
    type: RouteType;
    route_color?: string;
}

/** An alert as the API sends it, plus what `useAlerts` derives from it. */
export interface RSSItem extends AppAlert {
    /** Derived from `lines` and routes.json. */
    resolvedLines?: AlertLine[];
    /** Derived from the validity window as of the fetch. */
    isActive?: boolean;
    isFuture?: boolean;
}

export type Infotext = AppInfotext;
