/**
 * Template Styles — 4 distinct PDF themes for documents.
 * 
 * t1: Classic — Standard left-logo, right-address, orange accents
 * t2: Minimalist — Clean whitespace, thin lines, monochrome with subtle accent
 * t3: Bold Corporate — Full-width accent header band, dark table headers
 * t4: Elegant — Centered header, serif-like typography, ornamental dividers
 */

export type TemplateId = 't1' | 't2' | 't3' | 't4';

const ACCENT = '#ea580c'; // Default accent — overridden by brandColor

export function getTemplateStyles(templateId: TemplateId, brandColor?: string) {
    const accent = brandColor || ACCENT;
    const accentLight = accent + '1a'; // ~10% opacity hex

    switch (templateId) {
        case 't2': return minimalistStyles(accent);
        case 't3': return boldCorporateStyles(accent);
        case 't4': return elegantStyles(accent);
        default:   return classicStyles(accent);
    }
}

// ─── T1: Classic ────────────────────────────────────────────
function classicStyles(accent: string) {
    return {
        page: { padding: 40, backgroundColor: '#ffffff', fontFamily: 'Helvetica', fontSize: 10, color: '#1a1a1a' },
        headerRow: { flexDirection: 'row' as const, justifyContent: 'space-between' as const, alignItems: 'center' as const, marginBottom: 30, borderBottom: `2px solid ${accent}`, paddingBottom: 20 },
        headerLeft: { flexDirection: 'column' as const, gap: 4 },
        headerRight: { flexDirection: 'column' as const, alignItems: 'flex-end' as const, gap: 4 },
        logo: { width: 120, marginBottom: 8 },
        title: { fontSize: 24, fontWeight: 'bold' as const, color: '#000000', textTransform: 'uppercase' as const, letterSpacing: 1 },
        subtitle: { fontSize: 12, color: '#666666' },
        tableHeaderRow: { flexDirection: 'row' as const, backgroundColor: '#f3f4f6', borderBottom: '1px solid #e5e7eb', padding: 6, marginTop: 20, fontWeight: 'bold' as const, fontSize: 9, textTransform: 'uppercase' as const, color: '#4b5563' },
        tableRow: { flexDirection: 'row' as const, borderBottom: '1px solid #f3f4f6', paddingVertical: 6, paddingHorizontal: 6, fontSize: 9 },
        sectionRow: { flexDirection: 'row' as const, backgroundColor: '#fff7ed', borderTop: `1px solid ${accent}`, borderBottom: `1px solid ${accent}`, paddingVertical: 8, paddingHorizontal: 6, marginTop: 10, marginBottom: 4 },
        sectionText: { fontWeight: 'bold' as const, color: accent, fontSize: 11 },
        subsectionRow: { flexDirection: 'row' as const, backgroundColor: '#fafaf9', borderBottom: '1px solid #d6d3d1', paddingVertical: 6, paddingHorizontal: 6, marginTop: 8, marginLeft: 10 },
        summaryBox: { marginTop: 30, borderTop: `2px solid ${accent}`, paddingTop: 10, flexDirection: 'column' as const, alignItems: 'flex-end' as const, gap: 6 },
        summaryRow: { flexDirection: 'row' as const, width: 250, justifyContent: 'space-between' as const },
        summaryLabel: { fontSize: 10, color: '#666666', textTransform: 'uppercase' as const },
        summaryValue: { fontSize: 11, fontWeight: 'bold' as const },
        grandTotalValue: { fontSize: 16, fontWeight: 'bold' as const, color: accent },
        footerText: { position: 'absolute' as const, bottom: 30, left: 40, right: 40, fontSize: 8, color: '#999999', textAlign: 'center' as const, borderTop: '1px solid #e5e7eb', paddingTop: 10 },
        accentColor: accent,
        clientLabel: { fontSize: 10, fontWeight: 'bold' as const, marginBottom: 4 },
        betreftLabel: { fontSize: 12, fontWeight: 'bold' as const, color: accent },
        companyFallback: { fontSize: 24, fontWeight: 'heavy' as const, color: accent, marginBottom: 4 },
    };
}

