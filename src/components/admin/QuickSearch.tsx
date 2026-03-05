"use client";

import { useState, useEffect, useCallback } from "react";
import { Search, LayoutDashboard, FileText, Briefcase, ImageIcon, User, X, Command } from "lucide-react";
import { useRouter } from "next/navigation";
import { Link } from "@/i18n/routing";

const items = [
    { id: "dashboard", label: "Dashboard", href: "/admin/dashboard", icon: LayoutDashboard },
    { id: "content", label: "Edit Site Content", href: "/admin/content", icon: FileText },
    { id: "services", label: "Manage Services", href: "/admin/services", icon: Briefcase },
    { id: "portfolio", label: "Manage Portfolio", href: "/admin/projects", icon: ImageIcon },
    { id: "portals", label: "Client Portals", href: "/admin/portals", icon: User },
    { id: "leads", label: "View Leads", href: "/admin/leads", icon: User },
];

export default function QuickSearch() {
    const [isOpen, setIsOpen] = useState(false);
    const [query, setQuery] = useState("");
    const router = useRouter();

    const toggle = useCallback(() => setIsOpen((prev) => !prev), []);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "k") {
                e.preventDefault();
                toggle();
            }
            if (e.key === "Escape" && isOpen) {
                setIsOpen(false);
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isOpen, toggle]);

    const filteredItems = items.filter((item) =>
        item.label.toLowerCase().includes(query.toLowerCase())
    );

    if (!isOpen) {
        return (
            <button
                onClick={toggle}
                className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-neutral-100 dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-lg text-neutral-500 hover:text-neutral-900 dark:hover:text-white transition-colors group"
            >
                <Search className="w-3.5 h-3.5" />
                <span className="text-[10px] font-bold uppercase tracking-widest">Search...</span>
                <div className="flex items-center gap-0.5 px-1.5 py-0.5 bg-white dark:bg-white/10 rounded border border-neutral-200 dark:border-white/10 ml-2">
                    <Command className="w-2.5 h-2.5" />
                    <span className="text-[9px] font-bold">K</span>
                </div>
            </button>
        );
    }

    return (
        <div className="fixed inset-0 z-[100] flex items-start justify-center pt-24 px-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-full max-w-xl bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl border border-neutral-200 dark:border-white/10 overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="p-4 border-b border-neutral-200 dark:border-white/10 flex items-center gap-3">
                    <Search className="w-5 h-5 text-[#d35400]" />
                    <input
                        autoFocus
                        type="text"
                        placeholder="Type a command or search..."
                        className="flex-1 bg-transparent outline-none text-neutral-900 dark:text-white font-medium"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                    />
                    <button onClick={() => setIsOpen(false)} className="p-2 hover:bg-neutral-100 dark:hover:bg-white/5 rounded-lg transition-colors">
                        <X className="w-4 h-4 text-neutral-400" />
                    </button>
                </div>

                <div className="max-h-[60vh] overflow-y-auto p-2">
                    {filteredItems.length > 0 ? (
                        <div className="space-y-1">
                            {filteredItems.map((item) => (
                                <Link
                                    key={item.id}
                                    href={item.href}
                                    onClick={() => setIsOpen(false)}
                                    className="flex items-center gap-3 p-3 rounded-xl hover:bg-neutral-100 dark:hover:bg-white/5 transition-colors group"
                                >
                                    <div className="w-8 h-8 rounded-lg bg-neutral-100 dark:bg-white/10 flex items-center justify-center">
                                        <item.icon className="w-4 h-4 text-neutral-400 group-hover:text-[#d35400] transition-colors" />
                                    </div>
                                    <span className="font-bold text-sm">{item.label}</span>
                                    <span className="text-[10px] text-neutral-400 ml-auto uppercase tracking-wider">{item.href}</span>
                                </Link>
                            ))}
                        </div>
                    ) : (
                        <div className="p-8 text-center text-neutral-500 text-sm italic">
                            No results found for "{query}"
                        </div>
                    )}
                </div>

                <div className="p-3 border-t border-neutral-200 dark:border-white/10 bg-neutral-50/50 dark:bg-black/20 flex justify-between items-center text-[10px] font-bold text-neutral-400 uppercase tracking-widest">
                    <div className="flex gap-4">
                        <span className="flex items-center gap-1"><kbd className="px-1 py-0.5 bg-white dark:bg-white/10 rounded border border-neutral-200 dark:border-white/10">ESC</kbd> to close</span>
                    </div>
                </div>
            </div>
            <div className="fixed inset-0 -z-10" onClick={() => setIsOpen(false)} />
        </div>
    );
}
