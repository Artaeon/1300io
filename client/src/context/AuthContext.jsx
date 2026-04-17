import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { useToast } from '../hooks/useToast';

const AuthContext = createContext(null);

/**
 * Typed error so Login.jsx can tell the user *why* login failed:
 * bad credentials vs. rate limit vs. network vs. server.
 */
export class LoginError extends Error {
    constructor(kind, status, message) {
        super(message);
        this.name = 'LoginError';
        this.kind = kind; // 'credentials' | 'rate-limit' | 'network' | 'server'
        this.status = status ?? null;
    }
}

export function AuthProvider({ children }) {
    const { toast } = useToast();
    const [user, setUser] = useState(() => {
        const savedToken = localStorage.getItem('token');
        return savedToken ? { token: savedToken } : null;
    });
    const [token, setToken] = useState(() => localStorage.getItem('token'));
    const refreshPromiseRef = useRef(null);
    const sessionExpiredNoticedRef = useRef(false);

    const logout = useCallback(
        (opts = {}) => {
            const rt = localStorage.getItem('refreshToken');
            if (rt) {
                fetch('/api/auth/logout', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ refreshToken: rt }),
                }).catch(() => {});
            }
            localStorage.removeItem('token');
            localStorage.removeItem('refreshToken');
            setToken(null);
            setUser(null);
            if (opts.reason === 'session-expired' && !sessionExpiredNoticedRef.current) {
                sessionExpiredNoticedRef.current = true;
                toast.info('Sitzung abgelaufen. Bitte erneut anmelden.');
            }
        },
        [toast],
    );

    const refreshAccessToken = useCallback(async () => {
        if (refreshPromiseRef.current) return refreshPromiseRef.current;

        const promise = (async () => {
            const rt = localStorage.getItem('refreshToken');
            if (!rt) {
                logout({ reason: 'session-expired' });
                return null;
            }
            try {
                const res = await fetch('/api/auth/refresh', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ refreshToken: rt }),
                });
                if (!res.ok) {
                    logout({ reason: 'session-expired' });
                    return null;
                }
                const data = await res.json();
                localStorage.setItem('token', data.token);
                localStorage.setItem('refreshToken', data.refreshToken);
                setToken(data.token);
                setUser(data.user);
                sessionExpiredNoticedRef.current = false;
                return data.token;
            } catch {
                // Network down during refresh. Don't log out on transient
                // failures — the active request will surface its own
                // error toast, and the user can retry once back online.
                return null;
            } finally {
                refreshPromiseRef.current = null;
            }
        })();

        refreshPromiseRef.current = promise;
        return promise;
    }, [logout]);

    const authFetch = useCallback(
        async (url, options = {}) => {
            const currentToken = localStorage.getItem('token');
            const headers = {
                ...options.headers,
                Authorization: `Bearer ${currentToken}`,
            };
            let res = await fetch(url, { ...options, headers });

            if (res.status === 401 || res.status === 403) {
                const newToken = await refreshAccessToken();
                if (newToken) {
                    headers.Authorization = `Bearer ${newToken}`;
                    res = await fetch(url, { ...options, headers });
                }
            }
            return res;
        },
        [refreshAccessToken],
    );

    const login = useCallback(async (email, password) => {
        let res;
        try {
            res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            });
        } catch {
            throw new LoginError('network', null, 'Netzwerk-Fehler. Bitte prüfen Sie Ihre Verbindung.');
        }

        if (res.status === 401) {
            throw new LoginError('credentials', 401, 'Ungültige Zugangsdaten');
        }
        if (res.status === 429) {
            throw new LoginError('rate-limit', 429, 'Zu viele Anmeldeversuche. Bitte in 15 Minuten erneut versuchen.');
        }
        if (!res.ok) {
            throw new LoginError('server', res.status, 'Anmeldung fehlgeschlagen. Bitte später erneut versuchen.');
        }

        const data = await res.json();
        localStorage.setItem('token', data.token);
        localStorage.setItem('refreshToken', data.refreshToken);
        setToken(data.token);
        setUser(data.user);
        sessionExpiredNoticedRef.current = false;
        return true;
    }, []);

    // Seed the session from an external flow that already obtained
    // tokens server-side — used by the first-run setup wizard so the
    // admin lands logged in after POST /api/setup/initialize, without
    // a round-trip to /api/auth/login.
    const bootstrapSession = useCallback(({ token: t, refreshToken: rt, user: u }) => {
        localStorage.setItem('token', t);
        localStorage.setItem('refreshToken', rt);
        setToken(t);
        setUser(u);
        sessionExpiredNoticedRef.current = false;
    }, []);

    const value = useMemo(
        () => ({ user, token, login, logout, authFetch, bootstrapSession }),
        [user, token, login, logout, authFetch, bootstrapSession],
    );

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext);
