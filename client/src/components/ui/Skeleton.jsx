/**
 * Skeleton primitives for loading states.
 *
 * Prefer these over a centered spinner when the final content has a
 * predictable shape — the user's eye already knows where the real
 * content will appear, which feels faster than spinner → snap.
 */
export function SkeletonBlock({ className = '' }) {
    return (
        <div
            aria-hidden="true"
            className={`animate-pulse bg-gray-200 dark:bg-gray-800 rounded ${className}`}
        />
    );
}

/** Card-shaped skeleton matching Dashboard property cards. */
export function SkeletonPropertyCard() {
    return (
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm p-5" aria-busy="true">
            <div className="flex justify-between items-start mb-3">
                <SkeletonBlock className="h-7 w-32" />
                <div className="flex gap-1">
                    <SkeletonBlock className="h-6 w-6 rounded-full" />
                    <SkeletonBlock className="h-6 w-6 rounded-full" />
                    <SkeletonBlock className="h-6 w-6 rounded-full" />
                </div>
            </div>
            <SkeletonBlock className="h-5 w-3/4 mb-2" />
            <SkeletonBlock className="h-4 w-1/2 mb-4" />
            <SkeletonBlock className="h-12 w-full rounded-xl" />
        </div>
    );
}

/** Row-shaped skeleton for admin tables. */
export function SkeletonTableRow() {
    return (
        <tr className="border-b border-gray-100 dark:border-gray-800" aria-busy="true">
            <td className="px-4 py-3"><SkeletonBlock className="h-4 w-32" /></td>
            <td className="px-4 py-3"><SkeletonBlock className="h-4 w-48" /></td>
            <td className="px-4 py-3"><SkeletonBlock className="h-6 w-16 rounded-full" /></td>
            <td className="px-4 py-3"><SkeletonBlock className="h-4 w-16 ml-auto" /></td>
        </tr>
    );
}

/** Generic list skeleton (for audit logs, checklist, etc.). */
export function SkeletonList({ rows = 4 }) {
    return (
        <div className="space-y-3" aria-busy="true" aria-live="polite">
            {Array.from({ length: rows }).map((_, i) => (
                <div key={i} className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm p-4 flex items-center gap-3">
                    <SkeletonBlock className="h-5 w-16 rounded-full" />
                    <SkeletonBlock className="h-4 flex-1" />
                    <SkeletonBlock className="h-4 w-20" />
                </div>
            ))}
        </div>
    );
}
