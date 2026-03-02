import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Login from '../components/Login';

// Mock the auth context
const mockLogin = vi.fn();
const mockNavigate = vi.fn();

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    login: mockLogin,
    user: null,
    token: null,
    logout: vi.fn(),
  }),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('Login Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render login form', () => {
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );

    expect(screen.getByText('Anmelden')).toBeInTheDocument();
    expect(screen.getByText('Email')).toBeInTheDocument();
    expect(screen.getByText('Passwort')).toBeInTheDocument();
    expect(screen.getByText('Einloggen')).toBeInTheDocument();
    // Check input fields exist by type
    expect(document.querySelector('input[type="email"]')).toBeInTheDocument();
    expect(document.querySelector('input[type="password"]')).toBeInTheDocument();
  });

  it('should call login on form submission', async () => {
    mockLogin.mockResolvedValue(true);

    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );

    const emailInput = document.querySelector('input[type="email"]');
    const passwordInput = document.querySelector('input[type="password"]');

    fireEvent.change(emailInput, { target: { value: 'test@test.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.click(screen.getByText('Einloggen'));

    expect(mockLogin).toHaveBeenCalledWith('test@test.com', 'password123');
  });

  it('should show error on failed login', async () => {
    mockLogin.mockRejectedValue(new Error('Login failed'));

    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );

    const emailInput = document.querySelector('input[type="email"]');
    const passwordInput = document.querySelector('input[type="password"]');

    fireEvent.change(emailInput, { target: { value: 'wrong@test.com' } });
    fireEvent.change(passwordInput, { target: { value: 'wrong' } });
    fireEvent.click(screen.getByText('Einloggen'));

    const errorEl = await screen.findByText('Ungültige Zugangsdaten');
    expect(errorEl).toBeInTheDocument();
  });
});
