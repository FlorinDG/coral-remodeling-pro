import { Metadata } from 'next';
import prisma from '@/lib/prisma';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import ServiceDetailClient from '@/components/ServiceDetailClient';
import JsonLd from '@/components/JsonLd';

export async function generateMetadata({ params }: { params: Promise<{ slug: string, locale: string }> }): Promise<Metadata> {
    const { slug, locale } = await params;

    const serviceData = await prisma.cMS_Service.findUnique({
        where: { slug }
    });

    if (!serviceData) {
        return {};
    }

    const sData = serviceData as unknown as Record<string, string | string[] | null>;
    const suffix = locale.charAt(0).toUpperCase() + locale.slice(1);
    const title = (sData[`title${suffix}`] as string) || serviceData.titleEn;
    const description = (sData[`description${suffix}`] as string) || serviceData.descriptionEn;

    return {
        title: `${title}`,
        description: description,
        alternates: {
            canonical: `https://app.coral-group.be/${locale}/services/${slug}`,
        },
        openGraph: {
            title: `${title} | Coral Enterprises`,
            description: description,
            type: 'article',
            url: `https://app.coral-group.be/${locale}/services/${slug}`,
            images: [
                {
                    url: serviceData.image || '/images/kitchen-hero.png',
                    width: 1200,
                    height: 630,
                    alt: title,
                },
            ],
        },
    };
}

export default async function ServiceDetail({ params }: { params: Promise<{ slug: string, locale: string }> }) {
    const { slug, locale } = await params;

    const serviceData = await prisma.cMS_Service.findUnique({
        where: { slug }
    });

    if (!serviceData) {
        notFound();
    }

    const td = await getTranslations('ServiceDetail');
    const sData = serviceData as unknown as Record<string, string | string[] | null>;

    const suffix = locale.charAt(0).toUpperCase() + locale.slice(1);
    const service = {
        title: (sData[`title${suffix}`] as string) || serviceData.titleEn,
        subtitle: (sData[`subtitle${suffix}`] as string) || serviceData.subtitleEn || '',
        fullDescription: (sData[`fullDescription${suffix}`] as string) || serviceData.fullDescriptionEn,
        features: (sData[`features${suffix}`] as string[]) || serviceData.featuresEn || [],
        image: serviceData.image,
        slug: serviceData.slug
    };

    const translations = {
        back: td('back'),
        specializeIn: td('specializeIn'),
        keyFeatures: td('keyFeatures'),
        ready: td('ready'),
        schedule: td('schedule', { service: service.title.toLowerCase() }),
        bookConsultation: td('bookConsultation'),
        notFound: td('notFound')
    };

    const jsonLd = {
        "@context": "https://schema.org",
        "@type": "Service",
        "name": service.title,
        "description": service.fullDescription,
        "provider": {
            "@type": "LocalBusiness",
            "name": "Coral Enterprises",
            "image": "https://coral-group.be/images/kitchen-hero.png",
            "telephone": "+32 472 74 10 25",
            "url": "https://coral-group.be"
        },
        "areaServed": {
            "@type": "Country",
            "name": "BE"
        }
    };

    return (
        <>
            <JsonLd data={jsonLd} />
            <ServiceDetailClient service={service} translations={translations} />
        </>
    );
}
