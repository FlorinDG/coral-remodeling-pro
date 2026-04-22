/**
 * Template Styles — 4 distinct PDF themes.
 *
 * All templates derive colors from the tenant's brand color:
 * t1: BLOCK  — High-contrast dark/white impact
 * t2: MIST   — Soft tinted background, brand-color accents
 * t3: NAVY   — Classic corporate dark bands
 * t4: PRISM  — Geometric diagonal header
 *
 * Every template is monochrome — all shades derived from a single brand color.
 */

export type TemplateId = 't1' | 't2' | 't3' | 't4';

const DEFAULT_ACCENT = '#ea580c';

// ── Color utilities ─────────────────────────────────────────────────────────
function hexToRgb(hex: string): [number, number, number] {
    const h = hex.replace('#', '');
    return [
        parseInt(h.substring(0, 2), 16),
        parseInt(h.substring(2, 4), 16),
        parseInt(h.substring(4, 6), 16),
    ];
}

function rgbToHex(r: number, g: number, b: number): string {
    return '#' + [r, g, b].map(c => Math.round(c).toString(16).padStart(2, '0')).join('');
}

/** Mix color with black (amount 0–1, 1 = fully black) */
function darken(hex: string, amount: number): string {
    const [r, g, b] = hexToRgb(hex);
    return rgbToHex(r * (1 - amount), g * (1 - amount), b * (1 - amount));
}

/** Mix color with white (amount 0–1, 1 = fully white) */
function lighten(hex: string, amount: number): string {
    const [r, g, b] = hexToRgb(hex);
    return rgbToHex(r + (255 - r) * amount, g + (255 - g) * amount, b + (255 - b) * amount);
}

/** Brand color with hex opacity suffix */
function withAlpha(hex: string, alpha: string): string {
    return hex + alpha;
}

export function getTemplateStyles(templateId: TemplateId, brandColor?: string) {
    const accent = brandColor || DEFAULT_ACCENT;
    switch (templateId) {
        case 't2': return mistStyles(accent);
        case 't3': return navyStyles(accent);
        case 't4': return prismStyles(accent);
        default:   return blockStyles(accent);
    }
}

// ─── T1: BLOCK — Dark/White Impact ──────────────────────────────────────────
function blockStyles(accent: string) {
    const dark = darken(accent, 0.65);       // deep brand for header block
    const darkMid = darken(accent, 0.50);    // slightly lighter for info text
    return {
        page: { padding: 0, backgroundColor: '#ffffff', fontFamily: 'Helvetica', fontSize: 10, color: '#111111' },
        headerRow: { flexDirection: 'row' as const, alignItems: 'stretch' as const, marginBottom: 0 },
        headerLeft:  { flexDirection: 'column' as const, justifyContent: 'flex-end' as const, backgroundColor: dark, padding: 28, flex: 0.55 },
        headerRight: { flexDirection: 'column' as const, alignItems: 'flex-end' as const, justifyContent: 'flex-end' as const, padding: 28, flex: 0.45 },
        logo:             { width: 110, marginBottom: 8 },
        title:            { fontSize: 20, fontWeight: 'bold' as const, color: dark, textTransform: 'uppercase' as const, letterSpacing: 1 },
        subtitle:         { fontSize: 9, color: '#555555' },
        companyInfoText:  { fontSize: 8.5, color: lighten(accent, 0.65) },
        companyFallback:  { fontSize: 22, fontWeight: 'bold' as const, color: '#ffffff', textTransform: 'uppercase' as const, letterSpacing: 1, marginBottom: 8 },
        clientLabel:      { fontSize: 8, fontWeight: 'bold' as const, color: '#999999', textTransform: 'uppercase' as const, letterSpacing: 1, marginBottom: 3 },
        betreftLabel:     { fontSize: 12, fontWeight: 'bold' as const, color: dark },
        clientSection:    { flexDirection: 'row' as const, justifyContent: 'space-between' as const, marginBottom: 0, paddingHorizontal: 28, paddingTop: 22, paddingBottom: 18, borderBottom: `0.5px solid ${lighten(accent, 0.75)}` },
        tableHeaderRow:   { flexDirection: 'row' as const, borderTop: `1px solid ${dark}`, borderBottom: `1px solid ${dark}`, paddingVertical: 7, paddingHorizontal: 28, fontWeight: 'bold' as const, fontSize: 8, textTransform: 'uppercase' as const, color: dark, letterSpacing: 0.5 },
        tableRow:         { flexDirection: 'row' as const, borderBottom: `0.5px solid ${lighten(accent, 0.80)}`, paddingVertical: 6, paddingHorizontal: 28, fontSize: 9 },
        sectionRow:       { flexDirection: 'row' as const, backgroundColor: lighten(accent, 0.92), borderTop: `0.5px solid ${lighten(accent, 0.60)}`, borderBottom: `0.5px solid ${lighten(accent, 0.60)}`, paddingVertical: 7, paddingHorizontal: 28, marginTop: 10, marginBottom: 2 },
        sectionText:      { fontWeight: 'bold' as const, color: dark, fontSize: 10, textTransform: 'uppercase' as const },
        subsectionRow:    { flexDirection: 'row' as const, borderBottom: `0.5px solid ${lighten(accent, 0.85)}`, paddingVertical: 5, paddingHorizontal: 28 },
        summaryBox:       { marginTop: 24, paddingHorizontal: 28, flexDirection: 'column' as const, alignItems: 'flex-end' as const, gap: 5 },
        summaryRow:       { flexDirection: 'row' as const, width: 250, justifyContent: 'space-between' as const },
        summaryLabel:     { fontSize: 8.5, color: '#777777', textTransform: 'uppercase' as const, letterSpacing: 0.5 },
        summaryValue:     { fontSize: 10, fontWeight: 'bold' as const },
        grandTotalValue:  { fontSize: 17, fontWeight: 'bold' as const, color: dark },
        footerText:       { position: 'absolute' as const, bottom: 0, left: 0, right: 0, fontSize: 8, color: '#777777', textAlign: 'center' as const, backgroundColor: lighten(accent, 0.92), borderTop: `0.5px solid ${lighten(accent, 0.80)}`, paddingVertical: 11, paddingHorizontal: 28 },
        accentColor: accent,
        darkColor: dark,
        darkMid: darkMid,
    };
}

