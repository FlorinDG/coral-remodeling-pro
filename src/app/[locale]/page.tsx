import Hero from "@/components/Hero";
import ProjectGallery from "@/components/ProjectGallery";
import ServiceExpander from "@/components/ServiceExpander";
import HomeClientWrapper from "@/components/HomeClientWrapper";
import { getTranslations } from 'next-intl/server';
import { getCMSContent, getCMSServices, getCMSProjects } from "@/lib/cms";
import { Metadata } from 'next';
import JsonLd from "@/components/JsonLd";

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
    const { locale } = await params;
    const t = await getTranslations({ locale, namespace: 'Metadata' });

    return {
        title: t('title'),
        description: t('description'),
        alternates: {
            canonical: `https://coral-group.be/${locale}`,
        },
    };
}

export default async function Home({ params }: { params: Promise<{ locale: string }> }) {
    const { locale } = await params;
    const t = await getTranslations();

    // Fetch CMS data
    const cmsContent = await getCMSContent();
    const cmsServices = await getCMSServices();
    const cmsProjects = await getCMSProjects();

    const jsonLd = {
        "@context": "https://schema.org",
        "@graph": [
            {
                "@type": "LocalBusiness",
                "name": "Coral Enterprises",
                "image": [
                    {
                        "@type": "ImageObject",
                        "url": "https://coral-group.be/images/kitchen-hero.png",
                        "caption": t('Metadata.title')
                    }
                ],
                "address": {
                    "@type": "PostalAddress",
                    "streetAddress": "Z.5 Industriezone 230",
                    "addressLocality": "Mollem (Asse)",
                    "postalCode": "1730",
                    "addressCountry": "BE"
                },
                "url": `https://coral-group.be/${locale}`,
                "telephone": "+32 472 74 10 25",
                "priceRange": "$$$",
            },
            {
                "@type": "BreadcrumbList",
                "itemListElement": [
                    {
                        "@type": "ListItem",
                        "position": 1,
                        "name": t('Navbar.home'),
                        "item": `https://coral-group.be/${locale}`
                    },
                    {
                        "@type": "ListItem",
                        "position": 2,
                        "name": t('Navbar.services'),
                        "item": `https://coral-group.be/${locale}#services`
                    },
                    {
                        "@type": "ListItem",
                        "position": 3,
                        "name": t('Navbar.projects'),
                        "item": `https://coral-group.be/${locale}#projects`
                    }
                ]
            }
        ]
    };

    return (
        <>
            <JsonLd data={jsonLd} />
            <HomeClientWrapper>
                <Hero cmsContent={cmsContent} locale={locale} />

                {/* Services Section */}
                <section id="services" className="py-24 bg-white text-neutral-900 dark:bg-neutral-950 dark:text-white">
                    <div className="container mx-auto px-8 md:px-16">
                        <div className="mb-16">
                            <h2 className="text-4xl font-bold tracking-tight mb-4 text-neutral-900 dark:text-white">
                                {t('Sections.expertise.title')}
                            </h2>
                            <div className="w-20 h-1 bg-neutral-900 dark:bg-white" />
                        </div>

                        <ServiceExpander cmsServices={cmsServices} locale={locale} />
                    </div>
                </section>

                {/* Projects Section */}
                <section id="projects" className="py-24 px-8 md:px-16 bg-neutral-100 text-neutral-900 dark:bg-neutral-900 dark:text-white">
                    <div className="container mx-auto">
                        <div className="flex justify-between items-end mb-16">
                            <div>
                                <h2 className="text-4xl font-bold tracking-tight mb-4 text-neutral-900 dark:text-white">
                                    {t('Sections.portfolio.title')}
                                </h2>
                                <p className="text-neutral-400 uppercase tracking-widest text-xs font-bold">
                                    {t('Sections.portfolio.tagline')}
                                </p>
                            </div>
                        </div>

                        <div className="grid md:grid-cols-2 gap-8">
                            {cmsProjects.map((project) => (
                                <ProjectGallery
                                    key={project.id}
                                    slug={project.titleEn.toLowerCase().replace(/[^a-z0-9]+/g, '-')}
                                    title={project[`title${locale.charAt(0).toUpperCase() + locale.slice(1)}` as keyof typeof project] as string || project.titleEn}
                                    location={project[`location${locale.charAt(0).toUpperCase() + locale.slice(1)}` as keyof typeof project] as string || project.locationEn}
                                    images={project.images.map(img => ({
                                        src: img.url,
                                        caption: img[`caption${locale.charAt(0).toUpperCase() + locale.slice(1)}` as keyof typeof img] as string || img.captionEn || ''
                                    }))}
                                />
                            ))}
                        </div>
                    </div>
                </section>
            </HomeClientWrapper>
        </>
    );
}
