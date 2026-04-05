import prisma from "@/lib/prisma";
import { Megaphone } from "lucide-react";

export default async function PromotionalBanner({ locale }: { locale: string }) {
    try {
        const banner = await prisma.promotionalBanner.findFirst();

        if (!banner || !banner.isActive) return null;

        const text = locale === 'nl' ? (banner.textNl || banner.textEn) : banner.textEn;

        return (
            <div className="bg-[#d75d00] text-white py-2 px-4 relative z-[100]">
                <div className="max-w-7xl mx-auto flex items-center justify-center gap-3">
                    <Megaphone className="w-3.5 h-3.5 animate-bounce" />
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-center">
                        {text}
                    </p>
                </div>
            </div>
        );
    } catch (error) {
        console.error("Failed to load promotional banner:", error);
        return null; // Gracefully fail without bringing down the root layout
    }
}
