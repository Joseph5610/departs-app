import { useEffect, useState } from 'react';

type Mode = 'vh' | 'fit' | 'strip' | 'header' | 'htmlFit' | 'redStrip' | 'oldSearch' | 'oldSearchFull' | 'solidBar' | 'fadeBar' | 'six';

const MODES: Mode[] = ['vh', 'six', 'solidBar', 'fadeBar', 'fit', 'strip', 'header', 'htmlFit', 'redStrip', 'oldSearch', 'oldSearchFull'];

const initialMode = (): Mode => {
    const m = new URLSearchParams(window.location.search).get('probe') as Mode | null;
    return m && MODES.includes(m) ? m : 'vh';
};

const measure = (css: string): number => {
    const el = document.createElement('div');
    el.style.cssText = `position:absolute;visibility:hidden;top:0;left:0;width:1px;${css}`;
    document.body.appendChild(el);
    const h = el.getBoundingClientRect().height;
    el.remove();
    return Math.round(h);
};

const read = () => {
    const de = document.documentElement;
    return {
        inner: window.innerHeight,
        vv: Math.round(window.visualViewport?.height ?? 0),
        screen: window.screen.height,
        vh: measure('height:100vh'),
        dvh: measure('height:100dvh'),
        lvh: measure('height:100lvh'),
        safeTop: measure('height:env(safe-area-inset-top)'),
        safeBottom: measure('height:env(safe-area-inset-bottom)'),
        docScroll: de.scrollHeight,
        docClient: de.clientHeight,
        bodyH: Math.round(document.body.getBoundingClientRect().height),
        standalone: String((navigator as Navigator & { standalone?: boolean }).standalone),
        dmStandalone: String(matchMedia('(display-mode: standalone)').matches),
        scrollY: Math.round(window.scrollY),
    };
};

const applyMode = (mode: Mode) => {
    const html = document.documentElement.style;
    const body = document.body.style;
    const root = document.getElementById('root')!.style;
    for (const s of [html, body, root]) {
        s.removeProperty('height');
        s.removeProperty('position');
        s.removeProperty('top');
        s.removeProperty('left');
    }
    document.getElementById('probe-strip')?.remove();

    if (mode === 'fit') {
        html.height = '100%';
        body.height = '100%';
        Object.assign(root, { position: 'fixed', top: '0', left: '0', height: '100vh' });
    }
    if (mode === 'htmlFit') {
        html.height = '100%';
    }
    if (mode === 'six') {
        const strip = document.createElement('div');
        strip.id = 'probe-strip';
        strip.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:6px;background-color:#16181d;z-index:450;pointer-events:none';
        document.body.appendChild(strip);
    }
    if (mode === 'solidBar' || mode === 'fadeBar') {
        const strip = document.createElement('div');
        strip.id = 'probe-strip';
        strip.style.cssText = mode === 'solidBar'
            ? 'position:fixed;top:0;left:0;right:0;height:calc(env(safe-area-inset-top) + 44px);background:var(--background);z-index:450;pointer-events:none'
            : 'position:fixed;top:0;left:0;right:0;height:calc(env(safe-area-inset-top) + 72px);background:linear-gradient(to bottom, var(--background) 0, var(--background) calc(env(safe-area-inset-top) + 40px), transparent 100%);z-index:450;pointer-events:none';
        document.body.appendChild(strip);
    }
    if (mode === 'redStrip') {
        const strip = document.createElement('div');
        strip.id = 'probe-strip';
        strip.style.cssText = 'position:fixed;top:0;left:0;right:0;height:calc(env(safe-area-inset-top) + 10px);background:#c00;z-index:450;pointer-events:none';
        document.body.appendChild(strip);
    }
    if (mode === 'strip' || mode === 'header') {
        const strip = document.createElement('div');
        strip.id = 'probe-strip';
        strip.style.cssText = mode === 'strip'
            ? 'position:fixed;top:0;left:0;right:0;height:env(safe-area-inset-top);background:var(--background);z-index:450;pointer-events:none'
            : 'position:fixed;top:0;left:0;right:0;height:calc(env(safe-area-inset-top) + 44px);background:color-mix(in oklab, var(--background) 80%, transparent);-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px);z-index:450;pointer-events:none';
        document.body.appendChild(strip);
    }
};

