"use client";

import { useState } from 'react';
import { useTranslations } from 'next-intl';

interface ProjectUpdateFormProps {
    portalId: string;
}

export default function ProjectUpdateForm({ portalId }: ProjectUpdateFormProps) {
    const t = useTranslations('Admin.portals');
    const [loading, setLoading] = useState(false);
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const res = await fetch('/api/portals/updates', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ portalId, title, content })
            });
            if (!res.ok) throw new Error();
            window.location.reload();
        } catch (error) {
            alert('Failed to post update');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="glass-morphism p-6 rounded-3xl border border-white/10">
            <h3 className="text-xl font-bold mb-6">{t('postUpdate')}</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
                <input
                    name="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder={t('form.title')}
                    required
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-[#d35400] outline-none transition-colors"
                />
                <textarea
                    name="content"
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder={t('form.details')}
                    required
                    rows={3}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-[#d35400] outline-none transition-colors"
                />
                <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-[#d35400] hover:bg-[#a04000] text-white py-3 rounded-xl font-bold uppercase transition-colors disabled:opacity-50"
                >
                    {loading ? 'POSTING...' : t('form.post')}
                </button>
            </form>
        </div>
    );
}
