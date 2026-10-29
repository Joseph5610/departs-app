import type { Map } from 'maplibre-gl';
import { MAP_ICONS } from '@/config/mapLayers';
import { provideStopBadges } from './stopBadges';
import { addAlertMarkers } from './alertMarkers';

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
    registerIcon(map, MAP_ICONS.POS_MACHINE, false, drawPosMachine);
    registerIcon(map, MAP_ICONS.POS_INFO, false, drawPosInfo);
    registerIcon(map, MAP_ICONS.POS_OFFICE, false, drawPosOffice);
    addAlertMarkers(map);
    provideStopBadges(map);
};
