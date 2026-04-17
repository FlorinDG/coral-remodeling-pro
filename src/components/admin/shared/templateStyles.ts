/**
 * Template Styles — 4 distinct PDF themes.
 *
 * t1: BLOCK  — High-contrast black/white impact (Happy Tooth ref)
 * t2: MIST   — Soft sage background, brand-color accents (Valley Farms ref)
 * t3: NAVY   — Classic corporate dark-navy bands (First Up ref)
 * t4: PRISM  — Geometric diagonal SVG header (blueprint ref)
 */

export type TemplateId = 't1' | 't2' | 't3' | 't4';

const ACCENT = '#ea580c';

export function getTemplateStyles(templateId: TemplateId, brandColor?: string) {
    const accent = brandColor || ACCENT;
    switch (templateId) {
        case 't2': return mistStyles(accent);
        case 't3': return navyStyles(accent);
        case 't4': return prismStyles(accent);
        default:   return blockStyles(accent);
    }
}

// ─── T1: BLOCK — Black/White Impact ─────────────────────────────────────────
function blockStyles(accent: string) {
    return {
        // page has no padding — header blocks bleed to edges
        page: { padding: 0, backgroundColor: '#ffffff', fontFamily: 'Helvetica', fontSize: 10, color: '#111111' },
        // headerRow rendered custom in template (isT1 branch)
        headerRow: { flexDirection: 'row' as const, alignItems: 'stretch' as const, marginBottom: 0 },
        headerLeft:  { flexDirection: 'column' as const, justifyContent: 'flex-end' as const, backgroundColor: '#111111', padding: 28, flex: 0.55 },
        headerRight: { flexDirection: 'column' as const, alignItems: 'flex-end' as const, justifyContent: 'flex-end' as const, padding: 28, flex: 0.45 },
        logo:             { width: 110, marginBottom: 8 },
        title:            { fontSize: 20, fontWeight: 'bold' as const, color: '#111111', textTransform: 'uppercase' as const, letterSpacing: 1 },
        subtitle:         { fontSize: 9, color: '#555555' },
        companyInfoText:  { fontSize: 8.5, color: '#aaaaaa' },
        companyFallback:  { fontSize: 22, fontWeight: 'bold' as const, color: '#ffffff', textTransform: 'uppercase' as const, letterSpacing: 1, marginBottom: 8 },
        clientLabel:      { fontSize: 8, fontWeight: 'bold' as const, color: '#999999', textTransform: 'uppercase' as const, letterSpacing: 1, marginBottom: 3 },
        betreftLabel:     { fontSize: 12, fontWeight: 'bold' as const, color: '#111111' },
        clientSection:    { flexDirection: 'row' as const, justifyContent: 'space-between' as const, marginBottom: 0, paddingHorizontal: 28, paddingTop: 22, paddingBottom: 18, borderBottom: '0.5px solid #e0e0e0' },
        tableHeaderRow:   { flexDirection: 'row' as const, borderTop: '1px solid #111111', borderBottom: '1px solid #111111', paddingVertical: 7, paddingHorizontal: 28, fontWeight: 'bold' as const, fontSize: 8, textTransform: 'uppercase' as const, color: '#111111', letterSpacing: 0.5 },
        tableRow:         { flexDirection: 'row' as const, borderBottom: '0.5px solid #e0e0e0', paddingVertical: 6, paddingHorizontal: 28, fontSize: 9 },
        sectionRow:       { flexDirection: 'row' as const, backgroundColor: '#f5f5f5', borderTop: '0.5px solid #bbb', borderBottom: '0.5px solid #bbb', paddingVertical: 7, paddingHorizontal: 28, marginTop: 10, marginBottom: 2 },
        sectionText:      { fontWeight: 'bold' as const, color: '#111111', fontSize: 10, textTransform: 'uppercase' as const },
        subsectionRow:    { flexDirection: 'row' as const, borderBottom: '0.5px solid #e8e8e8', paddingVertical: 5, paddingHorizontal: 28 },
        summaryBox:       { marginTop: 24, paddingHorizontal: 28, flexDirection: 'column' as const, alignItems: 'flex-end' as const, gap: 5 },
        summaryRow:       { flexDirection: 'row' as const, width: 250, justifyContent: 'space-between' as const },
        summaryLabel:     { fontSize: 8.5, color: '#777777', textTransform: 'uppercase' as const, letterSpacing: 0.5 },
        summaryValue:     { fontSize: 10, fontWeight: 'bold' as const },
        grandTotalValue:  { fontSize: 17, fontWeight: 'bold' as const, color: '#111111' },
        footerText:       { position: 'absolute' as const, bottom: 0, left: 0, right: 0, fontSize: 8, color: '#777777', textAlign: 'center' as const, backgroundColor: '#f2f2f2', borderTop: '0.5px solid #ddd', paddingVertical: 11, paddingHorizontal: 28 },
        accentColor: accent,
    };
}

