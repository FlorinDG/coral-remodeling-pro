import React from 'react';
import { Document, Page, Text, View, Image, Svg, Polygon, Rect } from '@react-pdf/renderer';
import { Block } from '@/components/admin/database/types';
import { getTemplateStyles, TemplateId } from '@/components/admin/shared/templateStyles';
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
}

export const QuotationPDFTemplate = ({
    blocks, quotationTitle, betreft, clientInfo, projectId, grandTotal,
    databaseStoreState, tenantProfile, templateId = 't1', language = 'nl',
}: QuotationPDFProps) => {

    const { companyName, vatNumber, iban, logoUrl, brandColor, planType, street, postalCode, city, email, bic } = tenantProfile || {};
    const showWatermark = !canAccess('WHITELABEL', planType ?? 'FREE');
    const s = getTemplateStyles(templateId, brandColor);
    const lang = language;

    const isT1 = templateId === 't1';
    const isT3 = templateId === 't3';
    const isT4 = templateId === 't4';

    const dateStr = new Date().toLocaleDateString(
        lang === 'fr' ? 'fr-BE' : lang === 'en' ? 'en-GB' : 'nl-BE'
    );

    const navy   = (s as any).navyColor  || '#1a3a5c';
    const navyMid = (s as any).navyMid  || '#245076';

    // ── Column proportions ──────────────────────────────────────────────────
    const colDesc  = { flex: 4, paddingRight: 8 };
    const colQty   = { flex: 0.8, textAlign: 'center' as const };
    const colUnit  = { flex: 0.8, textAlign: 'center' as const };
    const colPrice = { flex: 1.2, textAlign: 'right' as const };
    const colTotal = { flex: 1.2, textAlign: 'right' as const, fontWeight: 'bold' as const };

    const stripHtml = (html: string | undefined) => {
        if (!html) return '';
        return html.replace(/<[^>]*>?/gm, '').trim();
    };

    // ── Company info lines ──────────────────────────────────────────────────
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
            let blockTotal = 0;
            let variantDeltas = 0;

            if (!isContainer && !(block.children && block.children.length > 0)) {
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

            if (block.type === 'section') {
                rows.push(
                    <View key={block.id} style={s.sectionRow}>
                        <Text style={{ ...colDesc, ...s.sectionText }}>{cleanContent.toUpperCase()}</Text>
                        <Text style={colQty} /><Text style={colUnit} /><Text style={colPrice} /><Text style={colTotal} />
                    </View>
                );
            } else if (block.type === 'subsection' || block.type === 'post') {
                rows.push(
                    <View key={block.id} style={s.subsectionRow}>
                        <Text style={{ ...colDesc, fontWeight: 'bold' }}>{cleanContent}</Text>
                        <Text style={colQty} /><Text style={colUnit} /><Text style={colPrice} /><Text style={colTotal} />
                    </View>
                );
            } else if (block.type === 'text') {
                rows.push(
                    <View key={block.id} style={{ ...s.tableRow, borderBottom: undefined, paddingLeft: depth * 10 + 6 }}>
                        <Text style={{ ...colDesc, fontStyle: 'italic', color: '#777' }}>{cleanContent}</Text>
                        <Text style={colQty} /><Text style={colUnit} /><Text style={colPrice} /><Text style={colTotal} />
                    </View>
                );
            } else {
                rows.push(
                    <View key={block.id} style={{ ...s.tableRow, paddingLeft: depth > 0 ? depth * 10 + (isT1 || isT4 ? 28 : 6) : (isT1 || isT4 ? 28 : 6) }}>
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

    const taxAmount   = grandTotal * 0.21;
    const totalInclTax = grandTotal + taxAmount;

    // ── T4: PRISM geometric SVG header ──────────────────────────────────────
    const renderT4Header = () => (
        <>
            <View style={{ position: 'relative', height: 120 }}>
                <Svg width={595} height={120} style={{ position: 'absolute', top: 0, left: 0 }}>
                    {/* Base navy block */}
                    <Rect x={0} y={0} width={595} height={120} fill={navy} />
                    {/* Right diagonal overlay */}
                    <Polygon points="370,0 595,0 595,120 480,120" fill={navyMid} />
                    {/* Bottom-left accent wedge */}
                    <Polygon points="0,88 210,88 290,120 0,120" fill={navyMid} />
                </Svg>
                {/* Company info on top of geometry */}
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
            {/* Invoice label + number below the shape */}
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 32, paddingTop: 14, marginBottom: 4 }}>
                <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ fontSize: 24, fontWeight: 'bold', color: navy, textTransform: 'uppercase', letterSpacing: 2 }}>{t('quotation', lang)}</Text>
                    <Text style={{ fontSize: 9, color: '#888', marginTop: 3 }}>#{quotationTitle || 'DRAFT'} · {dateStr}</Text>
                </View>
            </View>
        </>
    );

    // ── T1: BLOCK black/white header ────────────────────────────────────────
    const renderT1Header = () => (
        <View style={{ flexDirection: 'row', alignItems: 'stretch', marginBottom: 0 }}>
            {/* Black left block */}
            <View style={{ flex: 0.55, backgroundColor: '#111111', padding: 28, flexDirection: 'column', justifyContent: 'flex-end', minHeight: 130 }}>
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
            {/* Right invoice meta */}
            <View style={{ flex: 0.45, padding: 28, flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'flex-end' }}>
                <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#111111', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>
                    {t('quotation', lang)}
                </Text>
                <Text style={{ fontSize: 13, color: '#333333', fontWeight: 'bold', marginBottom: 3 }}>#{quotationTitle || 'DRAFT'}</Text>
                <Text style={{ fontSize: 9, color: '#777777' }}>{dateStr}</Text>
            </View>
        </View>
    );

    // ── T3: NAVY corporate header with bands ────────────────────────────────
    const renderT3Header = () => (
        <>
            {/* Company + huge INVOICE */}
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
            {/* BILL TO + invoice meta — dark navy band */}
            <View style={{ flexDirection: 'row', backgroundColor: navy, paddingVertical: 7, paddingHorizontal: 8, marginBottom: 1 }}>
                <Text style={{ flex: 1, color: '#ffffff', fontSize: 8.5, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    {t('bill_to', lang)}
                </Text>
                <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'flex-end', gap: 40 }}>
                    <Text style={{ color: '#aac4dc', fontSize: 8.5, fontWeight: 'bold', textTransform: 'uppercase' }}>Invoice #</Text>
                    <Text style={{ color: '#aac4dc', fontSize: 8.5, fontWeight: 'bold', textTransform: 'uppercase' }}>Date</Text>
                </View>
            </View>
            {/* Values band — medium navy */}
            <View style={{ flexDirection: 'row', backgroundColor: navyMid, paddingVertical: 7, paddingHorizontal: 8, marginBottom: 20 }}>
                <Text style={{ flex: 1, color: '#ddeaf6', fontSize: 9 }}>{clientInfo.name || '—'}</Text>
                <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'flex-end', gap: 36 }}>
                    <Text style={{ color: '#ddeaf6', fontSize: 9 }}>#{quotationTitle || 'DRAFT'}</Text>
                    <Text style={{ color: '#ddeaf6', fontSize: 9 }}>{dateStr}</Text>
                </View>
            </View>
        </>
    );

    // ── Standard header (T2 default) ────────────────────────────────────────
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

    // ── T3 special: navy grand total bar ────────────────────────────────────
    const renderGrandTotal = () => {
        if (isT3) {
            return (
                <View style={{ marginTop: 4, backgroundColor: navy, padding: 10, flexDirection: 'row', width: 265, justifyContent: 'space-between' }}>
                    <Text style={{ fontSize: 11, fontWeight: 'bold', color: '#ffffff', textTransform: 'uppercase' }}>
                        {t('grand_total_incl', lang)}
                    </Text>
                    <Text style={{ fontSize: 15, fontWeight: 'bold', color: '#ffffff' }}>
                        €{totalInclTax.toFixed(2)}
                    </Text>
                </View>
            );
        }
        return (
            <View style={{ ...s.summaryRow, marginTop: 4, paddingTop: 4, borderTop: '1px solid #e5e7eb' }}>
                <Text style={{ ...s.summaryLabel, color: '#000', fontWeight: 'bold' }}>{t('grand_total_incl', lang)}:</Text>
                <Text style={s.grandTotalValue}>€{totalInclTax.toFixed(2)}</Text>
            </View>
        );
    };

    // ── T1 special footer with contact block ────────────────────────────────
    const renderFooter = () => {
        if (isT1) {
            return (
                <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'stretch' }}>
                    {/* Left: small black square accent + contact */}
                    <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#f2f2f2', borderTop: '0.5px solid #ddd', paddingHorizontal: 16, paddingVertical: 10, gap: 10 }}>
                        <View style={{ width: 10, height: 10, backgroundColor: '#111111' }} />
                        <Text style={{ fontSize: 7.5, color: '#777777', lineHeight: 1.5 }}>
                            {[companyName, vatNumber ? `${t('vat', lang)}: ${vatNumber}` : '', email].filter(Boolean).join('  ·  ')}
                        </Text>
                    </View>
                    {/* Right: black "MERCI" block */}
                    <View style={{ backgroundColor: '#111111', paddingHorizontal: 22, paddingVertical: 10, alignItems: 'center', justifyContent: 'center', minWidth: 100 }}>
                        <Text style={{ fontSize: 11, fontWeight: 'bold', color: '#ffffff', textTransform: 'uppercase', letterSpacing: 1 }}>
                            {lang === 'fr' ? 'MERCI' : lang === 'en' ? 'THANK YOU' : 'DANK U'}
                        </Text>
                    </View>
                </View>
            );
        }
        return (
            <View style={s.footerText}>
                <Text>
                    {companyName || 'Coral Enterprises'}
                    {vatNumber ? `  ·  ${t('vat', lang)}: ${vatNumber}` : ''}
                    {iban ? `  ·  IBAN: ${iban}` : ''}
                    {email ? `  ·  ${email}` : ''}
                </Text>
            </View>
        );
    };

    const pad = isT1 || isT4 ? 28 : 40;

    return (
        <Document>
            <Page size="A4" style={s.page}>

                {/* ── Header ── */}
                {isT4 ? renderT4Header() : isT1 ? renderT1Header() : isT3 ? renderT3Header() : renderDefaultHeader()}

                {/* ── Client & Project ── */}
                {/* T3 skips this — client already shown in the band */}
                {!isT3 && (
                    <View style={s.clientSection || { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20, paddingHorizontal: pad }}>
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

                {/* T3: project/re on a separate clean line below bands */}
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

                {/* ── Table header ── */}
                <View style={s.tableHeaderRow}>
                    <Text style={colDesc}>{t('description', lang)}</Text>
                    <Text style={colQty}>{t('qty', lang)}</Text>
                    <Text style={colUnit}>{t('unit', lang)}</Text>
                    <Text style={colPrice}>{t('unit_price', lang)}</Text>
                    <Text style={colTotal}>{t('total_excl', lang)}</Text>
                </View>

                {/* ── Rows ── */}
                {renderBlocks(blocks)}

                {/* ── Summary ── */}
                <View style={{ alignItems: 'flex-end', width: '100%' }}>
                    <View style={s.summaryBox}>
                        <View style={s.summaryRow}>
                            <Text style={s.summaryLabel}>{t('subtotal_excl', lang)}:</Text>
                            <Text style={s.summaryValue}>€{grandTotal.toFixed(2)}</Text>
                        </View>
                        <View style={s.summaryRow}>
                            <Text style={s.summaryLabel}>{t('vat', lang)} (21%):</Text>
                            <Text style={s.summaryValue}>€{taxAmount.toFixed(2)}</Text>
                        </View>
                        {renderGrandTotal()}
                    </View>
                </View>

                {/* ── Legal text ── */}
                <Text style={{ fontSize: 7.5, color: '#999999', textAlign: 'center', marginTop: 28, paddingHorizontal: pad, lineHeight: 1.4 }}>
                    {t('quote_legal', lang)}
                </Text>

                {/* ── Footer ── */}
                {renderFooter()}

                {/* ── Free watermark ── */}
                {showWatermark && (
                    <Text style={{ position: 'absolute', bottom: 4, left: 0, right: 0, textAlign: 'center', fontSize: 6.5, color: '#cccccc', letterSpacing: 1.5 }}>
                        Powered by CoralOS — coral-os.com
                    </Text>
                )}
            </Page>
        </Document>
    );
};
