import React from 'react';
import prisma from '@/lib/prisma';
import { notFound } from 'next/navigation';
import InvoiceViewer from './InvoiceViewer';
import { Block, VariantsConfig } from '@/components/admin/database/types';

async function enrichBlocks(blocks: Block[], articlesDbId: string): Promise<Block[]> {
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

export default async function PublicInvoicePage({ params }: { params: Promise<{ locale: string, id: string }> }) {
    const { locale, id: invoiceId } = await params;

    const invoice = await prisma.globalPage.findUnique({
        where: { id: invoiceId },
        include: {
            database: {
                include: {
                    tenant: {
                        select: {
                            companyName: true,
                            logoUrl: true,
                            brandColor: true,
                            email: true,
                            street: true,
                            city: true,
                            postalCode: true,
                            vatNumber: true,
                            documentLanguage: true,
                            planType: true,
                        }
                    }
                }
            }
        }
    });

    if (!invoice || !invoice.database.id.includes('db-invoices')) {
        return notFound();
    }

    const tenant = invoice.database.tenant;
    const lang = locale || tenant.documentLanguage || 'nl';

    const enrichedBlocks = await enrichBlocks((invoice.blocks as any) || [], 'db-articles');

    return (
        <InvoiceViewer
            invoiceId={invoice.id}
            properties={invoice.properties}
            blocks={enrichedBlocks}
            tenant={{
                companyName: tenant.companyName,
                logoUrl: tenant.logoUrl,
                brandColor: tenant.brandColor,
                email: tenant.email,
                vatNumber: tenant.vatNumber,
                planType: tenant.planType,
            }}
            lang={lang}
        />
    );
}
