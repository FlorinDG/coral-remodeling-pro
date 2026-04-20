"use client";

import React, { useState, useEffect } from 'react';
import { pdf } from '@react-pdf/renderer';
import { FileImage, Palette, LayoutTemplate, UploadCloud, CheckCircle2, Circle, Loader2, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { QuotationPDFTemplate } from '@/components/admin/quotations/QuotationPDFTemplate';

// ── Sample blocks used for template preview PDF ──────────────────────────────
const PREVIEW_BLOCKS: any[] = [
    {
        id: 's1', type: 'section', content: 'Interior Renovation', isOptional: false,
        children: [
            { id: 'l1', type: 'line', content: 'Kitchen remodeling — full removal and reinstallation', isOptional: false, quantity: 1, unit: 'forf.', verkoopPrice: 2500, children: [] },
            { id: 'l2', type: 'line', content: 'Premium floor tiles (60×60 cm, matte finish)', isOptional: false, quantity: 35, unit: 'm²', verkoopPrice: 45, children: [] },
            { id: 'l3', type: 'line', content: 'Skilled labour — tile installation', isOptional: false, quantity: 16, unit: 'h', verkoopPrice: 65, children: [] },
        ],
    },
    {
        id: 's2', type: 'section', content: 'Finishing Works', isOptional: false,
        children: [
            { id: 'l4', type: 'line', content: 'Wall plastering and painting (2 coats)', isOptional: false, quantity: 45, unit: 'm²', verkoopPrice: 28, children: [] },
            { id: 'l5', type: 'line', content: 'Crown molding — supply and installation', isOptional: false, quantity: 12, unit: 'ml', verkoopPrice: 32, children: [] },
        ],
    },
];
const PREVIEW_TOTAL = 2500 + 35 * 45 + 16 * 65 + 45 * 28 + 12 * 32; // = 6759

// ── Template definitions ─────────────────────────────────────────────────────
const TEMPLATES = [
    {
        id: 't1',
        name: 'BLOCK',
        description: 'High-contrast black/white. Bold company header on the left, clean hairline table.',
        badge: 'Default',
        preview: (color: string) => (
            <svg viewBox="0 0 48 64" className="w-12 h-16">
                <rect width="48" height="64" fill="#fff" rx="2" />
                {/* Black left header block */}
                <rect x="0" y="0" width="27" height="16" fill="#111111" />
                <rect x="3" y="4" width="14" height="2.5" fill="#ffffff" opacity="0.9" />
                <rect x="3" y="8" width="10" height="1.5" fill="#ffffff" opacity="0.5" />
                <rect x="3" y="11" width="7" height="1" fill="#ffffff" opacity="0.35" />
                {/* Right: invoice number */}
                <rect x="30" y="5" width="14" height="2.5" fill="#222222" />
                <rect x="32" y="9.5" width="10" height="1.5" fill="#aaaaaa" />
                <rect x="34" y="12.5" width="7" height="1" fill="#cccccc" />
                {/* Table: heavy top/bottom lines, hairline rows */}
                <line x1="4" y1="21" x2="44" y2="21" stroke="#111" strokeWidth="0.9" />
                <rect x="4" y="22" width="40" height="5" fill="#fafafa" />
                <line x1="4" y1="27" x2="44" y2="27" stroke="#111" strokeWidth="0.9" />
                <rect x="4" y="28" width="40" height="5" fill="#ffffff" />
                <line x1="4" y1="33" x2="44" y2="33" stroke="#e0e0e0" strokeWidth="0.4" />
                <rect x="4" y="33.5" width="40" height="5" fill="#fafafa" />
                <line x1="4" y1="38.5" x2="44" y2="38.5" stroke="#e0e0e0" strokeWidth="0.4" />
                {/* Summary right-aligned — brand color accent */}
                <rect x="28" y="42" width="16" height="1.5" fill="#cccccc" />
                <rect x="28" y="45.5" width="16" height="1.5" fill="#cccccc" />
                <rect x="28" y="49" width="16" height="3" fill={color} />
                {/* Footer: gray left + brand color right block */}
                <rect x="0" y="59" width="31" height="5" fill="#f2f2f2" />
                <rect x="31" y="59" width="17" height="5" fill={color} />
                <rect x="33" y="61" width="11" height="1.5" fill="#ffffff" opacity="0.7" />
            </svg>
        ),
    },
    {
        id: 't2',
        name: 'MIST',
        description: 'Soft sage background, brand-color accents and table headers. Natural and calm.',
        badge: '',
        preview: (color: string) => (
            <svg viewBox="0 0 48 64" className="w-12 h-16">
                {/* Sage background */}
                <rect width="48" height="64" fill="#eef2f0" rx="2" />
                {/* Brand square + company name */}
                <rect x="3" y="3" width="7" height="7" fill={color} rx="0.8" />
                <rect x="12" y="4" width="12" height="2" fill="#2c3a34" opacity="0.7" />
                <rect x="12" y="7.5" width="8" height="1.5" fill="#6b8c7a" />
                {/* Large Invoice label top-right */}
                <rect x="34" y="3" width="11" height="5" fill={color} opacity="0.85" rx="0.5" />
                {/* Client section — slightly darker sage band */}
                <rect x="0" y="13" width="48" height="10" fill="#e4ece7" />
                <rect x="3" y="15" width="8" height="1.5" fill="#7aaa8e" />
                <rect x="3" y="18.5" width="14" height="2" fill="#2c3a34" opacity="0.65" />
                {/* Table header — brand color */}
                <rect x="0" y="25" width="48" height="5" fill={color} />
                <rect x="3" y="26.5" width="15" height="1.5" fill="#ffffff" opacity="0.75" />
                {/* Rows alternating white/very light */}
                <rect x="0" y="30" width="48" height="4" fill="#ffffff" />
                <rect x="0" y="34" width="48" height="4" fill="#f4f8f5" />
                <rect x="0" y="38" width="48" height="4" fill="#ffffff" />
                <rect x="0" y="42" width="48" height="4" fill="#f4f8f5" />
                {/* Summary */}
                <rect x="28" y="49" width="16" height="1.5" fill="#6b8c7a" />
                <rect x="28" y="52.5" width="16" height="2.5" fill={color} opacity="0.7" />
                {/* Sage footer bar */}
                <rect x="0" y="59" width="48" height="5" fill="#dce8e2" rx="0" />
            </svg>
        ),
    },
    {
        id: 't3',
        name: 'NAVY',
        description: 'Classic corporate. Navy metadata bands, navy table header, navy total bar.',
        badge: '',
        preview: (color: string) => (
            <svg viewBox="0 0 48 64" className="w-12 h-16">
                <rect width="48" height="64" fill="#ffffff" rx="2" />
                {/* Company name top-left */}
                <rect x="3" y="3" width="18" height="2.5" fill="#1a3a5c" opacity="0.8" />
                <rect x="3" y="7" width="12" height="1.5" fill="#555555" />
                {/* Huge INVOICE text top-right */}
                <rect x="30" y="2" width="16" height="6" fill="#111111" rx="0.5" />
                <rect x="32" y="4" width="12" height="2" fill="#ffffff" opacity="0.9" />
                {/* Navy BILL TO band */}
                <rect x="0" y="15" width="48" height="4.5" fill="#1a3a5c" />
                <rect x="3" y="16.5" width="8" height="1.5" fill="#ffffff" opacity="0.75" />
                <rect x="30" y="16.5" width="7" height="1.5" fill="#aac4dc" />
                {/* Medium navy values band */}
                <rect x="0" y="19.5" width="48" height="4.5" fill="#245076" />
                <rect x="3" y="21" width="14" height="1.5" fill="#ddeaf6" />
                <rect x="30" y="21" width="9" height="1.5" fill="#ddeaf6" />
                {/* Navy table header */}
                <rect x="0" y="28" width="48" height="4.5" fill="#1a3a5c" />
                <rect x="3" y="29.5" width="15" height="1.5" fill="#ffffff" opacity="0.75" />
                {/* Table rows */}
                <rect x="0" y="32.5" width="48" height="4" fill="#ffffff" />
                <line x1="0" y1="36.5" x2="48" y2="36.5" stroke="#eaeff4" strokeWidth="0.5" />
                <rect x="0" y="36.5" width="48" height="4" fill="#ffffff" />
                <line x1="0" y1="40.5" x2="48" y2="40.5" stroke="#eaeff4" strokeWidth="0.5" />
                {/* Brand color total bar */}
                <rect x="28" y="47" width="20" height="4.5" fill={color} />
                <rect x="30" y="48.5" width="15" height="1.5" fill="#ffffff" opacity="0.7" />
                {/* Footer thin line */}
                <line x1="4" y1="59" x2="44" y2="59" stroke="#e0e0e0" strokeWidth="0.5" />
                <rect x="13" y="60.5" width="22" height="1.5" fill="#e0e0e0" />
            </svg>
        ),
    },
    {
        id: 't4',
        name: 'PRISM',
        description: 'Geometric diagonal header in deep navy. Bold and modern — makes an impression.',
        badge: '',
        preview: (color: string) => (
            <svg viewBox="0 0 48 64" className="w-12 h-16">
                <rect width="48" height="64" fill="#ffffff" rx="2" />
                {/* Navy base header */}
                <rect x="0" y="0" width="48" height="17" fill="#1c2e4a" />
                {/* Diagonal overlay right */}
                <polygon points="30,0 48,0 48,17 39,17" fill="#26405e" />
                {/* Bottom-left wedge */}
                <polygon points="0,12 19,12 25,17 0,17" fill="#26405e" />
                {/* Company text on header */}
                <rect x="3" y="3" width="16" height="2.5" fill="#ffffff" opacity="0.95" />
                <rect x="3" y="7" width="10" height="1.5" fill="#ffffff" opacity="0.5" />
                <rect x="3" y="9.5" width="7" height="1" fill="#ffffff" opacity="0.35" />
                {/* Brand color accent stripe below header */}
                <rect x="0" y="17" width="48" height="2" fill={color} opacity="0.85" />
                {/* Invoice label below header right-aligned */}
                <rect x="28" y="21" width="17" height="3.5" fill="#1c2e4a" opacity="0.75" rx="0.3" />
                <rect x="30" y="22.2" width="13" height="1.5" fill="#ffffff" opacity="0.6" />
                {/* Client section */}
                <rect x="3" y="27" width="9" height="1.5" fill="#888888" />
                <rect x="3" y="30" width="16" height="2" fill="#222222" />
                {/* Navy table header */}
                <rect x="0" y="35" width="48" height="4.5" fill="#1c2e4a" />
                <rect x="3" y="36.5" width="15" height="1.5" fill="#ffffff" opacity="0.75" />
                {/* Table rows */}
                <rect x="0" y="39.5" width="48" height="4" fill="#fafafa" />
                <line x1="0" y1="43.5" x2="48" y2="43.5" stroke="#eeeeee" strokeWidth="0.5" />
                <rect x="0" y="43.5" width="48" height="4" fill="#ffffff" />
                <line x1="0" y1="47.5" x2="48" y2="47.5" stroke="#eeeeee" strokeWidth="0.5" />
                {/* Summary */}
                <rect x="28" y="51" width="16" height="1.5" fill="#888888" />
                <rect x="28" y="54.5" width="16" height="3" fill={color} opacity="0.85" />
                {/* Navy footer bar */}
                <rect x="0" y="59" width="48" height="5" fill="#1c2e4a" />
                <rect x="14" y="60.5" width="20" height="1.5" fill="#ffffff" opacity="0.4" />
            </svg>
        ),
    },
];

// ── Component ─────────────────────────────────────────────────────────────────
export default function DocumentTemplatesModule() {
    const [mode, setMode] = useState<'dynamic' | 'stationery'>('dynamic');

    const [selectedTemplate, setSelectedTemplate] = useState('t1');
    const [primaryColor, setPrimaryColor] = useState('#d75d00');
    const [documentLanguage, setDocumentLanguage] = useState('nl');

    const [logoPreview, setLogoPreview] = useState<string | null>(null);
    const [logoUrl, setLogoUrl] = useState<string | null>(null); // saved URL from DB
    const [stationeryFile, setStationeryFile] = useState<File | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [isPreviewing, setIsPreviewing] = useState(false);

    // Profile data needed to build a realistic preview
    const [tenantProfile, setTenantProfile] = useState<any>(null);

    // Load saved settings from tenant profile
    useEffect(() => {
        fetch('/api/tenant/profile').then(r => r.json()).then(data => {
            if (data && !data.error) {
                if (data.brandColor)       setPrimaryColor(data.brandColor);
                if (data.logoUrl)          { setLogoPreview(data.logoUrl); setLogoUrl(data.logoUrl); }
                if (data.documentTemplate) setSelectedTemplate(data.documentTemplate);
                if (data.documentLanguage) setDocumentLanguage(data.documentLanguage);
                setTenantProfile(data);
            }
        }).catch(() => {});
    }, []);

    const handleSaveSettings = async () => {
        setIsSaving(true);
        try {
            const res = await fetch('/api/tenant/profile', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ brandColor: primaryColor, documentTemplate: selectedTemplate }),
            });
            if (res.ok) {
                document.documentElement.style.setProperty('--brand-color', primaryColor);
                window.dispatchEvent(new CustomEvent('brandColorChanged', { detail: primaryColor }));
                setTenantProfile((p: any) => ({ ...p, brandColor: primaryColor, documentTemplate: selectedTemplate }));
                toast.success('Branding settings saved');
            } else {
                toast.error('Failed to save branding settings');
            }
        } catch {
            toast.error('Network error saving branding settings');
        }
        setIsSaving(false);
    };

    // Generate a real PDF preview using the actual template + sample data
    const handlePreview = async () => {
        setIsPreviewing(true);
        try {
            const profile = {
                ...(tenantProfile || {}),
                brandColor: primaryColor,
                logoUrl: logoUrl,
                documentTemplate: selectedTemplate,
                planType: 'FOUNDER', // no watermark in preview
            };

            const doc = (
                <QuotationPDFTemplate
                    blocks={PREVIEW_BLOCKS}
                    quotationTitle="OFF-2026-001"
                    betreft="Sample preview — Interior renovation project"
                    clientInfo={{
                        name: profile.companyName || 'Sample Client BV',
                        address: `${profile.street || 'Example Street 42'}, ${profile.postalCode || '1000'} ${profile.city || 'Brussels'}`,
                        vatNumber: profile.vatNumber || 'BE 0123.456.789',
                        email: profile.email || 'client@example.com',
                    }}
                    projectId="preview"
                    grandTotal={PREVIEW_TOTAL}
                    databaseStoreState={{ databases: [] }}
                    tenantProfile={profile}
                    templateId={selectedTemplate as any}
                    language={documentLanguage || 'nl'}
                />
            );

            const blob = await pdf(doc).toBlob();
            const url = URL.createObjectURL(blob);
            window.open(url, '_blank');
        } catch (e) {
            console.error('Preview failed', e);
            toast.error('Could not generate preview PDF');
        }
        setIsPreviewing(false);
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
            {/* Mode tabs */}
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
                            <h2 className="text-lg font-bold text-neutral-900 dark:text-white">Document Layout</h2>
                            <span className="text-xs text-neutral-400 ml-1">Applied to all exports: quotations, invoices, and future documents.</span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            {TEMPLATES.map(tmpl => (
                                <div
                                    key={tmpl.id}
                                    onClick={() => setSelectedTemplate(tmpl.id)}
                                    className={`relative flex flex-col gap-3 p-5 rounded-xl border-2 cursor-pointer transition-all group ${selectedTemplate === tmpl.id ? 'shadow-md' : 'border-neutral-200 dark:border-white/10 hover:border-neutral-300 dark:hover:border-white/20 bg-white dark:bg-[#111]'}`}
                                    style={selectedTemplate === tmpl.id ? { borderColor: primaryColor, backgroundColor: `${primaryColor}09` } : {}}
                                >
                                    {/* Selection indicator */}
                                    {selectedTemplate === tmpl.id ? (
                                        <CheckCircle2 className="absolute top-3 right-3 w-4 h-4" style={{ color: primaryColor }} />
                                    ) : (
                                        <Circle className="absolute top-3 right-3 w-4 h-4 text-neutral-300 dark:text-neutral-700" />
                                    )}

                                    {/* Thumbnail */}
                                    <div className="mb-1 flex items-center justify-center h-16">
                                        {tmpl.preview(primaryColor)}
                                    </div>

                                    {/* Name + description */}
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <h3 className="font-bold text-neutral-900 dark:text-white text-sm tracking-wide">{tmpl.name}</h3>
                                            {tmpl.badge && (
                                                <span className="text-[9px] font-bold uppercase tracking-widest text-neutral-400 border border-neutral-200 dark:border-white/10 px-1.5 py-0.5 rounded">
                                                    {tmpl.badge}
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-xs text-neutral-500 mt-1 leading-relaxed">{tmpl.description}</p>
                                    </div>
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
                                <input type="file" accept="image/png,image/jpeg,image/svg+xml" className="hidden" onChange={handleLogoUpload} />
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
                                            <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Click or drag to upload</p>
                                            <p className="text-xs text-neutral-500">PNG, JPG or SVG — up to 2 MB</p>
                                        </div>
                                    </>
                                )}
                            </label>
                        </div>

                        {/* Brand Color */}
                        <div className="flex-1 flex flex-col gap-6">
                            <h2 className="text-sm font-bold uppercase tracking-widest text-neutral-500">Brand Color</h2>
                            <div className="flex items-center justify-between p-4 rounded-lg border border-neutral-200 dark:border-white/10 bg-white dark:bg-[#111]">
                                <div className="flex flex-col gap-1">
                                    <span className="text-sm font-medium text-neutral-900 dark:text-white">Primary Brand Color</span>
                                    <span className="text-xs text-neutral-500">Used for headers, accents, table rows, and app theming.</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="text-xs font-mono text-neutral-400">{primaryColor}</span>
                                    <input
                                        type="color"
                                        value={primaryColor}
                                        onChange={e => setPrimaryColor(e.target.value)}
                                        className="w-10 h-10 rounded border-none cursor-pointer bg-transparent"
                                    />
                                </div>
                            </div>

                            {/* Live swatch */}
                            <div className="flex gap-2">
                                {[primaryColor, `${primaryColor}cc`, `${primaryColor}88`, `${primaryColor}44`, `${primaryColor}1a`].map((c, i) => (
                                    <div key={i} className="flex-1 h-7 rounded" style={{ backgroundColor: c }} />
                                ))}
                            </div>
                            <p className="text-xs text-neutral-400 -mt-4">Automatic opacity scale — how the color appears across document elements.</p>
                        </div>
                    </div>

                </div>
            ) : (
                <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className="flex flex-col">
                        <h2 className="text-lg font-bold text-neutral-900 dark:text-white">A4 Stationery Upload</h2>
                        <p className="text-sm text-neutral-500">Upload a full A4 PDF letterhead. We will overlay the data directly onto your background without our own headers and footers.</p>
                    </div>
                    <label
                        className="w-full max-w-2xl aspect-[1/1.414] mx-auto rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-4 cursor-pointer transition-colors relative overflow-hidden group"
                        style={{ borderColor: `${primaryColor}80`, backgroundColor: `${primaryColor}08` }}
                    >
                        <input type="file" accept="application/pdf" className="hidden" onChange={handleStationeryUpload} />
                        {stationeryFile ? (
                            <div className="absolute inset-0 w-full h-full p-8 flex flex-col items-center justify-center bg-white dark:bg-[#111] text-center gap-4">
                                <CheckCircle2 className="w-16 h-16 text-emerald-500" />
                                <div>
                                    <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400 mb-1">Stationery Uploaded</p>
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
                                    <p className="text-sm text-neutral-500">Exactly A4 (210 × 297 mm). Pre-printed logos, footers, and watermarks are preserved.</p>
                                </div>
                            </>
                        )}
                    </label>
                </div>
            )}

            {/* Actions */}
            <div className="flex justify-end items-center gap-3 mt-2">
                <button
                    onClick={handlePreview}
                    disabled={isPreviewing}
                    className="flex items-center gap-2 px-5 py-2.5 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 disabled:opacity-60 text-neutral-900 dark:text-white text-sm font-bold rounded-lg transition-colors"
                >
                    {isPreviewing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
                    {isPreviewing ? 'Generating…' : 'Preview as PDF'}
                </button>
                <button
                    onClick={handleSaveSettings}
                    disabled={isSaving}
                    className="flex items-center gap-2 px-5 py-2.5 text-white text-sm font-bold rounded-lg shadow-sm transition-colors disabled:opacity-70"
                    style={{ backgroundColor: primaryColor }}
                >
                    {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                    {isSaving ? 'Saving…' : 'Save Branding'}
                </button>
            </div>
        </div>
    );
}
