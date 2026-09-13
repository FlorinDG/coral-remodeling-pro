'use client';

import React, { useState } from 'react';
import { useRouter, usePathname, Link } from '@/i18n/routing';
import { useTranslations, useLocale } from 'next-intl';
import { useTheme } from 'next-themes';
import { useSession } from 'next-auth/react';
import { toast } from 'sonner';
import {
    ArrowLeft, Eye, SlidersHorizontal, Bell,
    Repeat, Moon, Sun, Monitor, Send, Check
} from 'lucide-react';
import { useUserPreferences } from '@/hooks/useUserPreferences';
import { sendTaskDigestAction } from '@/app/actions/tasks';

export interface TaskSettingsPreferences {
    defaultView: 'today' | 'all' | 'flagged';
    defaultSort: 'due' | 'priority' | 'title' | 'manual';
    reminderDigestEnabled: boolean;
    reminderDigestTime: string;
    reminderDigestEmail: string;
    defaultRecurrenceAnchor: 'due' | 'completion';
    showCompleted: boolean;
}

export const DEFAULT_TASK_SETTINGS: TaskSettingsPreferences = {
    defaultView: 'today',
    defaultSort: 'due',
    reminderDigestEnabled: true,
    reminderDigestTime: '08:00',
    reminderDigestEmail: '',
    defaultRecurrenceAnchor: 'due',
    showCompleted: false,
};

