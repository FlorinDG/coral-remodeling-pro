"use client";

import React, { useState, useEffect } from 'react';
import { FileImage, Palette, LayoutTemplate, UploadCloud, CheckCircle2, Circle } from 'lucide-react';
import { toast } from 'sonner';

const TEMPLATES = [
    {
        id: 't1', name: 'Classic Professional',
        description: 'Clean, simple, standard layout with left-aligned header.',
        badge: 'Default',
        // Classic: logo top-left, address top-right, table with header, footer line
        preview: (color: string) => (
            <svg viewBox="0 0 48 64" className="w-12 h-16">
                <rect width="48" height="64" fill="#f9f9f9" rx="2" />
                <rect x="4" y="4" width="12" height="6" rx="1" fill={color} opacity="0.3" />
                <rect x="26" y="4" width="18" height="2" rx="0.5" fill="#ddd" />
                <rect x="30" y="7" width="14" height="1.5" rx="0.5" fill="#eee" />
                <line x1="4" y1="14" x2="44" y2="14" stroke={color} strokeWidth="0.8" />
                <rect x="4" y="17" width="40" height="3" rx="0.5" fill={color} opacity="0.15" />
                <rect x="4" y="22" width="40" height="2" rx="0.3" fill="#f0f0f0" />
                <rect x="4" y="26" width="40" height="2" rx="0.3" fill="#f7f7f7" />
                <rect x="4" y="30" width="40" height="2" rx="0.3" fill="#f0f0f0" />
                <rect x="4" y="34" width="40" height="2" rx="0.3" fill="#f7f7f7" />
                <line x1="4" y1="38" x2="44" y2="38" stroke={color} strokeWidth="0.5" />
                <rect x="28" y="40" width="16" height="3" rx="0.5" fill={color} opacity="0.2" />
                <line x1="4" y1="58" x2="44" y2="58" stroke="#eee" strokeWidth="0.5" />
                <rect x="16" y="60" width="16" height="1.5" rx="0.5" fill="#e0e0e0" />
            </svg>
        )
    },
    {
        id: 't2', name: 'Modern Minimalist',
        description: 'Lots of whitespace, thin lines, right-aligned header.',
        badge: '',
        // Minimalist: right-aligned top block, thin single-line table, centered footer
        preview: (color: string) => (
            <svg viewBox="0 0 48 64" className="w-12 h-16">
                <rect width="48" height="64" fill="#fff" rx="2" />
                <rect x="28" y="6" width="16" height="4" rx="1" fill={color} opacity="0.15" />
                <rect x="32" y="11" width="12" height="1.5" rx="0.5" fill="#e8e8e8" />
                <rect x="4" y="20" width="20" height="2.5" rx="0.5" fill={color} opacity="0.6" />
                <line x1="4" y1="26" x2="44" y2="26" stroke="#eee" strokeWidth="0.3" />
                <rect x="4" y="28" width="40" height="1.5" rx="0.3" fill="#f5f5f5" />
                <line x1="4" y1="31" x2="44" y2="31" stroke="#f0f0f0" strokeWidth="0.3" />
                <rect x="4" y="33" width="40" height="1.5" rx="0.3" fill="#fafafa" />
                <line x1="4" y1="36" x2="44" y2="36" stroke="#f0f0f0" strokeWidth="0.3" />
                <rect x="4" y="38" width="40" height="1.5" rx="0.3" fill="#f5f5f5" />
                <line x1="4" y1="41" x2="44" y2="41" stroke="#eee" strokeWidth="0.3" />
                <rect x="30" y="44" width="14" height="2.5" rx="0.5" fill={color} opacity="0.12" />
                <rect x="18" y="59" width="12" height="1" rx="0.5" fill="#e5e5e5" />
            </svg>
        )
    },
    {
        id: 't3', name: 'Bold Corporate',
        description: 'Full-width colored header, strong contrast, accent bar.',
        badge: '',
        // Bold: full-width header bar, bold sections, thick separator
        preview: (color: string) => (
            <svg viewBox="0 0 48 64" className="w-12 h-16">
                <rect width="48" height="64" fill="#fff" rx="2" />
                <rect x="0" y="0" width="48" height="12" rx="2" fill={color} />
                <rect x="4" y="3" width="14" height="3" rx="0.5" fill="white" opacity="0.9" />
                <rect x="4" y="7" width="10" height="1.5" rx="0.5" fill="white" opacity="0.5" />
                <rect x="4" y="16" width="24" height="2.5" rx="0.5" fill="#333" />
                <rect x="4" y="20" width="40" height="3" rx="0.5" fill={color} opacity="0.12" />
                <rect x="4" y="25" width="40" height="2" rx="0.3" fill="#f3f3f3" />
                <rect x="4" y="29" width="40" height="2" rx="0.3" fill="#f8f8f8" />
                <rect x="4" y="33" width="40" height="2" rx="0.3" fill="#f3f3f3" />
                <rect x="4" y="37" width="40" height="2" rx="0.3" fill="#f8f8f8" />
                <rect x="0" y="41" width="48" height="1.5" fill={color} opacity="0.2" />
                <rect x="28" y="44" width="16" height="3" rx="0.5" fill={color} opacity="0.25" />
                <rect x="0" y="58" width="48" height="6" rx="0" fill={color} opacity="0.06" />
                <rect x="14" y="60" width="20" height="1.5" rx="0.5" fill={color} opacity="0.3" />
            </svg>
        )
    },
    {
        id: 't4', name: 'Elegant Serif',
        description: 'Centered header, ornamental divider, premium feel.',
        badge: '',
        // Elegant: centered header, ornamental line, serif-weight sections
        preview: (color: string) => (
            <svg viewBox="0 0 48 64" className="w-12 h-16">
                <rect width="48" height="64" fill="#fdfcfa" rx="2" />
                <rect x="14" y="4" width="20" height="4" rx="1" fill={color} opacity="0.2" />
                <rect x="18" y="9" width="12" height="1.5" rx="0.5" fill="#d0d0d0" />
                <line x1="8" y1="14" x2="40" y2="14" stroke={color} strokeWidth="0.5" />
                <circle cx="24" cy="14" r="1.5" fill={color} opacity="0.4" />
                <line x1="8" y1="14" x2="20" y2="14" stroke={color} strokeWidth="0.5" />
                <line x1="28" y1="14" x2="40" y2="14" stroke={color} strokeWidth="0.5" />
                <rect x="4" y="18" width="16" height="2" rx="0.3" fill="#888" />
                <rect x="4" y="22" width="40" height="2" rx="0.3" fill="#f2f0ed" />
                <rect x="4" y="26" width="40" height="2" rx="0.3" fill="#f8f6f3" />
                <rect x="4" y="30" width="40" height="2" rx="0.3" fill="#f2f0ed" />
                <rect x="4" y="34" width="40" height="2" rx="0.3" fill="#f8f6f3" />
                <line x1="8" y1="39" x2="40" y2="39" stroke={color} strokeWidth="0.3" />
                <rect x="28" y="41" width="16" height="2.5" rx="0.5" fill={color} opacity="0.15" />
                <line x1="12" y1="56" x2="36" y2="56" stroke={color} strokeWidth="0.3" />
                <circle cx="24" cy="56" r="1" fill={color} opacity="0.3" />
                <rect x="14" y="58" width="20" height="1.5" rx="0.5" fill="#d5d0c8" />
            </svg>
        )
    },
];

