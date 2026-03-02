import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { AuthProvider, useAuth } from '../context/AuthContext';

function TestComponent() {
  const { user, token, login, logout } = useAuth();
  return (
    <div>
      <span data-testid="user">{user ? JSON.stringify(user) : 'null'}</span>
      <span data-testid="token">{token || 'null'}</span>
      <button onClick={() => login('test@test.com', 'password').catch(() => {})} data-testid="login">Login</button>
      <button onClick={logout} data-testid="logout">Logout</button>
    </div>
  );
}

describe('AuthContext', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('should start with no user and no token', () => {
    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );
    expect(screen.getByTestId('token').textContent).toBe('null');
  });

  it('should load token from localStorage on mount', () => {
    localStorage.setItem('token', 'existing-token');
    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );
    expect(screen.getByTestId('token').textContent).toBe('existing-token');
  });

  it('should clear user and token on logout', async () => {
    localStorage.setItem('token', 'existing-token');
    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await act(async () => {
      screen.getByTestId('logout').click();
    });

    expect(screen.getByTestId('token').textContent).toBe('null');
    expect(screen.getByTestId('user').textContent).toBe('null');
    expect(localStorage.getItem('token')).toBeNull();
  });

  it('should handle successful login', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        token: 'new-token',
        refreshToken: 'new-refresh-token',
        user: { id: 1, email: 'test@test.com', name: 'Test', role: 'ADMIN' }
      }),
    });

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await act(async () => {
      screen.getByTestId('login').click();
    });

    expect(screen.getByTestId('token').textContent).toBe('new-token');
    expect(localStorage.getItem('token')).toBe('new-token');
    expect(localStorage.getItem('refreshToken')).toBe('new-refresh-token');
  });

  it('should not set token on failed login', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
    });

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await act(async () => {
      screen.getByTestId('login').click();
    });

    // Token should remain null after failed login
    expect(screen.getByTestId('token').textContent).toBe('null');
    expect(localStorage.getItem('token')).toBeNull();
  });
});
