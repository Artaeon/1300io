import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Login from '../components/Login';
import { ToastProvider } from '../context/ToastContext';

const mockLogin = vi.fn();
const mockNavigate = vi.fn();

// Real LoginError class (not a mock) — the Login component does
// `instanceof LoginError`, so the rejection value must be the same
// class the component imported.
vi.mock('../context/AuthContext', async () => {
    const LoginError = class extends Error {
        constructor(kind, status, message) {
            super(message);
            this.kind = kind;
            this.status = status ?? null;
        }
    };
    return {
        useAuth: () => ({
            login: mockLogin,
            user: null,
            token: null,
            logout: vi.fn(),
        }),
        LoginError,
    };
});

vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return {
        ...actual,
        useNavigate: () => mockNavigate,
    };
});

function renderLogin() {
    return render(
        <ToastProvider>
            <MemoryRouter>
                <Login />
            </MemoryRouter>
        </ToastProvider>,
    );
}

describe('Login component', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders the login form', () => {
        renderLogin();
        expect(screen.getByText('Anmelden')).toBeInTheDocument();
        expect(screen.getByLabelText('Email')).toBeInTheDocument();
        expect(screen.getByLabelText('Passwort')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Einloggen' })).toBeInTheDocument();
    });

    it('submits credentials to the login function', () => {
        mockLogin.mockResolvedValue(true);
        renderLogin();
        fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'test@test.com' } });
        fireEvent.change(screen.getByLabelText('Passwort'), { target: { value: 'password123' } });
        fireEvent.click(screen.getByRole('button', { name: 'Einloggen' }));
        expect(mockLogin).toHaveBeenCalledWith('test@test.com', 'password123');
    });

    it('shows the typed error message for bad credentials', async () => {
        const { LoginError } = await import('../context/AuthContext');
        mockLogin.mockRejectedValue(new LoginError('credentials', 401, 'Ungültige Zugangsdaten'));
        renderLogin();
        fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'wrong@test.com' } });
        fireEvent.change(screen.getByLabelText('Passwort'), { target: { value: 'wrong' } });
        fireEvent.click(screen.getByRole('button', { name: 'Einloggen' }));
        expect(await screen.findByText('Ungültige Zugangsdaten')).toBeInTheDocument();
    });

    it('renders rate-limit errors with a different visual treatment', async () => {
        const { LoginError } = await import('../context/AuthContext');
        mockLogin.mockRejectedValue(new LoginError('rate-limit', 429, 'Zu viele Anmeldeversuche.'));
        renderLogin();
        fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'a@b.test' } });
        fireEvent.change(screen.getByLabelText('Passwort'), { target: { value: 'x' } });
        fireEvent.click(screen.getByRole('button', { name: 'Einloggen' }));
        const el = await screen.findByRole('alert');
        expect(el).toHaveTextContent('Zu viele Anmeldeversuche.');
        // rate-limit errors use orange; credentials use red. We only
        // assert the class delta exists, not the exact tailwind names.
        expect(el.className).toMatch(/orange/);
    });

    it('disables submit while loading', async () => {
        let resolveLogin;
        mockLogin.mockImplementation(
            () => new Promise((r) => {
                resolveLogin = r;
            }),
        );
        renderLogin();
        fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'a@b.test' } });
        fireEvent.change(screen.getByLabelText('Passwort'), { target: { value: 'x' } });
        fireEvent.click(screen.getByRole('button', { name: 'Einloggen' }));
        const submitBtn = screen.getByRole('button', { name: /Anmeldung läuft/ });
        expect(submitBtn).toBeDisabled();
        resolveLogin(true);
    });
});

// Silence unused React import warning (JSX requires it in some setups).
void React;
