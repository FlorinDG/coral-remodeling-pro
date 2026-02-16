import Image from 'next/image';
import { motion } from 'framer-motion';
import LeadForm from './LeadForm';

import { useTranslations } from 'next-intl';

export default function Hero() {
    const t = useTranslations('Hero');

    return (
        <section className="relative min-h-screen flex items-center pt-20 px-8 md:px-16 overflow-hidden">
            {/* Background Images with Cinematic Animation */}
            <motion.div
                initial={{ x: '10%', opacity: 0, filter: 'brightness(0.1) grayscale(100%)' }}
                animate={{ x: 0, opacity: 0.4, filter: 'brightness(1) grayscale(50%)' }}
                transition={{
                    x: { duration: 2, ease: "easeOut" },
                    opacity: { duration: 2, ease: "easeOut" },
                    filter: { delay: 1.8, duration: 1.5, ease: "easeInOut" }
                }}
                className="absolute inset-0 z-0"
            >
                <Image
                    src="/images/kitchen-hero.png"
                    alt="Kitchen Hero"
                    fill
                    className="object-cover"
                    priority
                />
                <div className="absolute inset-0 bg-white/90 dark:bg-transparent" />
                <div className="absolute inset-0 bg-gradient-to-t from-white via-transparent to-white/50 dark:from-black dark:to-black/50" />
            </motion.div>

            <div className="container mx-auto grid md:grid-cols-2 gap-12 items-center z-10">
                <div className="flex flex-col items-end text-right">
                    <h1 className="text-4xl md:text-7xl font-bold tracking-tighter leading-tight mb-6 text-neutral-950 dark:text-white">
                        Luxury. <br />
                        <span className="text-[#d35400]">Redefined.</span>
                    </h1>
                    <p className="text-lg md:text-xl text-neutral-600 dark:text-neutral-400 max-w-md mb-8 leading-relaxed font-normal">
                        {t('description')}
                    </p>
                    <p className="text-[#d35400] font-bold tracking-[0.3em] uppercase mb-12 text-sm md:text-base">
                        {t('tagline')}
                    </p>
                    <div className="flex gap-6 text-neutral-950 dark:text-white">
                        <div className="flex flex-col items-end">
                            <span className="text-2xl font-bold">150+</span>
                            <span className="text-[10px] text-neutral-500 tracking-[0.2em]">PROJECTS DONE</span>
                        </div>
                        <div className="w-[1px] h-10 bg-neutral-800" />
                        <div className="flex flex-col items-end">
                            <span className="text-2xl font-bold">12+</span>
                            <span className="text-[10px] text-neutral-500 tracking-[0.2em]">YEARS EXP</span>
                        </div>
                    </div>
                </div>

                <motion.div
                    initial={{ opacity: 0, y: 50 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, delay: 0.2 }}
                    className="glass-morphism p-8 rounded-3xl border border-white/10 min-h-[580px] flex flex-col"
                >
                    <LeadForm />
                </motion.div>
            </div>
        </section>
    );
}
