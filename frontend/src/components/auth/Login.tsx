/* eslint-disable */
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
    const [showEmailForm, setShowEmailForm] = useState(false);

    const handleGoogleSignIn = async () => {
        setError('');
        setIsLoading(true);
        try {
            const { error: oauthError } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: `${window.location.origin}/dashboard`,
                    scopes: 'openid email profile https://www.googleapis.com/auth/gmail.readonly',
                    queryParams: {
                        access_type: 'offline',
                        prompt: 'consent',
                    },
                },
            });
            if (oauthError) throw oauthError;
        } catch (err: any) {
            setError(err.message || 'Failed to sign in with Google');
            setIsLoading(false);
        }
    };

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
            const msg = err.message || err.error_description || 'An unexpected error occurred';
            setError(msg);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-bg-primary p-8">
            <div className="w-full max-w-[400px] bg-bg-secondary p-10 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.3)] border border-border-color animate-fade-in">
                {/* Logo */}
                <div className="flex justify-center mb-8">
                    <div className="w-16 h-16 rounded-[18px] bg-gradient-to-br from-accent to-emerald-500 flex items-center justify-center shadow-[0_0_20px_rgba(99,102,241,0.3)]">
                        <svg width="32" height="32" fill="none" stroke="#fff" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>
                </div>

                <h1 className="text-center text-[1.75rem] mb-2">
                    {showEmailForm
                        ? (mode === 'signup' ? 'Create Account' : mode === 'forgot' ? 'Reset Password' : 'Sign In with Email')
                        : 'Welcome Back'}
                </h1>
                <p className="text-center text-text-muted text-sm mb-8">
                    {showEmailForm
                        ? (mode === 'signup'
                            ? 'Join Expense Tracker to manage your finances'
                            : mode === 'forgot'
                                ? 'We will send you a recovery link'
                                : 'Enter your email and password')
                        : 'Sign in to manage your finances'}
                </p>

                {/* ── Google Sign-In (Primary) ── */}
                {!showEmailForm && mode !== 'forgot' && (
                    <>
                        <button
                            onClick={handleGoogleSignIn}
                            disabled={isLoading}
                            style={{
                                width: '100%',
                                padding: '0.875rem 1rem',
                                borderRadius: 12,
                                background: '#fff',
                                color: '#1f1f1f',
                                border: '1px solid #dadce0',
                                fontWeight: 600,
                                fontSize: '0.95rem',
                                cursor: isLoading ? 'not-allowed' : 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 12,
                                transition: 'all 0.2s',
                                boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                            }}
                            onMouseOver={(e) => {
                                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
                                e.currentTarget.style.transform = 'translateY(-1px)';
                            }}
                            onMouseOut={(e) => {
                                e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.08)';
                                e.currentTarget.style.transform = 'translateY(0)';
                            }}
                        >
                            {/* Google "G" logo */}
                            <svg width="20" height="20" viewBox="0 0 24 24">
                                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                            </svg>
                            {isLoading ? 'Signing in...' : 'Continue with Google'}
                        </button>

                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 16,
                            margin: '1.25rem 0',
                        }}>
                            <div style={{ flex: 1, height: 1, background: 'var(--border-color)' }} />
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: 1 }}>or</span>
                            <div style={{ flex: 1, height: 1, background: 'var(--border-color)' }} />
                        </div>

                        <button
                            onClick={() => setShowEmailForm(true)}
                            style={{
                                width: '100%',
                                padding: '0.75rem',
                                borderRadius: 12,
                                background: 'transparent',
                                color: 'var(--text-secondary)',
                                border: '1px solid var(--border-color)',
                                fontWeight: 500,
                                fontSize: '0.875rem',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                            }}
                            onMouseOver={(e) => {
                                e.currentTarget.style.borderColor = 'var(--accent)';
                                e.currentTarget.style.color = 'var(--accent)';
                            }}
                            onMouseOut={(e) => {
                                e.currentTarget.style.borderColor = 'var(--border-color)';
                                e.currentTarget.style.color = 'var(--text-secondary)';
                            }}
                        >
                            Sign in with Email
                        </button>

                        <p style={{
                            textAlign: 'center',
                            fontSize: '0.75rem',
                            color: 'var(--text-secondary)',
                            marginTop: '1rem',
                            lineHeight: 1.5,
                            opacity: 0.7,
                        }}>
                            Sign in with Google to auto-import<br />bank statements from your Gmail
                        </p>
                    </>
                )}

                {/* ── Email/Password Form ── */}
                {(showEmailForm || mode === 'forgot') && (
                    <>
                        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
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
                                    marginTop: '0.5rem',
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
                                    onClick={() => { setMode('signin'); setShowEmailForm(true); }}
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

                        {/* Toggle between sign in / sign up */}
                        <div style={{ textAlign: 'center', marginTop: '1.25rem' }}>
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

                        {/* Back to Google option */}
                        {mode !== 'forgot' && (
                            <div style={{ textAlign: 'center', marginTop: '0.75rem' }}>
                                <button
                                    onClick={() => { setShowEmailForm(false); setMode('signin'); setError(''); setMessage(''); }}
                                    style={{
                                        background: 'none',
                                        border: 'none',
                                        color: 'var(--text-secondary)',
                                        cursor: 'pointer',
                                        fontSize: '0.8rem',
                                        opacity: 0.7,
                                    }}
                                >
                                    ← Back to all sign-in options
                                </button>
                            </div>
                        )}
                    </>
                )}

                {/* Error display for Google sign-in (outside form) */}
                {!showEmailForm && error && (
                    <div style={{
                        padding: '0.75rem',
                        borderRadius: 12,
                        background: 'rgba(239, 68, 68, 0.1)',
                        color: 'var(--danger)',
                        fontSize: '0.875rem',
                        border: '1px solid rgba(239, 68, 68, 0.2)',
                        marginTop: '1rem',
                    }}>
                        {error}
                    </div>
                )}
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
