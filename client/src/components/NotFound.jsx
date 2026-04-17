import React from 'react';
import { Link } from 'react-router-dom';

export default function NotFound() {
    return (
        <div className="min-h-screen bg-gray-100/50 dark:bg-gray-950 flex items-center justify-center px-4">
            <div className="max-w-md w-full bg-white dark:bg-gray-900 rounded-2xl shadow-sm p-8 text-center">
                <p className="text-5xl font-bold text-gray-900 dark:text-gray-100 mb-2">404</p>
                <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                    Seite nicht gefunden
                </h1>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                    Die angeforderte Seite existiert nicht oder wurde verschoben.
                </p>
                <Link
                    to="/"
                    className="inline-block px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium"
                >
                    Zur Startseite
                </Link>
            </div>
        </div>
    );
}
