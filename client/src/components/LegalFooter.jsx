import React from 'react';
import { Link } from 'react-router-dom';

export default function LegalFooter() {
    return (
        <footer className="text-center py-4 text-xs text-gray-400">
            <div className="flex items-center justify-center gap-3">
                <Link to="/impressum" className="hover:text-gray-600 hover:underline">
                    Impressum
                </Link>
                <span>|</span>
                <Link to="/datenschutz" className="hover:text-gray-600 hover:underline">
                    Datenschutz
                </Link>
            </div>
            <p className="mt-2">© 2026 Stoicera GesbR</p>
        </footer>
    );
}
