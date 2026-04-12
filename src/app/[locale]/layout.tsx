import type { Metadata } from "next";
import { Oxanium } from "next/font/google";

import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations } from 'next-intl/server';
import { ThemeProvider } from "@/components/ThemeProvider";
import Script from "next/script";
import "../globals.css";

const oxanium = Oxanium({
    variable: "--font-oxanium",
    subsets: ["latin"],
    weight: ["300", "400", "500", "600", "700", "800"],
});

const baseUrl = 'https://app.coral-group.be';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
    const { locale } = await params;
    const t = await getTranslations({ locale, namespace: 'Metadata' });

    return {
        metadataBase: new URL(baseUrl),
        title: {
            default: t('title'),
            template: `%s | ${t('title')}`
        },
        description: t('description'),
        keywords: t.raw('keywords') as string[],
        alternates: {
            canonical: `${baseUrl}/${locale}`,
            languages: {
                'en': `${baseUrl}/en`,
                'nl': `${baseUrl}/nl`,
                'fr': `${baseUrl}/fr`,
                'ro': `${baseUrl}/ro`,
                'x-default': `${baseUrl}/en`,
            },
        },
        openGraph: {
            title: t('title'),
            description: t('description'),
            url: baseUrl,
            siteName: 'Coral Enterprises',
            locale: locale,
            type: 'website',
            images: [
                {
                    url: '/images/kitchen-hero.png',
                    width: 1200,
                    height: 630,
                    alt: 'Coral Enterprises Premium Remodeling',
                },
            ],
        },
        twitter: {
            card: 'summary_large_image',
            title: t('title'),
            description: t('description'),
            images: ['/images/kitchen-hero.png'],
        },
        robots: {
            index: true,
            follow: true,
            googleBot: {
                index: true,
                follow: true,
                'max-video-preview': -1,
                'max-image-preview': 'large',
                'max-snippet': -1,
            },
        },
        icons: {
            icon: '/icon.svg',
        },
    };
}

import PromotionalBanner from "@/components/PromotionalBanner";
import CookieConsent from "@/components/CookieConsent";

export default async function RootLayout({
    children,
    params
}: Readonly<{
    children: React.ReactNode;
    params: Promise<{ locale: string }>;
}>) {
    const { locale } = await params;
    const messages = await getMessages();

    return (
        <html lang={locale} className="scroll-smooth" suppressHydrationWarning>
            <head>
                <link rel="manifest" href="/manifest.json" />
                <meta name="theme-color" content="#000000" />

                {/* Google Consent Mode */}
                <Script
                    id="consent-mode"
                    strategy="beforeInteractive"
                    dangerouslySetInnerHTML={{
                        __html: `
                          window.dataLayer = window.dataLayer || [];
                          function gtag(){dataLayer.push(arguments);}
                          
                          // Set default consent for analytics to granted so it runs immediately
                          gtag('consent', 'default', {
                            'ad_storage': 'denied',
                            'ad_user_data': 'denied',
                            'ad_personalization': 'denied',
                            'analytics_storage': 'granted',
                            'wait_for_update': 500
                          });
                        `
                    }}
                />

                {/* Google tag (gtag.js) */}
                <Script
                    id="google-analytics-script"
                    strategy="afterInteractive"
                    src="https://www.googletagmanager.com/gtag/js?id=G-N0NPGEPJKN"
                />
                <Script
                    id="google-ads-script"
                    strategy="afterInteractive"
                    src="https://www.googletagmanager.com/gtag/js?id=AW-17978966291"
                />
                <Script
                    id="google-analytics-config"
                    strategy="afterInteractive"
                    dangerouslySetInnerHTML={{
                        __html: `
                          window.dataLayer = window.dataLayer || [];
                          function gtag(){dataLayer.push(arguments);}
                          gtag('js', new Date());

                          gtag('config', 'G-N0NPGEPJKN', {
                            page_path: window.location.pathname,
                          });
                          gtag('config', 'AW-17978966291');
                        `
                    }}
                />
            </head>
            <body
                className={`${oxanium.variable} antialiased selection:bg-[#d75d00]/30 overflow-y-scroll`}
                suppressHydrationWarning
            >
                <NextIntlClientProvider messages={messages}>
                    <ThemeProvider
                        attribute="class"
                        defaultTheme="system"
                        enableSystem
                        disableTransitionOnChange
                    >
                        <PromotionalBanner locale={locale} />
                        <CookieConsent />
                        {children}
                    </ThemeProvider>
                </NextIntlClientProvider>

                {/* Service Worker Setup */}
                <script
                    dangerouslySetInnerHTML={{
                        __html: `
                          if ('serviceWorker' in navigator) {
                            window.addEventListener('load', function() {
                              navigator.serviceWorker.register('/sw.js').then(function(registration) {
                                console.log('ServiceWorker registration successful with scope: ', registration.scope);
                              }, function(err) {
                                console.log('ServiceWorker registration failed: ', err);
                              });
                            });
                          }
                        `
                    }}
                />
            </body>
        </html>
    );
}
