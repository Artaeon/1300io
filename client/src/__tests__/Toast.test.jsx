import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { ToastProvider } from '../context/ToastContext';
import { useToast } from '../hooks/useToast';

// Test harness that exposes the toast API to the test body via a callback.
function TestTrigger({ onReady }) {
    const api = useToast();
    React.useEffect(() => {
        onReady(api);
    }, [api, onReady]);
    return null;
}

function renderWithProvider() {
    let api = null;
    render(
        <ToastProvider>
            <TestTrigger onReady={(x) => { api = x; }} />
        </ToastProvider>,
    );
    return () => api;
}

describe('Toast system', () => {
    it('shows a success toast', () => {
        const getApi = renderWithProvider();
        act(() => {
            getApi().toast.success('Saved!');
        });
        expect(screen.getByText('Saved!')).toBeInTheDocument();
    });

    it('shows an error toast with role=alert', () => {
        const getApi = renderWithProvider();
        act(() => {
            getApi().toast.error('Boom');
        });
        const el = screen.getByRole('alert');
        expect(el).toHaveTextContent('Boom');
    });

    it('stacks multiple toasts instead of replacing', () => {
        const getApi = renderWithProvider();
        act(() => {
            getApi().toast.success('First');
            getApi().toast.success('Second');
            getApi().toast.error('Third');
        });
        expect(screen.getByText('First')).toBeInTheDocument();
        expect(screen.getByText('Second')).toBeInTheDocument();
        expect(screen.getByText('Third')).toBeInTheDocument();
    });

    it('renders an action button that dispatches and dismisses', () => {
        const getApi = renderWithProvider();
        const onClick = vi.fn();
        act(() => {
            getApi().toast.error('Failed', { action: { label: 'Retry', onClick } });
        });
        const btn = screen.getByRole('button', { name: 'Retry' });
        fireEvent.click(btn);
        expect(onClick).toHaveBeenCalledTimes(1);
        expect(screen.queryByText('Failed')).not.toBeInTheDocument();
    });

    it('dismisses on the close button click', () => {
        const getApi = renderWithProvider();
        act(() => {
            getApi().toast.info('Hello');
        });
        const closeBtn = screen.getAllByRole('button', { name: 'Schließen' })[0];
        fireEvent.click(closeBtn);
        expect(screen.queryByText('Hello')).not.toBeInTheDocument();
    });

    it('auto-dismisses after the duration expires', async () => {
        vi.useFakeTimers();
        try {
            const getApi = renderWithProvider();
            act(() => {
                getApi().toast.success('Quick', { duration: 1000 });
            });
            expect(screen.getByText('Quick')).toBeInTheDocument();
            await act(async () => {
                vi.advanceTimersByTime(1100);
            });
            expect(screen.queryByText('Quick')).not.toBeInTheDocument();
        } finally {
            vi.useRealTimers();
        }
    });

    it('errors default to 8s, non-errors to 5s', async () => {
        vi.useFakeTimers();
        try {
            const getApi = renderWithProvider();
            act(() => {
                getApi().toast.success('OK');
                getApi().toast.error('Bad');
            });
            await act(async () => {
                vi.advanceTimersByTime(5100);
            });
            expect(screen.queryByText('OK')).not.toBeInTheDocument();
            expect(screen.getByText('Bad')).toBeInTheDocument();
            await act(async () => {
                vi.advanceTimersByTime(3100);
            });
            expect(screen.queryByText('Bad')).not.toBeInTheDocument();
        } finally {
            vi.useRealTimers();
        }
    });

    it('useToast throws outside a provider', () => {
        const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
        function Bare() {
            useToast();
            return null;
        }
        expect(() => render(<Bare />)).toThrow(/within a ToastProvider/);
        spy.mockRestore();
    });
});
