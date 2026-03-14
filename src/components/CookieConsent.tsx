"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslations } from "next-intl";
import { X, Cookie } from "lucide-react";

export default function CookieConsent() {
    const t = useTranslations("CookieConsent");
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        const consent = localStorage.getItem("cookie-consent");
        if (!consent) {
            setIsVisible(true);
        }
    }, []);

    const handleConsent = (status: "granted" | "denied") => {
        localStorage.setItem("cookie-consent", status);

        if (typeof window !== "undefined" && (window as any).gtag) {
            (window as any).gtag("consent", "update", {
                ad_storage: status,
                ad_user_data: status,
                ad_personalization: status,
                analytics_storage: status,
            });
        }

        setIsVisible(false);
    };

    return (
        <AnimatePresence>
            {isVisible && (
                <motion.div
                    initial={{ y: 100, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: 100, opacity: 0 }}
                    transition={{ type: "spring", damping: 25, stiffness: 200 }}
                    className="fixed bottom-6 left-6 right-6 z-[9999] flex justify-center pointer-events-none"
                >
                    <div className="w-full max-w-xl bg-neutral-900/95 backdrop-blur-xl border border-white/10 rounded-3xl p-6 shadow-2xl pointer-events-auto">
                        <div className="flex items-start gap-4">
                            <div className="p-3 bg-[#d35400]/10 rounded-2xl text-[#d35400] shrink-0">
                                <Cookie className="w-6 h-6" />
                            </div>
                            <div className="flex-1">
                                <h3 className="text-white font-bold text-lg mb-1">{t("title")}</h3>
                                <p className="text-neutral-400 text-sm leading-relaxed mb-6">
                                    {typeof t("description", { link: "||LINK||" }) === 'string'
                                        ? t("description", { link: "||LINK||" }).split("||LINK||").map((part, i, arr) => (
                                            <React.Fragment key={i}>
                                                {part}
                                                {i !== arr.length - 1 && (
                                                    <a href="/legal/cookies" className="text-[#d35400] hover:underline font-medium">
                                                        {t("linkText")}
                                                    </a>
                                                )}
                                            </React.Fragment>
                                        ))
                                        : null}
                                </p>
                                <div className="flex flex-col sm:flex-row gap-3">
                                    <button
                                        onClick={() => handleConsent("granted")}
                                        className="flex-1 bg-[#d35400] hover:bg-[#a04000] text-white font-bold py-3 px-6 rounded-2xl transition-all shadow-lg shadow-[#d35400]/20"
                                    >
                                        {t("accept")}
                                    </button>
                                    <button
                                        onClick={() => handleConsent("denied")}
                                        className="flex-1 bg-white/5 hover:bg-white/10 text-white font-bold py-3 px-6 rounded-2xl border border-white/10 transition-all"
                                    >
                                        {t("decline")}
                                    </button>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsVisible(false)}
                                className="text-neutral-500 hover:text-white transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
