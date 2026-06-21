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
} from 'lucide-react';

const renderAlertIcon = (cause?: string, type?: string, props?: { className?: string, size?: number, strokeWidth?: number }) => {
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
    type?: string;
    className?: string;
    size?: number;
    strokeWidth?: number;
}

export const AlertIcon: React.FC<AlertIconProps> = ({ cause, type, className, size = 16, strokeWidth = 1.5 }) => {
    return renderAlertIcon(cause, type, { className, size, strokeWidth });
};
