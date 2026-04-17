import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

export default function LegalFooter() {
    // Fetch server version once for support-ticket traceability.
    // Fails silently — the footer still works without it.
    const [release, setRelease] = useState(null);
    useEffect(() => {
        let cancelled = false;
        fetch('/api/version')
            .then((r) => (r.ok ? r.json() : null))
            .then((body) => {
                if (!cancelled && body) setRelease(body);
            })
            .catch(() => {});
        return () => {
            cancelled = true;
        };
    }, []);

    const year = new Date().getFullYear();

    return (
        <footer className="text-center py-4 text-xs text-gray-400 dark:text-gray-500">
            <div className="flex items-center justify-center flex-wrap gap-x-3 gap-y-1">
                <Link to="/impressum" className="hover:text-gray-600 dark:hover:text-gray-300 hover:underline focus:outline-none focus-visible:underline">
                    Impressum
                </Link>
                <span aria-hidden="true">|</span>
                <Link to="/datenschutz" className="hover:text-gray-600 dark:hover:text-gray-300 hover:underline focus:outline-none focus-visible:underline">
                    Datenschutz
                </Link>
                <span aria-hidden="true">|</span>
                <Link to="/agb" className="hover:text-gray-600 dark:hover:text-gray-300 hover:underline focus:outline-none focus-visible:underline">
                    AGB
                </Link>
            </div>
            <p className="mt-2">
                © {year} Stoicera GesbR
                {release && (
                    <>
                        {' · '}
                        <span title={`Commit: ${release.sha}`} className="font-mono">
                            v{release.version} · {release.sha.slice(0, 7)}
                        </span>
                    </>
                )}
            </p>
        </footer>
    );
}
