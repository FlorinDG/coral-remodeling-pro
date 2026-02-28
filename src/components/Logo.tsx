import { useTranslations } from 'next-intl';

export default function Logo({ className = "" }: { className?: string }) {
    const t = useTranslations('Navbar');
    return (
        <svg
            viewBox="0 0 512 512"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className={`text-[#d35400] dark:text-white transition-colors duration-300 ${className}`}
            role="img"
            aria-label={t('logoAria')}
        >
            <title>{t('logoTitle')}</title>
            {/* Stylized C */}
            <path
                d="M400 130C375 100 330 80 280 80C180.589 80 100 158.35 100 256C100 353.65 180.589 432 280 432C330 432 375 412 400 382"
                stroke="currentColor"
                strokeWidth="40"
                strokeLinecap="round"
            />

            {/* Stylized Coral */}
            <path
                d="M280 350V210M280 300C250 300 240 280 240 250M280 270C310 270 320 250 320 220"
                stroke="currentColor"
                strokeWidth="20"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
}
