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
                    {mode === 'signup' ? 'Create Account' : mode === 'forgot' ? 'Reset Password' : 'Welcome Back'}
                </h1>
                <p className="text-center text-text-muted text-sm mb-8">
                    {mode === 'signup'
                        ? 'Join Expense Tracker to manage your finances'
                        : mode === 'forgot'
                            ? 'We will send you a recovery link'
                            : 'Please enter your details to sign in'}
                </p>

                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                    {mode === 'signup' && (
                        <div className="input-group">
                            <label className="text-xs font-semibold text-text-secondary mb-1 block">FULL NAME</label>
                            <input
                                type="text"
                                value={fullName}
                                onChange={(e) => setFullName(e.target.value)}
                                placeholder="John Doe"
                                required
                                className="w-full px-4 py-3 rounded-xl bg-bg-primary border border-border-color text-text-primary outline-none"
                            />
                        </div>
                    )}

                    <div className="input-group">
                        <label className="text-xs font-semibold text-text-secondary mb-1 block">EMAIL</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="john@example.com"
                            required
                            className="w-full px-4 py-3 rounded-xl bg-bg-primary border border-border-color text-text-primary outline-none"
                        />
                    </div>

                    {mode !== 'forgot' && (
                        <div className="input-group">
                            <div className="flex justify-between items-center mb-1">
                                <label className="text-xs font-semibold text-text-secondary">PASSWORD</label>
                                {mode === 'signin' && (
                                    <button
                                        type="button"
                                        onClick={() => setMode('forgot')}
                                        className="bg-none border-none text-accent text-xs cursor-pointer"
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
                                className="w-full px-4 py-3 rounded-xl bg-bg-primary border border-border-color text-text-primary outline-none"
                            />
                        </div>
                    )}

                    {error && (
                        <div className="p-3 rounded-xl bg-red-500/10 text-danger text-sm border border-red-500/20">
                            {error}
                        </div>
                    )}

                    {message && (
                        <div className="p-3 rounded-xl bg-emerald-500/10 text-accent text-sm border border-emerald-500/20">
                            {message}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full py-4 rounded-xl bg-accent text-white border-none font-semibold cursor-pointer mt-4 transition-all shadow-[0_4px_12px_rgba(16,185,129,0.2)] hover:-translate-y-0.5"
                    >
                        {isLoading
                            ? 'Processing...'
                            : (mode === 'signup' ? 'Sign Up' : mode === 'forgot' ? 'Send Reset Link' : 'Sign In')}
                    </button>

                    {mode === 'forgot' && (
                        <button
                            type="button"
                            onClick={() => setMode('signin')}
                            className="w-full py-3 rounded-xl bg-transparent text-text-secondary border border-border-color font-medium cursor-pointer transition-all"
                        >
                            Back to Sign In
                        </button>
                    )}
                </form>

                <div className="text-center mt-8">
                    <button
                        onClick={() => setMode(mode === 'signup' ? 'signin' : 'signup')}
                        className="bg-none border-none text-accent cursor-pointer text-sm font-medium"
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