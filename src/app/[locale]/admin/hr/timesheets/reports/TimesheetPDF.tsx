import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
    page: {
        flexDirection: 'column',
        backgroundColor: '#FFFFFF',
        padding: 40,
        fontFamily: 'Helvetica'
    },
    header: {
        fontSize: 24,
        marginBottom: 20,
        fontWeight: 'bold'
    },
    metaSection: {
        marginBottom: 30,
        display: 'flex',
        flexDirection: 'row',
        justifyContent: 'space-between'
    },
    metaItem: {
        fontSize: 10,
        color: '#555555',
        marginBottom: 4
    },
    table: {
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        borderStyle: 'solid',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        marginBottom: 40
    },
    tableRow: {
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
        minHeight: 24,
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 4
    },
    tableHeader: {
        backgroundColor: '#F9FAFB',
        fontWeight: 'bold',
        fontSize: 10
    },
    col1: { width: '30%' },
    col2: { width: '20%' },
    col3: { width: '30%' },
    col4: { width: '20%', textAlign: 'right' },
    cellText: {
        fontSize: 9
    },
    signatureSection: {
        marginTop: 'auto',
        display: 'flex',
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingTop: 40
    },
    signatureBox: {
        width: 200,
        borderTopWidth: 1,
        borderTopColor: '#000000',
        paddingTop: 8
    },
    signatureText: {
        fontSize: 10,
        textAlign: 'center'
    }
});

interface TimesheetPDFProps {
    reportData: any;
    dateRangeLabel: string;
}

export const TimesheetPDF = ({ reportData, dateRangeLabel }: TimesheetPDFProps) => {
    return (
        <Document>
            <Page size="A4" style={styles.page}>
                <Text style={styles.header}>Werkbon / Prestatiestaat</Text>
                
                <View style={styles.metaSection}>
                    <View>
                        <Text style={styles.metaItem}>Periode: {dateRangeLabel}</Text>
                        <Text style={styles.metaItem}>Totaal Uren: {(reportData.summary.totalHours).toFixed(2)}</Text>
                        <Text style={styles.metaItem}>Factureerbaar: {(reportData.summary.billableHours).toFixed(2)}</Text>
                    </View>
                    <View>
                        <Text style={styles.metaItem}>Datum gegenereerd: {new Date().toLocaleDateString('nl-BE')}</Text>
                    </View>
                </View>

                <View style={styles.table}>
                    <View style={[styles.tableRow, styles.tableHeader]}>
                        <Text style={[styles.cellText, styles.col1]}>Medewerker</Text>
                        <Text style={[styles.cellText, styles.col2]}>Datum</Text>
                        <Text style={[styles.cellText, styles.col3]}>Project</Text>
                        <Text style={[styles.cellText, styles.col4]}>Uren</Text>
                    </View>
                    
                    {reportData.entries.map((entry: any) => {
                        const duration = (new Date(entry.clockOutTime).getTime() - new Date(entry.clockInTime).getTime()) / 3600000;
                        return (
                            <View key={entry.id} style={styles.tableRow}>
                                <Text style={[styles.cellText, styles.col1]}>{entry.userName || 'Onbekend'}</Text>
                                <Text style={[styles.cellText, styles.col2]}>{new Date(entry.clockInTime).toLocaleDateString('nl-BE')}</Text>
                                <Text style={[styles.cellText, styles.col3]}>{entry.projectId || 'Geen project'}</Text>
                                <Text style={[styles.cellText, styles.col4]}>{duration.toFixed(2)}u</Text>
                            </View>
                        );
                    })}
                </View>

                <View style={styles.signatureSection}>
                    <View style={styles.signatureBox}>
                        <Text style={styles.signatureText}>Handtekening Medewerker</Text>
                    </View>
                    <View style={styles.signatureBox}>
                        <Text style={styles.signatureText}>Handtekening Klant / Manager</Text>
                    </View>
                </View>
            </Page>
        </Document>
    );
};