// ─── T2: MIST — Sage Soft ───────────────────────────────────────────────────
function mistStyles(accent: string) {
    return {
        page: { padding: 0, backgroundColor: '#eef2f0', fontFamily: 'Helvetica', fontSize: 10, color: '#2c3a34' },
        headerRow: { flexDirection: 'row' as const, justifyContent: 'space-between' as const, alignItems: 'center' as const, padding: 32, paddingBottom: 24, backgroundColor: '#eef2f0' },
        headerLeft:  { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 14 },
        headerRight: { flexDirection: 'column' as const, alignItems: 'flex-end' as const, gap: 3 },
        logo:            { width: 48, height: 48, borderRadius: 6 },
        title:           { fontSize: 28, fontWeight: 'bold' as const, color: accent },
        subtitle:        { fontSize: 9, color: '#6b8c7a' },
        companyInfoText: { fontSize: 9, color: '#6b8c7a' },
        companyFallback: { fontSize: 18, fontWeight: 'bold' as const, color: '#2c3a34', marginBottom: 2 },
        clientLabel:     { fontSize: 8, fontWeight: 'bold' as const, color: '#7aaa8e', textTransform: 'uppercase' as const, letterSpacing: 1, marginBottom: 3 },
        betreftLabel:    { fontSize: 12, fontWeight: 'bold' as const, color: accent },
        clientSection:   { flexDirection: 'row' as const, justifyContent: 'space-between' as const, backgroundColor: '#e4ece7', marginBottom: 0, padding: 24 },
        tableHeaderRow:  { flexDirection: 'row' as const, backgroundColor: accent, paddingVertical: 8, paddingHorizontal: 32, fontWeight: 'bold' as const, fontSize: 8.5, textTransform: 'uppercase' as const, color: '#ffffff', letterSpacing: 0.3 },
        tableRow:        { flexDirection: 'row' as const, backgroundColor: '#ffffff', borderBottom: '1px solid #dde8e2', paddingVertical: 7, paddingHorizontal: 32, fontSize: 9 },
        sectionRow:      { flexDirection: 'row' as const, backgroundColor: accent + '1a', borderLeft: `3px solid ${accent}`, paddingVertical: 7, paddingHorizontal: 32, marginTop: 0, marginBottom: 0 },
        sectionText:     { fontWeight: 'bold' as const, color: accent, fontSize: 10 },
        subsectionRow:   { flexDirection: 'row' as const, backgroundColor: '#f4f8f5', paddingVertical: 6, paddingHorizontal: 32, borderBottom: '0.5px solid #dde8e2' },
        summaryBox:      { marginTop: 20, paddingHorizontal: 32, flexDirection: 'column' as const, alignItems: 'flex-end' as const, gap: 5 },
        summaryRow:      { flexDirection: 'row' as const, width: 240, justifyContent: 'space-between' as const },
        summaryLabel:    { fontSize: 8.5, color: '#6b8c7a', textTransform: 'uppercase' as const, letterSpacing: 0.5 },
        summaryValue:    { fontSize: 10, fontWeight: 'bold' as const },
        grandTotalValue: { fontSize: 16, fontWeight: 'bold' as const, color: accent },
        footerText:      { position: 'absolute' as const, bottom: 0, left: 0, right: 0, fontSize: 8, color: '#7aaa8e', textAlign: 'center' as const, backgroundColor: '#dce8e2', paddingVertical: 12 },
        accentColor: accent,
    };
}

