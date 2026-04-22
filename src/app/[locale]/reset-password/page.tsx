"use client";

import { useState, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import Logo from '@/components/Logo';
import { Loader2, Lock, Check, X, Eye, EyeOff, ShieldCheck, AlertTriangle } from 'lucide-react';
import { Link } from '@/i18n/routing';

/* ─── Password validation (same rules as signup) ─── */
function validatePasswordRules(pw: string) {
    return {
        minLength: pw.length >= 6,
        uppercase: /[A-Z]/.test(pw),
        lowercase: /[a-z]/.test(pw),
        number: /[0-9]/.test(pw),
        special: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(pw),
        noRepeat: !/(.)\\1{2,}/.test(pw),
    };
}

function strengthColor(rules: ReturnType<typeof validatePasswordRules>) {
    const passed = Object.values(rules).filter(Boolean).length;
    if (passed <= 2) return 'bg-red-500';
    if (passed <= 4) return 'bg-yellow-500';
    return 'bg-emerald-500';
}

export default function ResetPasswordPage() {
    const searchParams = useSearchParams();
    const token = searchParams.get('token') || '';
    const email = searchParams.get('email') || '';

    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);

    const pwRules = useMemo(() => validatePasswordRules(password), [password]);
    const allRulesPassed = Object.values(pwRules).every(Boolean);
    const passwordsMatch = password === confirm && confirm.length > 0;

    const RuleCheck = ({ passed, label }: { passed: boolean; label: string }) => (
        <div className={`flex items-center gap-1.5 text-[11px] transition-colors ${passed ? 'text-emerald-500' : 'text-neutral-400'}`}>
            {passed ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
            <span>{label}</span>
        </div>
    );

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!allRulesPassed || !passwordsMatch) return;

        setIsSubmitting(true);
        setError('');

        try {
            const res = await fetch('/api/auth/reset-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, token, newPassword: password }),
            });

            const data = await res.json();

            if (!res.ok) {
                setError(data.error || 'Something went wrong');
            } else {
                setSuccess(true);
            }
        } catch {
            setError('System error. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!token || !email) {
        return (
            <div className="min-h-screen bg-[#f9fafb] dark:bg-neutral-950 flex flex-col items-center justify-center p-4">
                <div className="bg-white dark:bg-neutral-900/50 p-8 rounded-2xl border border-red-200 dark:border-red-800/40 shadow-xl max-w-md w-full text-center">
                    <AlertTriangle className="w-10 h-10 text-red-500 mx-auto mb-4" />
                    <h2 className="text-lg font-bold text-neutral-900 dark:text-white mb-2">Invalid Reset Link</h2>
                    <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-6">
                        This password reset link is invalid or incomplete. Please request a new one from the login page.
                    </p>
                    <Link href="/login" className="text-blue-500 hover:text-blue-600 text-sm font-bold">
                        ← Back to Login
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#f9fafb] dark:bg-neutral-950 flex flex-col items-center justify-center p-4 sm:p-8 relative overflow-hidden">
            {/* Header */}
            <div className="flex flex-col items-center mb-8">
                <div className="w-14 h-14 mb-3">
                    <Logo />
                </div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-white dark:to-neutral-300 bg-clip-text text-transparent tracking-tight">
                    CoralOS
                </h1>
            </div>

            <div className="w-full max-w-md relative z-10">
                {success ? (
                    /* ── Success state ── */
                    <div className="bg-white dark:bg-neutral-900/50 p-8 rounded-2xl border border-emerald-200 dark:border-emerald-800/40 shadow-xl text-center">
                        <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 flex items-center justify-center mx-auto mb-4">
                            <ShieldCheck className="w-7 h-7 text-emerald-500" />
                        </div>
                        <h2 className="text-lg font-bold text-neutral-900 dark:text-white mb-2">Password Updated!</h2>
                        <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-6">
                            Your password has been reset successfully. You can now sign in with your new password.
                        </p>
                        <Link
                            href="/login"
                            className="inline-block w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-blue-600/20 text-sm text-center"
                        >
                            Sign In
                        </Link>
                    </div>
                ) : (
                    /* ── Reset form ── */
                    <div className="bg-white dark:bg-neutral-900/50 p-6 rounded-2xl border border-neutral-200 dark:border-white/10 shadow-xl backdrop-blur-xl">
                        <h2 className="text-lg font-bold text-neutral-900 dark:text-white mb-1 flex items-center gap-2">
                            <Lock className="w-4 h-4 text-blue-500" />
                            Reset Password
                        </h2>
                        <p className="text-xs text-neutral-500 mb-5">
                            Enter a new password for <span className="font-bold text-neutral-700 dark:text-neutral-300">{email}</span>
                        </p>

                        <form onSubmit={handleSubmit} className="space-y-3">
                            <div className="relative">
                                <Lock className="absolute left-3 top-3 w-4 h-4 text-neutral-400" />
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="New password"
                                    required
                                    className="w-full bg-neutral-50 dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-xl pl-10 pr-10 py-2.5 outline-none focus:border-blue-500 transition-colors text-neutral-900 dark:text-white text-sm placeholder:text-neutral-400"
                                />
                                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-3 text-neutral-400 hover:text-neutral-600">
                                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>

                            {/* Password strength */}
                            {password.length > 0 && (
                                <div className="space-y-2">
                                    <div className="flex gap-1 h-1">
                                        {[...Array(6)].map((_, i) => {
                                            const passed = Object.values(pwRules).filter(Boolean).length;
                                            return (
                                                <div key={i} className={`flex-1 rounded-full transition-all ${i < passed ? strengthColor(pwRules) : 'bg-neutral-200 dark:bg-white/10'}`} />
                                            );
                                        })}
                                    </div>
                                    <div className="grid grid-cols-2 gap-1">
                                        <RuleCheck passed={pwRules.minLength} label="6+ characters" />
                                        <RuleCheck passed={pwRules.uppercase} label="Uppercase" />
                                        <RuleCheck passed={pwRules.lowercase} label="Lowercase" />
                                        <RuleCheck passed={pwRules.number} label="Number" />
                                        <RuleCheck passed={pwRules.special} label="Special char" />
                                        <RuleCheck passed={pwRules.noRepeat} label="No repeats" />
                                    </div>
                                </div>
                            )}

                            <div className="relative">
                                <Lock className="absolute left-3 top-3 w-4 h-4 text-neutral-400" />
                                <input
                                    type="password"
                                    value={confirm}
                                    onChange={(e) => setConfirm(e.target.value)}
                                    placeholder="Confirm new password"
                                    required
                                    className={`w-full bg-neutral-50 dark:bg-white/5 border rounded-xl pl-10 pr-10 py-2.5 outline-none transition-colors text-neutral-900 dark:text-white text-sm placeholder:text-neutral-400 ${confirm.length > 0 ? (passwordsMatch ? 'border-emerald-500' : 'border-red-400') : 'border-neutral-200 dark:border-white/10'} focus:border-blue-500`}
                                />
                                {confirm.length > 0 && (
                                    <div className="absolute right-3 top-3">
                                        {passwordsMatch ? <Check className="w-4 h-4 text-emerald-500" /> : <X className="w-4 h-4 text-red-400" />}
                                    </div>
                                )}
                            </div>

                            {error && (
                                <p className="text-red-500 text-xs font-bold text-center bg-red-500/10 py-2 rounded-lg border border-red-500/20">
                                    {error}
                                </p>
                            )}

                            <button
                                type="submit"
                                disabled={isSubmitting || !allRulesPassed || !passwordsMatch}
                                className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold py-2.5 rounded-xl transition-all shadow-lg shadow-blue-600/20 active:scale-[0.98] flex items-center justify-center gap-2 text-sm"
                            >
                                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Set New Password"}
                            </button>
                        </form>

                        <div className="mt-4 text-center">
                            <Link href="/login" className="text-xs text-neutral-400 hover:text-blue-500 transition-colors">
                                ← Back to Login
                            </Link>
                        </div>
                    </div>
                )}
            </div>

            {/* Background blurs */}
            <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-blue-500/10 dark:bg-blue-900/20 blur-[120px] rounded-full pointer-events-none" />
            <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-emerald-500/10 dark:bg-emerald-900/20 blur-[120px] rounded-full pointer-events-none" />
        </div>
    );
}
