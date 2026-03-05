"use client";

import { usePathname } from "next/navigation";
import { Link } from "@/i18n/routing";
import { ChevronRight, Home } from "lucide-react";

export default function Breadcrumbs() {
    const pathname = usePathname();
    const paths = pathname.split("/").filter(Boolean);

    // Remove the locale from the paths for display
    const localeArr = ["en", "nl", "fr", "ro"];
    const filteredPaths = localeArr.includes(paths[0]) ? paths.slice(1) : paths;

    return (
        <nav className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-neutral-400">
            <Link
                href="/admin/dashboard"
                className="hover:text-[#d35400] transition-colors flex items-center gap-1"
            >
                <Home className="w-3 h-3" />
                <span>Admin</span>
            </Link>

            {filteredPaths.map((path, index) => {
                if (path === "admin") return null;

                const href = `/${filteredPaths.slice(0, index + 1).join("/")}`;
                const label = path.charAt(0).toUpperCase() + path.slice(1);
                const isLast = index === filteredPaths.length - 1;

                return (
                    <div key={path} className="flex items-center gap-2">
                        <ChevronRight className="w-3 h-3 text-neutral-300 dark:text-neutral-700" />
                        {isLast ? (
                            <span className="text-neutral-900 dark:text-white">{label}</span>
                        ) : (
                            <Link href={href} className="hover:text-[#d35400] transition-colors whitespace-nowrap">
                                {label}
                            </Link>
                        )}
                    </div>
                );
            })}
        </nav>
    );
}
