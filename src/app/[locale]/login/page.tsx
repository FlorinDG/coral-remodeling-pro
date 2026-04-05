"use client";

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from '@/i18n/routing';
import Logo from '@/components/Logo';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { Loader2, Mail, Lock } from 'lucide-react';

export default function LoginPage() {
    const [isLoading, setIsLoading] = useState(false);
    const [isCredentialsLoading, setIsCredentialsLoading] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const router = useRouter();

    const handleGoogleAuth = async () => {
        setIsLoading(true);
        // NextAuth will handle the redirect automatically once successful.
        await signIn('google', { callbackUrl: '/admin/dashboard' });
    };

    const handleCredentialsAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsCredentialsLoading(true);
        setError('');

        try {
            const result = await signIn('credentials', {
                email,
                password,
                redirect: false,
            });

            if (result?.error) {
                setError('Invalid workspace credentials');
            } else {
                router.push('/admin/dashboard');
                router.refresh();
            }
        } catch {
            setError('System error. Please try again later.');
        } finally {
            setIsCredentialsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#f9fafb] dark:bg-neutral-950 flex flex-col items-center justify-center p-8 relative overflow-hidden">
            <div className="absolute top-8 right-8 z-50">
                <LanguageSwitcher />
            </div>

            <div className="w-full max-w-md relative z-10">
                <div className="flex flex-col items-center mb-10">
                    <div className="w-16 h-16 mb-4">
                        <Logo />
                    </div>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-white dark:to-white bg-clip-text text-transparent tracking-tight">
                        CoralOS Premium
                    </h1>
                    <p className="text-neutral-500 mt-2 font-medium text-sm text-center">
                        The ultimate isolated workspace for contractors.
                    </p>
                </div>

                <div className="bg-white dark:bg-neutral-900/50 p-6 sm:p-8 rounded-3xl border border-neutral-200 dark:border-white/10 shadow-2xl backdrop-blur-xl">
                    <form onSubmit={handleCredentialsAuth} className="space-y-4 mb-6">
                        <div>
                            <div className="relative">
                                <Mail className="absolute left-3.5 top-3.5 w-5 h-5 text-neutral-400" />
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="Work email"
                                    required
                                    className="w-full bg-neutral-50 dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-xl pl-11 pr-4 py-3.5 outline-none focus:border-blue-500 transition-colors text-neutral-900 dark:text-white text-sm font-medium placeholder:text-neutral-400"
                                />
                            </div>
                        </div>
                        <div>
                            <div className="relative">
                                <Lock className="absolute left-3.5 top-3.5 w-5 h-5 text-neutral-400" />
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="Password"
                                    required
                                    className="w-full bg-neutral-50 dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-xl pl-11 pr-4 py-3.5 outline-none focus:border-blue-500 transition-colors text-neutral-900 dark:text-white text-sm font-medium placeholder:text-neutral-400"
                                />
                            </div>
                        </div>

                        {error && (
                            <p className="text-red-500 text-xs font-bold uppercase tracking-wider text-center bg-red-500/10 py-2 rounded-lg border border-red-500/20">
                                {error}
                            </p>
                        )}

                        <button
                            type="submit"
                            disabled={isCredentialsLoading}
                            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold py-3.5 rounded-xl transition-all shadow-xl shadow-blue-600/20 active:scale-[0.98] flex items-center justify-center gap-2"
                        >
                            {isCredentialsLoading ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                                "Sign In"
                            )}
                        </button>
                    </form>

                    <div className="flex items-center gap-3 mb-6">
                        <div className="flex-1 h-px bg-neutral-200 dark:bg-white/10" />
                        <span className="text-xs uppercase tracking-widest text-neutral-400 font-bold">Or</span>
                        <div className="flex-1 h-px bg-neutral-200 dark:bg-white/10" />
                    </div>

                    <div className="space-y-6">
                        <button
                            onClick={handleGoogleAuth}
                            type="button"
                            disabled={isLoading}
                            className="w-full bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-white/10 hover:bg-neutral-50 dark:hover:bg-neutral-800 disabled:opacity-50 text-neutral-800 dark:text-white font-bold py-3.5 rounded-xl transition-all shadow-sm flex items-center justify-center gap-3"
                        >
                            {isLoading ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                                <>
                                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                                    </svg>
                                    Continue with Google
                                </>
                            )}
                        </button>

                        <div className="flex items-center gap-3">
                            <div className="flex-1 h-px bg-neutral-200 dark:bg-white/10" />
                            <span className="text-xs uppercase tracking-widest text-neutral-400 font-bold">Secure Deployment</span>
                            <div className="flex-1 h-px bg-neutral-200 dark:bg-white/10" />
                        </div>

                        <p className="text-[11px] text-neutral-500 text-center leading-relaxed font-medium px-4">
                            By continuing, you agree to the automated provisioning of an isolated PostgreSQL Sandbox and Google Drive partition on the CoralOS network.
                        </p>
                    </div>
                </div>
            </div>

            <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-blue-500/10 dark:bg-blue-900/20 blur-[120px] rounded-full pointer-events-none" />
            <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-indigo-500/10 dark:bg-indigo-900/20 blur-[120px] rounded-full pointer-events-none" />
        </div>
    );
}
