import type { IconNode } from 'lucide-react';

/** A Lucide glyph's shapes in its 24-unit viewBox, drawn on a canvas since map images cannot be SVG. */
export type GlyphNode =
    | ['path', string]
    | ['circle', number, number, number]
    | ['rect', number, number, number, number, number];

/** A Lucide icon node as canvas glyph nodes. */
export const glyphOf = (node: IconNode): GlyphNode[] => node.map(([tag, a]): GlyphNode =>
    tag === 'circle' ? ['circle', Number(a.cx), Number(a.cy), Number(a.r)]
        : tag === 'rect' ? ['rect', Number(a.x), Number(a.y), Number(a.width), Number(a.height), Number(a.rx ?? 0)]
            : ['path', a.d ?? '']);

/** Strokes `nodes` as a `px` square with its top-left corner at (`left`, `top`); `lineWidth` is in viewBox units. */
export const strokeGlyph = (ctx: CanvasRenderingContext2D, nodes: GlyphNode[], left: number, top: number, px: number, color: string, lineWidth: number) => {
    const scale = px / 24;
    ctx.save();
    ctx.translate(left, top);
    ctx.scale(scale, scale);
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const node of nodes) {
        if (node[0] === 'path') {
            ctx.stroke(new Path2D(node[1]));
            continue;
        }
        ctx.beginPath();
        if (node[0] === 'circle') ctx.arc(node[1], node[2], node[3], 0, Math.PI * 2);
        else ctx.roundRect(node[1], node[2], node[3], node[4], node[5]);
        ctx.stroke();
    }
    ctx.restore();
};