interface FixedEl { el: HTMLElement; label: string }

const topFixedElements = (): FixedEl[] => {
    const out: FixedEl[] = [];
    for (const el of Array.from(document.querySelectorAll<HTMLElement>('body *'))) {
        if (el.closest('[data-probe]')) continue;
        if (getComputedStyle(el).position !== 'fixed') continue;
        const r = el.getBoundingClientRect();
        if (r.top > 5 || r.width < window.innerWidth * 0.5) continue;
        const name = el.dataset.testid ?? el.dataset.slot ?? el.id ?? '';
        out.push({ el, label: `${name || el.tagName.toLowerCase()} ${Math.round(r.width)}x${Math.round(r.height)} z${getComputedStyle(el).zIndex} ${el.className.toString().slice(0, 40)}` });
    }
    return out;
};

/** Temporary on-device readout of the viewport, with buttons switching layout variants live. */
export const ViewportProbe = () => {
    const [mode, setMode] = useState<Mode>(initialMode);
    const [values, setValues] = useState(read);
    const [open, setOpen] = useState(true);
    const [fixedEls, setFixedEls] = useState<FixedEl[]>([]);
    const [, force] = useState(0);

    useEffect(() => {
        applyMode(mode);
        const id = window.setInterval(() => setValues(read()), 500);
        return () => window.clearInterval(id);
    }, [mode]);

    const reloadWith = () => {
        const url = new URL(window.location.href);
        url.searchParams.set('probe', mode);
        window.location.replace(url.toString());
    };

    return (
        <>
        {(mode === 'oldSearch' || mode === 'oldSearchFull') && (
            <div
                className="pointer-events-none fixed top-0 left-0 z-1000 p-4"
                style={{ paddingTop: 'calc(env(safe-area-inset-top) + 1rem)', width: mode === 'oldSearch' ? 'calc(100% - 56px)' : '100%' }}
            >
                <div className="glassy flex h-11 items-center rounded-2xl px-4 text-muted-foreground">old search bar</div>
            </div>
        )}
        <div
            data-probe
            className="fixed left-2 z-5000 max-w-[70vw] rounded-lg bg-black/85 p-2 font-mono text-caption leading-tight text-white"
            style={{ top: 'calc(env(safe-area-inset-top) + 50px)' }}
        >
            <button type="button" className="mb-1 underline" onClick={() => setOpen(o => !o)}>probe {open ? '−' : '+'} [{mode}]</button>
            {open && (
                <>
                    <pre className="whitespace-pre-wrap">{Object.entries(values).map(([k, v]) => `${k}: ${v}`).join('\n')}</pre>
                    <div className="mt-1 flex flex-wrap gap-1">
                        {MODES.map(m => (
                            <button key={m} type="button" onClick={() => setMode(m)} className={m === mode ? 'rounded bg-white px-2 py-1 text-black' : 'rounded bg-white/20 px-2 py-1'}>
                                {m}
                            </button>
                        ))}
                    </div>
                    <button type="button" onClick={() => setFixedEls(topFixedElements())} className="mt-1 mr-1 rounded bg-white/20 px-2 py-1">list top fixed</button>
                    {fixedEls.map(({ el, label }, i) => (
                        <button
                            key={i}
                            type="button"
                            onClick={() => { el.style.display = el.style.display === 'none' ? '' : 'none'; force(n => n + 1); }}
                            className={el.style.display === 'none' ? 'mt-1 block w-full rounded bg-red-700 px-2 py-1 text-left' : 'mt-1 block w-full rounded bg-white/10 px-2 py-1 text-left'}
                        >
                            {el.style.display === 'none' ? 'HIDDEN ' : ''}{label}
                        </button>
                    ))}
                    <button type="button" onClick={reloadWith} className="mt-1 rounded bg-white/20 px-2 py-1">reload with {mode}</button>
                </>
            )}
        </div>
        </>
    );
};
