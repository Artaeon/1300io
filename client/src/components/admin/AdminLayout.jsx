import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, Users, ListChecks } from 'lucide-react';

const tabs = [
    { path: '/admin/users', label: 'Benutzer', icon: Users },
    { path: '/admin/checklist', label: 'Checkliste', icon: ListChecks },
];

export default function AdminLayout({ children }) {
    const location = useLocation();
    const navigate = useNavigate();

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <div className="bg-white shadow-sm sticky top-0 z-10">
                <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-4">
                    <button onClick={() => navigate('/')} className="text-gray-500 hover:text-gray-700">
                        <ArrowLeft size={22} />
                    </button>
                    <h1 className="text-xl font-bold text-gray-900">Verwaltung</h1>
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
                                        ? 'border-blue-600 text-blue-600'
                                        : 'border-transparent text-gray-500 hover:text-gray-700'
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
