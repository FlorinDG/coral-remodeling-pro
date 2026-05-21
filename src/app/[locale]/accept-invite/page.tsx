"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Loader2, Check, AlertCircle, KeyRound, User, ArrowRight } from "lucide-react";

function AcceptInviteForm() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const token = searchParams.get("token") || "";

    const [name, setName] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState("");
    const [resultEmail, setResultEmail] = useState("");
    const [resultRole, setResultRole] = useState("");
    const [signingIn, setSigningIn] = useState(false);

    // Determine if this is a workforce user (redirect to WorkHub after login)
    const isWorkforce = resultRole === "TENANT_ENTERPRISE_WORKFORCE";

    // Auto-detect if we're on the work subdomain
    const [isWorkDomain, setIsWorkDomain] = useState(false);
    useEffect(() => {
        if (typeof window !== "undefined") {
            setIsWorkDomain(window.location.hostname.startsWith("work."));
        }
    }, []);

    if (!token) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-neutral-50 dark:bg-black p-4">
                <div className="w-full max-w-md bg-white dark:bg-neutral-900 rounded-3xl shadow-2xl p-8 text-center">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-red-100 dark:bg-red-500/10 flex items-center justify-center">
                        <AlertCircle className="w-8 h-8 text-red-500" />
                    </div>
                    <h1 className="text-xl font-bold text-neutral-900 dark:text-white mb-2">Invalid Invite Link</h1>
                    <p className="text-sm text-neutral-500">
                        This invite link is missing the required token. Please check the link from your email and try again.
                    </p>
                    <button
                        onClick={() => router.push("/login")}
                        className="mt-6 px-6 py-2.5 rounded-xl bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 text-sm font-bold hover:opacity-90 transition-opacity"
                    >
                        Go to Login
                    </button>
                </div>
            </div>
        );
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");

        if (password.length < 8) {
            setError("Password must be at least 8 characters");
            return;
        }
        if (password !== confirmPassword) {
            setError("Passwords do not match");
            return;
        }

        setLoading(true);
        try {
            const res = await fetch("/api/auth/accept-invite", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token, password, name: name || undefined }),
            });

            const data = await res.json();

            if (!res.ok) {
                setError(data.error || "Failed to accept invite");
                return;
            }

            setResultEmail(data.email);
            setResultRole(data.role || "");
            setSuccess(true);

            // Auto-login: sign in with credentials
            setSigningIn(true);
            const signInResult = await signIn("credentials", {
                redirect: false,
                email: data.email,
                password,
            });

            if (signInResult?.ok) {
                // Determine redirect target
                const isWf = data.role === "TENANT_ENTERPRISE_WORKFORCE";
                const onWorkDomain = typeof window !== "undefined" && window.location.hostname.startsWith("work.");

                if (isWf && !onWorkDomain) {
                    // Workforce user on app domain → redirect to work domain
                    window.location.href = "https://work.coral-group.be";
                } else if (isWf && onWorkDomain) {
                    // Already on work domain → go to WorkHub home
                    window.location.href = "/";
                } else {
                    // ERP user → go to admin dashboard
                    router.push("/admin/dashboard");
                }
            } else {
                // Auto-login failed — show manual redirect
                setSigningIn(false);
            }
        } catch {
            setError("Network error — please try again");
        } finally {
            setLoading(false);
        }
    };

    if (success) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-neutral-50 dark:bg-black p-4">
                <div className="w-full max-w-md bg-white dark:bg-neutral-900 rounded-3xl shadow-2xl p-8 text-center">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-emerald-100 dark:bg-emerald-500/10 flex items-center justify-center">
                        {signingIn ? (
                            <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
                        ) : (
                            <Check className="w-8 h-8 text-emerald-500" />
                        )}
                    </div>
                    <h1 className="text-xl font-bold text-neutral-900 dark:text-white mb-2">
                        {signingIn ? "Signing you in..." : "Account Activated!"}
                    </h1>
                    <p className="text-sm text-neutral-500 mb-6">
                        {signingIn
                            ? "Setting up your workspace..."
                            : `Your account (${resultEmail}) is ready.`}
                    </p>
                    {!signingIn && (
                        <button
                            onClick={() => {
                                if (isWorkforce || isWorkDomain) {
                                    window.location.href = "https://work.coral-group.be/login";
                                } else {
                                    router.push("/login");
                                }
                            }}
                            className="flex items-center justify-center gap-2 w-full px-6 py-3 rounded-xl text-white text-sm font-bold hover:opacity-90 transition-opacity"
                            style={{ backgroundColor: "var(--brand-color, #d35400)" }}
                        >
                            <ArrowRight className="w-4 h-4" />
                            {isWorkforce || isWorkDomain ? "Open WorkHub" : "Go to Login"}
                        </button>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-neutral-50 dark:bg-black p-4">
            <div className="w-full max-w-md bg-white dark:bg-neutral-900 rounded-3xl shadow-2xl overflow-hidden">
                {/* Header */}
                <div
                    className="px-8 py-6 text-center"
                    style={{ background: "linear-gradient(135deg, var(--brand-color, #d35400) 0%, #c0392b 100%)" }}
                >
                    <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                        <KeyRound className="w-7 h-7 text-white" />
                    </div>
                    <h1 className="text-xl font-bold text-white">Set Up Your Account</h1>
                    <p className="text-sm text-white/70 mt-1">
                        {isWorkDomain
                            ? "Join the team on WorkHub"
                            : "Create your password to get started"}
                    </p>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-8 space-y-5">
                    {/* Name */}
                    <div>
                        <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 mb-1.5 block">
                            Your Name
                        </label>
                        <div className="relative">
                            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="John Doe"
                                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-neutral-200 dark:border-white/10 bg-neutral-50 dark:bg-white/5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-color,#d35400)]/30 transition-shadow"
                            />
                        </div>
                    </div>

                    {/* Password */}
                    <div>
                        <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 mb-1.5 block">
                            Password *
                        </label>
                        <div className="relative">
                            <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Minimum 8 characters"
                                required
                                minLength={8}
                                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-neutral-200 dark:border-white/10 bg-neutral-50 dark:bg-white/5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-color,#d35400)]/30 transition-shadow"
                            />
                        </div>
                    </div>

                    {/* Confirm Password */}
                    <div>
                        <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 mb-1.5 block">
                            Confirm Password *
                        </label>
                        <div className="relative">
                            <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                            <input
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                placeholder="Re-enter your password"
                                required
                                minLength={8}
                                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-neutral-200 dark:border-white/10 bg-neutral-50 dark:bg-white/5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-color,#d35400)]/30 transition-shadow"
                            />
                        </div>
                    </div>

                    {/* Error */}
                    {error && (
                        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20">
                            <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                        </div>
                    )}

                    {/* Submit */}
                    <button
                        type="submit"
                        disabled={loading || !password}
                        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-white text-sm font-bold hover:opacity-90 disabled:opacity-50 transition-all shadow-lg active:scale-[0.98]"
                        style={{ backgroundColor: "var(--brand-color, #d35400)" }}
                    >
                        {loading ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <Check className="w-4 h-4" />
                        )}
                        {loading ? "Activating..." : "Activate Account"}
                    </button>

                    <p className="text-xs text-neutral-400 text-center">
                        Already have an account?{" "}
                        <button
                            type="button"
                            onClick={() => router.push("/login")}
                            className="text-[var(--brand-color,#d35400)] font-bold hover:underline"
                        >
                            Log in
                        </button>
                    </p>
                </form>
            </div>
        </div>
    );
}

export default function AcceptInvitePage() {
    return (
        <Suspense
            fallback={
                <div className="min-h-screen flex items-center justify-center bg-neutral-50 dark:bg-black">
                    <Loader2 className="w-8 h-8 animate-spin text-neutral-400" />
                </div>
            }
        >
            <AcceptInviteForm />
        </Suspense>
    );
}
