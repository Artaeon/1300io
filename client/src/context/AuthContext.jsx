import { createContext, useContext, useState, useMemo, useCallback, useRef } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(() => {
        const savedToken = localStorage.getItem('token');
        return savedToken ? { token: savedToken } : null;
    });
    const [token, setToken] = useState(() => localStorage.getItem('token'));
    const refreshPromiseRef = useRef(null);

    const logout = useCallback(() => {
        const rt = localStorage.getItem('refreshToken');
        if (rt) {
            fetch('/api/auth/logout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ refreshToken: rt })
            }).catch(() => {});
        }
        localStorage.removeItem('token');
        localStorage.removeItem('refreshToken');
        setToken(null);
        setUser(null);
    }, []);

    const refreshAccessToken = useCallback(async () => {
        // Deduplicate concurrent refresh calls
        if (refreshPromiseRef.current) return refreshPromiseRef.current;

        const promise = (async () => {
            const rt = localStorage.getItem('refreshToken');
            if (!rt) {
                logout();
                return null;
            }
            try {
                const res = await fetch('/api/auth/refresh', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ refreshToken: rt })
                });
                if (!res.ok) {
                    logout();
                    return null;
                }
                const data = await res.json();
                localStorage.setItem('token', data.token);
                localStorage.setItem('refreshToken', data.refreshToken);
                setToken(data.token);
                setUser(data.user);
                return data.token;
            } catch {
                logout();
                return null;
            } finally {
                refreshPromiseRef.current = null;
            }
        })();

        refreshPromiseRef.current = promise;
        return promise;
    }, [logout]);

    const authFetch = useCallback(async (url, options = {}) => {
        const currentToken = localStorage.getItem('token');
        const headers = { ...options.headers, 'Authorization': `Bearer ${currentToken}` };
        let res = await fetch(url, { ...options, headers });

        // Auto-retry on 401/403 with token refresh
        if (res.status === 401 || res.status === 403) {
            const newToken = await refreshAccessToken();
            if (newToken) {
                headers['Authorization'] = `Bearer ${newToken}`;
                res = await fetch(url, { ...options, headers });
            }
        }
        return res;
    }, [refreshAccessToken]);

    const login = async (email, password) => {
        const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        if (!res.ok) throw new Error('Login failed');
        const data = await res.json();
        localStorage.setItem('token', data.token);
        localStorage.setItem('refreshToken', data.refreshToken);
        setToken(data.token);
        setUser(data.user);
        return true;
    };

    const value = useMemo(() => ({ user, token, login, logout, authFetch }), [user, token, logout, authFetch]);

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext);
