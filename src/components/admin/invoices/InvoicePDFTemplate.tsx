/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useMemo } from 'react';
import { Document, Page, Text, View, Image, Svg, Polygon, Rect } from '@react-pdf/renderer';
import { Block } from '@/components/admin/database/types';
import { renderRichText } from '@/components/admin/shared/pdfRichText';
import { getTemplateStyles, TemplateId, lighten, withAlpha } from '@/components/admin/shared/templateStyles';
import { t } from '@/lib/document-i18n';
import { canAccess } from '@/lib/feature-flags';
import { calculateInvoiceTotals } from '@/lib/invoice-totals';

/**
 * Resolve the document type label. Credit notes (CN- prefix) get
 * a different title, amount label, and legal text.
 */
function resolveDocType(invoiceTitle: string, lang: string, docType?: string) {
    const isCreditNote = docType === 'opt-credit-note';
    const isProforma = docType === 'opt-proforma';

    if (isProforma) {
        return {
            isCreditNote: false,
            isProforma: true,
            docTitle: lang === 'nl' ? 'Proforma Factuur' : lang === 'fr' ? 'Facture Proforma' : 'Proforma Invoice',
            amountLabel: lang === 'nl' ? 'Totaalbedrag (Proforma)' : lang === 'fr' ? 'Montant Total (Proforma)' : 'Total Amount (Proforma)',
            legalText: lang === 'nl'
                ? 'Deze proforma factuur is uitsluitend bedoeld ter informatie en heeft geen fiscale of boekhoudkundige waarde.'
                : lang === 'fr'
                    ? 'Cette facture proforma est fournie uniquement \u00e0 titre d\'information et n\'a aucune valeur fiscale ou comptable.'
                    : 'This proforma invoice is for informational purposes only and has no fiscal or accounting value.',
        };
    }

    return {
        isCreditNote,
        isProforma: false,
        docTitle: isCreditNote ? t('credit_note', lang) : t('invoice', lang),
        amountLabel: isCreditNote
            ? (lang === 'nl' ? 'Te vergoeden bedrag' : lang === 'fr' ? 'Montant \u00e0 rembourser' : 'Amount to Refund')
            : t('amount_due', lang),
        legalText: isCreditNote
            ? (lang === 'nl'
                ? 'Deze creditnota vervangt het oorspronkelijk gefactureerd bedrag en wordt verrekend met de volgende factuur of terugbetaald.'
                : lang === 'fr'
                    ? 'Cette note de cr\u00e9dit remplace le montant initialement factur\u00e9 et sera d\u00e9duite de la prochaine facture ou rembours\u00e9e.'
                    : 'This credit note replaces the originally invoiced amount and will be deducted from the next invoice or refunded.')
            : t('invoice_legal', lang),
    };
}

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

interface InvoicePDFProps {
    blocks: Block[];
    invoiceTitle: string;
    betreft: string;
    clientInfo: ClientInfo;
    projectId: string;
    grandTotal: number;
    databaseStoreState: any;
    tenantProfile?: any;
    templateId?: TemplateId;
    language?: string;
    invoiceDate?: string;
    deliveryDate?: string;
    dueDate?: string;
    docType?: string;
    vatCalcMode?: 'lines' | 'total';
    vatRegime?: string;
    structuredComm?: string;
}