// ─── T3: NAVY — Classic Corporate ───────────────────────────────────────────
function navyStyles(accent: string) {
    const navy = '#1a3a5c';
    const navyMid = '#245076';
    return {
        page: { padding: 40, backgroundColor: '#ffffff', fontFamily: 'Helvetica', fontSize: 10, color: '#111111' },
        headerRow:   { flexDirection: 'row' as const, justifyContent: 'space-between' as const, alignItems: 'flex-start' as const, marginBottom: 20 },
        headerLeft:  { flexDirection: 'column' as const, gap: 2, flex: 0.6 },
        headerRight: { flexDirection: 'column' as const, alignItems: 'flex-end' as const, flex: 0.4 },
        logo:            { width: 100, marginBottom: 6 },
        title:           { fontSize: 38, fontWeight: 'bold' as const, color: '#111111', textTransform: 'uppercase' as const },
        subtitle:        { fontSize: 9, color: '#666666' },
        companyInfoText: { fontSize: 8.5, color: '#555555' },
        companyFallback: { fontSize: 15, fontWeight: 'bold' as const, color: navy, marginBottom: 4 },
        clientLabel:     { fontSize: 8, fontWeight: 'bold' as const, color: '#ffffff', textTransform: 'uppercase' as const, letterSpacing: 0.5 },
        betreftLabel:    { fontSize: 12, fontWeight: 'bold' as const, color: navy },
        clientSection:   { flexDirection: 'row' as const, justifyContent: 'space-between' as const, marginBottom: 16, backgroundColor: navyMid, padding: 10 },
        tableHeaderRow:  { flexDirection: 'row' as const, backgroundColor: navy, paddingVertical: 7, paddingHorizontal: 8, fontWeight: 'bold' as const, fontSize: 8.5, textTransform: 'uppercase' as const, color: '#ffffff', letterSpacing: 0.3, marginTop: 0 },
        tableRow:        { flexDirection: 'row' as const, borderBottom: '1px solid #eaeff4', paddingVertical: 6, paddingHorizontal: 8, fontSize: 9 },
        sectionRow:      { flexDirection: 'row' as const, backgroundColor: '#eaf0f7', borderLeft: `4px solid ${navy}`, paddingVertical: 7, paddingHorizontal: 8, marginTop: 10, marginBottom: 2 },
        sectionText:     { fontWeight: 'bold' as const, color: navy, fontSize: 10, textTransform: 'uppercase' as const },
        subsectionRow:   { flexDirection: 'row' as const, backgroundColor: '#f5f8fc', borderBottom: '1px solid #e4ecf4', paddingVertical: 5, paddingHorizontal: 8, marginLeft: 12 },
        summaryBox:      { marginTop: 16, flexDirection: 'column' as const, alignItems: 'flex-end' as const, gap: 4 },
        summaryRow:      { flexDirection: 'row' as const, width: 265, justifyContent: 'space-between' as const },
        summaryLabel:    { fontSize: 9, color: '#666666', textTransform: 'uppercase' as const, fontWeight: 'bold' as const },
        summaryValue:    { fontSize: 10, fontWeight: 'bold' as const },
        grandTotalValue: { fontSize: 16, fontWeight: 'bold' as const, color: '#ffffff' },
        footerText:      { position: 'absolute' as const, bottom: 30, left: 40, right: 40, fontSize: 8, color: '#999999', textAlign: 'center' as const, borderTop: '1px solid #e0e0e0', paddingTop: 8 },
        accentColor: accent,
        // Extra keys used in template navy-specific rendering
        navyColor:   navy,
        navyMid:     navyMid,
    };
}

