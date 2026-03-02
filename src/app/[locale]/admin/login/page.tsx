"use client";

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from '@/i18n/routing';
import Logo from '@/components/Logo';
import { Loader2 } from 'lucide-react';

export default function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const router = useRouter();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');

        try {
            const result = await signIn('credentials', {
                email,
                password,
                redirect: false,
            });

            if (result?.error) {
                setError('Invalid credentials');
            } else {
                router.push('/admin/dashboard');
                router.refresh();
            }
        } catch {
            setError('Something went wrong. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-neutral-950 flex flex-col items-center justify-center p-8">
            <div className="w-full max-w-md">
                <div className="flex flex-col items-center mb-12">
                    <div className="w-16 h-16 mb-6">
                        <Logo />
                    </div>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-[#d35400] to-[#e67e22] bg-clip-text text-transparent italic">
                        CORAL ENTERPRISES
                    </h1>
                    <p className="text-neutral-500 mt-2 font-oxanium tracking-widest uppercase text-xs">
                        Admin Portal
                    </p>
                </div>

                <div className="glass-morphism p-8 rounded-3xl border border-white/10 shadow-2xl">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div>
                            <label className="block text-[10px] font-bold uppercase tracking-widest text-neutral-400 mb-2">
                                Email Address
                            </label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-[#d35400] transition-colors text-white"
                                placeholder="admin@coral-remodeling.pro"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-[10px] font-bold uppercase tracking-widest text-neutral-400 mb-2">
                                Password
                            </label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-[#d35400] transition-colors text-white"
                                placeholder="••••••••"
                                required
                            />
                        </div>

                        {error && (
                            <p className="text-red-500 text-xs font-bold uppercase tracking-wider text-center bg-red-500/10 py-2 rounded-lg border border-red-500/20">
                                {error}
                            </p>
                        )}

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full bg-[#d35400] hover:bg-[#e67e22] disabled:opacity-50 text-white font-bold py-4 rounded-xl transition-all shadow-xl shadow-[#d35400]/20 active:scale-[0.98] flex items-center justify-center gap-2"
                        >
                            {isLoading ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                                "SECURE LOGIN"
                            )}
                        </button>
                    </form>
                </div>

                <p className="mt-8 text-center text-neutral-600 text-[10px] uppercase tracking-widest">
                    &copy; {new Date().getFullYear()} Coral Remodeling Pro. Protected Access.
                </p>
            </div>
        </div>
    );
}
