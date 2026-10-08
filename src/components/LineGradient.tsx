import { cn } from 'cn';

interface LineGradientProps {
    /** A colour from `safeHexColor`; it is interpolated into CSS. */
    routeColor: string | null;
    /** The fainter light-mode tint of a board's second direction. */
    subtle?: boolean;
    className?: string;
}

const darkGradient = (routeColor: string) =>
    `linear-gradient(90deg, color-mix(in srgb, color-mix(in srgb, ${routeColor}, white 15%), black 50%) 0%, color-mix(in srgb, color-mix(in srgb, ${routeColor}, white 15%), black 70%) 100%)`;

/** The route-coloured gradient behind a line header; the parent must be `relative` and its content positioned above. */
export const LineGradient = ({ routeColor, subtle = false, className }: LineGradientProps) => (
    <>
        <div
            className={cn("absolute inset-0 pointer-events-none dark:hidden", subtle ? "opacity-10" : "opacity-15", className)}
            style={{ background: routeColor ? `linear-gradient(90deg, ${routeColor} 0%, transparent 100%)` : 'none' }}
        />
        <div
            className={cn("absolute inset-0 pointer-events-none hidden dark:block", className)}
            style={{ background: routeColor ? darkGradient(routeColor) : 'rgba(255,255,255,0.1)' }}
        />
    </>
);
