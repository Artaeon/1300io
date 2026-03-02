import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, Users, ListChecks, Building2 } from 'lucide-react';

const tabs = [
    { path: '/admin/users', label: 'Benutzer', icon: Users },
    { path: '/admin/checklist', label: 'Checkliste', icon: ListChecks },
    { path: '/admin/organizations', label: 'Organisationen', icon: Building2 },
];

export default function AdminLayout({ children }) {
    const location = useLocation();
    const navigate = useNavigate();

    return (
        <div className="min-h-screen bg-gray-100/50 dark:bg-gray-950">
            {/* Header */}
            <div className="bg-white/70 dark:bg-gray-900/70 backdrop-blur-xl border-b border-gray-200/50 dark:border-gray-800/50 sticky top-0 z-10">
                <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-4">
                    <button onClick={() => navigate('/')} className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 active:scale-95 transition-all">
                        <ArrowLeft size={22} />
                    </button>
                    <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Verwaltung</h1>
                </div>

                {/* Tab Navigation */}
                <div className="max-w-4xl mx-auto px-4 flex gap-1">
                    {tabs.map(tab => {
                        const Icon = tab.icon;
                        const isActive = location.pathname === tab.path;
                        return (
                            <Link
                                key={tab.path}
                                to={tab.path}
                                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                                    isActive
                                        ? 'border-blue-600 dark:border-blue-400 text-blue-600 dark:text-blue-400'
                                        : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                                }`}
                            >
                                <Icon size={16} />
                                {tab.label}
                            </Link>
                        );
                    })}
                </div>
            </div>

            {/* Content */}
            <div className="max-w-4xl mx-auto px-4 py-6">
                {children}
            </div>
        </div>
    );
}