// ─── T2: MIST — Soft Tinted ────────────────────────────────────────────────
function mistStyles(accent: string) {
    const pageBg = lighten(accent, 0.92);       // very light brand tint
    const clientBg = lighten(accent, 0.87);     // slightly darker band
    const muted = lighten(accent, 0.40);        // muted brand for labels
    const footerBg = lighten(accent, 0.85);
    return {
        page: { padding: 0, backgroundColor: pageBg, fontFamily: 'Helvetica', fontSize: 10, color: darken(accent, 0.60) },
        headerRow: { flexDirection: 'row' as const, justifyContent: 'space-between' as const, alignItems: 'center' as const, padding: 32, paddingBottom: 24, backgroundColor: pageBg },
        headerLeft:  { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 14 },
        headerRight: { flexDirection: 'column' as const, alignItems: 'flex-end' as const, gap: 3 },
        logo:            { width: 48, height: 48, borderRadius: 6 },
        title:           { fontSize: 28, fontWeight: 'bold' as const, color: accent },
        subtitle:        { fontSize: 9, color: muted },
        companyInfoText: { fontSize: 9, color: muted },
        companyFallback: { fontSize: 18, fontWeight: 'bold' as const, color: darken(accent, 0.60), marginBottom: 2 },
        clientLabel:     { fontSize: 8, fontWeight: 'bold' as const, color: muted, textTransform: 'uppercase' as const, letterSpacing: 1, marginBottom: 3 },
        betreftLabel:    { fontSize: 12, fontWeight: 'bold' as const, color: accent },
        clientSection:   { flexDirection: 'row' as const, justifyContent: 'space-between' as const, backgroundColor: clientBg, marginBottom: 0, padding: 24 },
        tableHeaderRow:  { flexDirection: 'row' as const, backgroundColor: accent, paddingVertical: 8, paddingHorizontal: 32, fontWeight: 'bold' as const, fontSize: 8.5, textTransform: 'uppercase' as const, color: '#ffffff', letterSpacing: 0.3 },
        tableRow:        { flexDirection: 'row' as const, backgroundColor: '#ffffff', borderBottom: `1px solid ${lighten(accent, 0.82)}`, paddingVertical: 7, paddingHorizontal: 32, fontSize: 9 },
        sectionRow:      { flexDirection: 'row' as const, backgroundColor: withAlpha(accent, '1a'), borderLeft: `3px solid ${accent}`, paddingVertical: 7, paddingHorizontal: 32, marginTop: 0, marginBottom: 0 },
        sectionText:     { fontWeight: 'bold' as const, color: accent, fontSize: 10 },
        subsectionRow:   { flexDirection: 'row' as const, backgroundColor: lighten(accent, 0.93), paddingVertical: 6, paddingHorizontal: 32, borderBottom: `0.5px solid ${lighten(accent, 0.82)}` },
        summaryBox:      { marginTop: 20, paddingHorizontal: 32, flexDirection: 'column' as const, alignItems: 'flex-end' as const, gap: 5 },
        summaryRow:      { flexDirection: 'row' as const, width: 240, justifyContent: 'space-between' as const },
        summaryLabel:    { fontSize: 8.5, color: muted, textTransform: 'uppercase' as const, letterSpacing: 0.5 },
        summaryValue:    { fontSize: 10, fontWeight: 'bold' as const },
        grandTotalValue: { fontSize: 16, fontWeight: 'bold' as const, color: accent },
        footerText:      { position: 'absolute' as const, bottom: 0, left: 0, right: 0, fontSize: 8, color: muted, textAlign: 'center' as const, backgroundColor: footerBg, paddingVertical: 12 },
        accentColor: accent,
    };
}

