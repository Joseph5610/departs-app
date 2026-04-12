/**
 * Checks if the application is currently running in standalone mode (installed as a PWA).
 */
export const isStandalone = () => {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as any).standalone ||
    document.referrer.includes("android-app://")
  );
};
