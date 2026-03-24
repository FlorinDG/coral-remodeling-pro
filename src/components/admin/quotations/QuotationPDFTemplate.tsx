import React from 'react';
import { Document, Page, Text, View, StyleSheet, Font, Image } from '@react-pdf/renderer';
import { Block, VariantsConfig } from '@/components/admin/database/types';

// Optional: Register a custom font (using standard Inter/Roboto usually)
// Font.register({ family: 'Inter', src: 'https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZJhjp-Ek-_EeA.woff2' });

const styles = StyleSheet.create({
    page: {
        padding: 40,
        backgroundColor: '#ffffff',
        fontFamily: 'Helvetica', // Fallback universal sans-serif
        fontSize: 10,
        color: '#1a1a1a'
    },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 30,
        borderBottom: '2px solid #ea580c', // Coral Brand Orange
        paddingBottom: 20
    },
    headerLeft: {
        flexDirection: 'column',
        gap: 4
    },
    headerRight: {
        flexDirection: 'column',
        alignItems: 'flex-end',
        gap: 4
    },
    logo: {
        width: 120,
        marginBottom: 8
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#000000',
        textTransform: 'uppercase',
        letterSpacing: 1
    },
    subtitle: {
        fontSize: 12,
        color: '#666666'
    },
    tableHeaderRow: {
        flexDirection: 'row',
        backgroundColor: '#f3f4f6',
        borderBottom: '1px solid #e5e7eb',
        padding: 6,
        marginTop: 20,
        fontWeight: 'bold',
        fontSize: 9,
        textTransform: 'uppercase',
        color: '#4b5563'
    },
    tableRow: {
        flexDirection: 'row',
        borderBottom: '1px solid #f3f4f6',
        paddingVertical: 6,
        paddingHorizontal: 6,
        fontSize: 9
    },
    sectionRow: {
        flexDirection: 'row',
        backgroundColor: '#fff7ed', // Light Orange
        borderTop: '1px solid #ea580c',
        borderBottom: '1px solid #ea580c',
        paddingVertical: 8,
        paddingHorizontal: 6,
        marginTop: 10,
        marginBottom: 4
    },
    subsectionRow: {
        flexDirection: 'row',
        backgroundColor: '#fafaf9',
        borderBottom: '1px solid #d6d3d1',
        paddingVertical: 6,
        paddingHorizontal: 6,
        marginTop: 8,
        marginLeft: 10
    },
    colDesc: { flex: 4, paddingRight: 8 },
    colQty: { flex: 0.8, textAlign: 'center' },
    colUnit: { flex: 0.8, textAlign: 'center' },
    colPrice: { flex: 1.2, textAlign: 'right' },
    colTotal: { flex: 1.2, textAlign: 'right', fontWeight: 'bold' },
    summaryBox: {
        marginTop: 30,
        borderTop: '2px solid #ea580c',
        paddingTop: 10,
        flexDirection: 'column',
        alignItems: 'flex-end',
        gap: 6
    },
    summaryRow: {
        flexDirection: 'row',
        width: 250,
        justifyContent: 'space-between'
    },
    summaryLabel: {
        fontSize: 10,
        color: '#666666',
        textTransform: 'uppercase'
    },
    summaryValue: {
        fontSize: 11,
        fontWeight: 'bold'
    },
    grandTotalValue: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#ea580c'
    },
    footerText: {
        position: 'absolute',
        bottom: 30,
        left: 40,
        right: 40,
        fontSize: 8,
        color: '#999999',
        textAlign: 'center',
        borderTop: '1px solid #e5e7eb',
        paddingTop: 10
    }
});

interface QuotationPDFProps {
    blocks: Block[];
    quotationTitle: string;
    betreft: string;
    clientId: string;
    projectId: string;
    grandTotal: number;
    databaseStoreState: any; // Passed in to resolve variant relations statelessly
}