// ─── T3: NAVY — Classic Corporate ───────────────────────────────────────────
function navyStyles(accent: string) {
    const dark = darken(accent, 0.55);          // deepest brand shade (was #1a3a5c)
    const darkMid = darken(accent, 0.40);       // mid dark (was #245076)
    return {
        page: { padding: 40, backgroundColor: '#ffffff', fontFamily: 'Helvetica', fontSize: 10, color: '#111111' },
        headerRow:   { flexDirection: 'row' as const, justifyContent: 'space-between' as const, alignItems: 'flex-start' as const, marginBottom: 20 },
        headerLeft:  { flexDirection: 'column' as const, gap: 2, flex: 0.6 },
        headerRight: { flexDirection: 'column' as const, alignItems: 'flex-end' as const, flex: 0.4 },
        logo:            { width: 100, marginBottom: 6 },
        title:           { fontSize: 38, fontWeight: 'bold' as const, color: '#111111', textTransform: 'uppercase' as const },
        subtitle:        { fontSize: 9, color: '#666666' },
        companyInfoText: { fontSize: 8.5, color: '#555555' },
        companyFallback: { fontSize: 15, fontWeight: 'bold' as const, color: dark, marginBottom: 4 },
        clientLabel:     { fontSize: 8, fontWeight: 'bold' as const, color: '#ffffff', textTransform: 'uppercase' as const, letterSpacing: 0.5 },
        betreftLabel:    { fontSize: 12, fontWeight: 'bold' as const, color: dark },
        clientSection:   { flexDirection: 'row' as const, justifyContent: 'space-between' as const, marginBottom: 16, backgroundColor: darkMid, padding: 10 },
        tableHeaderRow:  { flexDirection: 'row' as const, backgroundColor: dark, paddingVertical: 7, paddingHorizontal: 8, fontWeight: 'bold' as const, fontSize: 8.5, textTransform: 'uppercase' as const, color: '#ffffff', letterSpacing: 0.3, marginTop: 0 },
        tableRow:        { flexDirection: 'row' as const, borderBottom: `1px solid ${lighten(accent, 0.85)}`, paddingVertical: 6, paddingHorizontal: 8, fontSize: 9 },
        sectionRow:      { flexDirection: 'row' as const, backgroundColor: lighten(accent, 0.88), borderLeft: `4px solid ${dark}`, paddingVertical: 7, paddingHorizontal: 8, marginTop: 10, marginBottom: 2 },
        sectionText:     { fontWeight: 'bold' as const, color: dark, fontSize: 10, textTransform: 'uppercase' as const },
        subsectionRow:   { flexDirection: 'row' as const, backgroundColor: lighten(accent, 0.93), borderBottom: `1px solid ${lighten(accent, 0.87)}`, paddingVertical: 5, paddingHorizontal: 8, marginLeft: 12 },
        summaryBox:      { marginTop: 16, flexDirection: 'column' as const, alignItems: 'flex-end' as const, gap: 4 },
        summaryRow:      { flexDirection: 'row' as const, width: 265, justifyContent: 'space-between' as const },
        summaryLabel:    { fontSize: 9, color: '#666666', textTransform: 'uppercase' as const, fontWeight: 'bold' as const },
        summaryValue:    { fontSize: 10, fontWeight: 'bold' as const },
        grandTotalValue: { fontSize: 16, fontWeight: 'bold' as const, color: '#ffffff' },
        footerText:      { position: 'absolute' as const, bottom: 30, left: 40, right: 40, fontSize: 8, color: '#999999', textAlign: 'center' as const, borderTop: `1px solid ${lighten(accent, 0.80)}`, paddingTop: 8 },
        accentColor: accent,
        navyColor:   dark,
        navyMid:     darkMid,
    };
}