// ─── T4: PRISM — Geometric Diagonal ─────────────────────────────────────────
function prismStyles(accent: string) {
    const navy = '#1c2e4a';
    const navyMid = '#26405e';
    return {
        page: { padding: 0, backgroundColor: '#ffffff', fontFamily: 'Helvetica', fontSize: 10, color: '#222222' },
        headerRow:   { flexDirection: 'row' as const, alignItems: 'center' as const },
        headerLeft:  { flexDirection: 'column' as const, gap: 3 },
        headerRight: { flexDirection: 'column' as const, alignItems: 'flex-end' as const, gap: 3 },
        logo:            { width: 70, marginBottom: 6 },
        title:           { fontSize: 26, fontWeight: 'bold' as const, color: navy, textTransform: 'uppercase' as const, letterSpacing: 2 },
        subtitle:        { fontSize: 9, color: '#666666' },
        companyInfoText: { fontSize: 8, color: 'rgba(255,255,255,0.7)' },
        companyFallback: { fontSize: 20, fontWeight: 'bold' as const, color: '#ffffff', letterSpacing: 0.5 },
        clientLabel:     { fontSize: 8, fontWeight: 'bold' as const, color: '#888888', textTransform: 'uppercase' as const, letterSpacing: 1, marginBottom: 3 },
        betreftLabel:    { fontSize: 12, fontWeight: 'bold' as const, color: navy },
        clientSection:   { flexDirection: 'row' as const, justifyContent: 'space-between' as const, paddingHorizontal: 32, marginBottom: 14, paddingTop: 10 },
        tableHeaderRow:  { flexDirection: 'row' as const, backgroundColor: navy, paddingVertical: 8, paddingHorizontal: 32, fontWeight: 'bold' as const, fontSize: 8.5, textTransform: 'uppercase' as const, color: '#ffffff', letterSpacing: 0.3 },
        tableRow:        { flexDirection: 'row' as const, borderBottom: '0.5px solid #eeeeee', paddingVertical: 6, paddingHorizontal: 32, fontSize: 9 },
        sectionRow:      { flexDirection: 'row' as const, backgroundColor: navy + '12', borderLeft: `3px solid ${navy}`, paddingVertical: 7, paddingHorizontal: 32, marginTop: 8, marginBottom: 0 },
        sectionText:     { fontWeight: 'bold' as const, color: navy, fontSize: 10, textTransform: 'uppercase' as const },
        subsectionRow:   { flexDirection: 'row' as const, borderBottom: '0.5px solid #e8e8e8', paddingVertical: 5, paddingHorizontal: 32, marginLeft: 12 },
        summaryBox:      { marginTop: 20, paddingHorizontal: 32, flexDirection: 'column' as const, alignItems: 'flex-end' as const, gap: 5 },
        summaryRow:      { flexDirection: 'row' as const, width: 250, justifyContent: 'space-between' as const },
        summaryLabel:    { fontSize: 8.5, color: '#666666', textTransform: 'uppercase' as const, letterSpacing: 0.5 },
        summaryValue:    { fontSize: 10, fontWeight: 'bold' as const },
        grandTotalValue: { fontSize: 16, fontWeight: 'bold' as const, color: navy },
        footerText:      { position: 'absolute' as const, bottom: 0, left: 0, right: 0, fontSize: 8, color: '#ffffff', textAlign: 'center' as const, backgroundColor: navy, paddingVertical: 12 },
        accentColor: accent,
        navyColor:  navy,
        navyMid:    navyMid,
    };
}
