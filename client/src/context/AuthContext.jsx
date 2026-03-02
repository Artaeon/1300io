import { createContext, useContext, useState, useMemo } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(() => {
        const savedToken = localStorage.getItem('token');
        return savedToken ? { token: savedToken } : null;
    });
    const [token, setToken] = useState(() => localStorage.getItem('token'));

    const login = async (email, password) => {
        const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        if (!res.ok) throw new Error('Login failed');
        const data = await res.json();
        localStorage.setItem('token', data.token);
        setToken(data.token);
        setUser(data.user);
        return true;
    };

    const logout = () => {
        localStorage.removeItem('token');
        setToken(null);
        setUser(null);
    };

    const value = useMemo(() => ({ user, token, login, logout }), [user, token]);

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext);
