"use client";

/**
 * WorkHub — Profile (WH-2). Who I am, and the app's LANGUAGE.
 * The old admin header (removed from the crew screens) carried the only language switcher;
 * for the crews (nl · fr · ro · ru) it lives here now, in their own i18n instance, persisted
 * on the phone by the detector's localStorage cache.
 */
import { useSession } from "next-auth/react";
import { useTranslation } from "react-i18next";
import { Mail, Languages, Check } from "lucide-react";

const LANGUAGES = [
    { code: "nl", label: "Nederlands" },
    { code: "fr", label: "Français" },
    { code: "en", label: "English" },
    { code: "ro", label: "Română" },
    { code: "ru", label: "Русский" },
] as const;

export default function WorkerProfilePage() {
    const { data: session } = useSession();
    const { t, i18n } = useTranslation();
    const user = session?.user;
    if (!user) return null;

    const current = (i18n.resolvedLanguage || i18n.language || "en").slice(0, 2);
    const initials = user.name
        ? user.name.split(" ").map((n) => n[0]).join("").substring(0, 2).toUpperCase()
        : "·";

    return (
        <div className="px-3 py-4 space-y-4">
            <div className="flex items-center gap-4 p-4 rounded-2xl border border-border bg-card shadow-sm">
                <div className="w-16 h-16 rounded-full bg-[var(--persian-green)] text-white flex items-center justify-center text-2xl font-bold shrink-0">
                    {initials}
                </div>
                <div className="min-w-0">
                    <h1 className="text-xl font-bold text-foreground break-words">{user.name}</h1>
                    {user.email && (
                        <p className="flex items-center gap-1.5 text-base text-muted-foreground min-w-0">
                            <Mail className="w-5 h-5 shrink-0" /><span className="truncate">{user.email}</span>
                        </p>
                    )}
                </div>
            </div>

            <section className="p-4 rounded-2xl border border-border bg-card shadow-sm space-y-3">
                <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
                    <Languages className="w-6 h-6 text-[var(--persian-green)]" />{t("profile.language")}
                </h2>
                <div className="grid grid-cols-1 gap-2">
                    {LANGUAGES.map((l) => {
                        const active = current === l.code;
                        return (
                            <button
                                key={l.code}
                                type="button"
                                onClick={() => i18n.changeLanguage(l.code)}
                                className={`flex items-center justify-between h-14 px-4 rounded-xl border text-base font-semibold transition-colors ${
                                    active
                                        ? "border-[var(--persian-green)] bg-[var(--persian-green)]/10 text-[var(--persian-green)]"
                                        : "border-border text-foreground"
                                }`}
                            >
                                {l.label}
                                {active && <Check className="w-6 h-6" />}
                            </button>
                        );
                    })}
                </div>
            </section>

            <p className="px-2 text-sm text-muted-foreground text-center">{t("profile.contactSupervisor")}</p>
        </div>
    );
}
