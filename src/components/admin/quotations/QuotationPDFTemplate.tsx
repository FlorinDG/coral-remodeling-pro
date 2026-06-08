/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useMemo } from 'react';
import { Document, Page, Text, View, Image, Svg, Polygon, Rect } from '@react-pdf/renderer';
import { Block } from '@/components/admin/database/types';
import { renderRichText } from '@/components/admin/shared/pdfRichText';
import { getTemplateStyles, TemplateId, lighten, withAlpha } from '@/components/admin/shared/templateStyles';
import { t } from '@/lib/document-i18n';
import { canAccess } from '@/lib/feature-flags';
import { calculateInvoiceTotals } from '@/lib/invoice-totals';

function formatBelgianVat(vat?: string) {
    if (!vat) return '';
    const clean = vat.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    let digits = clean;
    if (clean.startsWith('BE')) {
        digits = clean.substring(2);
    }
    if (digits.length === 10) {
        return `BE ${digits.substring(0, 4)}.${digits.substring(4, 7)}.${digits.substring(7, 10)}`;
    }
    return vat;
}

function formatIban(iban?: string) {
    if (!iban) return '';
    const clean = iban.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    const chunks = clean.match(/.{1,4}/g);
    return chunks ? chunks.join(' ') : iban;
}

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
    showSubcomponents?: boolean;
    vatCalcMode?: 'lines' | 'total';
    vatRegime?: string;
    billingRule?: string;
    paymentTerms?: string;
}

