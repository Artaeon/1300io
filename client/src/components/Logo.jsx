import React from 'react';

/**
 * Inline 1300.io logo. SVG so it scales crisply and inherits the
 * current text color for the wordmark part — that way dark mode
 * flips the "1300" text for free while keeping the shield gradient.
 *
 * Usage:
 *   <Logo />                   shield + wordmark, height 40
 *   <Logo size={56} />         bigger
 *   <Logo variant="shield" />  just the shield
 */
export default function Logo({ size = 40, variant = 'full', className = '' }) {
    if (variant === 'shield') {
        return (
            <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 64 64"
                width={size}
                height={size}
                className={className}
                role="img"
                aria-label="1300.io"
            >
                <defs>
                    <linearGradient id="logo-shield-s" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#3b82f6" />
                        <stop offset="100%" stopColor="#2563eb" />
                    </linearGradient>
                    <linearGradient id="logo-shield-h" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor="#ffffff" stopOpacity="0.25" />
                        <stop offset="60%" stopColor="#ffffff" stopOpacity="0" />
                    </linearGradient>
                </defs>
                <path d="M32 4 L57 12 L57 32 C57 46 45.5 56 32 60 C18.5 56 7 46 7 32 L7 12 Z" fill="url(#logo-shield-s)" />
                <path d="M32 4 L57 12 L57 32 C57 46 45.5 56 32 60 C18.5 56 7 46 7 32 L7 12 Z" fill="url(#logo-shield-h)" />
                <path d="M19.5 32.5 L28.5 42 L45 24" stroke="white" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </svg>
        );
    }

    // Full logo: shield + wordmark. currentColor drives the "1300"
    // so it inherits from its parent (text-gray-900 / dark:text-white).
    const height = size;
    const width = Math.round(size * (220 / 64));
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 220 64"
            width={width}
            height={height}
            className={className}
            role="img"
            aria-label="1300.io"
        >
            <defs>
                <linearGradient id="logo-full-s" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3b82f6" />
                    <stop offset="100%" stopColor="#2563eb" />
                </linearGradient>
                <linearGradient id="logo-full-h" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#ffffff" stopOpacity="0.25" />
                    <stop offset="60%" stopColor="#ffffff" stopOpacity="0" />
                </linearGradient>
            </defs>
            <path d="M32 6 L55 13 L55 32 C55 45.5 44.5 54.5 32 58 C19.5 54.5 9 45.5 9 32 L9 13 Z" fill="url(#logo-full-s)" />
            <path d="M32 6 L55 13 L55 32 C55 45.5 44.5 54.5 32 58 C19.5 54.5 9 45.5 9 32 L9 13 Z" fill="url(#logo-full-h)" />
            <path d="M20 32.5 L28.5 41 L44 25" stroke="white" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            <text
                x="72"
                y="41"
                fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
                fontSize="26"
                fontWeight="700"
                letterSpacing="-0.5"
                fill="currentColor"
            >
                1300<tspan fill="#2563eb">.io</tspan>
            </text>
        </svg>
    );
}
