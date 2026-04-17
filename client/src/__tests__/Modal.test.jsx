import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Modal from '../components/ui/Modal';

describe('Modal', () => {
    it('renders nothing when closed', () => {
        const { container } = render(
            <Modal open={false} onClose={() => {}} title="Hidden">
                body
            </Modal>,
        );
        expect(container).toBeEmptyDOMElement();
    });

    it('renders title + body when open', () => {
        render(
            <Modal open onClose={() => {}} title="My Dialog">
                <p>Hello</p>
            </Modal>,
        );
        expect(screen.getByRole('dialog', { name: 'My Dialog' })).toBeInTheDocument();
        expect(screen.getByText('Hello')).toBeInTheDocument();
    });

    it('calls onClose on ESC', () => {
        const onClose = vi.fn();
        render(
            <Modal open onClose={onClose} title="Dialog">
                body
            </Modal>,
        );
        fireEvent.keyDown(document, { key: 'Escape' });
        expect(onClose).toHaveBeenCalled();
    });

    it('calls onClose when backdrop button is clicked', () => {
        const onClose = vi.fn();
        render(
            <Modal open onClose={onClose} title="Dialog">
                body
            </Modal>,
        );
        fireEvent.click(screen.getByRole('button', { name: 'Dialog schließen' }));
        expect(onClose).toHaveBeenCalled();
    });

    it('calls onClose on the Close icon button by default', () => {
        const onClose = vi.fn();
        render(
            <Modal open onClose={onClose} title="Dialog">
                body
            </Modal>,
        );
        fireEvent.click(screen.getByRole('button', { name: 'Schließen' }));
        expect(onClose).toHaveBeenCalled();
    });

    it('hides the Close icon button when hideCloseButton', () => {
        render(
            <Modal open onClose={() => {}} title="Dialog" hideCloseButton>
                body
            </Modal>,
        );
        expect(screen.queryByRole('button', { name: 'Schließen' })).not.toBeInTheDocument();
    });

    it('locks body scroll while open', () => {
        const { unmount } = render(
            <Modal open onClose={() => {}} title="Dialog">
                body
            </Modal>,
        );
        expect(document.body.style.overflow).toBe('hidden');
        unmount();
        expect(document.body.style.overflow).not.toBe('hidden');
    });
});