// ─── T2: Minimalist ─────────────────────────────────────────
function minimalistStyles(accent: string) {
    return {
        page: { padding: 50, backgroundColor: '#ffffff', fontFamily: 'Helvetica', fontSize: 9.5, color: '#333333' },
        headerRow: { flexDirection: 'row' as const, justifyContent: 'space-between' as const, alignItems: 'flex-start' as const, marginBottom: 40, borderBottom: '0.5px solid #d4d4d4', paddingBottom: 24 },
        headerLeft: { flexDirection: 'column' as const, gap: 3 },
        headerRight: { flexDirection: 'column' as const, alignItems: 'flex-end' as const, gap: 3 },
        logo: { width: 80, marginBottom: 10 },
        title: { fontSize: 18, fontWeight: 'bold' as const, color: '#1a1a1a', letterSpacing: 3, textTransform: 'uppercase' as const },
        subtitle: { fontSize: 10, color: '#888888' },
        tableHeaderRow: { flexDirection: 'row' as const, borderBottom: '0.5px solid #999', padding: 5, marginTop: 24, fontWeight: 'bold' as const, fontSize: 8, textTransform: 'uppercase' as const, color: '#888888', letterSpacing: 1 },
        tableRow: { flexDirection: 'row' as const, borderBottom: '0.5px solid #eeeeee', paddingVertical: 5, paddingHorizontal: 5, fontSize: 9 },
        sectionRow: { flexDirection: 'row' as const, borderBottom: '0.5px solid #999', paddingVertical: 6, paddingHorizontal: 5, marginTop: 14, marginBottom: 4 },
        sectionText: { fontWeight: 'bold' as const, color: '#1a1a1a', fontSize: 10, letterSpacing: 1, textTransform: 'uppercase' as const },
        subsectionRow: { flexDirection: 'row' as const, borderBottom: '0.5px solid #ddd', paddingVertical: 5, paddingHorizontal: 5, marginTop: 6, marginLeft: 8 },
        summaryBox: { marginTop: 36, borderTop: '0.5px solid #999', paddingTop: 12, flexDirection: 'column' as const, alignItems: 'flex-end' as const, gap: 5 },
        summaryRow: { flexDirection: 'row' as const, width: 220, justifyContent: 'space-between' as const },
        summaryLabel: { fontSize: 9, color: '#888888', textTransform: 'uppercase' as const, letterSpacing: 0.5 },
        summaryValue: { fontSize: 10, fontWeight: 'bold' as const },
        grandTotalValue: { fontSize: 14, fontWeight: 'bold' as const, color: '#1a1a1a' },
        footerText: { position: 'absolute' as const, bottom: 30, left: 50, right: 50, fontSize: 7, color: '#bbbbbb', textAlign: 'center' as const, borderTop: '0.5px solid #ddd', paddingTop: 8 },
        accentColor: accent,
        clientLabel: { fontSize: 9, fontWeight: 'bold' as const, marginBottom: 3, color: '#888', textTransform: 'uppercase' as const, letterSpacing: 1 },
        betreftLabel: { fontSize: 11, fontWeight: 'bold' as const, color: '#1a1a1a' },
        companyFallback: { fontSize: 18, fontWeight: 'bold' as const, color: '#1a1a1a', marginBottom: 4, letterSpacing: 3 },
    };
}

// ─── T3: Bold Corporate ─────────────────────────────────────
function boldCorporateStyles(accent: string) {
    return {
        page: { padding: 0, backgroundColor: '#ffffff', fontFamily: 'Helvetica', fontSize: 10, color: '#1a1a1a' },
        headerRow: { flexDirection: 'row' as const, justifyContent: 'space-between' as const, alignItems: 'center' as const, marginBottom: 0, backgroundColor: accent, padding: 24, paddingBottom: 24 },
        headerLeft: { flexDirection: 'column' as const, gap: 3 },
        headerRight: { flexDirection: 'column' as const, alignItems: 'flex-end' as const, gap: 3 },
        logo: { width: 100, marginBottom: 6 },
        title: { fontSize: 28, fontWeight: 'bold' as const, color: '#ffffff', textTransform: 'uppercase' as const, letterSpacing: 2 },
        subtitle: { fontSize: 11, color: 'rgba(255,255,255,0.8)' },
        tableHeaderRow: { flexDirection: 'row' as const, backgroundColor: '#1a1a1a', padding: 8, marginTop: 12, marginHorizontal: 24, fontWeight: 'bold' as const, fontSize: 8.5, textTransform: 'uppercase' as const, color: '#ffffff', letterSpacing: 0.5 },
        tableRow: { flexDirection: 'row' as const, borderBottom: '1px solid #f0f0f0', paddingVertical: 6, paddingHorizontal: 8, fontSize: 9, marginHorizontal: 24 },
        sectionRow: { flexDirection: 'row' as const, backgroundColor: accent, paddingVertical: 6, paddingHorizontal: 8, marginTop: 10, marginHorizontal: 24, marginBottom: 2 },
        sectionText: { fontWeight: 'bold' as const, color: '#ffffff', fontSize: 10, textTransform: 'uppercase' as const, letterSpacing: 1 },
        subsectionRow: { flexDirection: 'row' as const, backgroundColor: '#f5f5f5', borderLeft: `3px solid ${accent}`, paddingVertical: 5, paddingHorizontal: 8, marginTop: 6, marginHorizontal: 24, marginLeft: 34 },
        summaryBox: { marginTop: 24, backgroundColor: '#fafafa', padding: 16, marginHorizontal: 24, borderTop: `4px solid ${accent}`, flexDirection: 'column' as const, alignItems: 'flex-end' as const, gap: 6 },
        summaryRow: { flexDirection: 'row' as const, width: 260, justifyContent: 'space-between' as const },
        summaryLabel: { fontSize: 10, color: '#555555', textTransform: 'uppercase' as const, fontWeight: 'bold' as const },
        summaryValue: { fontSize: 11, fontWeight: 'bold' as const },
        grandTotalValue: { fontSize: 18, fontWeight: 'bold' as const, color: accent },
        footerText: { position: 'absolute' as const, bottom: 0, left: 0, right: 0, fontSize: 7.5, color: '#ffffff', textAlign: 'center' as const, backgroundColor: '#1a1a1a', padding: 12 },
        accentColor: accent,
        clientLabel: { fontSize: 10, fontWeight: 'bold' as const, marginBottom: 4, color: '#555', textTransform: 'uppercase' as const },
        betreftLabel: { fontSize: 13, fontWeight: 'bold' as const, color: accent },
        companyFallback: { fontSize: 28, fontWeight: 'bold' as const, color: '#ffffff', marginBottom: 2, letterSpacing: 2 },
        // Extra: client/project section needs padding
        clientSection: { flexDirection: 'row' as const, justifyContent: 'space-between' as const, marginBottom: 12, paddingHorizontal: 24, paddingTop: 20 },
    };
}

