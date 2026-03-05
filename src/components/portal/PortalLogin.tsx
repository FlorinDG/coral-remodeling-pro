"use client";

import { useState } from 'react';
import Logo from '@/components/Logo';
import { Lock, ArrowRight } from 'lucide-react';

interface PortalLoginProps {
    onLogin: (password: string) => void;
    error?: string;
}

export default function PortalLogin({ onLogin, error }: PortalLoginProps) {
    const [password, setPassword] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onLogin(password);
    };

    return (
        <div className="min-h-screen bg-black flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                <div className="text-center mb-12">
                    <div className="inline-block p-4 bg-white/5 rounded-3xl mb-6">
                        <Logo className="w-12 h-12" />
                    </div>
                    <h1 className="text-3xl font-bold tracking-tighter text-white uppercase">Client Portal</h1>
                    <p className="text-neutral-500 mt-2 font-medium">Please enter your password to access this project.</p>
                </div>

                <div className="glass-morphism p-8 rounded-[2.5rem] border border-white/10">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest px-1 flex items-center gap-2">
                                <Lock className="w-3 h-3" /> Password
                            </label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
                                required
                                className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white focus:border-[#d35400] outline-none transition-all"
                            />
                            {error && <p className="text-red-500 text-[10px] font-bold uppercase tracking-widest px-1">{error}</p>}
                        </div>

                        <button
                            type="submit"
                            className="w-full bg-[#d35400] hover:bg-white hover:text-black text-white py-4 rounded-2xl font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 group shadow-xl shadow-[#d35400]/20"
                        >
                            Access Portal <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                        </button>
                    </form>
                </div>

                <p className="text-center mt-12 text-xs font-bold text-neutral-600 uppercase tracking-[0.2em]">
                    Coral Enterprises • Luxury. Redefined.
                </p>
            </div>
        </div>
    );
}
