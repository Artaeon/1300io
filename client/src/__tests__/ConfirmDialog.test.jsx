import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ConfirmDialog from '../components/ui/ConfirmDialog';

describe('ConfirmDialog', () => {
    it('fires onConfirm when the confirm button is clicked', async () => {
        const onConfirm = vi.fn().mockResolvedValue(undefined);
        const onClose = vi.fn();
        render(
            <ConfirmDialog
                open
                onClose={onClose}
                title="Delete?"
                message="Are you sure?"
                confirmLabel="Delete"
                destructive
                onConfirm={onConfirm}
            />,
        );
        fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
        await waitFor(() => expect(onConfirm).toHaveBeenCalled());
        await waitFor(() => expect(onClose).toHaveBeenCalled());
    });

    it('fires onClose when Cancel is clicked', () => {
        const onClose = vi.fn();
        const onConfirm = vi.fn();
        render(
            <ConfirmDialog
                open
                onClose={onClose}
                title="Delete?"
                message="Are you sure?"
                confirmLabel="Delete"
                destructive
                onConfirm={onConfirm}
            />,
        );
        fireEvent.click(screen.getByRole('button', { name: 'Abbrechen' }));
        expect(onClose).toHaveBeenCalled();
        expect(onConfirm).not.toHaveBeenCalled();
    });

    it('keeps dialog open when onConfirm rejects (so user sees the error)', async () => {
        const onConfirm = vi.fn().mockRejectedValue(new Error('nope'));
        const onClose = vi.fn();
        render(
            <ConfirmDialog
                open
                onClose={onClose}
                title="Delete?"
                message="Are you sure?"
                confirmLabel="Delete"
                destructive
                onConfirm={onConfirm}
            />,
        );
        fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
        await waitFor(() => expect(onConfirm).toHaveBeenCalled());
        expect(onClose).not.toHaveBeenCalled();
    });

    it('disables cancel + confirm while a slow onConfirm is in flight', async () => {
        let resolve;
        const onConfirm = vi.fn(() => new Promise((r) => { resolve = r; }));
        render(
            <ConfirmDialog
                open
                onClose={() => {}}
                title="Delete?"
                message="Are you sure?"
                confirmLabel="Delete"
                destructive
                onConfirm={onConfirm}
            />,
        );
        fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
        await waitFor(() => {
            expect(screen.getByRole('button', { name: /Delete/ })).toBeDisabled();
            expect(screen.getByRole('button', { name: 'Abbrechen' })).toBeDisabled();
        });
        resolve();
    });

    it('renders the provided message', () => {
        render(
            <ConfirmDialog
                open
                onClose={() => {}}
                title="Delete?"
                message={<span data-testid="msg">Das ist endgültig</span>}
                onConfirm={() => Promise.resolve()}
            />,
        );
        expect(screen.getByTestId('msg')).toHaveTextContent('Das ist endgültig');
    });
});
