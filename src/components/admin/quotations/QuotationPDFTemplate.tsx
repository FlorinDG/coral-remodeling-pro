import React from 'react';
import { Document, Page, Text, View, Image } from '@react-pdf/renderer';
import { Block } from '@/components/admin/database/types';
import { getTemplateStyles, TemplateId } from '@/components/admin/shared/templateStyles';
import { t } from '@/lib/document-i18n';

interface ClientInfo {
    name: string;
    address?: string;
    vatNumber?: string;
    email?: string;
}

interface QuotationPDFProps {
    blocks: Block[];
    quotationTitle: string;
    betreft: string;
    clientInfo: ClientInfo;
    projectId: string;
    grandTotal: number;
    databaseStoreState: any;
    tenantProfile?: any;
    templateId?: TemplateId;
    language?: string;
}

export const QuotationPDFTemplate = ({ blocks, quotationTitle, betreft, clientInfo, projectId, grandTotal, databaseStoreState, tenantProfile, templateId = 't1', language = 'nl' }: QuotationPDFProps) => {

    const { companyName, vatNumber, iban, logoUrl, brandColor, planType, street, postalCode, city, email, bic } = tenantProfile || {};
    const showWatermark = !planType || planType === 'FREE';
    const s = getTemplateStyles(templateId, brandColor);
    const lang = language;

    const colDesc = { flex: 4, paddingRight: 8 };
    const colQty = { flex: 0.8, textAlign: 'center' as const };
    const colUnit = { flex: 0.8, textAlign: 'center' as const };
    const colPrice = { flex: 1.2, textAlign: 'right' as const };
    const colTotal = { flex: 1.2, textAlign: 'right' as const, fontWeight: 'bold' as const };

    const stripHtml = (html: string | undefined) => {
        if (!html) return '';
        return html.replace(/<[^>]*>?/gm, '').trim();
    };

    const renderBlocks = (nodes: Block[], depth = 0): React.ReactNode[] => {
        let rows: React.ReactNode[] = [];

        nodes.forEach(block => {
            if (block.isOptional) return;

            const isContainer = block.type === 'section' || block.type === 'subsection' || block.type === 'post';
            const cleanContent = stripHtml(block.content);

            let blockTotal = 0;
            let variantDeltas = 0;

            if (!isContainer) {
                if (!(block.children && block.children.length > 0)) {
                    if (block.selectedVariants && block.articleId) {
                        const db = databaseStoreState.databases?.find((d: any) => d.id === 'db-articles');
                        const page = db?.pages.find((p: any) => p.id === block.articleId);
                        const vProp = db?.properties.find((p: any) => p.type === 'variants');
                        if (page && vProp) {
                            const vConfig = page.properties[vProp.id];
                            if (vConfig && Array.isArray(vConfig)) {
                                Object.entries(block.selectedVariants).forEach(([axisId, optId]) => {
                                    const axis = vConfig.find((a: any) => a.id === axisId);
                                    const opt = axis?.options.find((o: any) => o.id === optId);
                                    if (opt) variantDeltas += opt.priceDelta;
                                });
                            }
                        }
                    }
                    const unitRetail = (block.verkoopPrice || 0) + variantDeltas;
                    blockTotal = unitRetail * (block.quantity || 1);
                }
            }

            if (block.type === 'section') {
                rows.push(
                    <View key={block.id} style={s.sectionRow}>
                        <Text style={{ ...colDesc, ...s.sectionText }}>{cleanContent.toUpperCase()}</Text>
                        <Text style={colQty}></Text>
                        <Text style={colUnit}></Text>
                        <Text style={colPrice}></Text>
                        <Text style={colTotal}></Text>
                    </View>
                );
            } else if (block.type === 'subsection' || block.type === 'post') {
                rows.push(
                    <View key={block.id} style={s.subsectionRow}>
                        <Text style={{ ...colDesc, fontWeight: 'bold' }}>{cleanContent}</Text>
                        <Text style={colQty}></Text>
                        <Text style={colUnit}></Text>
                        <Text style={colPrice}></Text>
                        <Text style={colTotal}></Text>
                    </View>
                );
            } else if (block.type === 'text') {
                rows.push(
                    <View key={block.id} style={{ ...s.tableRow, borderBottom: 'none', paddingLeft: depth * 10 + 6 }}>
                        <Text style={{ ...colDesc, fontStyle: 'italic', color: '#666' }}>{cleanContent}</Text>
                        <Text style={colQty}></Text>
                        <Text style={colUnit}></Text>
                        <Text style={colPrice}></Text>
                        <Text style={colTotal}></Text>
                    </View>
                );
            } else {
                rows.push(
                    <View key={block.id} style={{ ...s.tableRow, paddingLeft: depth > 0 ? depth * 10 + 6 : 6 }}>
                        <Text style={colDesc}>{cleanContent}</Text>
                        <Text style={colQty}>{block.quantity || 1}</Text>
                        <Text style={colUnit}>{block.unit || 'stk'}</Text>
                        <Text style={colPrice}>€{((block.verkoopPrice || 0) + variantDeltas).toFixed(2)}</Text>
                        <Text style={colTotal}>€{blockTotal.toFixed(2)}</Text>
                    </View>
                );
            }

            if (block.children && block.children.length > 0) {
                rows = rows.concat(renderBlocks(block.children, depth + 1));
            }
        });

        return rows;
    };

    const taxAmount = grandTotal * 0.21;
    const totalInclTax = grandTotal + taxAmount;

    // Build company info lines
    const companyInfoLines = [
        vatNumber ? `${t('vat', lang)}: ${vatNumber}` : '',
        street ? `${street}` : '',
        (postalCode || city) ? `${postalCode || ''} ${city || ''}`.trim() : '',
        iban ? `IBAN: ${iban}` : '',
        email ? email : '',
    ].filter(Boolean);

    const clientSectionStyle = (s as any).clientSection || { flexDirection: 'row' as const, justifyContent: 'space-between' as const, marginBottom: 20 };

    return (
        <Document>
            <Page size="A4" style={s.page}>
                {/* Header */}
                <View style={s.headerRow}>
                    <View style={s.headerLeft}>
                        {logoUrl ? (
                            <Image src={logoUrl} style={s.logo} />
                        ) : (
                            <Text style={s.companyFallback}>
                                {companyName?.toUpperCase() || 'CORAL ENTERPRISES'}
                            </Text>
                        )}
                        {companyInfoLines.map((line, i) => (
                            <Text key={i} style={s.subtitle}>{line}</Text>
                        ))}
                    </View>
                    {(s as any).divider && <View style={(s as any).divider} />}
                    <View style={s.headerRight}>
                        <Text style={{ ...s.title, fontSize: 18 }}>{t('quotation', lang)}</Text>
                        <Text style={s.subtitle}>#{quotationTitle || 'DRAFT'}</Text>
                        <Text style={s.subtitle}>{t('date', lang)}: {new Date().toLocaleDateString(lang === 'fr' ? 'fr-BE' : lang === 'en' ? 'en-GB' : 'nl-BE')}</Text>
                    </View>
                </View>

                {/* Client & Project */}
                <View style={clientSectionStyle}>
                    <View>
                        <Text style={s.clientLabel}>{t('bill_to', lang)}:</Text>
                        <Text style={{ fontSize: 11, fontWeight: 'bold' }}>{clientInfo.name || 'Klant'}</Text>
                        {clientInfo.address && <Text style={{ fontSize: 9, color: '#555', marginTop: 2 }}>{clientInfo.address}</Text>}
                        {clientInfo.vatNumber && <Text style={{ fontSize: 9, color: '#888', marginTop: 2 }}>{t('vat', lang)}: {clientInfo.vatNumber}</Text>}
                        {clientInfo.email && <Text style={{ fontSize: 9, color: '#888', marginTop: 1 }}>{clientInfo.email}</Text>}
                    </View>
                    <View style={{ alignItems: 'flex-end' as const }}>
                        <Text style={s.clientLabel}>{t('project_re', lang)}:</Text>
                        <Text style={s.betreftLabel}>{betreft || '-'}</Text>
                    </View>
                </View>

                {/* Table Header */}
                <View style={s.tableHeaderRow}>
                    <Text style={colDesc}>{t('description', lang)}</Text>
                    <Text style={colQty}>{t('qty', lang)}</Text>
                    <Text style={colUnit}>{t('unit', lang)}</Text>
                    <Text style={colPrice}>{t('unit_price', lang)}</Text>
                    <Text style={colTotal}>{t('total_excl', lang)}</Text>
                </View>

                {/* Content */}
                {renderBlocks(blocks)}

                {/* Summary */}
                <View style={{ alignItems: 'flex-end' as const, width: '100%' }}>
                    <View style={s.summaryBox}>
                        <View style={s.summaryRow}>
                            <Text style={s.summaryLabel}>{t('subtotal_excl', lang)}:</Text>
                            <Text style={s.summaryValue}>€{grandTotal.toFixed(2)}</Text>
                        </View>
                        <View style={s.summaryRow}>
                            <Text style={s.summaryLabel}>{t('vat', lang)} (21%):</Text>
                            <Text style={s.summaryValue}>€{taxAmount.toFixed(2)}</Text>
                        </View>
                        <View style={{ ...s.summaryRow, marginTop: 4, paddingTop: 4, borderTop: '1px solid #e5e7eb' }}>
                            <Text style={{ ...s.summaryLabel, color: '#000', fontWeight: 'bold' }}>{t('grand_total_incl', lang)}:</Text>
                            <Text style={s.grandTotalValue}>€{totalInclTax.toFixed(2)}</Text>
                        </View>
                    </View>
                </View>

                {/* Legal text — above footer */}
                <Text style={{
                    fontSize: 7.5,
                    color: '#999999',
                    textAlign: 'center',
                    marginTop: 30,
                    paddingHorizontal: 20,
                    lineHeight: 1.4,
                }}>
                    {t('quote_legal', lang)}
                </Text>

                {/* Footer — contact info, themed */}
                <View style={s.footerText}>
                    <Text>
                        {companyName || 'Coral Enterprises'}{vatNumber ? ` | ${t('vat', lang)}: ${vatNumber}` : ''}{iban ? ` | IBAN: ${iban}` : ''}{email ? ` | ${email}` : ''}
                    </Text>
                </View>

                {/* Free tier watermark */}
                {showWatermark && (
                    <Text style={{
                        position: 'absolute',
                        bottom: 4,
                        left: 0,
                        right: 0,
                        textAlign: 'center',
                        fontSize: 6.5,
                        color: '#c0c0c0',
                        letterSpacing: 1.5,
                    }}>
                        Powered by CoralOS — coral-os.com
                    </Text>
                )}
            </Page>
        </Document>
    );
};