export default function TaskSettingsPage() {
    const t = useTranslations('Mobile');
    const locale = useLocale();
    const router = useRouter();
    const pathname = usePathname();
    const { theme, setTheme } = useTheme();
    const { data: session } = useSession();
    const userEmail = session?.user?.email || '';

    const [settings, setSettings] = useUserPreferences<TaskSettingsPreferences>(
        'tasks_settings',
        {
            ...DEFAULT_TASK_SETTINGS,
            reminderDigestEmail: userEmail,
        }
    );

    const [isSendingDigest, setIsSendingDigest] = useState(false);

    const handleSendTestDigest = async () => {
        setIsSendingDigest(true);
        try {
            const res = await sendTaskDigestAction();
            if (res.success) {
                toast.success(t('tasks_digest_sent'));
            } else {
                toast.error('Failed to send digest email');
            }
        } catch (e: any) {
            toast.error(e?.message || 'Error sending digest');
        } finally {
            setIsSendingDigest(false);
        }
    };

    const handleLanguageChange = (lang: string) => {
        document.cookie = `NEXT_LOCALE=${lang};path=/;max-age=${60 * 60 * 24 * 365};samesite=lax`;
        router.replace(pathname, { locale: lang });
    };

    return (
        <div className="max-w-lg mx-auto w-full p-4 space-y-6 pb-12">
            {/* Header / Nav */}
            <div className="flex items-center gap-3">
                <Link
                    href="/m/tasks"
                    className="w-10 h-10 rounded-xl bg-neutral-100 hover:bg-neutral-200 dark:bg-white/10 dark:hover:bg-white/15 flex items-center justify-center text-neutral-700 dark:text-neutral-300 transition-colors"
                >
                    <ArrowLeft className="w-5 h-5" />
                </Link>
                <div>
                    <h1 className="text-lg font-black text-neutral-900 dark:text-white">
                        {t('tasks_settings_title')}
                    </h1>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">
                        {t('tasks_subtitle')}
                    </p>
                </div>
            </div>

            {/* Views & Display */}
            <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-white/10 rounded-2xl p-4 shadow-xs space-y-4">
                <div className="flex items-center gap-2 border-b border-neutral-100 dark:border-white/5 pb-2">
                    <Eye className="w-4 h-4 text-orange-500" />
                    <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-700 dark:text-neutral-300">
                        {t('tasks_settings_views_display')}
                    </h2>
                </div>

                {/* Default View */}
                <div>
                    <label className="text-xs font-semibold text-neutral-600 dark:text-neutral-400 mb-1.5 block">
                        {t('tasks_settings_default_view')}
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                        {(['today', 'all', 'flagged'] as const).map(view => (
                            <button
                                key={view}
                                type="button"
                                onClick={() => setSettings(prev => ({ ...prev, defaultView: view }))}
                                className={`py-2 px-3 rounded-xl text-xs font-bold transition-all ${
                                    settings.defaultView === view
                                        ? 'bg-orange-500 text-white shadow-xs'
                                        : 'bg-neutral-100 hover:bg-neutral-200 dark:bg-white/5 dark:hover:bg-white/10 text-neutral-700 dark:text-neutral-300'
                                }`}
                            >
                                {view === 'today' && t('tasks_settings_view_today')}
                                {view === 'all' && t('tasks_settings_view_all')}
                                {view === 'flagged' && t('tasks_settings_view_flagged')}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Default Sort */}
                <div>
                    <label className="text-xs font-semibold text-neutral-600 dark:text-neutral-400 mb-1.5 block">
                        {t('tasks_settings_default_sort')}
                    </label>
                    <select
                        value={settings.defaultSort}
                        onChange={(e) => setSettings(prev => ({ ...prev, defaultSort: e.target.value as any }))}
                        className="w-full min-h-[44px] bg-neutral-100 dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-xl px-3 py-2 text-xs font-semibold text-neutral-900 dark:text-white outline-none"
                    >
                        <option value="due">{t('tasks_settings_sort_due')}</option>
                        <option value="priority">{t('tasks_settings_sort_priority')}</option>
                        <option value="title">{t('tasks_settings_sort_title')}</option>
                        <option value="manual">{t('tasks_settings_sort_manual')}</option>
                    </select>
                </div>

                {/* Show Completed Toggle */}
                <div className="flex items-center justify-between pt-2">
                    <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                        {t('tasks_settings_show_completed')}
                    </span>
                    <button
                        type="button"
                        onClick={() => setSettings(prev => ({ ...prev, showCompleted: !prev.showCompleted }))}
                        className={`w-12 h-7 rounded-full transition-colors relative p-1 ${
                            settings.showCompleted ? 'bg-orange-500' : 'bg-neutral-300 dark:bg-neutral-700'
                        }`}
                    >
                        <div
                            className={`w-5 h-5 rounded-full bg-white transition-transform ${
                                settings.showCompleted ? 'translate-x-5' : 'translate-x-0'
                            }`}
                        />
                    </button>
                </div>
            </div>

            {/* Recurrence Anchor */}
            <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-white/10 rounded-2xl p-4 shadow-xs space-y-4">
                <div className="flex items-center gap-2 border-b border-neutral-100 dark:border-white/5 pb-2">
                    <Repeat className="w-4 h-4 text-orange-500" />
                    <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-700 dark:text-neutral-300">
                        {t('tasks_settings_recurrence')}
                    </h2>
                </div>

                <div>
                    <label className="text-xs font-semibold text-neutral-600 dark:text-neutral-400 mb-1.5 block">
                        {t('tasks_settings_default_anchor')}
                    </label>
                    <div className="space-y-2">
                        <label
                            onClick={() => setSettings(prev => ({ ...prev, defaultRecurrenceAnchor: 'due' }))}
                            className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                                settings.defaultRecurrenceAnchor === 'due'
                                    ? 'border-orange-500 bg-orange-500/5'
                                    : 'border-neutral-200 dark:border-white/10 bg-neutral-50 dark:bg-white/[0.02]'
                            }`}
                        >
                            <input
                                type="radio"
                                name="recurrence_anchor"
                                checked={settings.defaultRecurrenceAnchor === 'due'}
                                onChange={() => {}}
                                className="mt-0.5 text-orange-500 focus:ring-orange-500"
                            />
                            <div>
                                <span className="text-xs font-bold text-neutral-900 dark:text-white block">
                                    {t('tasks_repeat_from_due')}
                                </span>
                                <span className="text-[11px] text-neutral-500 dark:text-neutral-400">
                                    {t('tasks_settings_anchor_due')}
                                </span>
                            </div>
                        </label>

                        <label
                            onClick={() => setSettings(prev => ({ ...prev, defaultRecurrenceAnchor: 'completion' }))}
                            className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                                settings.defaultRecurrenceAnchor === 'completion'
                                    ? 'border-orange-500 bg-orange-500/5'
                                    : 'border-neutral-200 dark:border-white/10 bg-neutral-50 dark:bg-white/[0.02]'
                            }`}
                        >
                            <input
                                type="radio"
                                name="recurrence_anchor"
                                checked={settings.defaultRecurrenceAnchor === 'completion'}
                                onChange={() => {}}
                                className="mt-0.5 text-orange-500 focus:ring-orange-500"
                            />
                            <div>
                                <span className="text-xs font-bold text-neutral-900 dark:text-white block">
                                    {t('tasks_repeat_from_completion')}
                                </span>
                                <span className="text-[11px] text-neutral-500 dark:text-neutral-400">
                                    {t('tasks_settings_anchor_completion')}
                                </span>
                            </div>
                        </label>
                    </div>
                </div>
            </div>

            {/* Daily Reminder Digest */}
            <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-white/10 rounded-2xl p-4 shadow-xs space-y-4">
                <div className="flex items-center gap-2 border-b border-neutral-100 dark:border-white/5 pb-2">
                    <Bell className="w-4 h-4 text-orange-500" />
                    <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-700 dark:text-neutral-300">
                        {t('tasks_settings_reminders')}
                    </h2>
                </div>

                <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                        {t('tasks_settings_reminders_enable')}
                    </span>
                    <button
                        type="button"
                        onClick={() => setSettings(prev => ({ ...prev, reminderDigestEnabled: !prev.reminderDigestEnabled }))}
                        className={`w-12 h-7 rounded-full transition-colors relative p-1 ${
                            settings.reminderDigestEnabled ? 'bg-orange-500' : 'bg-neutral-300 dark:bg-neutral-700'
                        }`}
                    >
                        <div
                            className={`w-5 h-5 rounded-full bg-white transition-transform ${
                                settings.reminderDigestEnabled ? 'translate-x-5' : 'translate-x-0'
                            }`}
                        />
                    </button>
                </div>

                {settings.reminderDigestEnabled && (
                    <div className="space-y-3 pt-2">
                        <div>
                            <label className="text-xs font-semibold text-neutral-600 dark:text-neutral-400 mb-1 block">
                                {t('tasks_settings_reminders_time')}
                            </label>
                            <input
                                type="time"
                                value={settings.reminderDigestTime}
                                onChange={(e) => setSettings(prev => ({ ...prev, reminderDigestTime: e.target.value }))}
                                className="w-full min-h-[44px] bg-neutral-100 dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-xl px-3 py-2 text-xs font-semibold text-neutral-900 dark:text-white outline-none"
                            />
                        </div>

                        <div>
                            <label className="text-xs font-semibold text-neutral-600 dark:text-neutral-400 mb-1 block">
                                {t('tasks_settings_reminders_email')}
                            </label>
                            <input
                                type="email"
                                value={settings.reminderDigestEmail || userEmail}
                                onChange={(e) => setSettings(prev => ({ ...prev, reminderDigestEmail: e.target.value }))}
                                placeholder="name@example.com"
                                className="w-full min-h-[44px] bg-neutral-100 dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-xl px-3 py-2 text-xs font-semibold text-neutral-900 dark:text-white outline-none"
                            />
                        </div>

                        <button
                            type="button"
                            onClick={handleSendTestDigest}
                            disabled={isSendingDigest}
                            className="w-full min-h-[44px] rounded-xl bg-orange-500/10 hover:bg-orange-500/20 text-orange-600 dark:text-orange-400 font-bold text-xs flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                        >
                            <Send className="w-3.5 h-3.5" />
                            {isSendingDigest ? t('tasks_uploading') : t('tasks_send_digest_now')}
                        </button>
                    </div>
                )}
            </div>

            {/* App Preferences: Theme & Language */}
            <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-white/10 rounded-2xl p-4 shadow-xs space-y-4">
                <div className="flex items-center gap-2 border-b border-neutral-100 dark:border-white/5 pb-2">
                    <SlidersHorizontal className="w-4 h-4 text-orange-500" />
                    <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-700 dark:text-neutral-300">
                        {t('tasks_settings_preferences')}
                    </h2>
                </div>

                {/* Theme */}
                <div>
                    <label className="text-xs font-semibold text-neutral-600 dark:text-neutral-400 mb-1.5 block">
                        {t('tasks_settings_theme')}
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                        {[
                            { id: 'light', label: t('tasks_settings_theme_light'), icon: <Sun className="w-4 h-4" /> },
                            { id: 'dark', label: t('tasks_settings_theme_dark'), icon: <Moon className="w-4 h-4" /> },
                            { id: 'system', label: t('tasks_settings_theme_system'), icon: <Monitor className="w-4 h-4" /> },
                        ].map(item => (
                            <button
                                key={item.id}
                                type="button"
                                onClick={() => setTheme(item.id)}
                                className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                                    theme === item.id
                                        ? 'bg-orange-500 text-white shadow-xs'
                                        : 'bg-neutral-100 hover:bg-neutral-200 dark:bg-white/5 dark:hover:bg-white/10 text-neutral-700 dark:text-neutral-300'
                                }`}
                            >
                                {item.icon}
                                {item.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Language */}
                <div>
                    <label className="text-xs font-semibold text-neutral-600 dark:text-neutral-400 mb-1.5 block">
                        {t('tasks_settings_language')}
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                        {[
                            { code: 'en', label: 'English' },
                            { code: 'nl', label: 'Nederlands' },
                            { code: 'fr', label: 'Français' },
                            { code: 'ro', label: 'Română' },
                        ].map(lang => (
                            <button
                                key={lang.code}
                                type="button"
                                onClick={() => handleLanguageChange(lang.code)}
                                className={`py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-between transition-all ${
                                    locale === lang.code
                                        ? 'border-2 border-orange-500 bg-orange-500/10 text-orange-600 dark:text-orange-400'
                                        : 'border border-neutral-200 dark:border-white/10 bg-neutral-50 dark:bg-white/5 text-neutral-700 dark:text-neutral-300'
                                }`}
                            >
                                <span>{lang.label}</span>
                                {locale === lang.code && <Check className="w-4 h-4 text-orange-500" />}
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
