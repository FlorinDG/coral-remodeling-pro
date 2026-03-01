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

            {/* Organic Coral */}
            <g
                stroke="currentColor"
                strokeWidth="20"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
                className="opacity-90"
            >
                {/* Main organic trunk */}
                <path d="M280 400C290 320 270 280 280 200" />
                {/* Left branching structure */}
                <path d="M282 340C250 340 230 320 230 290" />
                <path d="M230 290C230 270 250 260 260 240" />
                {/* Right branching structure */}
                <path d="M278 300C320 300 340 280 340 250" />
                <path d="M340 250C340 230 320 220 330 190" />
                {/* Secondary small branch */}
                <path d="M280 260C300 250 310 230 305 210" />
            </g>
        </svg>
    );
}