export default function DocumentTemplatesModule() {
    const [mode, setMode] = useState<'dynamic' | 'stationery'>('dynamic');

    // Stub states for UI demonstration
    const [selectedTemplate, setSelectedTemplate] = useState('t1');
    const [primaryColor, setPrimaryColor] = useState('#d75d00');
    const [roundedCorners, setRoundedCorners] = useState(true);
    const [bandedRows, setBandedRows] = useState(true);

    // File Upload States
    const [logoPreview, setLogoPreview] = useState<string | null>(null);
    const [stationeryFile, setStationeryFile] = useState<File | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    // Load saved brand color from tenant profile on mount
    useEffect(() => {
        fetch('/api/tenant/profile').then(r => r.json()).then(data => {
            if (data && !data.error) {
                if (data.brandColor) setPrimaryColor(data.brandColor);
                if (data.logoUrl) setLogoPreview(data.logoUrl);
            }
        }).catch(() => {});
    }, []);

    const handleSaveSettings = async () => {
        setIsSaving(true);
        try {
            const res = await fetch('/api/tenant/profile', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ brandColor: primaryColor })
            });
            if (res.ok) {
                // Apply the new brand color globally via CSS custom property
                document.documentElement.style.setProperty('--brand-color', primaryColor);
                toast.success('Branding settings saved — theme updated');
            } else {
                toast.error('Failed to save branding settings');
            }
        } catch (e) {
            toast.error('Network error saving branding settings');
        }
        setIsSaving(false);
    };

    const handlePreviewMockup = () => {
        toast.info('Generating mockup preview...', { duration: 1500 });
        const mockupWindow = window.open('', '_blank', 'width=800,height=1132');
        if (mockupWindow) {
            mockupWindow.document.write(`
                <!DOCTYPE html>
                <html><head><title>Mockup Preview</title>
                <style>
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    body { font-family: system-ui, -apple-system, sans-serif; background: #f5f5f5; display: flex; justify-content: center; padding: 32px; }
                    .page { width: 210mm; min-height: 297mm; background: white; box-shadow: 0 4px 24px rgba(0,0,0,0.12); padding: 48px; position: relative; }
                    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 48px; padding-bottom: 24px; border-bottom: 2px solid ${primaryColor}; }
                    .logo-area { width: 120px; height: 60px; ${logoPreview ? 'background-image: url(' + logoPreview + '); background-size: contain; background-repeat: no-repeat;' : 'display: flex; align-items: center; justify-content: center;'} }
                    .rhombus { width: 40px; height: 40px; background: ${primaryColor}; transform: rotate(45deg); border-radius: 4px; }
                    .company { text-align: right; font-size: 11px; color: #555; line-height: 1.6; }
                    .company strong { font-size: 16px; color: #111; display: block; margin-bottom: 4px; }
                    h2 { font-size: 22px; color: ${primaryColor}; margin-bottom: 32px; }
                    table { width: 100%; border-collapse: collapse; margin-bottom: 32px; }
                    th { text-align: left; padding: 10px 12px; background: ${primaryColor}10; color: ${primaryColor}; font-size: 10px; text-transform: uppercase; letter-spacing: 1px; border-bottom: 2px solid ${primaryColor}30; ${roundedCorners ? 'border-radius: 4px 4px 0 0;' : ''} }
                    td { padding: 10px 12px; font-size: 12px; border-bottom: 1px solid #eee; color: #333; }
                    ${bandedRows ? 'tr:nth-child(even) td { background: #fafafa; }' : ''}
                    .total-row td { font-weight: bold; border-top: 2px solid ${primaryColor}; font-size: 14px; }
                    .footer { position: absolute; bottom: 48px; left: 48px; right: 48px; text-align: center; font-size: 10px; color: #999; border-top: 1px solid #eee; padding-top: 12px; }
                </style></head><body>
                <div class="page">
                    <div class="header">
                        <div class="logo-area">${logoPreview ? '' : '<div class="rhombus"></div>'}</div>
                        <div class="company"><strong>Coral Enterprises</strong>Example Street 42<br>1000 Brussels, Belgium<br>BE 0123.456.789</div>
                    </div>
                    <h2>INVOICE INV-2026-001</h2>
                    <table>
                        <thead><tr><th>Description</th><th>Qty</th><th>Unit Price</th><th>Total</th></tr></thead>
                        <tbody>
                            <tr><td>Renovation works — Kitchen remodeling</td><td>1</td><td>€2,500.00</td><td>€2,500.00</td></tr>
                            <tr><td>Premium tiles (60x60cm, matte finish)</td><td>35</td><td>€45.00</td><td>€1,575.00</td></tr>
                            <tr><td>Labour — Installation (skilled tradesman)</td><td>16</td><td>€65.00</td><td>€1,040.00</td></tr>
                            <tr class="total-row"><td colspan="3" style="text-align:right">Subtotal excl. VAT</td><td>€5,115.00</td></tr>
                            <tr><td colspan="3" style="text-align:right;font-size:12px;color:#666">VAT 21%</td><td style="font-size:12px;color:#666">€1,074.15</td></tr>
                            <tr class="total-row"><td colspan="3" style="text-align:right">Total incl. VAT</td><td style="color:${primaryColor}">€6,189.15</td></tr>
                        </tbody>
                    </table>
                    <div class="footer">Generated with Coral SaaS — cloud-native construction management platform</div>
                </div>
                </body></html>
            `);
            mockupWindow.document.close();
        }
    };

    const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onloadend = () => setLogoPreview(reader.result as string);
        reader.readAsDataURL(file);
    };

    const handleStationeryUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) setStationeryFile(file);
    };

    return (
        <div className="flex flex-col gap-8 max-w-5xl mx-auto pb-24">
            {/* Header Tabs */}
            <div className="flex items-center p-1 bg-neutral-200/50 dark:bg-white/5 rounded-lg w-fit">
                <button
                    onClick={() => setMode('dynamic')}
                    className={`flex items-center gap-2 px-6 py-2 rounded-md font-medium text-sm transition-all ${mode === 'dynamic' ? 'bg-white dark:bg-neutral-800 shadow-sm text-neutral-900 dark:text-white' : 'text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'}`}
                >
                    <Palette className="w-4 h-4" /> Custom Branding
                </button>
                <button
                    onClick={() => setMode('stationery')}
                    className={`flex items-center gap-2 px-6 py-2 rounded-md font-medium text-sm transition-all ${mode === 'stationery' ? 'bg-white dark:bg-neutral-800 shadow-sm text-neutral-900 dark:text-white' : 'text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'}`}
                >
                    <FileImage className="w-4 h-4" /> Upload Stationery
                </button>
            </div>

            {mode === 'dynamic' ? (
                <div className="flex flex-col gap-10 animate-in fade-in slide-in-from-bottom-2 duration-300">

                    {/* Template Selection */}
                    <div className="flex flex-col gap-4">
                        <div className="flex items-center gap-2">
                            <LayoutTemplate className="w-5 h-5 text-neutral-400" />
                            <h2 className="text-lg font-bold text-neutral-900 dark:text-white">Premade Layouts</h2>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            {TEMPLATES.map(t => (
                                <div
                                    key={t.id}
                                    onClick={() => setSelectedTemplate(t.id)}
                                    className={`relative flex flex-col gap-2 p-5 rounded-xl border-2 cursor-pointer transition-all ${selectedTemplate === t.id ? 'border-[var(--brand-color,#d75d00)] bg-[var(--brand-color,#d75d00)]/5 dark:bg-[var(--brand-color,#d75d00)]/10' : 'border-neutral-200 dark:border-white/10 hover:border-neutral-300 dark:hover:border-white/20 bg-white dark:bg-[#111]'}`}
                                    style={selectedTemplate === t.id ? { borderColor: primaryColor, backgroundColor: `${primaryColor}0a` } : {}}
                                >
                                    {selectedTemplate === t.id ? (
                                        <CheckCircle2 className="absolute top-4 right-4 w-5 h-5" style={{ color: primaryColor }} />
                                    ) : (
                                        <Circle className="absolute top-4 right-4 w-5 h-5 text-neutral-300 dark:text-neutral-700" />
                                    )}
                                    <div className="mb-2">
                                        {t.preview(primaryColor)}
                                    </div>
                                    <h3 className="font-bold text-neutral-900 dark:text-white pr-6 leading-tight">{t.name}</h3>
                                    <p className="text-xs text-neutral-500 leading-relaxed">{t.description}</p>
                                    {t.badge && (
                                        <span className="mt-auto pt-2 text-[10px] font-bold uppercase tracking-widest text-neutral-400">{t.badge}</span>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    <hr className="border-neutral-200 dark:border-white/10" />

                    {/* Branding Options */}
                    <div className="flex flex-col md:flex-row gap-10">
                        {/* Logo Upload */}
                        <div className="flex-1 flex flex-col gap-4">
                            <h2 className="text-sm font-bold uppercase tracking-widest text-neutral-500">Company Logo</h2>
                            <label className="w-full aspect-video rounded-xl border-2 border-dashed border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-white/5 flex flex-col items-center justify-center gap-3 cursor-pointer hover:bg-neutral-100 dark:hover:bg-white/10 transition-colors relative overflow-hidden group">
                                <input
                                    type="file"
                                    accept="image/png, image/jpeg, image/jpg, image/svg+xml"
                                    className="hidden"
                                    onChange={handleLogoUpload}
                                />
                                {logoPreview ? (
                                    <div className="absolute inset-0 w-full h-full p-6 flex items-center justify-center bg-white dark:bg-black">
                                        <img src={logoPreview} alt="Logo Preview" className="max-w-full max-h-full object-contain" />
                                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                            <span className="text-white text-sm font-bold">Change Logo</span>
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        <UploadCloud className="w-8 h-8 text-neutral-400" />
                                        <div className="text-center">
                                            <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Click or drag image to upload</p>
                                            <p className="text-xs text-neutral-500">PNG or JPG, up to 2MB</p>
                                        </div>
                                    </>
                                )}
                            </label>
                        </div>

                        {/* Styling Controls */}
                        <div className="flex-1 flex flex-col gap-6">
                            <h2 className="text-sm font-bold uppercase tracking-widest text-neutral-500">Styling Variables</h2>

                            <div className="flex flex-col gap-4">
                                {/* Color Picker */}
                                <div className="flex items-center justify-between p-4 rounded-lg border border-neutral-200 dark:border-white/10 bg-white dark:bg-[#111]">
                                    <div className="flex flex-col gap-1">
                                        <span className="text-sm font-medium text-neutral-900 dark:text-white">Primary Brand Color</span>
                                        <span className="text-xs text-neutral-500">Used for headers, accents, and app theming.</span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className="text-xs font-mono text-neutral-400">{primaryColor}</span>
                                        <input
                                            type="color"
                                            value={primaryColor}
                                            onChange={(e) => setPrimaryColor(e.target.value)}
                                            className="w-8 h-8 rounded border-none cursor-pointer bg-transparent"
                                        />
                                    </div>
                                </div>

                                {/* Rounded Corners */}
                                <div className="flex items-center justify-between p-4 rounded-lg border border-neutral-200 dark:border-white/10 bg-white dark:bg-[#111]">
                                    <div className="flex flex-col gap-1">
                                        <span className="text-sm font-medium text-neutral-900 dark:text-white">Rounded Elements</span>
                                        <span className="text-xs text-neutral-500">Apply border-radius to tables and modules.</span>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input type="checkbox" className="sr-only peer" checked={roundedCorners} onChange={(e) => setRoundedCorners(e.target.checked)} />
                                        <div className="w-11 h-6 bg-neutral-200 peer-focus:outline-none rounded-full peer dark:bg-neutral-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-neutral-600 peer-checked:bg-[var(--brand-color,#d75d00)]"></div>
                                    </label>
                                </div>

                                {/* Banded Rows */}
                                <div className="flex items-center justify-between p-4 rounded-lg border border-neutral-200 dark:border-white/10 bg-white dark:bg-[#111]">
                                    <div className="flex flex-col gap-1">
                                        <span className="text-sm font-medium text-neutral-900 dark:text-white">Banded Table Rows</span>
                                        <span className="text-xs text-neutral-500">Alternating row colors for readability.</span>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input type="checkbox" className="sr-only peer" checked={bandedRows} onChange={(e) => setBandedRows(e.target.checked)} />
                                        <div className="w-11 h-6 bg-neutral-200 peer-focus:outline-none rounded-full peer dark:bg-neutral-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-neutral-600 peer-checked:bg-[var(--brand-color,#d75d00)]"></div>
                                    </label>
                                </div>
                            </div>
                        </div>
                    </div>

                </div>
            ) : (
                <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className="flex flex-col">
                        <h2 className="text-lg font-bold text-neutral-900 dark:text-white">A4 Stationery Upload</h2>
                        <p className="text-sm text-neutral-500">Upload a full-page PDF letterhead. We will overlay the raw calculation data directly onto this background without our own headers and footers.</p>
                    </div>

                    <label className="w-full max-w-2xl aspect-[1/1.414] mx-auto rounded-xl border-2 border-dashed border-[var(--brand-color,#d75d00)]/50 bg-[var(--brand-color,#d75d00)]/5 flex flex-col items-center justify-center gap-4 cursor-pointer hover:bg-[var(--brand-color,#d75d00)]/10 transition-colors shadow-sm relative overflow-hidden group" style={{ borderColor: `${primaryColor}80`, backgroundColor: `${primaryColor}0d` }}>
                        <input
                            type="file"
                            accept="application/pdf"
                            className="hidden"
                            onChange={handleStationeryUpload}
                        />
                        {stationeryFile ? (
                            <div className="absolute inset-0 w-full h-full p-8 flex flex-col items-center justify-center bg-white dark:bg-[#111] text-center gap-4">
                                <CheckCircle2 className="w-16 h-16 text-emerald-500" />
                                <div>
                                    <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400 mb-1">Stationery Uploaded Automatically</p>
                                    <p className="text-sm text-neutral-500 font-mono">{stationeryFile.name} ({(stationeryFile.size / 1024 / 1024).toFixed(2)} MB)</p>
                                </div>
                                <div className="absolute inset-0 bg-black/5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                    <div className="bg-white dark:bg-neutral-800 px-4 py-2 text-sm font-bold rounded shadow-sm border border-neutral-200 dark:border-neutral-700">Replace PDF File</div>
                                </div>
                            </div>
                        ) : (
                            <>
                                <div className="p-4 bg-white dark:bg-black rounded-full shadow-sm">
                                    <UploadCloud className="w-10 h-10" style={{ color: primaryColor }} />
                                </div>
                                <div className="text-center px-8">
                                    <p className="text-base font-bold text-neutral-900 dark:text-white mb-1">Upload your letterhead PDF</p>
                                    <p className="text-sm text-neutral-500">It should be exactly A4 sized (210 x 297 mm). Any pre-printed logos, footers, or watermarks will be preserved beneath the calculation tables.</p>
                                </div>
                            </>
                        )}
                    </label>
                </div>
            )}

            {/* Save Action */}
            <div className="flex justify-end items-center gap-4 mt-4">
                <button
                    onClick={handlePreviewMockup}
                    className="px-6 py-2.5 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-900 dark:text-white text-sm font-bold rounded-md shadow-sm transition-colors"
                >
                    Preview Mockup Document
                </button>
                <button
                    onClick={handleSaveSettings}
                    disabled={isSaving}
                    className="px-6 py-2.5 text-white text-sm font-bold rounded-md shadow-sm transition-colors disabled:opacity-70 flex items-center gap-2"
                    style={{ backgroundColor: primaryColor }}
                >
                    {isSaving && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                    {isSaving ? 'Saving...' : 'Save Branding Settings'}
                </button>
            </div>
        </div>
    );
}
