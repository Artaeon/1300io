import React from 'react';
import { Link } from 'react-router-dom';

export default function NotFound() {
    return (
        <div className="min-h-screen bg-gray-100/50 dark:bg-gray-950 flex items-center justify-center px-4">
            <div className="hover-lift max-w-md w-full bg-white dark:bg-gray-900 rounded-2xl shadow-sm hover:shadow-xl p-8 text-center animate-fade-in-up ring-1 ring-gray-200/60 dark:ring-gray-800/60">
                <p className="text-5xl font-bold text-gray-900 dark:text-gray-100 mb-2">404</p>
                <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                    Seite nicht gefunden
                </h1>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                    Die angeforderte Seite existiert nicht oder wurde verschoben.
                </p>
                <Link
                    to="/"
                    className="btn-apple inline-block px-5 py-2.5 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 dark:from-blue-500 dark:to-indigo-600 text-white text-sm font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                >
                    Zur Startseite
                </Link>
            </div>
        </div>
    );
}
