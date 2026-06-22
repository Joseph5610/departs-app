import React from 'react';
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
    MapPinOff
} from 'lucide-react';

const renderAlertIcon = (cause?: string, effect?: string, type?: string, props?: { className?: string, size?: number, strokeWidth?: number }) => {
    // If effect is present and we want to prioritize or fallback to it
    // Effect values: 1=NO_SERVICE, 2=REDUCED_SERVICE, 3=SIGNIFICANT_DELAYS, 4=DETOUR, 5=ADDITIONAL_SERVICE, 6=MODIFIED_SERVICE, 7=OTHER_EFFECT, 8=UNKNOWN_EFFECT, 9=STOP_MOVED
    switch (effect) {
        case '1': return <Ban {...props} />;
        case '2': return <MinusCircle {...props} />;
        case '3': return <Hourglass {...props} />;
        case '4': return <Route {...props} />;
        case '5': return <PlusCircle {...props} />;
        case '9': return <MapPinOff {...props} />;
    }

    switch (cause) {
        case '3': // TECHNICAL_PROBLEM
        case '9': // MAINTENANCE
            return <Wrench {...props} />;
        case '4': // STRIKE
        case '5': // DEMONSTRATION
            return <Megaphone {...props} />;
        case '6': // ACCIDENT
            return <CarFront {...props} />;
        case '7': // HOLIDAY
            return <CalendarDays {...props} />;
        case '8': // WEATHER
            return <CloudLightning {...props} />;
        case '10': // CONSTRUCTION
            return <Construction {...props} />;
        case '11': // POLICE_ACTIVITY
            return <Siren {...props} />;
        case '12': // MEDICAL_EMERGENCY
            return <Ambulance {...props} />;
        default:
            return type === 'exclusion' ? <Construction {...props} /> : <AlertTriangle {...props} />;
    }
};

interface AlertIconProps {
    cause?: string;
    effect?: string;
    type?: string;
    className?: string;
    size?: number;
    strokeWidth?: number;
}

export const AlertIcon: React.FC<AlertIconProps> = ({ cause, effect, type, className, size = 16, strokeWidth = 1.5 }) => {
    return renderAlertIcon(cause, effect, type, { className, size, strokeWidth });
};