// ─── T4: PRISM — Geometric Diagonal ─────────────────────────────────────────
function prismStyles(accent: string) {
    const dark = darken(accent, 0.55);          // was #1c2e4a
    const darkMid = darken(accent, 0.40);       // was #26405e
    return {
        page: { padding: 0, backgroundColor: '#ffffff', fontFamily: 'Helvetica', fontSize: 10, color: '#222222' },
        headerRow:   { flexDirection: 'row' as const, alignItems: 'center' as const },
        headerLeft:  { flexDirection: 'column' as const, gap: 3 },
        headerRight: { flexDirection: 'column' as const, alignItems: 'flex-end' as const, gap: 3 },
        logo:            { width: 70, marginBottom: 6 },
        title:           { fontSize: 26, fontWeight: 'bold' as const, color: dark, textTransform: 'uppercase' as const, letterSpacing: 2 },
        subtitle:        { fontSize: 9, color: '#666666' },
        companyInfoText: { fontSize: 8, color: 'rgba(255,255,255,0.7)' },
        companyFallback: { fontSize: 20, fontWeight: 'bold' as const, color: '#ffffff', letterSpacing: 0.5 },
        clientLabel:     { fontSize: 8, fontWeight: 'bold' as const, color: '#888888', textTransform: 'uppercase' as const, letterSpacing: 1, marginBottom: 3 },
        betreftLabel:    { fontSize: 12, fontWeight: 'bold' as const, color: dark },
        clientSection:   { flexDirection: 'row' as const, justifyContent: 'space-between' as const, paddingHorizontal: 32, marginBottom: 14, paddingTop: 10 },
        tableHeaderRow:  { flexDirection: 'row' as const, backgroundColor: dark, paddingVertical: 8, paddingHorizontal: 32, fontWeight: 'bold' as const, fontSize: 8.5, textTransform: 'uppercase' as const, color: '#ffffff', letterSpacing: 0.3 },
        tableRow:        { flexDirection: 'row' as const, borderBottom: `0.5px solid ${lighten(accent, 0.85)}`, paddingVertical: 6, paddingHorizontal: 32, fontSize: 9 },
        sectionRow:      { flexDirection: 'row' as const, backgroundColor: withAlpha(dark, '12'), borderLeft: `3px solid ${dark}`, paddingVertical: 7, paddingHorizontal: 32, marginTop: 8, marginBottom: 0 },
        sectionText:     { fontWeight: 'bold' as const, color: dark, fontSize: 10, textTransform: 'uppercase' as const },
        subsectionRow:   { flexDirection: 'row' as const, borderBottom: `0.5px solid ${lighten(accent, 0.85)}`, paddingVertical: 5, paddingHorizontal: 32, marginLeft: 12 },
        summaryBox:      { marginTop: 20, paddingHorizontal: 32, flexDirection: 'column' as const, alignItems: 'flex-end' as const, gap: 5 },
        summaryRow:      { flexDirection: 'row' as const, width: 250, justifyContent: 'space-between' as const },
        summaryLabel:    { fontSize: 8.5, color: '#666666', textTransform: 'uppercase' as const, letterSpacing: 0.5 },
        summaryValue:    { fontSize: 10, fontWeight: 'bold' as const },
        grandTotalValue: { fontSize: 16, fontWeight: 'bold' as const, color: dark },
        footerText:      { position: 'absolute' as const, bottom: 0, left: 0, right: 0, fontSize: 8, color: '#ffffff', textAlign: 'center' as const, backgroundColor: dark, paddingVertical: 12 },
        accentColor: accent,
        navyColor:  dark,
        navyMid:    darkMid,
    };
}
