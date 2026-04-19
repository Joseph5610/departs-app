import type { Map } from 'maplibre-gl';
import { LINE_COLORS } from '../config/stations';

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
    addSplitIcon(map, 'transfer-A-B', LINE_COLORS.A, LINE_COLORS.B);
    addSplitIcon(map, 'transfer-A-C', LINE_COLORS.A, LINE_COLORS.C);
    addSplitIcon(map, 'transfer-B-C', LINE_COLORS.B, LINE_COLORS.C);
};
