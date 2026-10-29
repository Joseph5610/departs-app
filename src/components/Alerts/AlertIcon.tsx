import {
    Ambulance,
    CloudLightning,
    Siren,
    CarFront,
    Wrench,
    Megaphone,
    Construction,
    AlertTriangle,
    CalendarDays,
    Ban,
    MinusCircle,
    Hourglass,
    Route,
    PlusCircle,
    MapPinOff,
    type LucideIcon,
} from 'lucide-react';
import { alertIconKind, type AlertIconKind } from '@/domain/alerts';

const ICONS: Record<AlertIconKind, LucideIcon> = {
    noService: Ban,
    reducedService: MinusCircle,
    delays: Hourglass,
    detour: Route,
    addedService: PlusCircle,
    stopMoved: MapPinOff,
    maintenance: Wrench,
    protest: Megaphone,
    accident: CarFront,
    holiday: CalendarDays,
    weather: CloudLightning,
    construction: Construction,
    police: Siren,
    medical: Ambulance,
    warning: AlertTriangle,
};

interface AlertIconProps {
    cause?: string;
    effect?: string;
    type?: string;
    className?: string;
    size?: number;
    strokeWidth?: number;
}

export const AlertIcon = ({ cause, effect, type, className, size = 16, strokeWidth = 1.5 }: AlertIconProps) => {
    const Icon = ICONS[alertIconKind(cause, effect, type)];
    return <Icon className={className} size={size} strokeWidth={strokeWidth} />;
};
