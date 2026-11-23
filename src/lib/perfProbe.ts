import type { Map as MapLibreMap } from 'maplibre-gl';

/** Temporary on-device diagnostics for map smoothness, switched on by `?perf=fps,noglass,blur8,sat,dpr2,noslide,noglow,nonet`. */
const flags = new Set((new URLSearchParams(window.location.search).get('perf') ?? '').split(',').filter(Boolean));

export const perfFlags = {
    noSlide: flags.has('noslide'),
};

const hideLayers = (map: MapLibreMap, match: string) => {
    for (const layer of map.getStyle().layers) {
        if (layer.id.includes(match)) map.setLayoutProperty(layer.id, 'visibility', 'none');
    }
};

/** Applies the map-side switches once the map has loaded. */
export const applyPerfProbe = (map: MapLibreMap) => {
    if (flags.has('dpr2')) map.setPixelRatio(Math.min(2, window.devicePixelRatio));
    if (flags.has('noglow')) hideLayers(map, 'stop-glow');
    if (flags.has('nonet')) hideLayers(map, 'network');
};

/** Applies the page-side switches and, with `fps`, shows the frame rate and the worst frame of each second. */
export const startPerfProbe = () => {
    if (flags.size === 0) return;
    if (flags.has('noglass')) document.documentElement.classList.add('perf-noglass');
    const blur = [...flags].find(flag => /^blur\d+$/.test(flag));
    if (blur) {
        document.documentElement.classList.add('perf-blur');
        document.documentElement.style.setProperty('--perf-blur', `blur(${blur.slice(4)}px)${flags.has('sat') ? ' saturate(140%)' : ''}`);
    }
    if (!flags.has('fps')) return;
    const meter = document.createElement('div');
    meter.style.cssText = 'position:fixed;left:8px;top:calc(env(safe-area-inset-top,0px) + 8px);z-index:99999;padding:4px 8px;border-radius:8px;background:#000c;color:#0f0;font:12px ui-monospace,monospace;pointer-events:none';
    document.body.appendChild(meter);
    let frames = 0;
    let worst = 0;
    let last = performance.now();
    let windowStart = last;
    const tick = (now: number) => {
        frames++;
        worst = Math.max(worst, now - last);
        last = now;
        if (now - windowStart >= 1000) {
            meter.textContent = `${[...flags].join(',')} · ${Math.round(frames * 1000 / (now - windowStart))} fps · worst ${Math.round(worst)} ms`;
            frames = 0;
            worst = 0;
            windowStart = now;
        }
        requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
};
