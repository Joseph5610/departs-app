import { createAppleSplashScreens, defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config';

/** Icon backdrop and launch screen colour; matches the manifest's background_color. */
const BACKGROUND = '#000000';

export default defineConfig({
    headLinkOptions: {
        preset: '2023',
    },
    preset: {
        ...minimal2023Preset,
        transparent: { ...minimal2023Preset.transparent, padding: 0 },
        maskable: { ...minimal2023Preset.maskable, padding: 0, resizeOptions: { background: BACKGROUND } },
        apple: { ...minimal2023Preset.apple, padding: 0, resizeOptions: { background: BACKGROUND } },
        // Icon spans 28% of the screen's short side; #boot-splash in index.html uses 28vmin so the handoff lines up.
        appleSplashScreens: createAppleSplashScreens({
            padding: 0.72,
            resizeOptions: { background: BACKGROUND, fit: 'contain' },
            linkMediaOptions: { addMediaScreen: true, xhtml: false },
            png: { compressionLevel: 9, quality: 60 },
        }, [
            'iPhone 17 Pro Max', 'iPhone 17 Pro', 'iPhone Air', 'iPhone 17', 'iPhone 16 Plus', 'iPhone 16', 'iPhone 16e',
            'iPhone 13 Pro Max', 'iPhone 11 Pro Max', 'iPhone 11', 'iPhone X', 'iPhone 8 Plus', 'iPhone 8', 'iPhone SE 4"',
            'iPad Pro 12.9"', 'iPad Pro 11"', 'iPad Air 13"', 'iPad Air 11"', 'iPad Air 10.9"', 'iPad 10.2"', 'iPad mini 8.3"',
        ]),
    },
    images: ['public/pwa-icon.webp'],
});
