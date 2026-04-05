import React from 'react';
import { Document, Page, Text, View, Image } from '@react-pdf/renderer';
import { Block } from '@/components/admin/database/types';
import { getTemplateStyles, TemplateId } from '@/components/admin/shared/templateStyles';

interface QuotationPDFProps {
    blocks: Block[];
    quotationTitle: string;
    betreft: string;
    clientId: string;
    projectId: string;
    grandTotal: number;
    databaseStoreState: any;
    tenantProfile?: any;
    templateId?: TemplateId;
}

export const QuotationPDFTemplate = ({ blocks, quotationTitle, betreft, clientId, projectId, grandTotal, databaseStoreState, tenantProfile, templateId = 't1' }: QuotationPDFProps) => {

    const { companyName, vatNumber, iban, logoUrl, brandColor } = tenantProfile || {};
    const s = getTemplateStyles(templateId, brandColor);

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

    // Client/project section style — Bold Corporate has extra padding
    const clientSectionStyle = (s as any).clientSection || { flexDirection: 'row' as const, justifyContent: 'space-between' as const, marginBottom: 20 };

    // Elegant template has centered header — different layout
    const isElegant = templateId === 't4';
    const isBold = templateId === 't3';

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
                                {companyName?.toUpperCase() || 'CORAL REMODELING'}
                            </Text>
                        )}
                        {!isElegant && vatNumber && <Text style={s.subtitle}>BTW: {vatNumber}</Text>}
                        {!isElegant && iban && <Text style={s.subtitle}>IBAN: {iban}</Text>}
                        {!isElegant && !vatNumber && !iban && <Text style={s.subtitle}>Configure details in Settings</Text>}
                    </View>
                    {isElegant && (s as any).divider && <View style={(s as any).divider} />}
                    <View style={s.headerRight}>
                        <Text style={s.title}>Quotation</Text>
                        <Text style={s.subtitle}>Offer #{quotationTitle || 'DRAFT'}</Text>
                        <Text style={s.subtitle}>Date: {new Date().toLocaleDateString('nl-BE')}</Text>
                    </View>
                </View>

                {/* Client & Project */}
                <View style={clientSectionStyle}>
                    <View>
                        <Text style={s.clientLabel}>To:</Text>
                        <Text style={{ fontSize: 11 }}>{clientId ? `Client: ${clientId}` : 'Valued Client'}</Text>
                        {isElegant && vatNumber && <Text style={{ fontSize: 9, color: '#999', marginTop: 2 }}>BTW: {vatNumber}</Text>}
                    </View>
                    <View style={{ alignItems: 'flex-end' as const }}>
                        <Text style={s.clientLabel}>Project / Betreft:</Text>
                        <Text style={s.betreftLabel}>{betreft || 'General Renovation'}</Text>
                    </View>
                </View>

                {/* Table Header */}
                <View style={s.tableHeaderRow}>
                    <Text style={colDesc}>Description / Omschrijving</Text>
                    <Text style={colQty}>Qte</Text>
                    <Text style={colUnit}>Unit</Text>
                    <Text style={colPrice}>Unit Price</Text>
                    <Text style={colTotal}>Total (Excl)</Text>
                </View>

                {/* Content */}
                {renderBlocks(blocks)}

                {/* Summary */}
                <View style={{ alignItems: 'flex-end' as const, width: '100%', ...(isBold ? { paddingHorizontal: 24 } : {}) }}>
                    <View style={s.summaryBox}>
                        <View style={s.summaryRow}>
                            <Text style={s.summaryLabel}>Total (Excl. VAT):</Text>
                            <Text style={s.summaryValue}>€{grandTotal.toFixed(2)}</Text>
                        </View>
                        <View style={s.summaryRow}>
                            <Text style={s.summaryLabel}>BTW / VAT (21%):</Text>
                            <Text style={s.summaryValue}>€{taxAmount.toFixed(2)}</Text>
                        </View>
                        <View style={{ ...s.summaryRow, marginTop: 4, paddingTop: 4, borderTop: '1px solid #e5e7eb' }}>
                            <Text style={{ ...s.summaryLabel, color: isBold ? '#1a1a1a' : '#000', fontWeight: 'bold' }}>Grand Total (Incl. VAT):</Text>
                            <Text style={s.grandTotalValue}>€{totalInclTax.toFixed(2)}</Text>
                        </View>
                    </View>
                </View>

                {/* Footer */}
                <Text style={s.footerText}>
                    Algemene voorwaarden: Offerte is 30 dagen geldig. De bovenstaande prijzen zijn exclusief onvoorziene werken tenzij anders vermeld.
                    {companyName || 'Coral Remodeling'} | {iban ? `IBAN: ${iban}` : ''} {vatNumber ? ` | BTW: ${vatNumber}` : ''}
                </Text>
            </Page>
        </Document>
    );
};
