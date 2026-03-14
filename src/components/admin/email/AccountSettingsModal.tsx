"use client";

import { useState } from "react";
import { Mail, Settings, Lock, Loader2, Server, ServerOff } from "lucide-react";
import { cn } from "@/components/time-tracker/lib/utils";

interface AccountSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export function AccountSettingsModal({ isOpen, onClose }: AccountSettingsModalProps) {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [isAdvanced, setIsAdvanced] = useState(false);
    const [host, setHost] = useState("");
    const [port, setPort] = useState("");

    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<boolean>(false);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setIsLoading(true);

        try {
            const res = await fetch('/api/email/accounts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password, host, port, type: 'imap' })
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || "Failed to connect account");
            }

            setSuccess(true);
            setTimeout(() => {
                onClose();
                setSuccess(false);
                setEmail("");
                setPassword("");
            }, 2000);

        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
            <div className="w-full max-w-md bg-card border border-border rounded-xl shadow-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                <div className="p-6 border-b border-border bg-muted/30">
                    <h2 className="text-xl font-bold text-foreground">Connect Email Account</h2>
                    <p className="text-sm text-muted-foreground mt-1">
                        Securely sync your inbox using IMAP/SMTP.
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {error && (
                        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-500 font-medium">
                            {error}
                        </div>
                    )}
                    {success && (
                        <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg text-sm text-green-500 font-medium">
                            Account connected successfully!
                        </div>
                    )}

                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-foreground">Email Address</label>
                        <div className="relative">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <input
                                type="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full pl-9 pr-4 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                                placeholder="name@company.com"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-foreground">App Password</label>
                        <div className="relative">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <input
                                type="password"
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full pl-9 pr-4 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                                placeholder="••••••••••••"
                            />
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-1">
                            For Google/Microsoft, please use an App Password instead of your main password.
                        </p>
                    </div>

                    <div className="pt-2">
                        <button
                            type="button"
                            onClick={() => setIsAdvanced(!isAdvanced)}
                            className="flex items-center gap-2 text-xs font-semibold text-primary hover:text-primary/80 transition-colors"
                        >
                            <Settings className="w-3 h-3" />
                            {isAdvanced ? "Hide Advanced Settings" : "Advanced IMAP/SMTP Settings"}
                        </button>
                    </div>

                    {isAdvanced && (
                        <div className="space-y-4 pt-2 border-t border-border animate-in slide-in-from-top-2">
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-foreground">IMAP Host</label>
                                <div className="relative">
                                    <Server className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                    <input
                                        type="text"
                                        value={host}
                                        onChange={(e) => setHost(e.target.value)}
                                        className="w-full pl-9 pr-4 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                                        placeholder="imap.example.com"
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-foreground">IMAP Port</label>
                                <div className="relative">
                                    <ServerOff className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                    <input
                                        type="text"
                                        value={port}
                                        onChange={(e) => setPort(e.target.value)}
                                        className="w-full pl-9 pr-4 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                                        placeholder="993"
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="flex gap-3 pt-4 border-t border-border">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 py-2 text-sm font-semibold text-muted-foreground hover:bg-muted rounded-lg transition-colors border border-border"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="flex-1 flex justify-center items-center gap-2 py-2 text-sm font-bold text-white bg-[#d35400] hover:bg-[#e67e22] rounded-lg transition-colors shadow-md disabled:opacity-50"
                        >
                            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Connect"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
