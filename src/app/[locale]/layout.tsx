import type { Metadata } from "next";
import { Oxanium, IBM_Plex_Sans } from "next/font/google";
import { headers } from 'next/headers';

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

const ibmPlexSans = IBM_Plex_Sans({
    variable: "--font-content",
    subsets: ["latin", "latin-ext"],
    weight: ["300", "400", "500", "600", "700"],
    display: "swap",
});

const baseUrl = 'https://coral-group.be';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
    const { locale } = await params;
    const headersList = await headers();
    const rawHost = headersList.get('x-forwarded-host') || headersList.get('host') || '';
    const host = rawHost.split(':')[0].split(',')[0].trim();
    const isERP = host.startsWith('app.');
    const isStorefront = host.startsWith('coral-sys.');
    const isWorkHub = host.startsWith('work.');

    // ── WorkHub workforce app (work.coral-group.be) ──
    if (isWorkHub) {
        return {
            metadataBase: new URL(`https://${host}`),
            title: {
                default: 'WorkHub',
                template: '%s | WorkHub',
            },
            description: 'Clock in, view your schedule, manage tasks and documents',
            robots: { index: false, follow: false },
            icons: { icon: '/icon.svg' },
            other: {
                'mobile-web-app-capable': 'yes',
                'apple-mobile-web-app-capable': 'yes',
                'apple-mobile-web-app-status-bar-style': 'black-translucent',
            },
        };
    }


    // ── CoralOS storefront (coral-sys.coral-group.be) ──
    if (isStorefront) {
        return {
            metadataBase: new URL(`https://${host}`),
            title: {
                default: 'CoralOS — Platform voor Belgische aannemers',
                template: '%s | CoralOS',
            },
            description: 'Facturatie, Peppol e-invoicing, CRM en projectbeheer voor aannemers. Gratis starten, Peppol-compliant sinds 2026.',
            robots: { index: true, follow: true },
            icons: { icon: '/icon.svg' },
            openGraph: {
                title: 'CoralOS — Platform voor Belgische aannemers',
                description: 'Facturatie, Peppol e-invoicing, CRM en projectbeheer. Gratis starten.',
                url: `https://${host}`,
                siteName: 'CoralOS',
                type: 'website',
            },
        };
    }

    // ── ERP subdomains: CoralOS branding ──
    if (isERP) {
        return {
            metadataBase: new URL(`https://${host}`),
            title: {
                default: 'CoralOS',
                template: '%s | CoralOS',
            },
            description: 'The workspace for modern contractors',
            robots: { index: false, follow: false },
            icons: { icon: '/icon.svg' },
        };
    }

    // ── Main site: Coral Enterprises construction company branding ──
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
                'x-default': `${baseUrl}/nl`,
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
    const headersList = await headers();
    const headersList2 = headersList;
    // On Vercel, x-forwarded-host is the real hostname; fall back to host
    const rawHost = headersList2.get('x-forwarded-host') || headersList2.get('host') || '';
    const host = rawHost.split(':')[0].split(',')[0].trim();
    const isMainSite = !host.startsWith('app.') && !host.startsWith('coral-sys.') && !host.startsWith('work.');
    const isWorkHub = host.startsWith('work.');

    return (
        <html lang={locale} className="scroll-smooth" suppressHydrationWarning>
            <head>
                {/* Manifest: work subdomain gets WorkHub PWA manifest, others get CoralOS */}
                {isWorkHub
                    ? <link rel="manifest" href="/manifest-workhub.json" />
                    : <link rel="manifest" href="/manifest.json" />
                }
                {/* Apple touch icon — used by iOS home screen and Chrome PWA on Mac */}
                <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
                <meta name="theme-color" content={isMainSite ? '#000000' : '#c2440f'} />

                {/* Google Consent Mode — main site only */}
                {isMainSite && (
                    <Script
                        id="consent-mode"
                        strategy="beforeInteractive"
                        dangerouslySetInnerHTML={{
                            __html: `
                              window.dataLayer = window.dataLayer || [];
                              function gtag(){dataLayer.push(arguments);}
                              
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
                )}

                {/* Google Analytics — main site only */}
                {isMainSite && (
                    <>
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
                    </>
                )}
            </head>
            <body
                className={`${oxanium.variable} ${ibmPlexSans.variable} antialiased selection:bg-[#d75d00]/30 overflow-y-scroll`}
                suppressHydrationWarning
            >
                <NextIntlClientProvider messages={messages}>
                    <ThemeProvider
                        attribute="class"
                        defaultTheme="system"
                        enableSystem
                        disableTransitionOnChange
                    >
                        {/* Promotional banner — main site only */}
                        {isMainSite && <PromotionalBanner locale={locale} />}
                        <CookieConsent />
                        {children}
                    </ThemeProvider>
                </NextIntlClientProvider>

                {/* Service worker lifecycle: WorkHub gets versioned SW, others get SW purge.
                    CROSS-7c: Pass deploy SHA as cache-bust param. Listen for controllerchange
                    to auto-reload when a new SW activates. Check for updates on focus. */}
                <script
                    dangerouslySetInnerHTML={{
                        __html: `
                          (function() {
                            try {
                              var subdomain = window.location.hostname;
                              var appVersion = '${process.env.VERCEL_GIT_COMMIT_SHA || 'dev'}';

                              // WorkHub subdomain: register versioned service worker
                              if (subdomain.startsWith('work.')) {
                                if ('serviceWorker' in navigator) {
                                  // Pass version as query param — SW uses it for cache name
                                  navigator.serviceWorker.register('/sw-workhub.js?v=' + appVersion, { scope: '/' })
                                    .then(function(reg) {
                                      console.log('[WorkHub] SW registered, scope:', reg.scope, 'version:', appVersion);
                                      // Check for SW updates on window focus
                                      window.addEventListener('focus', function() {
                                        reg.update().catch(function() {});
                                      });
                                      // Check for updates on visibility change (tab switch back)
                                      document.addEventListener('visibilitychange', function() {
                                        if (document.visibilityState === 'visible') {
                                          reg.update().catch(function() {});
                                        }
                                      });
                                    })
                                    .catch(function(err) {
                                      console.warn('[WorkHub] SW registration failed:', err);
                                    });

                                  // When a new SW takes control, reload to get fresh assets
                                  navigator.serviceWorker.addEventListener('controllerchange', function() {
                                    console.log('[WorkHub] New SW controller — reloading for fresh assets');
                                    window.location.reload();
                                  });
                                }
                                return; // Don't kill SW on work subdomain
                              }

                              // Other subdomains: kill stale service workers
                              if ('serviceWorker' in navigator) {
                                navigator.serviceWorker.getRegistrations().then(function(regs) {
                                  regs.forEach(function(r) { r.unregister(); });
                                });
                              }
                              // Nuke all Cache API entries on ERP/storefront subdomains
                              if (subdomain.startsWith('app.') || subdomain.startsWith('coral-sys.')) {
                                if ('caches' in window) {
                                  caches.keys().then(function(keys) {
                                    keys.forEach(function(key) { caches.delete(key); });
                                  });
                                }
                              }
                            } catch(e) {}
                          })();
                        `
                    }}
                />
            </body>
        </html>
    );
}
