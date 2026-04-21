"use client";

import { useState, useEffect, useMemo } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from '@/i18n/routing';
import { useSearchParams } from 'next/navigation';
import Logo from '@/components/Logo';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { Loader2, Mail, Lock, User, Check, X, Eye, EyeOff, ShieldCheck, AlertTriangle, Globe, ArrowRight } from 'lucide-react';

/* ─── Password validation ─── */
function validatePasswordRules(pw: string) {
    return {
        minLength: pw.length >= 6,
        uppercase: /[A-Z]/.test(pw),
        lowercase: /[a-z]/.test(pw),
        number: /[0-9]/.test(pw),
        special: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(pw),
        noRepeat: !/(.)\1{2,}/.test(pw),
    };
}

/* ─── Strength indicator color ─── */
function strengthColor(rules: ReturnType<typeof validatePasswordRules>) {
    const passed = Object.values(rules).filter(Boolean).length;
    if (passed <= 2) return 'bg-red-500';
    if (passed <= 4) return 'bg-yellow-500';
    return 'bg-emerald-500';
}

export default function LoginPage() {
    const [isLoading, setIsLoading] = useState(false);
    const [isCredentialsLoading, setIsCredentialsLoading] = useState(false);
    const [isSignupLoading, setIsSignupLoading] = useState(false);

    // Login state
    const [loginEmail, setLoginEmail] = useState('');
    const [loginPassword, setLoginPassword] = useState('');
    const [loginError, setLoginError] = useState('');
    const [showLoginPassword, setShowLoginPassword] = useState(false);

    // Signup state
    const [signupName, setSignupName] = useState('');
    const [signupEmail, setSignupEmail] = useState('');
    const [signupPassword, setSignupPassword] = useState('');
    const [signupConfirm, setSignupConfirm] = useState('');
    const [signupError, setSignupError] = useState('');
    const [signupSuccess, setSignupSuccess] = useState('');
    const [signupDone, setSignupDone] = useState(false);   // shows the verify-email card
    const [signupDoneEmail, setSignupDoneEmail] = useState('');  // which address to check
    const [showSignupPassword, setShowSignupPassword] = useState(false);
    const [signupLanguage, setSignupLanguage] = useState('nl');

    // Verification modal
    const [showVerificationBlock, setShowVerificationBlock] = useState<'warning' | 'hard' | null>(null);
    const [blockedEmail, setBlockedEmail] = useState('');
    const [resendLoading, setResendLoading] = useState(false);
    const [resendSuccess, setResendSuccess] = useState('');

    const [isAppDomain, setIsAppDomain] = useState(false);
    const router = useRouter();
    const searchParams = useSearchParams();
    const planParam = searchParams.get('plan');

    // Parse URL parameters for verification status
    const verifiedStatus = searchParams.get('verified');
    const errorParam = searchParams.get('error');

    const pwRules = useMemo(() => validatePasswordRules(signupPassword), [signupPassword]);
    const allRulesPassed = Object.values(pwRules).every(Boolean);
    const passwordsMatch = signupPassword === signupConfirm && signupConfirm.length > 0;

    /* ─── Login handler ─── */
    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsCredentialsLoading(true);
        setLoginError('');

        try {
            const result = await signIn('credentials', {
                email: loginEmail,
                password: loginPassword,
                redirect: false,
            });

            if (result?.error) {
                if (result.error.includes('VERIFICATION_HARD_BLOCK')) {
                    setShowVerificationBlock('hard');
                    setBlockedEmail(loginEmail);
                } else if (result.error.includes('VERIFICATION_WARNING_BLOCK')) {
                    setShowVerificationBlock('warning');
                    setBlockedEmail(loginEmail);
                } else {
                    setLoginError('Invalid credentials');
                }
            } else {
                // Fetch session to get user's stored environment language
                const sessionRes = await fetch('/api/auth/session');
                const sess = await sessionRes.json();
                const userLocale = (sess?.user as any)?.environmentLanguage || 'nl';
                window.location.href = `/${userLocale}/admin/dashboard`;
            }
        } catch {
            setLoginError('System error. Please try again.');
        } finally {
            setIsCredentialsLoading(false);
        }
    };

    /* ─── Signup handler ─── */
    const handleSignup = async (e: React.FormEvent) => {
        e.preventDefault();
        setSignupError('');
        setSignupSuccess('');

        if (!allRulesPassed) {
            setSignupError('Password does not meet all requirements');
            return;
        }
        if (!passwordsMatch) {
            setSignupError('Passwords do not match');
            return;
        }

        setIsSignupLoading(true);

        try {
            const res = await fetch('/api/auth/signup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: signupName,
                    email: signupEmail,
                    password: signupPassword,
                    language: signupLanguage,
                }),
            });

            const data = await res.json();

            if (!res.ok) {
                setSignupError(data.error || 'Signup failed');
                return;
            }

            // Account created — user needs to verify email before they can log in.
            // Show the verification prompt card instead of auto-signing in.
            setSignupDoneEmail(signupEmail);
            setSignupDone(true);
        } catch {
            setSignupError('System error. Please try again.');
        } finally {
            setIsSignupLoading(false);
        }
    };

    /* ─── Resend verification ─── */
    const handleResendVerification = async () => {
        setResendLoading(true);
        setResendSuccess('');
        try {
            await fetch('/api/auth/resend-verification', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: blockedEmail }),
            });
            setResendSuccess('Verification email sent! Please check your inbox.');
        } catch {
            setResendSuccess('Could not send verification email. Please try again.');
        } finally {
            setResendLoading(false);
        }
    };

    /* ─── Google OAuth ─── */
    const handleGoogleAuth = async () => {
        setIsLoading(true);
        await signIn('google', { callbackUrl: '/admin/dashboard' });
    };

    /* ─── App domain detection (client-side only) ─── */
    useEffect(() => {
        setIsAppDomain(window.location.hostname === 'app.coral-group.be');
    }, []);

    // Gate: direct navigation to app.coral-group.be/login without a plan → redirect to store
    const showSignupGate = isAppDomain && !planParam;

    /* ─── Password rule indicator ─── */
    const RuleCheck = ({ passed, label }: { passed: boolean; label: string }) => (
        <div className={`flex items-center gap-1.5 text-[11px] transition-colors ${passed ? 'text-emerald-500' : 'text-neutral-400'}`}>
            {passed ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
            <span>{label}</span>
        </div>
    );

    return (
        <div className="min-h-screen bg-[#f9fafb] dark:bg-neutral-950 flex flex-col items-center justify-center p-4 sm:p-8 relative overflow-hidden">
            <div className="absolute top-6 right-6 z-50">
                <LanguageSwitcher />
            </div>

            {/* Verification status messages from URL params */}
            {verifiedStatus === 'success' && (
                <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 px-6 py-3 rounded-xl text-sm font-bold flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
                    <ShieldCheck className="w-4 h-4" />
                    Email verified successfully. You can now sign in.
                </div>
            )}

            {/* Verification block modal */}
            {showVerificationBlock && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-white/10 p-8 max-w-md w-full shadow-2xl">
                        <div className="flex items-center gap-3 mb-4">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${showVerificationBlock === 'hard' ? 'bg-red-500/10' : 'bg-amber-500/10'}`}>
                                <AlertTriangle className={`w-5 h-5 ${showVerificationBlock === 'hard' ? 'text-red-500' : 'text-amber-500'}`} />
                            </div>
                            <h3 className="text-lg font-bold text-neutral-900 dark:text-white">
                                {showVerificationBlock === 'hard' ? 'Account Blocked' : 'Verification Required'}
                            </h3>
                        </div>
                        <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-6">
                            {showVerificationBlock === 'hard'
                                ? 'Your account has been blocked because your email was not verified in time. Please request a new verification email to restore access.'
                                : 'Your email verification period is expiring soon. Please verify your email to continue using your account.'}
                        </p>

                        {resendSuccess && (
                            <p className="text-sm text-emerald-600 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-4 py-2 mb-4">
                                {resendSuccess}
                            </p>
                        )}

                        <div className="flex gap-3">
                            <button
                                onClick={handleResendVerification}
                                disabled={resendLoading}
                                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2"
                            >
                                {resendLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                                Resend Verification
                            </button>
                            <button
                                onClick={() => setShowVerificationBlock(null)}
                                className="px-4 py-3 rounded-xl border border-neutral-200 dark:border-white/10 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-all font-medium"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Header */}
            <div className="flex flex-col items-center mb-8">
                <div className="w-14 h-14 mb-3">
                    <Logo />
                </div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-white dark:to-neutral-300 bg-clip-text text-transparent tracking-tight">
                    CoralOS
                </h1>
                <p className="text-neutral-500 mt-1 font-medium text-xs text-center">
                    The workspace for modern contractors
                </p>
            </div>

            {/* Side by side cards */}
            <div className="w-full max-w-[860px] grid grid-cols-1 md:grid-cols-2 gap-4 relative z-10">

                {/* ─── SIGN IN ─── */}
                <div className="bg-white dark:bg-neutral-900/50 p-6 rounded-2xl border border-neutral-200 dark:border-white/10 shadow-xl backdrop-blur-xl">
                    <h2 className="text-lg font-bold text-neutral-900 dark:text-white mb-5 flex items-center gap-2">
                        <Lock className="w-4 h-4 text-blue-500" />
                        Sign In
                    </h2>

                    <form onSubmit={handleLogin} className="space-y-3">
                        <div className="relative">
                            <Mail className="absolute left-3 top-3 w-4 h-4 text-neutral-400" />
                            <input
                                type="email"
                                value={loginEmail}
                                onChange={(e) => setLoginEmail(e.target.value)}
                                placeholder="Email"
                                required
                                className="w-full bg-neutral-50 dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-xl pl-10 pr-4 py-2.5 outline-none focus:border-blue-500 transition-colors text-neutral-900 dark:text-white text-sm placeholder:text-neutral-400"
                            />
                        </div>
                        <div className="relative">
                            <Lock className="absolute left-3 top-3 w-4 h-4 text-neutral-400" />
                            <input
                                type={showLoginPassword ? 'text' : 'password'}
                                value={loginPassword}
                                onChange={(e) => setLoginPassword(e.target.value)}
                                placeholder="Password"
                                required
                                className="w-full bg-neutral-50 dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-xl pl-10 pr-10 py-2.5 outline-none focus:border-blue-500 transition-colors text-neutral-900 dark:text-white text-sm placeholder:text-neutral-400"
                            />
                            <button type="button" onClick={() => setShowLoginPassword(!showLoginPassword)} className="absolute right-3 top-3 text-neutral-400 hover:text-neutral-600">
                                {showLoginPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                        </div>

                        {loginError && (
                            <p className="text-red-500 text-xs font-bold text-center bg-red-500/10 py-2 rounded-lg border border-red-500/20">
                                {loginError}
                            </p>
                        )}

                        <button
                            type="submit"
                            disabled={isCredentialsLoading}
                            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold py-2.5 rounded-xl transition-all shadow-lg shadow-blue-600/20 active:scale-[0.98] flex items-center justify-center gap-2 text-sm"
                        >
                            {isCredentialsLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Sign In"}
                        </button>
                    </form>

                    <div className="flex items-center gap-3 my-4">
                        <div className="flex-1 h-px bg-neutral-200 dark:bg-white/10" />
                        <span className="text-[10px] uppercase tracking-widest text-neutral-400 font-bold">Or</span>
                        <div className="flex-1 h-px bg-neutral-200 dark:bg-white/10" />
                    </div>

                    <button
                        onClick={handleGoogleAuth}
                        type="button"
                        disabled={isLoading}
                        className="w-full bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-white/10 hover:bg-neutral-50 dark:hover:bg-neutral-700 disabled:opacity-50 text-neutral-800 dark:text-white font-bold py-2.5 rounded-xl transition-all shadow-sm flex items-center justify-center gap-3 text-sm"
                    >
                        {isLoading ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <>
                                <svg className="w-4 h-4" viewBox="0 0 24 24">
                                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                                </svg>
                                Continue with Google
                            </>
                        )}
                    </button>
                </div>

                {/* ─── CREATE ACCOUNT / VERIFY EMAIL ─── */}
                {showSignupGate ? (
                    /* ── Funnel gate — direct navigation without ?plan → send to store ── */
                    <div className="bg-white dark:bg-neutral-900/50 p-8 rounded-2xl border border-neutral-200 dark:border-white/10 shadow-xl backdrop-blur-xl flex flex-col items-center text-center gap-6">
                        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500/10 to-indigo-500/10 border border-blue-200 dark:border-blue-500/20 flex items-center justify-center">
                            <ArrowRight className="w-8 h-8 text-blue-500" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-neutral-900 dark:text-white mb-2">Start for free</h2>
                            <p className="text-sm text-neutral-500 dark:text-neutral-400 leading-relaxed">
                                Choose your plan on our website to create your CoralOS account — it takes 30 seconds, no credit card needed.
                            </p>
                        </div>
                        <a
                            href="https://coral-group.be/nl/store#pricing"
                            className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2 text-sm"
                        >
                            View Plans &amp; Start for Free <ArrowRight className="w-4 h-4" />
                        </a>
                        <p className="text-[11px] text-neutral-400">Already have an account? Sign in on the left.</p>
                    </div>
                ) : signupDone ? (
                    /* ── Post-signup: verify email prompt ── */
                    <div className="bg-white dark:bg-neutral-900/50 p-6 rounded-2xl border border-emerald-200 dark:border-emerald-800/40 shadow-xl backdrop-blur-xl flex flex-col items-center text-center gap-4">
                        <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 flex items-center justify-center">
                            <Mail className="w-7 h-7 text-emerald-500" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-neutral-900 dark:text-white mb-1">
                                Check your inbox
                            </h2>
                            <p className="text-sm text-neutral-500 dark:text-neutral-400 leading-relaxed">
                                We sent a verification link to
                            </p>
                            <p className="text-sm font-bold text-neutral-800 dark:text-white mt-0.5 break-all">
                                {signupDoneEmail}
                            </p>
                        </div>
                        <div className="w-full bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700/40 rounded-xl px-4 py-3 text-xs text-emerald-700 dark:text-emerald-300 leading-relaxed text-left">
                            <strong>Next steps:</strong>
                            <ol className="mt-1.5 space-y-1 list-decimal list-inside">
                                <li>Open the email from CoralOS</li>
                                <li>Click the verification link inside</li>
                                <li>Return here and sign in</li>
                            </ol>
                        </div>
                        <p className="text-[11px] text-neutral-400">
                            Didn&apos;t receive it? Check your spam folder or{' '}
                            <button
                                type="button"
                                onClick={async () => {
                                    setResendLoading(true);
                                    setBlockedEmail(signupDoneEmail);
                                    await handleResendVerification();
                                    setResendLoading(false);
                                }}
                                disabled={resendLoading}
                                className="text-blue-500 hover:text-blue-600 underline disabled:opacity-50"
                            >
                                {resendLoading ? 'Sending...' : 'resend it'}
                            </button>.
                        </p>
                        {resendSuccess && (
                            <p className="text-xs text-emerald-600 font-semibold">{resendSuccess}</p>
                        )}
                    </div>
                ) : (
                    /* ── Signup form ── */
                    <div className="bg-white dark:bg-neutral-900/50 p-6 rounded-2xl border border-neutral-200 dark:border-white/10 shadow-xl backdrop-blur-xl">
                    <h2 className="text-lg font-bold text-neutral-900 dark:text-white mb-5 flex items-center gap-2">
                        <User className="w-4 h-4 text-emerald-500" />
                        Create Account
                    </h2>

                    <form onSubmit={handleSignup} className="space-y-3">
                        <div className="relative">
                            <User className="absolute left-3 top-3 w-4 h-4 text-neutral-400" />
                            <input
                                type="text"
                                value={signupName}
                                onChange={(e) => setSignupName(e.target.value)}
                                placeholder="Full name"
                                required
                                className="w-full bg-neutral-50 dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-xl pl-10 pr-4 py-2.5 outline-none focus:border-emerald-500 transition-colors text-neutral-900 dark:text-white text-sm placeholder:text-neutral-400"
                            />
                        </div>
                        <div className="relative">
                            <Globe className="absolute left-3 top-3 w-4 h-4 text-neutral-400" />
                            <select
                                value={signupLanguage}
                                onChange={(e) => setSignupLanguage(e.target.value)}
                                className="w-full bg-neutral-50 dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-xl pl-10 pr-4 py-2.5 outline-none focus:border-emerald-500 transition-colors text-neutral-900 dark:text-white text-sm appearance-none cursor-pointer"
                            >
                                <option value="nl">🇳🇱 Nederlands</option>
                                <option value="en">🇬🇧 English</option>
                                <option value="fr">🇫🇷 Français</option>
                                <option value="ro">🇷🇴 Română</option>
                                <option value="ru">🇷🇺 Русский</option>
                            </select>
                        </div>
                        <div className="relative">
                            <Mail className="absolute left-3 top-3 w-4 h-4 text-neutral-400" />
                            <input
                                type="email"
                                value={signupEmail}
                                onChange={(e) => setSignupEmail(e.target.value)}
                                placeholder="Work email"
                                required
                                className="w-full bg-neutral-50 dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-xl pl-10 pr-4 py-2.5 outline-none focus:border-emerald-500 transition-colors text-neutral-900 dark:text-white text-sm placeholder:text-neutral-400"
                            />
                        </div>
                        <div className="relative">
                            <Lock className="absolute left-3 top-3 w-4 h-4 text-neutral-400" />
                            <input
                                type={showSignupPassword ? 'text' : 'password'}
                                value={signupPassword}
                                onChange={(e) => setSignupPassword(e.target.value)}
                                placeholder="Password"
                                required
                                className="w-full bg-neutral-50 dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-xl pl-10 pr-10 py-2.5 outline-none focus:border-emerald-500 transition-colors text-neutral-900 dark:text-white text-sm placeholder:text-neutral-400"
                            />
                            <button type="button" onClick={() => setShowSignupPassword(!showSignupPassword)} className="absolute right-3 top-3 text-neutral-400 hover:text-neutral-600">
                                {showSignupPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                        </div>

                        {/* Password strength */}
                        {signupPassword.length > 0 && (
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
                                value={signupConfirm}
                                onChange={(e) => setSignupConfirm(e.target.value)}
                                placeholder="Confirm password"
                                required
                                className={`w-full bg-neutral-50 dark:bg-white/5 border rounded-xl pl-10 pr-10 py-2.5 outline-none transition-colors text-neutral-900 dark:text-white text-sm placeholder:text-neutral-400 ${signupConfirm.length > 0 ? (passwordsMatch ? 'border-emerald-500' : 'border-red-400') : 'border-neutral-200 dark:border-white/10'
                                    } focus:border-emerald-500`}
                            />
                            {signupConfirm.length > 0 && (
                                <div className="absolute right-3 top-3">
                                    {passwordsMatch ? <Check className="w-4 h-4 text-emerald-500" /> : <X className="w-4 h-4 text-red-400" />}
                                </div>
                            )}
                        </div>

                        {signupError && (
                            <p className="text-red-500 text-xs font-bold text-center bg-red-500/10 py-2 rounded-lg border border-red-500/20">
                                {signupError}
                            </p>
                        )}

                        <button
                            type="submit"
                            disabled={isSignupLoading || !allRulesPassed || !passwordsMatch}
                            className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold py-2.5 rounded-xl transition-all shadow-lg shadow-emerald-600/20 active:scale-[0.98] flex items-center justify-center gap-2 text-sm"
                        >
                            {isSignupLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create Account"}
                        </button>
                    </form>

                    <div className="flex items-center gap-3 my-4">
                        <div className="flex-1 h-px bg-neutral-200 dark:bg-white/10" />
                        <span className="text-[10px] uppercase tracking-widest text-neutral-400 font-bold">Or</span>
                        <div className="flex-1 h-px bg-neutral-200 dark:bg-white/10" />
                    </div>

                    <button
                        onClick={handleGoogleAuth}
                        type="button"
                        disabled={isLoading}
                        className="w-full bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-white/10 hover:bg-neutral-50 dark:hover:bg-neutral-700 disabled:opacity-50 text-neutral-800 dark:text-white font-bold py-2.5 rounded-xl transition-all shadow-sm flex items-center justify-center gap-3 text-sm"
                    >
                        {isLoading ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <>
                                <svg className="w-4 h-4" viewBox="0 0 24 24">
                                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                                </svg>
                                Sign up with Google
                            </>
                        )}
                    </button>
                </div>
                )}
            </div>

            {/* Footer */}
            <div className="mt-6 flex flex-col items-center gap-2 z-10 relative">
                <p className="text-center text-neutral-500 text-[10px] uppercase tracking-widest font-medium">
                    Door verder te gaan, ga je akkoord met onze{' '}
                    <a href="/nl/terms" className="text-blue-500 hover:text-blue-600 transition-colors">voorwaarden</a>
                </p>
                <a href="/nl/help" className="text-[10px] text-neutral-400 hover:text-blue-500 transition-colors uppercase tracking-widest font-medium">
                    Help & Documentatie
                </a>
            </div>

            {/* Background blurs */}
            <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-blue-500/10 dark:bg-blue-900/20 blur-[120px] rounded-full pointer-events-none" />
            <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-emerald-500/10 dark:bg-emerald-900/20 blur-[120px] rounded-full pointer-events-none" />
        </div>
    );
}
