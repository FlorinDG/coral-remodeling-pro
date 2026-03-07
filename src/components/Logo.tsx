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
            {/* Bold Stylized C */}
            <path
                d="M410 130C385 100 340 80 285 80C185 80 100 160 100 256C100 352 185 432 285 432C340 432 385 412 410 382"
                stroke="currentColor"
                strokeWidth="52"
                strokeLinecap="round"
            />

            {/* Organic Coral Branching */}
            <g
                stroke="currentColor"
                strokeWidth="22"
                stroke-linecap="round"
                stroke-linejoin="round"
                fill="none"
            >
                {/* Main Trunk */}
                <path d="M285 390C295 310 275 260 285 180" />

                {/* Primary Branches */}
                <path d="M285 330C250 330 235 310 235 285" />
                <path d="M235 285C235 265 250 255 265 235" />

                <path d="M285 300C330 300 345 280 345 255" />
                <path d="M345 255C345 235 330 225 335 195" />

                {/* Secondary Accents */}
                <path d="M285 240C305 230 315 210 310 190" />
                <path d="M285 270C265 260 255 240 260 220" />
            </g>
        </svg>
    );
}
