"use client";

import React from 'react';
import { AlertTriangle, ArrowRight, X } from 'lucide-react';
import { useState } from 'react';

interface PeppolQuotaBannerProps {
    /** Which limit was exceeded */
    type: 'sent' | 'received';
    current: number;
    limit: number;
    plan: string;
}

const MESSAGES = {
    sent: {
        nl: (current: number, limit: number, plan: string) =>
            `Je hebt ${current} van de ${limit} toegelaten Peppol-verzendingen voor deze maand bereikt (${plan}-plan). Extra volume wordt pro-rata gefactureerd.`,
        action: 'Upgrade naar Pro',
    },
    received: {
        nl: (current: number, limit: number, plan: string) =>
            `Je ${plan}-plan bevat ${limit} ontvangen Peppol-facturen/maand. Je hebt er ${current} ontvangen deze maand — alle documenten zijn correct verwerkt. Extra volume wordt pro-rata gefactureerd.`,
        action: 'Upgrade naar Pro',
    },
};

export default function PeppolQuotaBanner({ type, current, limit, plan }: PeppolQuotaBannerProps) {
    const [dismissed, setDismissed] = useState(false);
    if (dismissed) return null;

    const msg = MESSAGES[type];

    return (
        <div
            role="alert"
            className="flex items-start gap-3 px-4 py-3 mx-4 mt-2 mb-0.5 rounded-xl
                       bg-amber-50 dark:bg-amber-900/20
                       border border-amber-200 dark:border-amber-700/40
                       text-amber-800 dark:text-amber-300
                       text-xs animate-in slide-in-from-top-1 fade-in duration-200"
        >
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-500" />

            <p className="flex-1 leading-relaxed">
                {msg.nl(current, limit, plan)}{' '}
                <a
                    href="mailto:info@coral-group.be?subject=Upgrade%20CoralOS%20Pro"
                    className="inline-flex items-center gap-1 font-semibold underline hover:no-underline ml-1"
                >
                    {msg.action} <ArrowRight className="w-3 h-3" />
                </a>
            </p>

            <button
                onClick={() => setDismissed(true)}
                title="Sluiten"
                className="shrink-0 text-amber-400 hover:text-amber-600 dark:hover:text-amber-200 transition-colors"
            >
                <X className="w-3.5 h-3.5" />
            </button>
        </div>
    );
}
