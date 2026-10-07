import { memo } from 'react';
import { Trans } from 'react-i18next';
import { LineBadge } from '@/components/LineBadge';

interface VehicleTitleProps {
    line: string;
    routeColor: string;
}

/** "Line <badge>" as the panel title; the locale decides where the badge sits. */
export const VehicleTitle = memo(({ line, routeColor }: VehicleTitleProps) => (
    <span className="flex items-center gap-2">
        <Trans
            i18nKey="map.vehicleDetails.lineTitle"
            components={{ badge: <LineBadge name={line} routeColor={routeColor} size="lg" /> }}
        />
    </span>
));

VehicleTitle.displayName = 'VehicleTitle';
