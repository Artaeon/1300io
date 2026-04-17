import React from 'react';

export default class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { error: null };
    }

    static getDerivedStateFromError(error) {
        return { error };
    }

    componentDidCatch(error, info) {
        console.error('Uncaught UI error', error, info);
        if (typeof window !== 'undefined' && window.Sentry) {
            window.Sentry.captureException(error, { extra: info });
        }
    }

    handleReset = () => {
        this.setState({ error: null });
    };

    handleReload = () => {
        window.location.reload();
    };

    render() {
        if (!this.state.error) return this.props.children;

        return (
            <div className="min-h-screen bg-gray-100/50 dark:bg-gray-950 flex items-center justify-center px-4">
                <div className="max-w-md w-full bg-white dark:bg-gray-900 rounded-2xl shadow-sm p-8 text-center">
                    <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                        Ein Fehler ist aufgetreten
                    </h1>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                        Die Anwendung ist auf einen unerwarteten Fehler gestoßen.
                        Bitte laden Sie die Seite neu oder versuchen Sie es später erneut.
                    </p>
                    {import.meta.env.DEV && (
                        <pre className="text-xs text-left bg-gray-100 dark:bg-gray-800 text-red-700 dark:text-red-400 rounded-lg p-3 mb-6 overflow-auto max-h-48">
                            {this.state.error?.message || String(this.state.error)}
                        </pre>
                    )}
                    <div className="flex gap-3 justify-center">
                        <button
                            type="button"
                            onClick={this.handleReload}
                            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium"
                        >
                            Seite neu laden
                        </button>
                        <button
                            type="button"
                            onClick={this.handleReset}
                            className="px-4 py-2 rounded-lg bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm font-medium"
                        >
                            Fortfahren
                        </button>
                    </div>
                </div>
            </div>
        );
    }
}