export const QuotationPDFTemplate = ({
    blocks, quotationTitle, betreft, clientInfo, projectId, grandTotal,
    databaseStoreState, tenantProfile, templateId = 't1', language = 'nl',
    showSubcomponents = false,
    vatCalcMode = 'lines',
    vatRegime = '21',
    billingRule,
    paymentTerms,
}: QuotationPDFProps) => {

    const { companyName: rawCompanyName, commercialName, vatNumber, iban, logoUrl, brandColor, planType, street, postalCode, city, email, bic, stationeryUrl, documentMode, documentFont, documentFontSize } = tenantProfile || {};
    const companyName = commercialName || rawCompanyName;
    const showWatermark = !canAccess('WHITELABEL', planType ?? 'FREE');
    // Validate stationery URL — must be a well-formed data URL with actual base64 content
    const isValidStationeryUrl = (() => {
        if (!stationeryUrl || typeof stationeryUrl !== 'string') return false;
        // Must start with a valid data URI scheme
        if (!stationeryUrl.startsWith('data:')) return false;
        // Must have actual base64 content after the comma (at least 100 chars to be a real image)
        const commaIdx = stationeryUrl.indexOf(',');
        if (commaIdx < 0 || stationeryUrl.length - commaIdx < 100) return false;
        return true;
    })();
    const isStationery = documentMode === 'stationery' && isValidStationeryUrl;
    const isPdfStationery = isStationery && stationeryUrl?.startsWith('data:application/pdf');
    const s = getTemplateStyles(templateId, brandColor);
    const docFont = documentFont || 'Helvetica';
    const docFontSize = documentFontSize ?? 10;
    if (s.page) {
        s.page.fontFamily = docFont;
        s.page.fontSize = docFontSize;
    }
    const lang = language;
    const accent = brandColor || '#d35400';

    const isT1 = templateId === 't1';
    const isT3 = templateId === 't3';
    const isT4 = templateId === 't4';

    const dateStr = new Date().toLocaleDateString(
        lang === 'fr' ? 'fr-BE' : lang === 'en' ? 'en-GB' : 'nl-BE'
    );

    const navy   = (s as any).navyColor  || '#1a3a5c';
    const darkBrand = (s as any).darkColor || navy;

    const colDesc  = { flex: 4, paddingRight: 8 };
    const colQty   = { flex: 0.8, textAlign: 'center' as const };
    const colUnit  = { flex: 0.8, textAlign: 'center' as const };
    const colPrice = { flex: 1.2, textAlign: 'right' as const };
    const colTotal = { flex: 1.2, textAlign: 'right' as const, fontWeight: 'bold' as const };

    const stripHtml = (html: string | undefined) => {
        if (!html) return '';
        return html.replace(/<[^>]*>?/gm, '').trim();
    };

    // ── Recursive block renderer ────────────────────────────────────────────
    const renderBlocks = (nodes: Block[], depth = 0): React.ReactNode[] => {
        let rows: React.ReactNode[] = [];
        nodes.forEach(block => {
            if (block.isOptional) return;
            const isContainer = block.type === 'section' || block.type === 'subsection' || block.type === 'post';
            const cleanContent = stripHtml(block.content);
            
            // Helper to calculate total including nested children and variants
            const getBlockTotalRecursive = (b: Block): number => {
                if (b.isOptional) return 0;
                if (b.children && b.children.length > 0) {
                    const childrenSum = b.children.reduce((sum, child) => sum + getBlockTotalRecursive(child), 0);
                    return childrenSum * (b.quantity || 1);
                }
                
                let vDeltas = 0;
                if (b.selectedVariants && b.articleId) {
                    const db = databaseStoreState.databases?.find((d: any) => d.id === 'db-articles');
                    const page = db?.pages.find((p: any) => p.id === b.articleId);
                    const vProp = db?.properties.find((p: any) => p.type === 'variants');
                    if (page && vProp) {
                        const vConfig = page.properties[vProp.id];
                        if (vConfig && Array.isArray(vConfig)) {
                            Object.entries(b.selectedVariants).forEach(([axisId, optId]) => {
                                const axis = vConfig.find((a: any) => a.id === axisId);
                                const opt = axis?.options.find((o: any) => o.id === optId);
                                if (opt) vDeltas += opt.priceDelta;
                            });
                        }
                    }
                }
                return ((b.verkoopPrice || 0) + vDeltas) * (b.quantity || 1);
            };

            const blockTotal = getBlockTotalRecursive(block);
            const hasChildren = block.children && block.children.length > 0;

            // Stationery mode uses minimal styling
            const baseRowStyle = isStationery
                ? { flexDirection: 'row' as const, borderBottom: '0.5px solid #e0e0e0', paddingVertical: 5, paddingHorizontal: 40, fontSize: 9 }
                : s.tableRow;

            if (block.type === 'section') {
                const sectionStyle = isStationery
                    ? { flexDirection: 'row' as const, backgroundColor: withAlpha(accent, '12'), borderLeft: `3px solid ${accent}`, paddingVertical: 6, paddingHorizontal: 40, marginTop: 6 }
                    : s.sectionRow;
                const textStyle = isStationery
                    ? { fontWeight: 'bold' as const, color: accent, fontSize: 10, textTransform: 'uppercase' as const }
                    : s.sectionText;
                rows.push(
                    <View key={block.id} style={sectionStyle}>
                        <Text style={{ ...colDesc, ...textStyle }}>{cleanContent.toUpperCase()}</Text>
                        <Text style={colQty} /><Text style={colUnit} /><Text style={colPrice} />
                        <Text style={{ ...colTotal, ...textStyle, textAlign: 'right' }}>€  {blockTotal.toFixed(2)}</Text>
                    </View>
                );
            } else if (block.type === 'subsection' || block.type === 'post') {
                rows.push(
                    <View key={block.id} style={isStationery ? { ...baseRowStyle, backgroundColor: '#fafafa' } : s.subsectionRow}>
                        <Text style={{ ...colDesc, fontWeight: 'bold' }}>{cleanContent}</Text>
                        <Text style={colQty} /><Text style={colUnit} /><Text style={colPrice} />
                        <Text style={{ ...colTotal, fontWeight: 'bold', textAlign: 'right' }}>€  {blockTotal.toFixed(2)}</Text>
                    </View>
                );
            } else if (block.type === 'image') {
                if (block.content && (block.content.startsWith('http') || block.content.startsWith('data:'))) {
                    rows.push(
                        <View key={block.id} style={{ ...baseRowStyle, borderBottom: undefined, paddingLeft: depth * 10 + (isStationery ? 40 : 6), paddingVertical: 8, flexDirection: 'column' as const, gap: 4 }}>
                            <Image src={block.content} style={{ width: 180, height: 120, borderRadius: 4, marginTop: 4, marginBottom: 4 }} />
                        </View>
                    );
                }
            } else if (block.type === 'text') {
                rows.push(
                    <View key={block.id} style={{ ...baseRowStyle, borderBottom: undefined, paddingLeft: depth * 10 + (isStationery ? 40 : 6) }}>
                        <Text style={{ flex: 1, fontStyle: 'italic', color: '#555', fontSize: 9 }}>
                            {renderRichText(block.content, { fontStyle: 'italic', color: '#555', fontSize: 9 })}
                        </Text>
                    </View>
                );
            } else {
                const pad = isStationery ? 40 : (isT1 || isT4 ? 28 : 6);
                const unitPrice = blockTotal / (block.quantity || 1);
                const descStyle = { fontSize: depth > 0 ? 8 : 9, color: depth > 0 ? '#666' : '#111' };
                rows.push(
                    <View key={block.id} style={{ ...baseRowStyle, paddingLeft: depth > 0 ? depth * 10 + pad : pad, backgroundColor: depth > 0 ? '#fafafa' : undefined }}>
                        <Text style={{ ...colDesc, ...descStyle }}>
                            {renderRichText(block.content, descStyle)}
                        </Text>
                        <Text style={{ ...colQty, fontSize: depth > 0 ? 8 : 9, color: depth > 0 ? '#666' : '#111' }}>{block.quantity || 1}</Text>
                        <Text style={{ ...colUnit, fontSize: depth > 0 ? 8 : 9, color: depth > 0 ? '#666' : '#111' }}>{block.unit || 'stk'}</Text>
                        <Text style={{ ...colPrice, fontSize: depth > 0 ? 8 : 9, color: depth > 0 ? '#666' : '#111' }}>€  {unitPrice.toFixed(2)}</Text>
                        <Text style={{ ...colTotal, fontSize: depth > 0 ? 8 : 9, color: depth > 0 ? '#666' : '#111', fontWeight: depth > 0 ? 'normal' : 'bold' }}>€  {blockTotal.toFixed(2)}</Text>
                    </View>
                );
            }

            // Only recurse for containers (Sections/Subsections/Posts), hide subcomponents of Lines UNLESS showSubcomponents is true
            if (hasChildren && (isContainer || showSubcomponents)) {
                rows = rows.concat(renderBlocks(block.children!, depth + 1));
            }
        });
        return rows;
    };

    const totals = useMemo(() => {
        return calculateInvoiceTotals(blocks || [], { vatCalcMode, vatRegime, databaseStoreState });
    }, [blocks, vatCalcMode, vatRegime, databaseStoreState]);

    const finalSubtotal = blocks && blocks.length > 0 ? totals.subtotal : grandTotal;
    const vatBreakdown = totals.vatBreakdown;
    const taxAmount = totals.totalVAT;
    const totalInclTax = blocks && blocks.length > 0 ? totals.totalInclVAT : (grandTotal + taxAmount);
    const hasLineMedecontractant = totals.hasMedecontractant;
    const hasVat6 = vatBreakdown.some(v => v.rate === 6);

    const renderVatRows = (boxWidth: number) => {
        if (vatCalcMode === 'lines') {
            if (vatBreakdown.length === 0) {
                return (
                    <View style={{ flexDirection: 'row', width: boxWidth, justifyContent: 'space-between' }}>
                        <Text style={{ fontSize: 8.5, color: '#666', textTransform: 'uppercase', letterSpacing: 0.5 }}>{t('vat', lang)} (21%):</Text>
                        <Text style={{ fontSize: 10, fontWeight: 'bold' }}>€  0.00</Text>
                    </View>
                );
            }
            return vatBreakdown.map(({ rate, vat }) => {
                const label = `${t('vat', lang)} (${rate === 0 ? (hasLineMedecontractant ? (lang === 'fr' ? 'Autoliquidation' : lang === 'en' ? 'Reverse charge' : 'Verlegd') : '0%') : `${rate}%`}):`;
                return (
                    <View key={rate} style={{ flexDirection: 'row', width: boxWidth, justifyContent: 'space-between', marginTop: 2 }}>
                        <Text style={{ fontSize: 8.5, color: '#666', textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</Text>
                        <Text style={{ fontSize: 10, fontWeight: 'bold' }}>€  {vat.toFixed(2)}</Text>
                    </View>
                );
            });
        } else {
            const label = `${t('vat', lang)} (${vatRegime === 'medecontractant' ? (lang === 'fr' ? 'Autoliquidation' : lang === 'en' ? 'Reverse charge' : 'Verlegd') : `${vatRegime}%`}):`;
            return (
                <View style={{ flexDirection: 'row', width: boxWidth, justifyContent: 'space-between' }}>
                    <Text style={{ fontSize: 8.5, color: '#666', textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</Text>
                    <Text style={{ fontSize: 10, fontWeight: 'bold' }}>€  {taxAmount.toFixed(2)}</Text>
                </View>
            );
        }
    };

    const renderVatRowsDynamic = () => {
        if (vatCalcMode === 'lines') {
            if (vatBreakdown.length === 0) {
                return (
                    <View style={s.summaryRow}>
                        <Text style={s.summaryLabel}>{t('vat', lang)} (21%):</Text>
                        <Text style={s.summaryValue}>€  0.00</Text>
                    </View>
                );
            }
            return vatBreakdown.map(({ rate, vat }) => {
                const label = `${t('vat', lang)} (${rate === 0 ? (hasLineMedecontractant ? (lang === 'fr' ? 'Autoliquidation' : lang === 'en' ? 'Reverse charge' : 'Verlegd') : '0%') : `${rate}%`}):`;
                return (
                    <View key={rate} style={s.summaryRow}>
                        <Text style={s.summaryLabel}>{label}</Text>
                        <Text style={s.summaryValue}>€  {vat.toFixed(2)}</Text>
                    </View>
                );
            });
        } else {
            const label = `${t('vat', lang)} (${vatRegime === 'medecontractant' ? (lang === 'fr' ? 'Autoliquidation' : lang === 'en' ? 'Reverse charge' : 'Verlegd') : `${vatRegime}%`}):`;
            return (
                <View style={s.summaryRow}>
                    <Text style={s.summaryLabel}>{label}</Text>
                    <Text style={s.summaryValue}>€  {taxAmount.toFixed(2)}</Text>
                </View>
            );
        }
    };

    const padH = isStationery ? 40 : (isT1 || isT4 ? 28 : 40);

    // ── STATIONERY MODE ─────────────────────────────────────────────────────
    if (isStationery) {
        return (
            <Document>
                <Page size="A4" style={{ paddingTop: 180, paddingBottom: 150, paddingHorizontal: 40, fontFamily: docFont, fontSize: docFontSize, color: '#111' }}>
                    {/* Background stationery image — only for image stationery; PDF stationery is merged by pdf-lib */}
                    {!isPdfStationery && <Image src={stationeryUrl} style={{ position: 'absolute', top: 0, left: 0, width: 595, height: 842 }} fixed />}

                    {/* Content area — offset from top/bottom to avoid letterhead/footer zones */}
                    <View style={{ flex: 1 }}>
                        {/* Document title + meta */}
                        {/* Inspired Header for Stationery (Company Details hidden) */}
                        <View style={{ marginBottom: 15 }}>
                            {/* Top Section */}
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 15 }}>
                                {/* Left Column: Blank (since company info is on pre-printed letterhead) */}
                                <View style={{ flex: 0.55 }} />

                                {/* Right Column: Title & Client Details */}
                                <View style={{ flex: 0.45, flexDirection: 'column', alignItems: 'flex-start', gap: 2, paddingLeft: 10 }}>
                                    <Text style={{ fontSize: 14, fontWeight: 'bold', color: accent, textTransform: 'none', marginBottom: 10, fontFamily: docFont }}>
                                        {t('quotation', lang)} {quotationTitle || 'DRAFT'}
                                    </Text>
                                    <Text style={{ fontSize: 10, fontWeight: 'bold', color: '#111111', fontFamily: docFont }}>
                                        {clientInfo.name || 'Klant'}
                                    </Text>
                                    {clientInfo.address ? (
                                        <Text style={{ fontSize: 9, color: '#333333', fontFamily: docFont }}>{clientInfo.address}</Text>
                                    ) : null}
                                    {clientInfo.vatNumber ? (
                                        <Text style={{ fontSize: 9, color: '#333333', fontFamily: docFont }}>{formatBelgianVat(clientInfo.vatNumber)}</Text>
                                    ) : null}
                                </View>
                            </View>

                            {/* Horizontal Divider Line */}
                            <View style={{ height: 0.8, backgroundColor: '#cccccc', marginVertical: 8 }} />

                            {/* Bottom Section: Dates (Left) and Betreft (Right) */}
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: 4 }}>
                                {/* Left side: Dates */}
                                <View style={{ flex: 0.55, flexDirection: 'column', gap: 3 }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                        <Text style={{ width: 65, fontSize: 9, fontWeight: 'bold', color: '#111111', fontFamily: docFont }}>
                                            {lang === 'nl' ? 'Datum:' : lang === 'fr' ? 'Date:' : 'Date:'}
                                        </Text>
                                        <Text style={{ fontSize: 9, color: '#333333', fontFamily: docFont }}>{dateStr}</Text>
                                    </View>
                                </View>

                                {/* Right side: Betreft */}
                                <View style={{ flex: 0.45, paddingLeft: 10 }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                                        <Text style={{ fontSize: 9, fontWeight: 'bold', color: '#111111', fontFamily: docFont }}>
                                            {lang === 'nl' ? 'Betreft: ' : lang === 'fr' ? 'Concerne: ' : 'Subject: '}
                                        </Text>
                                        <Text style={{ flex: 1, fontSize: 9, color: '#333333', fontFamily: docFont }}>{betreft || '—'}</Text>
                                    </View>
                                </View>
                            </View>
                        </View>

                        {/* Table header */}
                        <View style={{ flexDirection: 'row', backgroundColor: accent, paddingVertical: 7, paddingHorizontal: 40, fontWeight: 'bold', fontSize: 8.5, textTransform: 'uppercase', color: '#ffffff', letterSpacing: 0.3 }}>
                            <Text style={colDesc}>{t('description', lang)}</Text>
                            <Text style={colQty}>{t('qty', lang)}</Text>
                            <Text style={colUnit}>{t('unit', lang)}</Text>
                            <Text style={colPrice}>{t('unit_price', lang)}</Text>
                            <Text style={colTotal}>{t('total_excl', lang)}</Text>
                        </View>

                        {/* Rows */}
                        {renderBlocks(blocks)}

                        {/* Summary */}
                        <View style={{ alignItems: 'flex-end', width: '100%', marginTop: 16 }}>
                            <View style={{ flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                                <View style={{ flexDirection: 'row', width: 240, justifyContent: 'space-between' }}>
                                    <Text style={{ fontSize: 8.5, color: '#666', textTransform: 'uppercase', letterSpacing: 0.5 }}>{t('subtotal_excl', lang)}:</Text>
                                    <Text style={{ fontSize: 10, fontWeight: 'bold' }}>€  {finalSubtotal.toFixed(2)}</Text>
                                </View>
                                {renderVatRows(240)}
                                <View style={{ flexDirection: 'row', width: 240, justifyContent: 'space-between', marginTop: 4, paddingTop: 4, borderTop: '1px solid #e5e7eb' }}>
                                    <Text style={{ fontSize: 8.5, color: '#000', fontWeight: 'bold', textTransform: 'uppercase' }}>{t('grand_total_incl', lang)}:</Text>
                                    <Text style={{ fontSize: 15, fontWeight: 'bold', color: accent }}>€  {totalInclTax.toFixed(2)}</Text>
                                </View>
                            </View>
                        </View>

                        {/* Billing and Payment Conditions section */}
                        {(billingRule || paymentTerms) && (
                            <View style={{ marginTop: 16, padding: 8, backgroundColor: '#fafafa', borderLeft: `2.5px solid ${accent}`, borderRadius: 4, flexDirection: 'row' as const, justifyContent: 'space-between' as const, alignItems: 'center' as const }} wrap={false}>
                                {billingRule && (
                                    <View style={{ flexDirection: 'column' as const, gap: 1 }}>
                                        <Text style={{ fontSize: 7.5, color: '#888888', textTransform: 'uppercase' as const, fontWeight: 'bold' as const }}>
                                            {lang === 'fr' ? 'Méthode de facturation' : lang === 'en' ? 'Billing method' : 'Facturatiemethode'}
                                        </Text>
                                        <Text style={{ fontSize: 9, color: '#333333', fontWeight: 'bold' as const }}>
                                            {billingRule === 'opt-fixed' ? (lang === 'fr' ? 'Prix fixe' : lang === 'en' ? 'Fixed price' : 'Vaste prijs') :
                                             billingRule === 'opt-progress' ? (lang === 'fr' ? 'États d\'avancement' : lang === 'en' ? 'Progress billing' : 'Vorderingsstaten') :
                                             billingRule === 'opt-hourly' ? (lang === 'fr' ? 'En régie' : lang === 'en' ? 'Hourly rate' : 'In regie') : 'Vaste prijs'}
                                        </Text>
                                    </View>
                                )}
                                {paymentTerms && (
                                    <View style={{ flexDirection: 'column' as const, gap: 1, alignItems: 'flex-end' as const }}>
                                        <Text style={{ fontSize: 7.5, color: '#888888', textTransform: 'uppercase' as const, fontWeight: 'bold' as const }}>
                                            {lang === 'fr' ? 'Conditions de paiement' : lang === 'en' ? 'Payment terms' : 'Betalingsvoorwaarden'}
                                        </Text>
                                        <Text style={{ fontSize: 9, color: '#333333', fontWeight: 'bold' as const }}>
                                            {paymentTerms === 'pay-0' ? (lang === 'fr' ? 'Immédiat' : lang === 'en' ? 'Immediate' : 'Onmiddellijk') :
                                             paymentTerms === 'pay-8' ? (lang === 'fr' ? '8 jours' : lang === 'en' ? '8 days' : '8 dagen') :
                                             paymentTerms === 'pay-14' ? (lang === 'fr' ? '14 jours' : lang === 'en' ? '14 days' : '14 dagen') :
                                             paymentTerms === 'pay-30' ? (lang === 'fr' ? '30 jours' : lang === 'en' ? '30 days' : '30 dagen') :
                                             paymentTerms === 'pay-60' ? (lang === 'fr' ? '60 jours' : lang === 'en' ? '60 days' : '60 dagen') :
                                             paymentTerms === 'pay-90' ? (lang === 'fr' ? '90 jours' : lang === 'en' ? '90 days' : '90 dagen') : '30 dagen'}
                                        </Text>
                                    </View>
                                )}
                            </View>
                        )}

                        {/* Medecontractant Legal Notice */}
                        {(vatRegime === 'medecontractant' || (vatCalcMode === 'lines' && hasLineMedecontractant)) && (
                            <View style={{ marginTop: 24, padding: 10, backgroundColor: '#fafafa', borderLeft: `3px solid ${accent}`, borderRadius: 4 }}>
                                <Text style={{ fontSize: 8, color: '#555555', fontStyle: 'italic', lineHeight: 1.4 }}>
                                    {t('footer_medecontractant_legal', lang)}
                                </Text>
                            </View>
                        )}

                        {/* 6% VAT Legal Notice */}
                        {hasVat6 && (
                            <View style={{ marginTop: 12, padding: 10, backgroundColor: '#fafafa', borderLeft: `3px solid ${accent}`, borderRadius: 4 }}>
                                <Text style={{ fontSize: 8, color: '#555555', fontStyle: 'italic', lineHeight: 1.4 }}>
                                    {t('footer_vat6_legal', lang)}
                                </Text>
                            </View>
                        )}
                    </View>

                    {showWatermark && (
                        <Text style={{ position: 'absolute', bottom: 4, left: 0, right: 0, textAlign: 'center', fontSize: 6.5, color: '#cccccc', letterSpacing: 1.5 }} fixed>
                            Powered by CoralOS — coral-os.com
                        </Text>
                    )}
                </Page>
            </Document>
        );
    }

    // ── DYNAMIC TEMPLATE MODE (T1/T2/T3/T4) ────────────────────────────────

    const renderInspiredHeader = () => {
        const formattedCompanyVat = formatBelgianVat(vatNumber) || '';
        const formattedCompanyIban = formatIban(iban) || '';
        const companyAddress = [street, (postalCode || city) ? `${postalCode || ''} ${city || ''}`.trim() : ''].filter(Boolean).join(' ') || '';
        const companyMail = email || '';
        
        const formattedClientVat = clientInfo.vatNumber ? formatBelgianVat(clientInfo.vatNumber) : '';
        const clientAddress = clientInfo.address || '';

        const headerPadH = isT3 ? 8 : (isT1 ? 28 : 32);
        const docId = quotationTitle || 'DRAFT';
        const subjectLabel = lang === 'nl' ? 'Betreft: ' : lang === 'fr' ? 'Concerne: ' : 'Subject: ';

        return (
            <View style={{ paddingHorizontal: headerPadH, marginTop: isT3 ? 0 : 25, marginBottom: 15 }}>
                {/* Top Section: Company Info (Left) and Doc Title & Client Info (Right) */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 15 }}>
                    {/* Left Column: Company Details */}
                    <View style={{ flex: 0.55, flexDirection: 'column', gap: 2 }}>
                        {logoUrl && <Image src={logoUrl} style={{ width: 80, height: 'auto', marginBottom: 6 }} />}
                        <Text style={{ fontSize: 10, fontWeight: 'bold', color: '#111111', fontFamily: docFont }}>
                            {companyName || ''}
                        </Text>
                        <Text style={{ fontSize: 9, color: '#333333', fontFamily: docFont }}>{companyAddress}</Text>
                        <Text style={{ fontSize: 9, color: '#333333', fontFamily: docFont }}>{formattedCompanyVat}</Text>
                        <Text style={{ fontSize: 9, color: '#333333', fontFamily: docFont }}>{formattedCompanyIban}</Text>
                        <Text style={{ fontSize: 9, color: '#333333', fontFamily: docFont }}>{companyMail}</Text>
                    </View>

                    {/* Right Column: Title & Client Details */}
                    <View style={{ flex: 0.45, flexDirection: 'column', alignItems: 'flex-start', gap: 2, paddingLeft: 10 }}>
                        <Text style={{ fontSize: 14, fontWeight: 'bold', color: accent, textTransform: 'none', marginBottom: 10, fontFamily: docFont }}>
                            {t('quotation', lang)} {docId}
                        </Text>
                        <Text style={{ fontSize: 10, fontWeight: 'bold', color: '#111111', fontFamily: docFont }}>
                            {clientInfo.name || 'Klant'}
                        </Text>
                        {clientAddress ? (
                            <Text style={{ fontSize: 9, color: '#333333', fontFamily: docFont }}>{clientAddress}</Text>
                        ) : null}
                        {formattedClientVat ? (
                            <Text style={{ fontSize: 9, color: '#333333', fontFamily: docFont }}>{formattedClientVat}</Text>
                        ) : null}
                    </View>
                </View>

                {/* Horizontal Divider Line */}
                <View style={{ height: 0.8, backgroundColor: '#cccccc', marginVertical: 8 }} />

                {/* Bottom Section: Dates (Left) and Betreft (Right) */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: 4 }}>
                    {/* Left side: Dates */}
                    <View style={{ flex: 0.55, flexDirection: 'column', gap: 3 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Text style={{ width: 65, fontSize: 9, fontWeight: 'bold', color: '#111111', fontFamily: docFont }}>
                                {lang === 'nl' ? 'Datum:' : lang === 'fr' ? 'Date:' : 'Date:'}
                            </Text>
                            <Text style={{ fontSize: 9, color: '#333333', fontFamily: docFont }}>{dateStr}</Text>
                        </View>
                    </View>

                    {/* Right side: Betreft */}
                    <View style={{ flex: 0.45, paddingLeft: 10 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                            <Text style={{ fontSize: 9, fontWeight: 'bold', color: '#111111', fontFamily: docFont }}>
                                {subjectLabel}
                            </Text>
                            <Text style={{ flex: 1, fontSize: 9, color: '#333333', fontFamily: docFont }}>{betreft || '—'}</Text>
                        </View>
                    </View>
                </View>
            </View>
        );
    };

    // T3 navy grand total bar
    const renderGrandTotal = () => {
        if (isT3) {
            return (
                <View style={{ marginTop: 4, backgroundColor: navy, padding: 10, flexDirection: 'row', width: 265, justifyContent: 'space-between' }}>
                    <Text style={{ fontSize: 11, fontWeight: 'bold', color: '#ffffff', textTransform: 'uppercase' }}>
                        {t('grand_total_incl', lang)}
                    </Text>
                    <Text style={{ fontSize: 15, fontWeight: 'bold', color: '#ffffff' }}>
                        €  {totalInclTax.toFixed(2)}
                    </Text>
                </View>
            );
        }
        return (
            <View style={{ ...s.summaryRow, marginTop: 4, paddingTop: 4, borderTop: '1px solid #e5e7eb' }}>
                <Text style={{ ...s.summaryLabel, color: '#000', fontWeight: 'bold' }}>{t('grand_total_incl', lang)}:</Text>
                <Text style={s.grandTotalValue}>€  {totalInclTax.toFixed(2)}</Text>
            </View>
        );
    };

    // Footer
    const renderFooter = () => {
        if (isT1) {
            return (
                <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'stretch' }} fixed>
                    <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#f2f2f2', borderTop: '0.5px solid #ddd', paddingHorizontal: 16, paddingVertical: 10, gap: 10 }}>
                        <View style={{ width: 10, height: 10, backgroundColor: darkBrand }} />
                        <Text style={{ fontSize: 7.5, color: '#777777', lineHeight: 1.5 }}>
                            {[companyName, vatNumber ? `${t('vat', lang)}: ${vatNumber}` : '', email].filter(Boolean).join('  ·  ')}
                        </Text>
                    </View>
                    <View style={{ backgroundColor: accent, paddingHorizontal: 22, paddingVertical: 10, alignItems: 'center', justifyContent: 'center', minWidth: 100 }}>
                        <Text style={{ fontSize: 11, fontWeight: 'bold', color: '#ffffff', textTransform: 'uppercase', letterSpacing: 1 }}>
                            {lang === 'fr' ? 'MERCI' : lang === 'en' ? 'THANK YOU' : 'DANK U'}
                        </Text>
                    </View>
                </View>
            );
        }
        return (
            <View style={s.footerText} fixed>
                <Text>
                    {companyName || ''}
                    {vatNumber ? `  ·  ${t('vat', lang)}: ${vatNumber}` : ''}
                    {iban ? `  ·  IBAN: ${iban}` : ''}
                    {email ? `  ·  ${email}` : ''}
                </Text>
            </View>
        );
    };

    return (
        <Document>
            <Page size="A4" style={s.page}>
                {/* Header & Client & Metadata Section */}
                {renderInspiredHeader()}

                <View style={s.tableHeaderRow}>
                    <Text style={colDesc}>{t('description', lang)}</Text>
                    <Text style={colQty}>{t('qty', lang)}</Text>
                    <Text style={colUnit}>{t('unit', lang)}</Text>
                    <Text style={colPrice}>{t('unit_price', lang)}</Text>
                    <Text style={colTotal}>{t('total_excl', lang)}</Text>
                </View>

                {renderBlocks(blocks)}

                <View style={{ alignItems: 'flex-end', width: '100%' }} wrap={false}>
                    <View style={s.summaryBox}>
                        <View style={s.summaryRow}>
                            <Text style={s.summaryLabel}>{t('subtotal_excl', lang)}:</Text>
                            <Text style={s.summaryValue}>€  {finalSubtotal.toFixed(2)}</Text>
                        </View>
                        {renderVatRowsDynamic()}
                        {renderGrandTotal()}
                    </View>
                </View>

                {/* Billing and Payment Conditions section */}
                {(billingRule || paymentTerms) && (
                    <View style={{ marginTop: 16, marginHorizontal: isT1 || isT4 ? 32 : 8, padding: 8, backgroundColor: '#fafafa', borderLeft: `2.5px solid ${accent}`, borderRadius: 4, flexDirection: 'row' as const, justifyContent: 'space-between' as const, alignItems: 'center' as const }} wrap={false}>
                        {billingRule && (
                            <View style={{ flexDirection: 'column' as const, gap: 1 }}>
                                <Text style={{ fontSize: 7.5, color: '#888888', textTransform: 'uppercase' as const, fontWeight: 'bold' as const }}>
                                    {lang === 'fr' ? 'Méthode de facturation' : lang === 'en' ? 'Billing method' : 'Facturatiemethode'}
                                </Text>
                                <Text style={{ fontSize: 9, color: '#333333', fontWeight: 'bold' as const }}>
                                    {billingRule === 'opt-fixed' ? (lang === 'fr' ? 'Prix fixe' : lang === 'en' ? 'Fixed price' : 'Vaste prijs') :
                                     billingRule === 'opt-progress' ? (lang === 'fr' ? 'États d\'avancement' : lang === 'en' ? 'Progress billing' : 'Vorderingsstaten') :
                                     billingRule === 'opt-hourly' ? (lang === 'fr' ? 'En régie' : lang === 'en' ? 'Hourly rate' : 'In regie') : 'Vaste prijs'}
                                </Text>
                            </View>
                        )}
                        {paymentTerms && (
                            <View style={{ flexDirection: 'column' as const, gap: 1, alignItems: 'flex-end' as const }}>
                                <Text style={{ fontSize: 7.5, color: '#888888', textTransform: 'uppercase' as const, fontWeight: 'bold' as const }}>
                                    {lang === 'fr' ? 'Conditions de paiement' : lang === 'en' ? 'Payment terms' : 'Betalingsvoorwaarden'}
                                </Text>
                                <Text style={{ fontSize: 9, color: '#333333', fontWeight: 'bold' as const }}>
                                    {paymentTerms === 'pay-0' ? (lang === 'fr' ? 'Immédiat' : lang === 'en' ? 'Immediate' : 'Onmiddellijk') :
                                     paymentTerms === 'pay-8' ? (lang === 'fr' ? '8 jours' : lang === 'en' ? '8 days' : '8 dagen') :
                                     paymentTerms === 'pay-14' ? (lang === 'fr' ? '14 jours' : lang === 'en' ? '14 days' : '14 dagen') :
                                     paymentTerms === 'pay-30' ? (lang === 'fr' ? '30 jours' : lang === 'en' ? '30 days' : '30 dagen') :
                                     paymentTerms === 'pay-60' ? (lang === 'fr' ? '60 jours' : lang === 'en' ? '60 days' : '60 dagen') :
                                     paymentTerms === 'pay-90' ? (lang === 'fr' ? '90 jours' : lang === 'en' ? '90 days' : '90 dagen') : '30 dagen'}
                                </Text>
                            </View>
                        )}
                    </View>
                )}

                {/* Medecontractant Legal Notice */}
                {(vatRegime === 'medecontractant' || (vatCalcMode === 'lines' && hasLineMedecontractant)) && (
                    <View style={{ marginTop: 24, marginHorizontal: isT1 || isT4 ? 32 : 8, padding: 10, backgroundColor: '#fafafa', borderLeft: `3px solid ${accent}`, borderRadius: 4 }} wrap={false}>
                        <Text style={{ fontSize: 8, color: '#555555', fontStyle: 'italic', lineHeight: 1.4 }}>
                            {t('footer_medecontractant_legal', lang)}
                        </Text>
                    </View>
                )}

                {/* 6% VAT Legal Notice */}
                {hasVat6 && (
                    <View style={{ marginTop: 12, marginHorizontal: isT1 || isT4 ? 32 : 8, padding: 10, backgroundColor: '#fafafa', borderLeft: `3px solid ${accent}`, borderRadius: 4 }} wrap={false}>
                        <Text style={{ fontSize: 8, color: '#555555', fontStyle: 'italic', lineHeight: 1.4 }}>
                            {t('footer_vat6_legal', lang)}
                        </Text>
                    </View>
                )}

                {renderFooter()}

                {showWatermark && (
                    <Text style={{ position: 'absolute', bottom: 4, left: 0, right: 0, textAlign: 'center', fontSize: 6.5, color: '#cccccc', letterSpacing: 1.5 }} fixed>
                        Powered by CoralOS — coral-os.com
                    </Text>
                )}
            </Page>
        </Document>
    );
};
