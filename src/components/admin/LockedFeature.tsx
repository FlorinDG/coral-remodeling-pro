"use client";

import React, { ReactNode } from "react";
import { Link } from "@/i18n/routing";
import { Lock, ArrowUpRight } from "lucide-react";

/**
 * <LockedFeature> — unified gate UI for plan-restricted features.
 *
 * Usage:
 *   <LockedFeature label="Article Library" requiredPlan="PRO" currentPlan={planType}>
 *       <ArticleGrid />
 *   </LockedFeature>
 *
 * If the current plan meets the requirement → renders children.
 * Otherwise → renders a beautiful lock screen with upgrade CTA.
 */

const TIER_ORDER = ['FREE', 'PRO', 'ENTERPRISE'] as const;
type Tier = typeof TIER_ORDER[number];

function meetsMinimum(current: string, required: Tier): boolean {
    // Unlimited plans bypass all gates
    if (current === 'FOUNDER' || current === 'CUSTOM') return true;
    const reqIdx = TIER_ORDER.indexOf(required);
    const curIdx = TIER_ORDER.indexOf(current as Tier);
    if (curIdx === -1) return false;
    return curIdx >= reqIdx;
}

const PLAN_COLORS: Record<string, { bg: string; text: string; border: string; badge: string }> = {
    PRO: {
        bg: 'from-blue-500/5 to-indigo-500/5',
        text: 'text-blue-600 dark:text-blue-400',
        border: 'border-blue-200 dark:border-blue-500/20',
        badge: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300',
    },
    ENTERPRISE: {
        bg: 'from-violet-500/5 to-purple-500/5',
        text: 'text-violet-600 dark:text-violet-400',
        border: 'border-violet-200 dark:border-violet-500/20',
        badge: 'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300',
    },
};

interface LockedFeatureProps {
    /** Human-readable feature name */
    label: string;
    /** Minimum plan tier to unlock */
    requiredPlan: 'PRO' | 'ENTERPRISE';
    /** Current tenant plan */
    currentPlan: string;
    /** Optional subtitle / description */
    description?: string;
    /** Content to render when unlocked */
    children?: ReactNode;
    /** If true, show as inline banner instead of full-page lock */
    inline?: boolean;
}

export default function LockedFeature({
    label,
    requiredPlan,
    currentPlan,
    description,
    children,
    inline = false,
}: LockedFeatureProps) {
    if (meetsMinimum(currentPlan, requiredPlan)) {
        return <>{children}</>;
    }

    const colors = PLAN_COLORS[requiredPlan] || PLAN_COLORS.PRO;

    if (inline) {
        return (
            <div className={`flex items-center gap-3 p-4 rounded-xl border ${colors.border} bg-gradient-to-r ${colors.bg}`}>
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${colors.badge}`}>
                    <Lock className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-neutral-900 dark:text-white truncate">{label}</p>
                    <p className="text-xs text-neutral-500 mt-0.5">
                        Requires <span className={`font-bold ${colors.text}`}>{requiredPlan}</span> plan
                    </p>
                </div>
                <Link
                    href="/pricing"
                    className={`flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-lg ${colors.badge} hover:opacity-80 transition-opacity shrink-0`}
                >
                    Upgrade <ArrowUpRight className="w-3 h-3" />
                </Link>
            </div>
        );
    }

    return (
        <div className="flex-1 flex items-center justify-center p-8">
            <div className={`max-w-md w-full text-center bg-gradient-to-br ${colors.bg} rounded-3xl border ${colors.border} p-10 shadow-sm`}>
                {/* Lock icon */}
                <div className={`w-16 h-16 rounded-2xl ${colors.badge} flex items-center justify-center mx-auto mb-6`}>
                    <Lock className="w-7 h-7" />
                </div>

                {/* Feature name */}
                <h2 className="text-xl font-black text-neutral-900 dark:text-white mb-2">
                    {label}
                </h2>

                {/* Description */}
                <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-1 leading-relaxed">
                    {description || `This feature is available on the ${requiredPlan} plan and above.`}
                </p>

                {/* Plan badge */}
                <div className="flex items-center justify-center gap-2 my-6">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">
                        Your plan
                    </span>
                    <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-md bg-neutral-100 dark:bg-white/10 text-neutral-600 dark:text-neutral-300">
                        {currentPlan}
                    </span>
                    <span className="text-neutral-300 dark:text-neutral-600">→</span>
                    <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-md ${colors.badge}`}>
                        {requiredPlan}
                    </span>
                </div>

                {/* CTA */}
                <Link
                    href="/pricing"
                    className={`inline-flex items-center gap-2 px-6 py-3 rounded-xl text-white font-bold text-sm shadow-md hover:opacity-90 transition-opacity active:scale-[0.98]`}
                    style={{ backgroundColor: 'var(--brand-color, #d35400)' }}
                >
                    Upgrade to {requiredPlan}
                    <ArrowUpRight className="w-4 h-4" />
                </Link>
            </div>
        </div>
    );
}
