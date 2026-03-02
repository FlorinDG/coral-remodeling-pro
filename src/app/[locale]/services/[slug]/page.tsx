import prisma from '@/lib/prisma';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import ServiceDetailClient from '@/components/ServiceDetailClient';

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
        schedule: td('schedule'),
        bookConsultation: td('bookConsultation'),
        notFound: td('notFound')
    };

    return <ServiceDetailClient service={service} translations={translations} />;
}
