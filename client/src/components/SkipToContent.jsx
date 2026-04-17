/**
 * Skip-to-content link.
 *
 * Invisible until focused (via Tab on first page load) — keyboard
 * users hit Tab once and can jump past the header into main content.
 * Required by WCAG 2.1 "Bypass Blocks" (2.4.1).
 *
 * Expects a landmark element with id="main-content" somewhere on the
 * page. The link targets via URL fragment + programmatic focus so
 * browsers that don't auto-focus fragment targets still work right.
 */
export default function SkipToContent() {
    const handleSkip = (e) => {
        const target = document.getElementById('main-content');
        if (target) {
            e.preventDefault();
            target.setAttribute('tabindex', '-1');
            target.focus();
            target.scrollIntoView({ block: 'start' });
        }
    };

    return (
        <a
            href="#main-content"
            onClick={handleSkip}
            className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:px-4 focus:py-2 focus:bg-blue-600 focus:text-white focus:rounded-xl focus:shadow-lg focus:outline-none focus:ring-4 focus:ring-blue-300"
        >
            Zum Hauptinhalt springen
        </a>
    );
}
