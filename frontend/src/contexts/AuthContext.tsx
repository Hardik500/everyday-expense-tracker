import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../utils/supabase';
import { User as SupabaseUser } from '@supabase/supabase-js';

const API_BASE = import.meta.env.VITE_API_URL || '';

interface User {
    id: number;
    username: string;
    email?: string;
    full_name?: string;
}

interface AuthContextType {
    user: User | null;
    token: string | null;
    isLoading: boolean;
    logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const syncWithBackend = async (supabaseToken: string) => {
        try {
            const resp = await fetch(`${API_BASE}/auth/me`, {
                headers: {
                    'Authorization': `Bearer ${supabaseToken}`
                }
            });
            if (resp.ok) {
                const userData = await resp.json();
                setUser(userData);
                setToken(supabaseToken);
                localStorage.setItem('auth_token', supabaseToken);
                localStorage.setItem('auth_user', JSON.stringify(userData));
            } else if (resp.status === 401) {
                // Token invalid or user not linked yet
                console.error('Backend sync failed: Unauthorized');
                logout();
            }
        } catch (err) {
            console.error('Error syncing with backend:', err);
        }
    };

    useEffect(() => {
        // 1. Check for initial session
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session) {
                syncWithBackend(session.access_token);
            }
            setIsLoading(false);
        });

        // 2. Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            if (session) {
                syncWithBackend(session.access_token);
            } else {
                setUser(null);
                setToken(null);
                localStorage.removeItem('auth_token');
                localStorage.removeItem('auth_user');
            }
            setIsLoading(false);
        });

        return () => subscription.unsubscribe();
    }, []);

    const logout = async () => {
        await supabase.auth.signOut();
        setToken(null);
        setUser(null);
        localStorage.removeItem('auth_token');
        localStorage.removeItem('auth_user');
    };

    return (
        <AuthContext.Provider value={{ user, token, isLoading, logout }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
