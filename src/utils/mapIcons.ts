import type { Map } from 'maplibre-gl';

/**
 * Official PID Branding Colors
 */
export const VEHICLE_COLORS = {
    METRO_A: '#00A562',
    METRO_B: '#F8B322',
    METRO_C: '#CF003D',
    METRO_DEFAULT: '#AD0B00',
    TRAM: '#7A0603',
    BUS: '#007DA8',
    TROLLEYBUS: '#80166F',
    TRAIN: '#1c1745',
    FERRY: '#00b1b0',
    NIGHT: '#262050',
    FALLBACK: '#5A5A5A'
} as const;

export const addArrowIcon = (map: Map) => {
    const size = 64;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (ctx) {
        ctx.clearRect(0, 0, size, size);
        ctx.fillStyle = 'white';
        ctx.beginPath();
        ctx.moveTo(32, 12);
        ctx.lineTo(18, 46);
        ctx.lineTo(32, 38);
        ctx.lineTo(46, 46);
        ctx.closePath();
        ctx.fill();

        if (!map.hasImage('v-arrow-centered')) {
            const imageData = ctx.getImageData(0, 0, size, size);
            map.addImage('v-arrow-centered', imageData, { sdf: true });
        }
    }
};

export const addSplitIcon = (map: Map, id: string, c1: string, c2: string) => {
    const size = 64;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (ctx) {
        const cx = size / 2;
        const cy = size / 2;
        const r = size / 2 - 2;
        ctx.beginPath();
        ctx.arc(cx, cy, size / 2, 0, Math.PI * 2);
        ctx.fillStyle = 'white';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(cx, cy, r, Math.PI * 0.5, Math.PI * 1.5);
        ctx.fillStyle = c1;
        ctx.fill();
        ctx.beginPath();
        ctx.arc(cx, cy, r, Math.PI * 1.5, Math.PI * 2.5);
        ctx.fillStyle = c2;
        ctx.fill();
        if (!map.hasImage(id)) {
            map.addImage(id, ctx.getImageData(0, 0, size, size), { pixelRatio: 2 });
        }
    }
};

export const addAllIcons = (map: Map) => {
    addArrowIcon(map);
    addSplitIcon(map, 'transfer-A-B', VEHICLE_COLORS.METRO_A, VEHICLE_COLORS.METRO_B);
    addSplitIcon(map, 'transfer-A-C', VEHICLE_COLORS.METRO_A, VEHICLE_COLORS.METRO_C);
    addSplitIcon(map, 'transfer-B-C', VEHICLE_COLORS.METRO_B, VEHICLE_COLORS.METRO_C);
};
