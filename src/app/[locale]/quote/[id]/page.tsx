import React from 'react';
import prisma from '@/lib/prisma';
import { notFound } from 'next/navigation';
import QuotationViewer from './QuotationViewer';
import { Block, VariantsConfig } from '@/components/admin/database/types';

async function enrichBlocks(blocks: Block[], articlesDbId: string): Promise<Block[]> {
    // Fetch articles DB to resolve variants
    const articlesDb = await prisma.globalDatabase.findUnique({
        where: { id: articlesDbId },
        include: { pages: true }
    });

    if (!articlesDb) return blocks;

    const properties = (articlesDb.properties as any) || [];
    const variantsProp = properties.find((p: any) => p.type === 'variants');
    if (!variantsProp) return blocks;

    const enrich = (nodes: Block[]): Block[] => {
        return nodes.map(block => {
            let enriched = { ...block };

            if (block.articleId && block.selectedVariants) {
                const articlePage = articlesDb.pages.find(p => p.id === block.articleId);
                if (articlePage) {
                    const props = (articlePage.properties as Record<string, any>) ?? {};
                    const variantsConfig = props[variantsProp.id] as VariantsConfig;
                    if (Array.isArray(variantsConfig)) {
                        let delta = 0;
                        Object.entries(block.selectedVariants).forEach(([axisId, optId]) => {
                            const axis = variantsConfig.find(a => a.id === axisId);
                            const opt = axis?.options.find(o => o.id === optId);
                            if (opt) delta += opt.priceDelta;
                        });
                        (enriched as any).variantPriceDelta = delta;
                    }
                }
            }

            if (block.children && block.children.length > 0) {
                enriched.children = enrich(block.children);
            }

            return enriched;
        });
    };

    return enrich(blocks);
}

export default async function PublicQuotePage({ params }: { params: Promise<{ locale: string, id: string }> }) {
    const { locale, id: quoteId } = await params;

    const quote = await prisma.globalPage.findUnique({
        where: { id: quoteId },
        include: {
            database: {
                include: {
                    tenant: {
                        select: {
                            companyName: true,
                            commercialName: true,
                            logoUrl: true,
                            brandColor: true,
                            email: true,
                            street: true,
                            city: true,
                            postalCode: true,
                            vatNumber: true,
                            iban: true,
                            bic: true,
                            documentLanguage: true,
                            planType: true,
                            documentMode: true,
                            stationeryUrl: true,
                            documentFont: true,
                            documentFontSize: true,
                            documentTemplate: true,
                        }
                    }
                }
            }
        }
    });

    // Ensure it's a valid quote payload
    if (!quote || !quote.database.id.includes('db-quotations')) {
        return notFound();
    }

    const tenant = quote.database.tenant;
    // Language priority: URL locale > tenant document language > 'nl'
    const lang = locale || tenant.documentLanguage || 'nl';

    // Enrich blocks with variant pricing deltas for accurate totals
    const enrichedBlocks = await enrichBlocks((quote.blocks as any) || [], 'db-articles');

    return (
        <QuotationViewer
            quoteId={quote.id}
            properties={quote.properties}
            blocks={enrichedBlocks}
            tenant={tenant}
            lang={lang}
        />
    );
}
