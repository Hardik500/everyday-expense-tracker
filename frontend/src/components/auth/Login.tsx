import React, { useState } from 'react';
import { supabase } from '../../utils/supabase';

interface LoginProps {
    apiBase: string;
}

type AuthMode = 'signin' | 'signup' | 'forgot';

const Login: React.FC<LoginProps> = ({ apiBase }) => {
    const [mode, setMode] = useState<AuthMode>('signin');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [fullName, setFullName] = useState('');
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setMessage('');
        setIsLoading(true);

        try {
            if (mode === 'signup') {
                const { data, error: signUpError } = await supabase.auth.signUp({
                    email,
                    password,
                    options: {
                        data: {
                            full_name: fullName,
                        },
                        emailRedirectTo: `${window.location.origin}`,
                    }
                });
                if (signUpError) throw signUpError;
                if (data.user && data.session) {
                    // Success, AuthContext will catch session change
                } else {
                    setMessage('Check your email for the confirmation link');
                }
            } else if (mode === 'signin') {
                const { error: signInError } = await supabase.auth.signInWithPassword({
                    email,
                    password,
                });
                if (signInError) throw signInError;
            } else if (mode === 'forgot') {
                const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
                    redirectTo: `${window.location.origin.replace(/\/$/, '')}/reset-password`,
                });
                if (resetError) throw resetError;
                setMessage('Password reset email sent');
            }
        } catch (err: any) {
            // Handle Supabase error objects correctly
            const msg = err.message || err.error_description || 'An unexpected error occurred';
            setError(msg);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--bg-primary)',
            padding: '2rem'
        }}>
            <div style={{
                width: '100%',
                maxWidth: 400,
                background: 'var(--bg-secondary)',
                padding: '2.5rem',
                borderRadius: 24,
                boxShadow: '0 20px 50px rgba(0,0,0,0.3)',
                border: '1px solid var(--border-color)',
                animation: 'fadeIn 0.5s ease-out'
            }}>
                {/* Logo */}
                <div style={{
                    display: 'flex',
                    justifyContent: 'center',
                    marginBottom: '2rem'
                }}>
                    <div style={{
                        width: 64,
                        height: 64,
                        borderRadius: 18,
                        background: 'linear-gradient(135deg, var(--accent) 0%, #059669 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: 'var(--shadow-glow)'
                    }}>
                        <svg width="32" height="32" fill="none" stroke="#fff" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>
                </div>

                <h1 style={{ textAlign: 'center', marginBottom: '0.5rem', fontSize: '1.75rem' }}>
                    {mode === 'signup' ? 'Create Account' : mode === 'forgot' ? 'Reset Password' : 'Welcome Back'}
                </h1>
                <p style={{ textAlign: 'center', color: 'var(--text-muted)', marginBottom: '2rem', fontSize: '0.875rem' }}>
                    {mode === 'signup'
                        ? 'Join Expense Tracker to manage your finances'
                        : mode === 'forgot'
                            ? 'We will send you a recovery link'
                            : 'Please enter your details to sign in'}
                </p>

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {mode === 'signup' && (
                        <div className="input-group">
                            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4, display: 'block' }}>FULL NAME</label>
                            <input
                                type="text"
                                value={fullName}
                                onChange={(e) => setFullName(e.target.value)}
                                placeholder="John Doe"
                                required
                                style={{
                                    width: '100%',
                                    padding: '0.75rem 1rem',
                                    borderRadius: 12,
                                    background: 'var(--bg-primary)',
                                    border: '1px solid var(--border-color)',
                                    color: 'var(--text-primary)',
                                    outline: 'none'
                                }}
                            />
                        </div>
                    )}

                    <div className="input-group">
                        <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4, display: 'block' }}>EMAIL</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="john@example.com"
                            required
                            style={{
                                width: '100%',
                                padding: '0.75rem 1rem',
                                borderRadius: 12,
                                background: 'var(--bg-primary)',
                                border: '1px solid var(--border-color)',
                                color: 'var(--text-primary)',
                                outline: 'none'
                            }}
                        />
                    </div>

                    {mode !== 'forgot' && (
                        <div className="input-group">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>PASSWORD</label>
                                {mode === 'signin' && (
                                    <button
                                        type="button"
                                        onClick={() => setMode('forgot')}
                                        style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: '0.75rem', cursor: 'pointer' }}
                                    >
                                        Forgot?
                                    </button>
                                )}
                            </div>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
                                required
                                style={{
                                    width: '100%',
                                    padding: '0.75rem 1rem',
                                    borderRadius: 12,
                                    background: 'var(--bg-primary)',
                                    border: '1px solid var(--border-color)',
                                    color: 'var(--text-primary)',
                                    outline: 'none'
                                }}
                            />
                        </div>
                    )}

                    {error && (
                        <div style={{
                            padding: '0.75rem',
                            borderRadius: 12,
                            background: 'rgba(239, 68, 68, 0.1)',
                            color: 'var(--danger)',
                            fontSize: '0.875rem',
                            border: '1px solid rgba(239, 68, 68, 0.2)'
                        }}>
                            {error}
                        </div>
                    )}

                    {message && (
                        <div style={{
                            padding: '0.75rem',
                            borderRadius: 12,
                            background: 'rgba(16, 185, 129, 0.1)',
                            color: 'var(--accent)',
                            fontSize: '0.875rem',
                            border: '1px solid rgba(16, 185, 129, 0.2)'
                        }}>
                            {message}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={isLoading}
                        style={{
                            width: '100%',
                            padding: '1rem',
                            borderRadius: 12,
                            background: 'var(--accent)',
                            color: '#fff',
                            border: 'none',
                            fontWeight: 600,
                            cursor: 'pointer',
                            marginTop: '1rem',
                            transition: 'all 0.2s',
                            boxShadow: '0 4px 12px rgba(16, 185, 129, 0.2)'
                        }}
                        onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                        onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                    >
                        {isLoading
                            ? 'Processing...'
                            : (mode === 'signup' ? 'Sign Up' : mode === 'forgot' ? 'Send Reset Link' : 'Sign In')}
                    </button>

                    {mode === 'forgot' && (
                        <button
                            type="button"
                            onClick={() => setMode('signin')}
                            style={{
                                width: '100%',
                                padding: '0.75rem',
                                borderRadius: 12,
                                background: 'transparent',
                                color: 'var(--text-secondary)',
                                border: '1px solid var(--border-color)',
                                fontWeight: 500,
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                            }}
                        >
                            Back to Sign In
                        </button>
                    )}
                </form>

                <div style={{ textAlign: 'center', marginTop: '2rem' }}>
                    <button
                        onClick={() => setMode(mode === 'signup' ? 'signin' : 'signup')}
                        style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--accent)',
                            cursor: 'pointer',
                            fontSize: '0.875rem',
                            fontWeight: 500
                        }}
                    >
                        {mode === 'signup' ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
                    </button>
                </div>
            </div>

            <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
        </div>
    );
};

export default Login;
