import type { Metadata } from "next";
import { Oxanium } from "next/font/google";
import Script from "next/script";
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { ThemeProvider } from "@/components/ThemeProvider";
import "../globals.css";

const oxanium = Oxanium({
    variable: "--font-oxanium",
    subsets: ["latin"],
    weight: ["300", "400", "500", "600", "700", "800"],
});

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
    const { locale } = await params;
    // We can't use getTranslations here easily without a request context usually,
    // but in Next.js 13+ app router with next-intl, there's a specific pattern.
    // For now, I'll use a simple mapping or just use the Locale-based titles if available.
    // Actually, let's keep it simple and just use the metadata from the messages if possible,
    // but metadata export is static here.

    // I will use a simple switch for now or just keep it as is if it's not a priority, 
    // but the user said ALL text.
    return {
        title: locale === 'nl' ? "Coral Enterprises | Premium Verbouwingen" : "Coral Enterprises | Premium Remodeling",
        description: locale === 'nl' ? "Luxe keuken- en badkamerrenovaties." : "Luxury kitchen and bathroom transformations.",
    };
}

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
            </head>
            <body
                className={`${oxanium.variable} antialiased selection:bg-white/20`}
                suppressHydrationWarning
            >
                <NextIntlClientProvider messages={messages}>
                    <ThemeProvider
                        attribute="class"
                        defaultTheme="system"
                        enableSystem
                        disableTransitionOnChange
                    >
                        {children}
                    </ThemeProvider>
                </NextIntlClientProvider>
                <Script id="service-worker" strategy="afterInteractive">
                    {`
            if ('serviceWorker' in navigator) {
              window.addEventListener('load', function() {
                navigator.serviceWorker.register('/sw.js').then(function(registration) {
                  console.log('ServiceWorker registration successful with scope: ', registration.scope);
                }, function(err) {
                  console.log('ServiceWorker registration failed: ', err);
                });
              });
            }
          `}
                </Script>
            </body>
        </html>
    );
}
