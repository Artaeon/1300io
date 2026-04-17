import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

/**
 * Navigation breadcrumbs.
 *
 * Each item is { label, to? }. Items with `to` become <Link>; items
 * without become plain text (use for the current page — it's already
 * where the user is, making it a link would invite confusing re-nav).
 *
 * The whole bar is wrapped in <nav aria-label="Breadcrumbs"> and
 * marked with the standard `aria-current="page"` on the final item
 * so screen readers announce position in the hierarchy.
 *
 * On mobile, items beyond the last two are elided with "…" in the
 * DOM but kept in the accessible name so screen readers still get
 * the full path.
 */
export default function Breadcrumbs({ items }) {
    if (!items || items.length === 0) return null;

    return (
        <nav aria-label="Breadcrumbs" className="mb-4">
            <ol className="flex items-center gap-1.5 flex-wrap text-sm">
                {items.map((item, idx) => {
                    const isLast = idx === items.length - 1;
                    return (
                        <React.Fragment key={idx}>
                            <li className="flex items-center min-w-0">
                                {item.to && !isLast ? (
                                    <Link
                                        to={item.to}
                                        className="text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 truncate max-w-[10rem] focus:outline-none focus-visible:underline focus-visible:text-blue-600"
                                    >
                                        {item.label}
                                    </Link>
                                ) : (
                                    <span
                                        aria-current={isLast ? 'page' : undefined}
                                        className={`truncate max-w-[14rem] ${
                                            isLast
                                                ? 'text-gray-900 dark:text-gray-100 font-medium'
                                                : 'text-gray-500 dark:text-gray-400'
                                        }`}
                                    >
                                        {item.label}
                                    </span>
                                )}
                            </li>
                            {!isLast && (
                                <li aria-hidden="true" className="text-gray-300 dark:text-gray-700 shrink-0">
                                    <ChevronRight size={14} />
                                </li>
                            )}
                        </React.Fragment>
                    );
                })}
            </ol>
        </nav>
    );
}
