import React, { useRef } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, act } from '@testing-library/react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { useEscapeKey } from '../hooks/useEscapeKey';

function OnlineProbe({ onState }) {
    const online = useOnlineStatus();
    React.useEffect(() => {
        onState(online);
    }, [online, onState]);
    return <div data-testid="status">{online ? 'online' : 'offline'}</div>;
}

describe('useOnlineStatus', () => {
    it('reports online initially when navigator says so', () => {
        Object.defineProperty(window.navigator, 'onLine', { value: true, configurable: true });
        const states = [];
        render(<OnlineProbe onState={(s) => states.push(s)} />);
        expect(states[0]).toBe(true);
    });

    it('updates when the offline event fires', () => {
        Object.defineProperty(window.navigator, 'onLine', { value: true, configurable: true });
        const states = [];
        const { getByTestId } = render(<OnlineProbe onState={(s) => states.push(s)} />);
        act(() => {
            Object.defineProperty(window.navigator, 'onLine', { value: false, configurable: true });
            window.dispatchEvent(new Event('offline'));
        });
        expect(getByTestId('status').textContent).toBe('offline');
        act(() => {
            Object.defineProperty(window.navigator, 'onLine', { value: true, configurable: true });
            window.dispatchEvent(new Event('online'));
        });
        expect(getByTestId('status').textContent).toBe('online');
    });
});

function TrapHost({ active }) {
    const ref = useFocusTrap(active);
    return (
        <div ref={ref}>
            <button type="button" data-testid="a">A</button>
            <button type="button" data-testid="b">B</button>
            <button type="button" data-testid="c">C</button>
        </div>
    );
}

describe('useFocusTrap', () => {
    it('moves focus inside on activate and cycles Tab', () => {
        render(<TrapHost active />);
        expect(document.activeElement).toBe(document.querySelector('[data-testid="a"]'));

        const c = document.querySelector('[data-testid="c"]');
        c.focus();
        expect(document.activeElement).toBe(c);

        // Tab at last should wrap to first
        const evt = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true });
        document.dispatchEvent(evt);
        expect(document.activeElement).toBe(document.querySelector('[data-testid="a"]'));

        // Shift+Tab at first should wrap to last
        const a = document.querySelector('[data-testid="a"]');
        a.focus();
        const evt2 = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true });
        document.dispatchEvent(evt2);
        expect(document.activeElement).toBe(document.querySelector('[data-testid="c"]'));
    });
});

function EscapeHost({ onEscape, active }) {
    useEscapeKey(onEscape, active);
    return <div />;
}

describe('useEscapeKey', () => {
    it('fires when active and user presses Escape', () => {
        const onEscape = vi.fn();
        render(<EscapeHost onEscape={onEscape} active />);
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
        expect(onEscape).toHaveBeenCalled();
    });

    it('does not fire when inactive', () => {
        const onEscape = vi.fn();
        render(<EscapeHost onEscape={onEscape} active={false} />);
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
        expect(onEscape).not.toHaveBeenCalled();
    });

    it('ignores non-Escape keys', () => {
        const onEscape = vi.fn();
        render(<EscapeHost onEscape={onEscape} active />);
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
        expect(onEscape).not.toHaveBeenCalled();
    });
});

// Suppress the unused-import warning for React — JSX parser needs it,
// but eslint's no-unused-vars doesn't always see that. Keep explicit.
void useRef;
