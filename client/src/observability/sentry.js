// Optional client-side Sentry integration. Dormant until both
// VITE_SENTRY_DSN is set and @sentry/react is installed.
//
// To enable:
//   1. Install: npm i @sentry/react
//   2. Add VITE_SENTRY_DSN=<dsn> to the client build env
//   3. Rebuild
//
// The ErrorBoundary in components/ErrorBoundary.jsx already calls
// window.Sentry.captureException(err) if present, so this module's
// init() exposes Sentry on window for that path.

export async function initSentry() {
    const dsn = import.meta.env.VITE_SENTRY_DSN;
    if (!dsn) return;

    // Opaque the specifier so Vite's static import-analysis can't resolve
    // it at build time. Without this, an uninstalled @sentry/react breaks
    // the dev server even though the import is wrapped in try/catch.
    const pkg = /* @vite-ignore */ '@sentry/react';
    let Sentry;
    try {
        Sentry = await import(/* @vite-ignore */ pkg);
    } catch {
        // @sentry/react not installed; silently skip.
        return;
    }

    Sentry.init({
        dsn,
        environment: import.meta.env.MODE,
        tracesSampleRate: parseFloat(import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE || '0.1'),
        release: import.meta.env.VITE_SENTRY_RELEASE,
    });

    window.Sentry = Sentry;
}
