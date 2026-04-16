"use client";

import React from 'react';
import {
    Document,
    Page,
    Text,
    View,
    StyleSheet,
    pdf,
} from '@react-pdf/renderer';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface PurchaseInvoicePDFData {
    // Buyer (tenant)
    buyerName: string;
    buyerVat?: string;
    buyerAddress?: string;

    // Supplier
    supplierName: string;
    supplierVat?: string;
    supplierAddress?: string;

    // Invoice header
    invoiceNumber: string;
    invoiceDate?: string;
    dueDate?: string;
    currency?: string;
    source?: string; // 'Peppol' | 'Manual' | 'PDF Import'

    // Line items
    lines: Array<{
        description: string;
        quantity: number;
        unitCode?: string;
        unitPrice: number;
        vatRate: number;
        lineTotal: number;
    }>;

    // Totals
    totalExVat: number;
    totalVat: number;
    totalIncVat: number;
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const colors = {
    primary: '#1a1a2e',
    accent: '#2563eb',
    muted: '#6b7280',
    border: '#e5e7eb',
    tableHeader: '#f3f4f6',
    white: '#ffffff',
};

const styles = StyleSheet.create({
    page: {
        fontFamily: 'Helvetica',
        fontSize: 9,
        color: colors.primary,
        paddingTop: 48,
        paddingBottom: 48,
        paddingHorizontal: 48,
        backgroundColor: colors.white,
    },

    // Header
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 32,
    },
    headerLeft: {
        flex: 1,
    },
    headerRight: {
        flex: 1,
        alignItems: 'flex-end',
    },
    docTitle: {
        fontSize: 22,
        fontFamily: 'Helvetica-Bold',
        color: colors.accent,
        marginBottom: 4,
    },
    docNumber: {
        fontSize: 11,
        fontFamily: 'Helvetica-Bold',
        color: colors.primary,
        marginBottom: 2,
    },
    sourceBadge: {
        fontSize: 8,
        color: colors.muted,
        marginTop: 4,
    },

    // Parties
    partiesRow: {
        flexDirection: 'row',
        gap: 24,
        marginBottom: 28,
    },
    partyBox: {
        flex: 1,
        padding: 12,
        borderRadius: 6,
        backgroundColor: colors.tableHeader,
    },
    partyLabel: {
        fontSize: 7,
        fontFamily: 'Helvetica-Bold',
        color: colors.muted,
        textTransform: 'uppercase',
        letterSpacing: 0.8,
        marginBottom: 6,
    },
    partyName: {
        fontSize: 10,
        fontFamily: 'Helvetica-Bold',
        color: colors.primary,
        marginBottom: 2,
    },
    partyDetail: {
        fontSize: 8.5,
        color: colors.muted,
        marginBottom: 1,
    },

    // Dates row
    datesRow: {
        flexDirection: 'row',
        gap: 16,
        marginBottom: 24,
    },
    dateCell: {
        flex: 1,
        padding: 8,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 4,
    },
    dateCellLabel: {
        fontSize: 7,
        fontFamily: 'Helvetica-Bold',
        color: colors.muted,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 3,
    },
    dateCellValue: {
        fontSize: 9.5,
        fontFamily: 'Helvetica-Bold',
        color: colors.primary,
    },

    // Line items
    tableWrapper: {
        marginBottom: 20,
        borderRadius: 6,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: colors.border,
    },
    tableHeader: {
        flexDirection: 'row',
        backgroundColor: colors.tableHeader,
        paddingVertical: 7,
        paddingHorizontal: 10,
    },
    tableHeaderText: {
        fontSize: 7.5,
        fontFamily: 'Helvetica-Bold',
        color: colors.muted,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    tableRow: {
        flexDirection: 'row',
        paddingVertical: 7,
        paddingHorizontal: 10,
        borderTopWidth: 1,
        borderTopColor: colors.border,
    },
    tableRowAlt: {
        backgroundColor: '#fafafa',
    },
    cellDesc: { flex: 3, paddingRight: 8 },
    cellQty: { flex: 0.6, textAlign: 'right' },
    cellUnit: { flex: 0.7, textAlign: 'right', paddingRight: 4 },
    cellPrice: { flex: 1, textAlign: 'right' },
    cellVat: { flex: 0.7, textAlign: 'right' },
    cellTotal: { flex: 1.2, textAlign: 'right' },

    cellText: {
        fontSize: 8.5,
        color: colors.primary,
    },
    cellTextBold: {
        fontSize: 8.5,
        fontFamily: 'Helvetica-Bold',
        color: colors.primary,
    },
    cellTextMuted: {
        fontSize: 8.5,
        color: colors.muted,
    },

    // Totals
    totalsSection: {
        alignItems: 'flex-end',
        marginBottom: 28,
    },
    totalsBox: {
        width: 220,
    },
    totalsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 4,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    totalsRowFinal: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 8,
        marginTop: 4,
        borderTopWidth: 2,
        borderTopColor: colors.primary,
    },
    totalsLabel: {
        fontSize: 8.5,
        color: colors.muted,
    },
    totalsValue: {
        fontSize: 8.5,
        fontFamily: 'Helvetica-Bold',
        color: colors.primary,
    },
    totalsFinalLabel: {
        fontSize: 11,
        fontFamily: 'Helvetica-Bold',
        color: colors.primary,
    },
    totalsFinalValue: {
        fontSize: 11,
        fontFamily: 'Helvetica-Bold',
        color: colors.accent,
    },

    // Footer
    footer: {
        position: 'absolute',
        bottom: 24,
        left: 48,
        right: 48,
        borderTopWidth: 1,
        borderTopColor: colors.border,
        paddingTop: 8,
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    footerText: {
        fontSize: 7.5,
        color: colors.muted,
    },
});

// ── PDF Document Component ─────────────────────────────────────────────────────

function PurchaseInvoicePDFDocument({ data }: { data: PurchaseInvoicePDFData }) {
    const fmt = (n: number) =>
        `${data.currency || '€'}${n.toFixed(2)}`;

    const hasLines = data.lines && data.lines.length > 0;

    return (
        <Document
            title={`Purchase Invoice ${data.invoiceNumber}`}
            author={data.buyerName}
        >
            <Page size="A4" style={styles.page}>

                {/* Header */}
                <View style={styles.header}>
                    <View style={styles.headerLeft}>
                        <Text style={styles.docTitle}>PURCHASE INVOICE</Text>
                        <Text style={styles.docNumber}>{data.invoiceNumber || 'Untitled'}</Text>
                        {data.source && (
                            <Text style={styles.sourceBadge}>Source: {data.source}</Text>
                        )}
                    </View>
                    <View style={styles.headerRight}>
                        <Text style={{ fontSize: 11, fontFamily: 'Helvetica-Bold', color: colors.primary }}>
                            {data.buyerName}
                        </Text>
                        {data.buyerVat && (
                            <Text style={{ fontSize: 8.5, color: colors.muted, marginTop: 2 }}>
                                {data.buyerVat}
                            </Text>
                        )}
                        {data.buyerAddress && (
                            <Text style={{ fontSize: 8.5, color: colors.muted, marginTop: 2 }}>
                                {data.buyerAddress}
                            </Text>
                        )}
                    </View>
                </View>

                {/* Parties */}
                <View style={styles.partiesRow}>
                    {/* Supplier */}
                    <View style={styles.partyBox}>
                        <Text style={styles.partyLabel}>From (Supplier)</Text>
                        <Text style={styles.partyName}>{data.supplierName || '—'}</Text>
                        {data.supplierVat && (
                            <Text style={styles.partyDetail}>VAT: {data.supplierVat}</Text>
                        )}
                        {data.supplierAddress && (
                            <Text style={styles.partyDetail}>{data.supplierAddress}</Text>
                        )}
                    </View>
                    {/* Buyer */}
                    <View style={styles.partyBox}>
                        <Text style={styles.partyLabel}>To (Buyer)</Text>
                        <Text style={styles.partyName}>{data.buyerName}</Text>
                        {data.buyerVat && (
                            <Text style={styles.partyDetail}>VAT: {data.buyerVat}</Text>
                        )}
                        {data.buyerAddress && (
                            <Text style={styles.partyDetail}>{data.buyerAddress}</Text>
                        )}
                    </View>
                </View>

                {/* Dates */}
                <View style={styles.datesRow}>
                    <View style={styles.dateCell}>
                        <Text style={styles.dateCellLabel}>Invoice Date</Text>
                        <Text style={styles.dateCellValue}>{data.invoiceDate || '—'}</Text>
                    </View>
                    <View style={styles.dateCell}>
                        <Text style={styles.dateCellLabel}>Due Date</Text>
                        <Text style={styles.dateCellValue}>{data.dueDate || '—'}</Text>
                    </View>
                    <View style={styles.dateCell}>
                        <Text style={styles.dateCellLabel}>Currency</Text>
                        <Text style={styles.dateCellValue}>{data.currency || 'EUR'}</Text>
                    </View>
                </View>

                {/* Line Items */}
                {hasLines && (
                    <View style={styles.tableWrapper}>
                        {/* Table header */}
                        <View style={styles.tableHeader}>
                            <View style={styles.cellDesc}>
                                <Text style={styles.tableHeaderText}>Description</Text>
                            </View>
                            <View style={styles.cellQty}>
                                <Text style={[styles.tableHeaderText, { textAlign: 'right' }]}>Qty</Text>
                            </View>
                            <View style={styles.cellUnit}>
                                <Text style={[styles.tableHeaderText, { textAlign: 'right' }]}>Unit</Text>
                            </View>
                            <View style={styles.cellPrice}>
                                <Text style={[styles.tableHeaderText, { textAlign: 'right' }]}>Unit Price</Text>
                            </View>
                            <View style={styles.cellVat}>
                                <Text style={[styles.tableHeaderText, { textAlign: 'right' }]}>VAT %</Text>
                            </View>
                            <View style={styles.cellTotal}>
                                <Text style={[styles.tableHeaderText, { textAlign: 'right' }]}>Total</Text>
                            </View>
                        </View>

                        {/* Rows */}
                        {data.lines.map((line, i) => (
                            <View
                                key={i}
                                style={[styles.tableRow, i % 2 === 1 ? styles.tableRowAlt : {}]}
                            >
                                <View style={styles.cellDesc}>
                                    <Text style={styles.cellText}>{line.description || '—'}</Text>
                                </View>
                                <View style={styles.cellQty}>
                                    <Text style={[styles.cellTextMuted, { textAlign: 'right' }]}>
                                        {line.quantity}
                                    </Text>
                                </View>
                                <View style={styles.cellUnit}>
                                    <Text style={[styles.cellTextMuted, { textAlign: 'right' }]}>
                                        {line.unitCode || '—'}
                                    </Text>
                                </View>
                                <View style={styles.cellPrice}>
                                    <Text style={[styles.cellTextMuted, { textAlign: 'right' }]}>
                                        {fmt(line.unitPrice)}
                                    </Text>
                                </View>
                                <View style={styles.cellVat}>
                                    <Text style={[styles.cellTextMuted, { textAlign: 'right' }]}>
                                        {line.vatRate}%
                                    </Text>
                                </View>
                                <View style={styles.cellTotal}>
                                    <Text style={[styles.cellTextBold, { textAlign: 'right' }]}>
                                        {fmt(line.lineTotal)}
                                    </Text>
                                </View>
                            </View>
                        ))}
                    </View>
                )}

                {/* No lines fallback */}
                {!hasLines && (
                    <View style={{
                        borderWidth: 1, borderColor: colors.border,
                        borderRadius: 6, padding: 20, marginBottom: 20,
                        alignItems: 'center',
                    }}>
                        <Text style={{ fontSize: 8.5, color: colors.muted }}>
                            No line item detail available for this invoice.
                        </Text>
                    </View>
                )}

                {/* Totals */}
                <View style={styles.totalsSection}>
                    <View style={styles.totalsBox}>
                        <View style={styles.totalsRow}>
                            <Text style={styles.totalsLabel}>Subtotal (excl. VAT)</Text>
                            <Text style={styles.totalsValue}>{fmt(data.totalExVat)}</Text>
                        </View>
                        <View style={styles.totalsRow}>
                            <Text style={styles.totalsLabel}>VAT</Text>
                            <Text style={styles.totalsValue}>{fmt(data.totalVat)}</Text>
                        </View>
                        <View style={styles.totalsRowFinal}>
                            <Text style={styles.totalsFinalLabel}>Total (incl. VAT)</Text>
                            <Text style={styles.totalsFinalValue}>{fmt(data.totalIncVat)}</Text>
                        </View>
                    </View>
                </View>

                {/* Footer */}
                <View style={styles.footer} fixed>
                    <Text style={styles.footerText}>
                        Generated by CoralOS · {new Date().toLocaleDateString('en-BE')}
                    </Text>
                    <Text style={styles.footerText}>
                        {data.invoiceNumber} — {data.supplierName}
                    </Text>
                </View>

            </Page>
        </Document>
    );
}

// ── Export trigger function ────────────────────────────────────────────────────

/**
 * Call this from an onClick handler to download the PDF client-side.
 */
export async function downloadPurchaseInvoicePDF(data: PurchaseInvoicePDFData): Promise<void> {
    const blob = await pdf(<PurchaseInvoicePDFDocument data={data} />).toBlob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `purchase-invoice-${data.invoiceNumber || 'export'}.pdf`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export default PurchaseInvoicePDFDocument;
