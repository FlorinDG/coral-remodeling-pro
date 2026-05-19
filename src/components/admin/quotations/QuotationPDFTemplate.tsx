/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
import { Document, Page, Text, View, Image, Svg, Polygon, Rect } from '@react-pdf/renderer';
import { Block } from '@/components/admin/database/types';
import { getTemplateStyles, TemplateId, lighten, withAlpha } from '@/components/admin/shared/templateStyles';
import { t } from '@/lib/document-i18n';
import { canAccess } from '@/lib/feature-flags';

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
}

export const QuotationPDFTemplate = ({
    blocks, quotationTitle, betreft, clientInfo, projectId, grandTotal,
    databaseStoreState, tenantProfile, templateId = 't1', language = 'nl',
    showSubcomponents = false,
    vatCalcMode = 'lines',
    vatRegime = '21',
}: QuotationPDFProps) => {

    const { companyName: rawCompanyName, commercialName, vatNumber, iban, logoUrl, brandColor, planType, street, postalCode, city, email, bic, stationeryUrl, documentMode } = tenantProfile || {};
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
    const lang = language;
    const accent = brandColor || '#d35400';

    const isT1 = templateId === 't1';
    const isT3 = templateId === 't3';
    const isT4 = templateId === 't4';

    const dateStr = new Date().toLocaleDateString(
        lang === 'fr' ? 'fr-BE' : lang === 'en' ? 'en-GB' : 'nl-BE'
    );

    const navy   = (s as any).navyColor  || '#1a3a5c';
    const navyMid = (s as any).navyMid  || '#245076';
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

    const companyInfoLines = [
        vatNumber ? `${t('vat', lang)}: ${vatNumber}` : '',
        street || '',
        (postalCode || city) ? `${postalCode || ''} ${city || ''}`.trim() : '',
        iban ? `IBAN: ${iban}` : '',
        email || '',
    ].filter(Boolean);

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
                        <Text style={{ ...colDesc, fontStyle: 'italic', color: '#777' }}>{cleanContent}</Text>
                        <Text style={colQty} /><Text style={colUnit} /><Text style={colPrice} /><Text style={colTotal} />
                    </View>
                );
            } else {
                const pad = isStationery ? 40 : (isT1 || isT4 ? 28 : 6);
                const unitPrice = blockTotal / (block.quantity || 1);
                rows.push(
                    <View key={block.id} style={{ ...baseRowStyle, paddingLeft: depth > 0 ? depth * 10 + pad : pad, backgroundColor: depth > 0 ? '#fafafa' : undefined }}>
                        <Text style={{ ...colDesc, fontSize: depth > 0 ? 8 : 9, color: depth > 0 ? '#666' : '#111' }}>{cleanContent}</Text>
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

    const calcVatAndTotal = () => {
        let computedSubtotal = 0;
        let totalVat = 0;
        const vatMap = new Map<number, { base: number; vat: number }>();
        let hasLineMedecontractant = false;

        const accumulateVat = (nodes: Block[], multiplier = 1) => {
            (nodes || []).forEach(b => {
                if (b.isOptional) return;

                const currentQty = (b.type === 'line' || b.type === 'article' || b.type === 'bestek' || b.type === 'post') 
                    ? (b.quantity || 1) 
                    : 1;
                const nextMultiplier = multiplier * currentQty;
                
                if (b.children && b.children.length > 0) {
                    accumulateVat(b.children, nextMultiplier);
                    return;
                }

                if (b.type === 'line' || b.type === 'article' || b.type === 'bestek') {
                    const price = b.verkoopPrice || 0;
                    const lineTotal = price * nextMultiplier;
                    computedSubtotal += lineTotal;

                    const lineVatRate = b.vatRate ?? 21;

                    if (b.vatMedecontractant) {
                        hasLineMedecontractant = true;
                    }

                    let effectiveRate: number;
                    if (vatCalcMode === 'lines') {
                        effectiveRate = b.vatMedecontractant ? 0 : lineVatRate;
                    } else {
                        effectiveRate = vatRegime === 'medecontractant' ? 0 : parseFloat(vatRegime);
                    }

                    const existing = vatMap.get(effectiveRate) || { base: 0, vat: 0 };
                    existing.base += lineTotal;
                    existing.vat += lineTotal * (effectiveRate / 100);
                    vatMap.set(effectiveRate, existing);
                }
            });
        };

        accumulateVat(blocks, 1);
        
        const vatBreakdown = Array.from(vatMap.entries())
            .sort((a, b) => b[0] - a[0])
            .map(([rate, data]) => ({ rate, ...data }));

        totalVat = vatBreakdown.reduce((sum, v) => sum + v.vat, 0);

        return {
            subtotal: computedSubtotal,
            taxAmount: totalVat,
            vatBreakdown,
            hasLineMedecontractant,
        };
    };

    const { taxAmount, vatBreakdown, hasLineMedecontractant } = calcVatAndTotal();
    const totalInclTax = grandTotal + taxAmount;

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
                <Page size="A4" style={{ paddingTop: 180, paddingBottom: 150, paddingHorizontal: 40, fontFamily: 'Helvetica', fontSize: 10, color: '#111' }}>
                    {/* Background stationery image — only for image stationery; PDF stationery is merged by pdf-lib */}
                    {!isPdfStationery && <Image src={stationeryUrl} style={{ position: 'absolute', top: 0, left: 0, width: 595, height: 842 }} fixed />}

                    {/* Content area — offset from top/bottom to avoid letterhead/footer zones */}
                    <View style={{ flex: 1 }}>
                        {/* Document title + meta */}
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 }}>
                            <View>
                                <Text style={{ fontSize: 8, fontWeight: 'bold', color: '#888', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 3 }}>{t('bill_to', lang)}:</Text>
                                <Text style={{ fontSize: 11, fontWeight: 'bold' }}>{clientInfo.name || 'Klant'}</Text>
                                {clientInfo.address && <Text style={{ fontSize: 9, color: '#555', marginTop: 2 }}>{clientInfo.address}</Text>}
                                {clientInfo.vatNumber && <Text style={{ fontSize: 9, color: '#888', marginTop: 2 }}>{t('vat', lang)}: {clientInfo.vatNumber}</Text>}
                            </View>
                            <View style={{ alignItems: 'flex-end' }}>
                                <Text style={{ fontSize: 16, fontWeight: 'bold', color: accent, textTransform: 'uppercase' }}>{t('quotation', lang)}</Text>
                                <Text style={{ fontSize: 9, color: '#666', marginTop: 3 }}>#{quotationTitle || 'DRAFT'} · {dateStr}</Text>
                                <Text style={{ fontSize: 8, color: '#888', marginTop: 3 }}>{t('project_re', lang)}: {betreft || '—'}</Text>
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
                                    <Text style={{ fontSize: 10, fontWeight: 'bold' }}>€  {grandTotal.toFixed(2)}</Text>
                                </View>
                                {renderVatRows(240)}
                                <View style={{ flexDirection: 'row', width: 240, justifyContent: 'space-between', marginTop: 4, paddingTop: 4, borderTop: '1px solid #e5e7eb' }}>
                                    <Text style={{ fontSize: 8.5, color: '#000', fontWeight: 'bold', textTransform: 'uppercase' }}>{t('grand_total_incl', lang)}:</Text>
                                    <Text style={{ fontSize: 15, fontWeight: 'bold', color: accent }}>€  {totalInclTax.toFixed(2)}</Text>
                                </View>
                            </View>
                        </View>

                        {/* Medecontractant Legal Notice */}
                        {(vatRegime === 'medecontractant' || (vatCalcMode === 'lines' && hasLineMedecontractant)) && (
                            <View style={{ marginTop: 24, padding: 10, backgroundColor: '#fafafa', borderLeft: `3px solid ${accent}`, borderRadius: 4 }}>
                                <Text style={{ fontSize: 8, color: '#555555', fontStyle: 'italic', lineHeight: 1.4 }}>
                                    {t('footer_medecontractant_legal', lang)}
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

    // T4: PRISM geometric SVG header
    const renderT4Header = () => (
        <>
            <View style={{ position: 'relative', height: 120 }}>
                <Svg width={595} height={120} style={{ position: 'absolute', top: 0, left: 0 }}>
                    <Rect x={0} y={0} width={595} height={120} fill={navy} />
                    <Polygon points="370,0 595,0 595,120 480,120" fill={navyMid} />
                    <Polygon points="0,88 210,88 290,120 0,120" fill={navyMid} />
                </Svg>
                <View style={{ position: 'absolute', top: 22, left: 32 }}>
                    {logoUrl ? (
                        <Image src={logoUrl} style={{ width: 56, marginBottom: 6 }} />
                    ) : (
                        <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#ffffff', letterSpacing: 0.5, marginBottom: 6 }}>
                            {companyName?.toUpperCase() || 'CORAL'}
                        </Text>
                    )}
                    {companyInfoLines.slice(0, 3).map((line, i) => (
                        <Text key={i} style={{ fontSize: 8, color: 'rgba(255,255,255,0.65)', marginTop: 2 }}>{line}</Text>
                    ))}
                </View>
            </View>
            {/* Accent stripe */}
            <View style={{ height: 3, backgroundColor: accent }} />
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 32, paddingTop: 14, marginBottom: 4 }}>
                <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ fontSize: 24, fontWeight: 'bold', color: navy, textTransform: 'uppercase', letterSpacing: 2 }}>{t('quotation', lang)}</Text>
                    <Text style={{ fontSize: 9, color: '#888', marginTop: 3 }}>#{quotationTitle || 'DRAFT'} · {dateStr}</Text>
                </View>
            </View>
        </>
    );

    // T1: BLOCK black/white header
    const renderT1Header = () => (
        <View style={{ flexDirection: 'row', alignItems: 'stretch', marginBottom: 0 }}>
            <View style={{ flex: 0.55, backgroundColor: darkBrand, padding: 28, flexDirection: 'column', justifyContent: 'flex-end', minHeight: 130 }}>
                {logoUrl ? (
                    <Image src={logoUrl} style={{ width: 100, marginBottom: 8 }} />
                ) : (
                    <Text style={{ fontSize: 22, fontWeight: 'bold', color: '#ffffff', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
                        {companyName || 'CORAL ENTERPRISES'}
                    </Text>
                )}
                {companyInfoLines.map((line, i) => (
                    <Text key={i} style={{ fontSize: 8.5, color: '#aaaaaa', marginTop: 2 }}>{line}</Text>
                ))}
            </View>
            <View style={{ flex: 0.45, padding: 28, flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'flex-end' }}>
                <Text style={{ fontSize: 20, fontWeight: 'bold', color: darkBrand, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>
                    {t('quotation', lang)}
                </Text>
                <Text style={{ fontSize: 13, color: darkBrand, fontWeight: 'bold', marginBottom: 3 }}>#{quotationTitle || 'DRAFT'}</Text>
                <Text style={{ fontSize: 9, color: '#777777' }}>{dateStr}</Text>
            </View>
        </View>
    );

    // T3: NAVY
    const renderT3Header = () => (
        <>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
                <View style={{ flexDirection: 'column', gap: 2 }}>
                    {logoUrl ? (
                        <Image src={logoUrl} style={{ width: 90, marginBottom: 6 }} />
                    ) : (
                        <Text style={{ fontSize: 15, fontWeight: 'bold', color: navy, marginBottom: 4 }}>
                            {companyName || 'Coral Enterprises'}
                        </Text>
                    )}
                    {companyInfoLines.map((line, i) => (
                        <Text key={i} style={{ fontSize: 8.5, color: '#555555' }}>{line}</Text>
                    ))}
                </View>
                <Text style={{ fontSize: 38, fontWeight: 'bold', color: '#111111', textTransform: 'uppercase' }}>
                    {t('quotation', lang)}
                </Text>
            </View>
            <View style={{ flexDirection: 'row', backgroundColor: navy, paddingVertical: 7, paddingHorizontal: 8, marginBottom: 1 }}>
                <Text style={{ flex: 1, color: '#ffffff', fontSize: 8.5, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    {t('bill_to', lang)}
                </Text>
                <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'flex-end', gap: 40 }}>
                    <Text style={{ color: lighten(navy, 0.60), fontSize: 8.5, fontWeight: 'bold', textTransform: 'uppercase' }}>{t('quotation', lang)} #</Text>
                    <Text style={{ color: lighten(navy, 0.60), fontSize: 8.5, fontWeight: 'bold', textTransform: 'uppercase' }}>{t('date', lang)}</Text>
                </View>
            </View>
            <View style={{ flexDirection: 'row', backgroundColor: navyMid, paddingVertical: 7, paddingHorizontal: 8, marginBottom: 20 }}>
                <Text style={{ flex: 1, color: lighten(navy, 0.85), fontSize: 9 }}>{clientInfo.name || '—'}</Text>
                <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'flex-end', gap: 36 }}>
                    <Text style={{ color: lighten(navy, 0.85), fontSize: 9 }}>#{quotationTitle || 'DRAFT'}</Text>
                    <Text style={{ color: lighten(navy, 0.85), fontSize: 9 }}>{dateStr}</Text>
                </View>
            </View>
        </>
    );

    // Default header (T2)
    const renderDefaultHeader = () => (
        <View style={s.headerRow}>
            <View style={s.headerLeft}>
                {logoUrl ? (
                    <Image src={logoUrl} style={s.logo} />
                ) : (
                    <Text style={s.companyFallback}>{companyName || 'Coral'}</Text>
                )}
                <View style={{ flexDirection: 'column', gap: 2 }}>
                    {companyInfoLines.map((line, i) => (
                        <Text key={i} style={(s as any).companyInfoText || s.subtitle}>{line}</Text>
                    ))}
                </View>
            </View>
            <View style={s.headerRight}>
                <Text style={s.title}>{t('quotation', lang)}</Text>
                <Text style={s.subtitle}>#{quotationTitle || 'DRAFT'}</Text>
                <Text style={s.subtitle}>{t('date', lang)}: {dateStr}</Text>
            </View>
        </View>
    );

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
                    {companyName || 'Coral Enterprises'}
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
                {isT4 ? renderT4Header() : isT1 ? renderT1Header() : isT3 ? renderT3Header() : renderDefaultHeader()}

                {!isT3 && (
                    <View style={s.clientSection || { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20, paddingHorizontal: padH }}>
                        <View>
                            <Text style={s.clientLabel}>{t('bill_to', lang)}:</Text>
                            <Text style={{ fontSize: 11, fontWeight: 'bold' }}>{clientInfo.name || 'Klant'}</Text>
                            {clientInfo.address && <Text style={{ fontSize: 9, color: '#555', marginTop: 2 }}>{clientInfo.address}</Text>}
                            {clientInfo.vatNumber && <Text style={{ fontSize: 9, color: '#888', marginTop: 2 }}>{t('vat', lang)}: {clientInfo.vatNumber}</Text>}
                            {clientInfo.email && <Text style={{ fontSize: 9, color: '#888', marginTop: 1 }}>{clientInfo.email}</Text>}
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                            <Text style={s.clientLabel}>{t('project_re', lang)}:</Text>
                            <Text style={s.betreftLabel}>{betreft || '—'}</Text>
                        </View>
                    </View>
                )}

                {isT3 && (
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 }}>
                        <View>
                            <Text style={{ fontSize: 9, color: '#999', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>{t('project_re', lang)}</Text>
                            <Text style={s.betreftLabel}>{betreft || '—'}</Text>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                            {clientInfo.address && <Text style={{ fontSize: 9, color: '#555' }}>{clientInfo.address}</Text>}
                            {clientInfo.vatNumber && <Text style={{ fontSize: 9, color: '#888' }}>{t('vat', lang)}: {clientInfo.vatNumber}</Text>}
                        </View>
                    </View>
                )}

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
                            <Text style={s.summaryValue}>€  {grandTotal.toFixed(2)}</Text>
                        </View>
                        {renderVatRowsDynamic()}
                        {renderGrandTotal()}
                    </View>
                </View>

                {/* Medecontractant Legal Notice */}
                {(vatRegime === 'medecontractant' || (vatCalcMode === 'lines' && hasLineMedecontractant)) && (
                    <View style={{ marginTop: 24, marginHorizontal: isT1 || isT4 ? 32 : 8, padding: 10, backgroundColor: '#fafafa', borderLeft: `3px solid ${accent}`, borderRadius: 4 }} wrap={false}>
                        <Text style={{ fontSize: 8, color: '#555555', fontStyle: 'italic', lineHeight: 1.4 }}>
                            {t('footer_medecontractant_legal', lang)}
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
