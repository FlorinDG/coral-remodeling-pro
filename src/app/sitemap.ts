import { MetadataRoute } from 'next';
import prisma from '@/lib/prisma';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const baseUrl = 'https://app.coral-group.be';
    const locales = ['en', 'nl', 'fr', 'ro'];

    // Fetch dynamic content
    const services = await prisma.cMS_Service.findMany({ select: { slug: true, updatedAt: true } });

    const sitemapEntries: MetadataRoute.Sitemap = [];

    for (const locale of locales) {
        // Base routes
        sitemapEntries.push({
            url: `${baseUrl}/${locale}`,
            lastModified: new Date(),
            changeFrequency: 'weekly',
            priority: 1,
        });

        // Dynamic Services
        for (const service of services) {
            sitemapEntries.push({
                url: `${baseUrl}/${locale}/services/${service.slug}`,
                lastModified: service.updatedAt,
                changeFrequency: 'monthly',
                priority: 0.8,
            });
        }
    }

    return sitemapEntries;
}
