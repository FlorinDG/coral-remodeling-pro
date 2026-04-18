import { MetadataRoute } from 'next';
import prisma from '@/lib/prisma';

// Force dynamic — Prisma cannot connect during Vercel's static prerender phase
export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const baseUrl = 'https://coral-group.be';
    const locales = ['en', 'nl', 'fr', 'ro'];

    // Fetch dynamic content — graceful fallback if DB unreachable
    let services: { slug: string; updatedAt: Date }[] = [];
    try {
        services = await prisma.cMS_Service.findMany({ select: { slug: true, updatedAt: true } });
    } catch {
        // DB not reachable (e.g. build environment) — return static routes only
    }

    const sitemapEntries: MetadataRoute.Sitemap = [];

    for (const locale of locales) {
        sitemapEntries.push({
            url: `${baseUrl}/${locale}`,
            lastModified: new Date(),
            changeFrequency: 'weekly',
            priority: 1,
        });

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
