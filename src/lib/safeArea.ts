/** The top safe-area inset (status bar, notch) in CSS pixels, measured with a throwaway element. */
export const readSafeAreaTop = (): number => {
    const probe = document.createElement('div');
    probe.style.cssText = 'position:fixed;top:0;left:0;width:0;height:env(safe-area-inset-top,0px);visibility:hidden;pointer-events:none';
    document.body.appendChild(probe);
    const height = probe.getBoundingClientRect().height;
    probe.remove();
    return height;
};
