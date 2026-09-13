import type { Map } from 'maplibre-gl';
import { MAP_ICONS } from '../config/mapLayers';

const ICON_SIZE_PX = 64;

/** Draws an icon on a fresh canvas and (re)adds it to the map; `sdf` icons are single-colour masks tinted by their layer. */
const registerIcon = (map: Map, name: string, sdf: boolean, draw: (ctx: CanvasRenderingContext2D) => void) => {
    const canvas = document.createElement('canvas');
    canvas.width = ICON_SIZE_PX;
    canvas.height = ICON_SIZE_PX;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    draw(ctx);
    if (map.hasImage(name)) map.removeImage(name);
    map.addImage(name, ctx.getImageData(0, 0, ICON_SIZE_PX, ICON_SIZE_PX), { sdf });
};

const roundRectPath = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, radius: number) => {
    if (typeof ctx.roundRect === 'function') ctx.roundRect(x, y, w, h, radius);
    else ctx.rect(x, y, w, h);
};

const drawArrow = (ctx: CanvasRenderingContext2D) => {
    ctx.fillStyle = 'white';
    ctx.beginPath();
    ctx.moveTo(32, 12);
    ctx.lineTo(18, 46);
    ctx.lineTo(32, 38);
    ctx.lineTo(46, 46);
    ctx.closePath();
    ctx.fill();
};

const drawTrain = (ctx: CanvasRenderingContext2D) => {
    const s = ICON_SIZE_PX / 24;
    ctx.strokeStyle = 'black';
    ctx.fillStyle = 'black';
    ctx.lineWidth = 2 * s;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    ctx.beginPath();
    roundRectPath(ctx, 4 * s, 3 * s, 16 * s, 16 * s, 2 * s);
    ctx.stroke();

    const strokeLine = (x1: number, y1: number, x2: number, y2: number) => {
        ctx.beginPath();
        ctx.moveTo(x1 * s, y1 * s);
        ctx.lineTo(x2 * s, y2 * s);
        ctx.stroke();
    };
    strokeLine(4, 11, 20, 11);
    strokeLine(12, 3, 12, 11);
    strokeLine(8, 19, 6, 22);
    strokeLine(16, 19, 18, 22);

    for (const lightX of [8, 16]) {
        ctx.beginPath();
        ctx.arc(lightX * s, 15 * s, 1 * s, 0, Math.PI * 2);
        ctx.fill();
    }
};

const drawStar = (ctx: CanvasRenderingContext2D) => {
    const cx = 32;
    const cy = 32;
    const spikes = 5;
    const outerRadius = 24;
    const innerRadius = 12;
    const step = Math.PI / spikes;
    let rot = Math.PI / 2 * 3;

    ctx.fillStyle = 'black';
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx, cy - outerRadius);
    for (let i = 0; i < spikes; i++) {
        ctx.lineTo(cx + Math.cos(rot) * outerRadius, cy + Math.sin(rot) * outerRadius);
        rot += step;
        ctx.lineTo(cx + Math.cos(rot) * innerRadius, cy + Math.sin(rot) * innerRadius);
        rot += step;
    }
    ctx.lineTo(cx, cy - outerRadius);
    ctx.closePath();
    ctx.fill();
};

const drawBusStop = (ctx: CanvasRenderingContext2D) => {
    ctx.strokeStyle = 'black';
    ctx.fillStyle = 'black';
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(32, 34);
    ctx.lineTo(32, 58);
    ctx.stroke();

    ctx.lineWidth = 3;
    ctx.beginPath();
    roundRectPath(ctx, 10, 8, 44, 28, 4);
    ctx.fill();
};

/** Coloured disc with a white outline, the background of every point-of-sale icon. */
const drawPosBadge = (ctx: CanvasRenderingContext2D, color: string) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(32, 32, 24, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
};

const drawPosMachine = (ctx: CanvasRenderingContext2D) => {
    drawPosBadge(ctx, '#10b981');
    ctx.beginPath();
    roundRectPath(ctx, 19, 23, 26, 18, 3);
    ctx.fill();

    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(28, 23);
    ctx.lineTo(28, 41);
    ctx.stroke();
};

const drawPosInfo = (ctx: CanvasRenderingContext2D) => {
    drawPosBadge(ctx, '#06b6d4');
    ctx.beginPath();
    ctx.arc(32, 22, 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    roundRectPath(ctx, 29, 28, 6, 14, 1.5);
    ctx.fill();
};

const drawPosOffice = (ctx: CanvasRenderingContext2D) => {
    drawPosBadge(ctx, '#8b5cf6');
    ctx.beginPath();
    ctx.moveTo(32, 19);
    ctx.lineTo(19, 26);
    ctx.lineTo(45, 26);
    ctx.closePath();
    ctx.fill();

    ctx.fillRect(19, 41, 26, 3);
    ctx.fillRect(21, 28, 4, 11);
    ctx.fillRect(30, 28, 4, 11);
    ctx.fillRect(39, 28, 4, 11);
};

export const addAllIcons = (map: Map) => {
    registerIcon(map, MAP_ICONS.VEHICLE_ARROW, true, drawArrow);
    registerIcon(map, MAP_ICONS.TRAIN_STATION, true, drawTrain);
    registerIcon(map, MAP_ICONS.BUS_STOP, true, drawBusStop);
    registerIcon(map, MAP_ICONS.FAVORITE_STAR, true, drawStar);
    registerIcon(map, MAP_ICONS.POS_MACHINE, false, drawPosMachine);
    registerIcon(map, MAP_ICONS.POS_INFO, false, drawPosInfo);
    registerIcon(map, MAP_ICONS.POS_OFFICE, false, drawPosOffice);
};
