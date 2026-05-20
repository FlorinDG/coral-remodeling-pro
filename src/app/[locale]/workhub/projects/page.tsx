"use client";

import { Link } from "@/i18n/routing";
import { FolderKanban, ArrowRight } from "lucide-react";

/**
 * WorkHub Projects — lightweight bridge to the admin Projects module.
 * Shows a summary card and links through to the full project management view.
 */
export default function WorkHubProjectsPage() {
    return (
        <div className="max-w-4xl mx-auto px-4 py-4">
            <h1 className="text-xl font-black tracking-tight mb-4 text-neutral-900 dark:text-white">Projects</h1>
            <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-white/10 rounded-2xl p-8 text-center">
                <div className="w-16 h-16 rounded-2xl bg-violet-100 dark:bg-violet-500/10 flex items-center justify-center mx-auto mb-4">
                    <FolderKanban className="w-8 h-8 text-violet-600 dark:text-violet-400" />
                </div>
                <h2 className="text-lg font-bold text-neutral-900 dark:text-white mb-2">Project Management</h2>
                <p className="text-sm text-neutral-500 max-w-md mx-auto mb-6">
                    View your assigned projects, track progress, and manage deliverables.
                </p>
                <Link
                    href="/admin/projects-management"
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white shadow-sm hover:opacity-90 transition-colors"
                    style={{ backgroundColor: 'var(--brand-color, #d35400)' }}
                >
                    Open Projects <ArrowRight className="w-4 h-4" />
                </Link>
            </div>
        </div>
    );
}