// ─── T4: Elegant ────────────────────────────────────────────
function elegantStyles(accent: string) {
    return {
        page: { padding: 48, backgroundColor: '#ffffff', fontFamily: 'Times-Roman', fontSize: 10, color: '#2a2a2a' },
        headerRow: { flexDirection: 'column' as const, alignItems: 'center' as const, marginBottom: 30, paddingBottom: 20 },
        headerLeft: { flexDirection: 'column' as const, alignItems: 'center' as const, gap: 3, marginBottom: 8 },
        headerRight: { flexDirection: 'column' as const, alignItems: 'center' as const, gap: 3 },
        logo: { width: 90, marginBottom: 10 },
        title: { fontSize: 22, fontWeight: 'bold' as const, color: accent, letterSpacing: 4, textTransform: 'uppercase' as const },
        subtitle: { fontSize: 11, color: '#777777', fontStyle: 'italic' as const },
        // Ornamental center divider
        divider: { width: 60, height: 1, backgroundColor: accent, marginVertical: 10, alignSelf: 'center' as const },
        tableHeaderRow: { flexDirection: 'row' as const, borderBottom: `1.5px solid ${accent}`, borderTop: `0.5px solid #ddd`, padding: 6, marginTop: 20, fontWeight: 'bold' as const, fontSize: 9, color: accent, textTransform: 'uppercase' as const, letterSpacing: 0.5 },
        tableRow: { flexDirection: 'row' as const, borderBottom: '0.5px solid #eee', paddingVertical: 6, paddingHorizontal: 6, fontSize: 9.5 },
        sectionRow: { flexDirection: 'row' as const, borderTop: `0.5px solid ${accent}`, borderBottom: `0.5px solid ${accent}`, paddingVertical: 7, paddingHorizontal: 6, marginTop: 12, marginBottom: 4, backgroundColor: '#fefcfa' },
        sectionText: { fontWeight: 'bold' as const, color: accent, fontSize: 11, fontStyle: 'italic' as const },
        subsectionRow: { flexDirection: 'row' as const, borderBottom: '0.5px solid #e8e8e8', paddingVertical: 5, paddingHorizontal: 6, marginTop: 6, marginLeft: 12 },
        summaryBox: { marginTop: 30, borderTop: `1.5px solid ${accent}`, paddingTop: 12, flexDirection: 'column' as const, alignItems: 'flex-end' as const, gap: 5 },
        summaryRow: { flexDirection: 'row' as const, width: 240, justifyContent: 'space-between' as const },
        summaryLabel: { fontSize: 10, color: '#777777', fontStyle: 'italic' as const },
        summaryValue: { fontSize: 11, fontWeight: 'bold' as const },
        grandTotalValue: { fontSize: 16, fontWeight: 'bold' as const, color: accent },
        footerText: { position: 'absolute' as const, bottom: 30, left: 48, right: 48, fontSize: 8, color: '#aaaaaa', textAlign: 'center' as const, borderTop: `0.5px solid ${accent}`, paddingTop: 10, fontStyle: 'italic' as const },
        accentColor: accent,
        clientLabel: { fontSize: 10, fontWeight: 'bold' as const, marginBottom: 4, fontStyle: 'italic' as const, color: '#777' },
        betreftLabel: { fontSize: 12, fontWeight: 'bold' as const, color: accent, fontStyle: 'italic' as const },
        companyFallback: { fontSize: 22, fontWeight: 'bold' as const, color: accent, marginBottom: 4, letterSpacing: 4 },
    };
}