export const InvoicePDFTemplate = ({
    blocks, invoiceTitle, betreft, clientInfo, projectId, grandTotal,
    databaseStoreState, tenantProfile, templateId = 't1', language = 'nl',
    invoiceDate, deliveryDate, dueDate, docType,
    vatCalcMode = 'lines', vatRegime = '21',
    structuredComm,
}: InvoicePDFProps) => {

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
    const { isCreditNote, isProforma, docTitle, amountLabel, legalText } = resolveDocType(invoiceTitle, lang, docType);

    const isT1 = templateId === 't1';
    const isT3 = templateId === 't3';
    const isT4 = templateId === 't4';

    const localeFmt = lang === 'fr' ? 'fr-BE' : lang === 'en' ? 'en-GB' : 'nl-BE';
    const formatDate = (d?: string) => d ? new Date(d).toLocaleDateString(localeFmt) : null;
    const dateStr = formatDate(invoiceDate) || new Date().toLocaleDateString(localeFmt);
    const deliveryDateStr = formatDate(deliveryDate);
    const dueDateStr = formatDate(dueDate);

    const navy = (s as any).navyColor || '#1a3a5c';
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
        return ((b.unitPrice || b.verkoopPrice || 0) + vDeltas) * (b.quantity || 1);
    };

    // ── Recursive block renderer ────────────────────────────────────────────
    const renderBlocks = (nodes: Block[], depth = 0): React.ReactNode[] => {
        let rows: React.ReactNode[] = [];
        nodes.forEach(block => {
            if (block.isOptional) return;
            const isContainer = block.type === 'section' || block.type === 'subsection' || block.type === 'post';
            const cleanContent = stripHtml(block.content);
            const blockTotal = getBlockTotalRecursive(block);
            
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
                rows.push(
                    <View key={block.id} style={{ ...baseRowStyle, paddingLeft: depth > 0 ? depth * 10 + pad : pad }}>
                        <Text style={colDesc}>
                            {renderRichText(block.content, colDesc)}
                        </Text>
                        <Text style={colQty}>{block.quantity || 1}</Text>
                        <Text style={colUnit}>{block.unit || 'stk'}</Text>
                        <Text style={colPrice}>€ {unitPrice.toFixed(2)}</Text>
                        <Text style={colTotal}>€ {blockTotal.toFixed(2)}</Text>
                    </View>
                );
            }

            if (block.children && block.children.length > 0) {
                rows = rows.concat(renderBlocks(block.children, depth + 1));
            }
        });
        return rows;
    };

    // Calculate VAT breakdown and totals using the shared calculator
    const totals = useMemo(() => {
        return calculateInvoiceTotals(blocks || [], { vatCalcMode, vatRegime, databaseStoreState });
    }, [blocks, vatCalcMode, vatRegime, databaseStoreState]);

    const finalSubtotal = blocks && blocks.length > 0 ? totals.subtotal : grandTotal;
    const vatBreakdown = totals.vatBreakdown;
    const totalVAT = totals.totalVAT;
    const totalInclTax = blocks && blocks.length > 0 ? totals.totalInclVAT : (grandTotal + totalVAT);
    const hasMedecontractant = totals.hasMedecontractant;
    const hasVat6 = vatBreakdown.some(v => v.rate === 6);

    const MEDECONTRACTANT_TEXT = t('footer_medecontractant_legal', lang);
    const VAT6_TEXT = t('footer_vat6_legal', lang);
    const padH = isStationery ? 40 : (isT1 || isT4 ? 28 : 40);

    // ── STATIONERY MODE ─────────────────────────────────────────────────────
    if (isStationery) {
        return (
            <Document>
                <Page size="A4" style={{ paddingTop: 180, paddingBottom: 150, paddingHorizontal: 40, fontFamily: docFont, fontSize: docFontSize, color: '#111' }}>
                    {/* Background stationery image — only for image stationery; PDF stationery is merged by pdf-lib */}
                    {!isPdfStationery && <Image src={stationeryUrl} style={{ position: 'absolute', top: 0, left: 0, width: 595, height: 842 }} fixed />}

                    <View style={{ flex: 1 }}>
                        {/* Inspired Header for Stationery (Company Details hidden) */}
                        <View style={{ marginBottom: 15 }}>
                            {/* Top Section */}
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 15 }}>
                                {/* Left Column: Blank (since company info is on pre-printed letterhead) */}
                                <View style={{ flex: 0.55 }} />

                                {/* Right Column: Title & Client Details */}
                                <View style={{ flex: 0.45, flexDirection: 'column', alignItems: 'flex-start', gap: 2, paddingLeft: 10 }}>
                                    <Text style={{ fontSize: 14, fontWeight: 'bold', color: accent, textTransform: 'none', marginBottom: 10, fontFamily: docFont }}>
                                        {docTitle} {invoiceTitle || 'DRAFT'}
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
                                    {dueDateStr && (
                                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                            <Text style={{ width: 65, fontSize: 9, fontWeight: 'bold', color: '#111111', fontFamily: docFont }}>
                                                {lang === 'nl' ? 'Vervaldag:' : lang === 'fr' ? 'Échéance:' : 'Due Date:'}
                                            </Text>
                                            <Text style={{ fontSize: 9, color: '#333333', fontFamily: docFont }}>{dueDateStr}</Text>
                                        </View>
                                    )}
                                    {deliveryDateStr && (
                                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                            <Text style={{ width: 65, fontSize: 9, fontWeight: 'bold', color: '#111111', fontFamily: docFont }}>
                                                {lang === 'nl' ? 'Levering:' : lang === 'fr' ? 'Livraison:' : 'Delivery:'}
                                            </Text>
                                            <Text style={{ fontSize: 9, color: '#333333', fontFamily: docFont }}>{deliveryDateStr}</Text>
                                        </View>
                                    )}
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

                        <View style={{ flexDirection: 'row', backgroundColor: accent, paddingVertical: 7, paddingHorizontal: 40, fontWeight: 'bold', fontSize: 8.5, textTransform: 'uppercase', color: '#ffffff', letterSpacing: 0.3 }}>
                            <Text style={colDesc}>{t('description', lang)}</Text>
                            <Text style={colQty}>{t('qty', lang)}</Text>
                            <Text style={colUnit}>{t('unit', lang)}</Text>
                            <Text style={colPrice}>{t('unit_price', lang)}</Text>
                            <Text style={colTotal}>{t('total_excl', lang)}</Text>
                        </View>

                        {renderBlocks(blocks)}

                        {/* Legal texts — above totals */}
                        {hasMedecontractant && (
                            <Text style={{ fontSize: 7.5, color: accent, fontWeight: 'bold', marginTop: 12, paddingHorizontal: 40 }}>
                                {MEDECONTRACTANT_TEXT}
                            </Text>
                        )}

                        {hasVat6 && (
                            <Text style={{ fontSize: 7.5, color: accent, fontWeight: 'bold', marginTop: 12, paddingHorizontal: 40 }}>
                                {VAT6_TEXT}
                            </Text>
                        )}

                        {legalText && (
                        <Text style={{ fontSize: 7.5, color: '#999', textAlign: 'center', marginTop: 12, lineHeight: 1.4 }}>
                            {legalText}
                        </Text>
                        )}

                        {/* Summary and Stripe Payment Section */}
                        <View style={{ flexDirection: 'row' as const, justifyContent: 'space-between' as const, marginTop: 16 }} wrap={false}>
                            {/* Left Side: Stripe Payment QR Code */}
                            {!isCreditNote && !isProforma && (
                                <View style={{ flex: 1, marginRight: 24, padding: 8, backgroundColor: '#fcfcfc', border: '0.5px solid #e2e8f0', borderRadius: 6, flexDirection: 'row' as const, gap: 8, alignItems: 'center' as const, maxWidth: 260 }}>
                                    <Image 
                                        src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(`https://checkout.stripe.com/pay/${invoiceTitle}?amount=${totalInclTax.toFixed(2)}&ref=${invoiceTitle}`)}`}
                                        style={{ width: 60, height: 60, borderRadius: 3 }}
                                    />
                                    <View style={{ flex: 1, gap: 2 }}>
                                        <Text style={{ fontSize: 8, fontWeight: 'bold' as const, color: '#1a1f36' }}>
                                            {lang === 'fr' ? 'Payer via Stripe' : lang === 'en' ? 'Pay via Stripe' : 'Betalen via Stripe'}
                                        </Text>
                                        <Text style={{ fontSize: 6.5, color: '#697386', lineHeight: 1.3 }}>
                                            {lang === 'fr' ? 'Scannez le code QR ci-contre pour régler en toute sécurité.' : 
                                             lang === 'en' ? 'Scan the QR code to securely pay this invoice.' : 
                                             'Scan de QR-code met uw smartphonecamera om deze factuur direct online te betalen.'}
                                        </Text>
                                    </View>
                                </View>
                            )}
                            {(!isCreditNote && isProforma) && <View style={{ flex: 1 }} />}
                            {isCreditNote && <View style={{ flex: 1 }} />}

                            {/* Right Side: Totals Summary */}
                            <View style={{ flexDirection: 'column', alignItems: 'flex-end', gap: 4, width: 240 }}>
                                <View style={{ flexDirection: 'row', width: 240, justifyContent: 'space-between' }}>
                                    <Text style={{ fontSize: 8.5, color: '#666', textTransform: 'uppercase', letterSpacing: 0.5 }}>{t('subtotal_excl', lang)}:</Text>
                                    <Text style={{ fontSize: 10, fontWeight: 'bold' }}>€{finalSubtotal.toFixed(2)}</Text>
                                </View>
                                {vatBreakdown.map((v, i) => (
                                    <View key={i} style={{ flexDirection: 'row', width: 240, justifyContent: 'space-between' }}>
                                        <Text style={{ fontSize: 8.5, color: '#666', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                                            {v.isMedecontractant ? 'BTW VERLEGD' : `${t('vat', lang)} (${v.rate}%):`}
                                        </Text>
                                        <Text style={{ fontSize: 10, fontWeight: 'bold' }}>€{v.vat.toFixed(2)}</Text>
                                    </View>
                                ))}
                                <View style={{ flexDirection: 'row', width: 240, justifyContent: 'space-between', marginTop: 4, paddingTop: 4, borderTop: '1px solid #e5e7eb' }}>
                                    <Text style={{ fontSize: 8.5, color: '#000', fontWeight: 'bold', textTransform: 'uppercase' }}>{amountLabel}:</Text>
                                    <Text style={{ fontSize: 15, fontWeight: 'bold', color: accent }}>€{totalInclTax.toFixed(2)}</Text>
                                </View>
                            </View>
                        </View>
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

    // ── DYNAMIC TEMPLATE MODE ───────────────────────────────────────────────

    const renderInspiredHeader = () => {
        const formattedCompanyVat = formatBelgianVat(vatNumber) || '';
        const formattedCompanyIban = formatIban(iban) || '';
        const companyAddress = [street, (postalCode || city) ? `${postalCode || ''} ${city || ''}`.trim() : ''].filter(Boolean).join(' ') || '';
        const companyMail = email || '';
        
        const formattedClientVat = clientInfo.vatNumber ? formatBelgianVat(clientInfo.vatNumber) : '';
        const clientAddress = clientInfo.address || '';

        const headerPadH = isT3 ? 8 : (isT1 ? 28 : 32);
        const docId = invoiceTitle || 'DRAFT';
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
                            {docTitle} {docId}
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
                        {dueDateStr && (
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <Text style={{ width: 65, fontSize: 9, fontWeight: 'bold', color: '#111111', fontFamily: docFont }}>
                                    {lang === 'nl' ? 'Vervaldag:' : lang === 'fr' ? 'Échéance:' : 'Due Date:'}
                                </Text>
                                <Text style={{ fontSize: 9, color: '#333333', fontFamily: docFont }}>{dueDateStr}</Text>
                            </View>
                        )}
                        {deliveryDateStr && (
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <Text style={{ width: 65, fontSize: 9, fontWeight: 'bold', color: '#111111', fontFamily: docFont }}>
                                    {lang === 'nl' ? 'Levering:' : lang === 'fr' ? 'Livraison:' : 'Delivery:'}
                                </Text>
                                <Text style={{ fontSize: 9, color: '#333333', fontFamily: docFont }}>{deliveryDateStr}</Text>
                            </View>
                        )}
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

    // Grand total rendering
    const renderGrandTotal = () => {
        if (isT3) {
            return (
                <View style={{ marginTop: 4, backgroundColor: navy, padding: 10, flexDirection: 'row', width: 265, justifyContent: 'space-between' }}>
                    <Text style={{ fontSize: 11, fontWeight: 'bold', color: '#ffffff', textTransform: 'uppercase' }}>
                        {amountLabel}
                    </Text>
                    <Text style={{ fontSize: 15, fontWeight: 'bold', color: '#ffffff' }}>
                        €{totalInclTax.toFixed(2)}
                    </Text>
                </View>
            );
        }
        return (
            <View style={{ ...s.summaryRow, marginTop: 4, paddingTop: 4, borderTop: '1px solid #e5e7eb' }}>
                <Text style={{ ...s.summaryLabel, color: '#000', fontWeight: 'bold' }}>{amountLabel}:</Text>
                <Text style={s.grandTotalValue}>€{totalInclTax.toFixed(2)}</Text>
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
                            {[companyName, vatNumber ? `${t('vat', lang)}: ${vatNumber}` : '', iban ? `IBAN: ${iban}` : '', structuredComm ? `Mededeling: ${structuredComm}` : '', email].filter(Boolean).join('  ·  ')}
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
                    {structuredComm ? `  ·  Mededeling: ${structuredComm}` : ''}
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

                {/* Legal texts — above totals */}
                {hasMedecontractant && (
                    <Text style={{ fontSize: 7.5, color: accent, fontWeight: 'bold', marginTop: 12, paddingHorizontal: padH }}>
                        {MEDECONTRACTANT_TEXT}
                    </Text>
                )}

                {hasVat6 && (
                    <Text style={{ fontSize: 7.5, color: accent, fontWeight: 'bold', marginTop: 12, paddingHorizontal: padH }}>
                        {VAT6_TEXT}
                    </Text>
                )}

                {legalText && (
                <Text style={{ fontSize: 7.5, color: '#999999', textAlign: 'center', marginTop: 12, paddingHorizontal: padH, lineHeight: 1.4 }}>
                    {legalText}
                </Text>
                )}

                {/* Summary and Stripe Payment Section */}
                <View style={{ flexDirection: 'row' as const, justifyContent: 'space-between' as const, marginTop: 20, marginHorizontal: isT1 || isT4 ? 32 : 8 }} wrap={false}>
                    {/* Left Side: Stripe Payment QR Code */}
                    {!isCreditNote && !isProforma && (
                        <View style={{ flex: 1, marginRight: 24, padding: 10, backgroundColor: '#fcfcfc', border: '1px solid #e2e8f0', borderRadius: 8, flexDirection: 'row' as const, gap: 10, alignItems: 'center' as const, maxWidth: 280 }}>
                            <Image 
                                src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(`https://checkout.stripe.com/pay/${invoiceTitle}?amount=${totalInclTax.toFixed(2)}&ref=${invoiceTitle}`)}`}
                                style={{ width: 68, height: 68, borderRadius: 4 }}
                            />
                            <View style={{ flex: 1, gap: 2 }}>
                                <Text style={{ fontSize: 8.5, fontWeight: 'bold' as const, color: '#1a1f36' }}>
                                    {lang === 'fr' ? 'Payer en ligne via Stripe' : lang === 'en' ? 'Pay online via Stripe' : 'Veilig betalen via Stripe'}
                                </Text>
                                <Text style={{ fontSize: 7, color: '#697386', lineHeight: 1.3 }}>
                                    {lang === 'fr' ? 'Scannez le code QR ci-contre avec votre smartphone pour régler cette facture en toute sécurité.' : 
                                     lang === 'en' ? 'Scan the QR code with your smartphone camera to securely settle this invoice.' : 
                                     'Scan de QR-code met uw smartphonecamera om deze factuur direct en veilig online te betalen.'}
                                </Text>
                            </View>
                        </View>
                    )}
                    {(!isCreditNote && isProforma) && <View style={{ flex: 1 }} />}
                    {isCreditNote && <View style={{ flex: 1 }} />}

                    {/* Right Side: Totals Summary */}
                    <View style={{ width: isT3 ? 265 : 240 }}>
                        <View style={s.summaryRow}>
                            <Text style={s.summaryLabel}>{t('subtotal_excl', lang)}:</Text>
                            <Text style={s.summaryValue}>€{finalSubtotal.toFixed(2)}</Text>
                        </View>
                        {vatBreakdown.map((v, i) => (
                            <View key={i} style={s.summaryRow}>
                                <Text style={s.summaryLabel}>
                                    {v.isMedecontractant ? 'BTW VERLEGD' : `${t('vat', lang)} (${v.rate}%):`}
                                </Text>
                                <Text style={s.summaryValue}>€{v.vat.toFixed(2)}</Text>
                            </View>
                        ))}
                        {renderGrandTotal()}
                    </View>
                </View>

                {/* Footer */}
                {renderFooter()}

                {/* Watermark */}
                {showWatermark && (
                    <Text style={{ position: 'absolute', bottom: 4, left: 0, right: 0, textAlign: 'center', fontSize: 6.5, color: '#c0c0c0', letterSpacing: 1.5 }} fixed>
                        Powered by CoralOS — coral-os.com
                    </Text>
                )}
            </Page>
        </Document>
    );
};