export const QuotationPDFTemplate = ({ blocks, quotationTitle, betreft, clientId, projectId, grandTotal, databaseStoreState }: QuotationPDFProps) => {

    // Helper to extract clean text from rich text HTML
    const stripHtml = (html: string | undefined) => {
        if (!html) return '';
        return html.replace(/<[^>]*>?/gm, '').trim();
    };

    // Recursive rendering of blocks
    const renderBlocks = (nodes: Block[], depth = 0): React.ReactNode[] => {
        let rows: React.ReactNode[] = [];

        nodes.forEach(block => {
            if (block.isOptional) return; // Skip optional lines in final PDF

            const isContainer = block.type === 'section' || block.type === 'subsection' || block.type === 'post';
            const cleanContent = stripHtml(block.content);

            // Compute block total identical to UI engine
            let blockTotal = 0;
            let variantDeltas = 0;

            if (isContainer) {
                // Containers don't have explicit totals printed on the single row in the simple format, but can be aggregated if needed.
            } else {
                if (block.children && block.children.length > 0) {
                    // Complex composite item
                } else {
                    // Extract phase 11 variant deltas
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
                    <View key={block.id} style={styles.sectionRow}>
                        <Text style={{ ...styles.colDesc, fontWeight: 'bold', color: '#ea580c', fontSize: 11 }}>{cleanContent.toUpperCase()}</Text>
                        <Text style={styles.colQty}></Text>
                        <Text style={styles.colUnit}></Text>
                        <Text style={styles.colPrice}></Text>
                        <Text style={styles.colTotal}></Text>
                    </View>
                );
            } else if (block.type === 'subsection' || block.type === 'post') {
                rows.push(
                    <View key={block.id} style={styles.subsectionRow}>
                        <Text style={{ ...styles.colDesc, fontWeight: 'bold' }}>{cleanContent}</Text>
                        <Text style={styles.colQty}></Text>
                        <Text style={styles.colUnit}></Text>
                        <Text style={styles.colPrice}></Text>
                        <Text style={styles.colTotal}></Text>
                    </View>
                );
            } else if (block.type === 'text') {
                // Freeform notes
                rows.push(
                    <View key={block.id} style={{ ...styles.tableRow, borderBottom: 'none', paddingLeft: depth * 10 + 6 }}>
                        <Text style={{ ...styles.colDesc, fontStyle: 'italic', color: '#666' }}>{cleanContent}</Text>
                        <Text style={styles.colQty}></Text>
                        <Text style={styles.colUnit}></Text>
                        <Text style={styles.colPrice}></Text>
                        <Text style={styles.colTotal}></Text>
                    </View>
                );
            } else {
                // Standard Line Item (Article / Line / Bestek)
                rows.push(
                    <View key={block.id} style={{ ...styles.tableRow, paddingLeft: depth > 0 ? depth * 10 + 6 : 6 }}>
                        <Text style={styles.colDesc}>{cleanContent}</Text>
                        <Text style={styles.colQty}>{block.quantity || 1}</Text>
                        <Text style={styles.colUnit}>{block.unit || 'stk'}</Text>
                        <Text style={styles.colPrice}>€{((block.verkoopPrice || 0) + variantDeltas).toFixed(2)}</Text>
                        <Text style={styles.colTotal}>€{blockTotal.toFixed(2)}</Text>
                    </View>
                );
            }

            if (block.children && block.children.length > 0) {
                rows = rows.concat(renderBlocks(block.children, depth + 1));
            }
        });

        return rows;
    };

    const taxAmount = grandTotal * 0.21; // Assuming 21% BTW for demo. Make dynamic later.
    const totalInclTax = grandTotal + taxAmount;

    return (
        <Document>
            <Page size="A4" style={styles.page}>
                {/* Header Phase */}
                <View style={styles.headerRow}>
                    <View style={styles.headerLeft}>
                        {/* Fake Logo Placeholder */}
                        <Text style={{ fontSize: 24, fontWeight: 'heavy', color: '#ea580c', marginBottom: 4 }}>CORAL REMODELING</Text>
                        <Text style={styles.subtitle}>123 Renovation Avenue</Text>
                        <Text style={styles.subtitle}>1000 Brussels, Belgium</Text>
                        <Text style={styles.subtitle}>BTW: BE 0123.456.789</Text>
                    </View>
                    <View style={styles.headerRight}>
                        <Text style={styles.title}>Quotation</Text>
                        <Text style={styles.subtitle}>Offer #{quotationTitle || 'DRAFT'}</Text>
                        <Text style={styles.subtitle}>Date: {new Date().toLocaleDateString('nl-BE')}</Text>
                    </View>
                </View>

                {/* Client & Project Phase */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 }}>
                    <View>
                        <Text style={{ fontSize: 10, fontWeight: 'bold', marginBottom: 4 }}>To:</Text>
                        <Text style={{ fontSize: 11 }}>{clientId ? `Client: ${clientId}` : 'Valued Client'}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                        <Text style={{ fontSize: 10, fontWeight: 'bold', marginBottom: 4 }}>Project / Betreft:</Text>
                        <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#ea580c' }}>{betreft || 'General Renovation'}</Text>
                    </View>
                </View>

                {/* Table Header Phase */}
                <View style={styles.tableHeaderRow}>
                    <Text style={styles.colDesc}>Description / Omschrijving</Text>
                    <Text style={styles.colQty}>Qte</Text>
                    <Text style={styles.colUnit}>Unit</Text>
                    <Text style={styles.colPrice}>Unit Price</Text>
                    <Text style={styles.colTotal}>Total (Excl)</Text>
                </View>

                {/* Main Content Phase */}
                {renderBlocks(blocks)}

                {/* Summary Box Phase */}
                <View style={{ alignItems: 'flex-end', width: '100%' }}>
                    <View style={styles.summaryBox}>
                        <View style={styles.summaryRow}>
                            <Text style={styles.summaryLabel}>Total (Excl. VAT):</Text>
                            <Text style={styles.summaryValue}>€{grandTotal.toFixed(2)}</Text>
                        </View>
                        <View style={styles.summaryRow}>
                            <Text style={styles.summaryLabel}>BTW / VAT (21%):</Text>
                            <Text style={styles.summaryValue}>€{taxAmount.toFixed(2)}</Text>
                        </View>
                        <View style={{ ...styles.summaryRow, marginTop: 4, paddingTop: 4, borderTop: '1px solid #e5e7eb' }}>
                            <Text style={{ ...styles.summaryLabel, color: '#000', fontWeight: 'bold' }}>Grand Total (Incl. VAT):</Text>
                            <Text style={styles.grandTotalValue}>€{totalInclTax.toFixed(2)}</Text>
                        </View>
                    </View>
                </View>

                {/* Footer Signature & Legal Phase */}
                <Text style={styles.footerText}>
                    Algemene voorwaarden: Offerte is 30 dagen geldig. De bovenstaande prijzen zijn exclusief onvoorziene werken tenzij anders vermeld.
                    Coral Remodeling | info@coralremodeling.be | +32 123 456 789
                </Text>
            </Page>
        </Document>
    );
};
