"use client";

import React, { useRef, useState, useCallback, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { acceptQuotation } from '@/app/actions/accept-quote';
import { Block } from '@/components/admin/database/types';
import { t } from '@/lib/document-i18n';
import {
    PenTool, CheckCircle, FileText, AlertCircle,
    Type, Upload, Pencil, Download, Clock, ChevronDown, ChevronUp, Sparkles
} from 'lucide-react';

const SignatureCanvas = dynamic(() => import('react-signature-canvas'), { ssr: false });

type SignatureMode = 'draw' | 'type' | 'upload';

interface TenantBranding {
    companyName: string;
    logoUrl: string | null;
    brandColor: string | null;
    email: string | null;
    vatNumber: string | null;
    planType: string;
}

interface QuotationViewerProps {
    quoteId: string;
    properties: any;
    blocks: any;
    tenant: TenantBranding;
    lang: string;
}

// --- Helpers ---

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) } : null;
}

function brandAlpha(color: string | null, alpha: number): string {
    if (!color) return `rgba(215, 93, 0, ${alpha})`;
    const rgb = hexToRgb(color);
    if (!rgb) return `rgba(215, 93, 0, ${alpha})`;
    return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
}

// --- Typed Signature Font Renderer ---
function TypedSignature({ name, color }: { name: string; color: string }) {
    return (
        <div className="flex items-center justify-center h-48 w-full">
            <span
                className="text-5xl select-none"
                style={{
                    fontFamily: "'Dancing Script', cursive",
                    color: color || '#1a1a1a',
                    letterSpacing: '2px',
                }}
            >
                {name || ''}
            </span>
        </div>
    );
}

// --- Quotation Line Item Table (Read-Only) ---
function QuoteLineItems({ blocks, lang, brandColor }: { blocks: Block[]; lang: string; brandColor: string }) {
    const renderBlock = (block: Block, depth: number = 0): React.ReactNode => {
        if (block.type === 'section' || block.type === 'subsection' || block.type === 'post') {
            const sectionTotal = calculateBlockTotal(block);
            return (
                <React.Fragment key={block.id}>
                    <tr className={`${depth === 0 ? 'border-t-2' : 'border-t'} border-neutral-200`}>
                        <td
                            colSpan={3}
                            className={`py-3 font-bold ${depth === 0 ? 'text-base' : 'text-sm text-neutral-600'}`}
                            style={{ paddingLeft: `${depth * 20 + 16}px` }}
                        >
                            <span dangerouslySetInnerHTML={{ __html: block.content || t('portal_section', lang) }} />
                            {block.isOptional && (
                                <span className="ml-2 text-xs font-normal text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                                    {t('portal_optional', lang)}
                                </span>
                            )}
                        </td>
                        <td className="py-3 text-right font-bold pr-4 tabular-nums whitespace-nowrap" style={{ color: brandColor }}>
                            {!block.isOptional && `€${sectionTotal.toFixed(2)}`}
                        </td>
                    </tr>
                    {(block.children || []).map(child => renderBlock(child, depth + 1))}
                </React.Fragment>
            );
        }

        // Regular line item
        const lineTotal = (block.verkoopPrice || 0) * (block.quantity || 1);
        if (block.isOptional) return null; // Hide optional items from client view

        return (
            <tr key={block.id} className="border-t border-neutral-100 hover:bg-neutral-50/50 transition-colors">
                <td className="py-2.5 text-sm text-neutral-700" style={{ paddingLeft: `${depth * 20 + 16}px` }}>
                    <span dangerouslySetInnerHTML={{ __html: block.content || '—' }} />
                </td>
                <td className="py-2.5 text-sm text-neutral-500 text-center tabular-nums whitespace-nowrap">
                    {block.quantity || 1} {block.unit || ''}
                </td>
                <td className="py-2.5 text-sm text-neutral-500 text-right tabular-nums whitespace-nowrap pr-2">
                    €{(block.verkoopPrice || 0).toFixed(2)}
                </td>
                <td className="py-2.5 text-sm text-neutral-900 text-right font-medium tabular-nums whitespace-nowrap pr-4">
                    €{lineTotal.toFixed(2)}
                </td>
            </tr>
        );
    };

    return (
        <div className="overflow-x-auto">
            <table className="w-full text-left">
                <thead>
                    <tr className="border-b-2 border-neutral-200">
                        <th className="py-3 pl-4 text-xs font-bold text-neutral-400 uppercase tracking-wider">{t('description', lang)}</th>
                        <th className="py-3 text-xs font-bold text-neutral-400 uppercase tracking-wider text-center">{t('qty', lang)}</th>
                        <th className="py-3 text-xs font-bold text-neutral-400 uppercase tracking-wider text-right pr-2">{t('unit_price', lang)}</th>
                        <th className="py-3 text-xs font-bold text-neutral-400 uppercase tracking-wider text-right pr-4">{t('total_excl', lang)}</th>
                    </tr>
                </thead>
                <tbody>
                    {blocks.map(block => renderBlock(block))}
                </tbody>
            </table>
        </div>
    );
}

function calculateBlockTotal(block: Block): number {
    if (block.isOptional) return 0;
    if (block.type === 'section' || block.type === 'subsection' || block.type === 'post') {
        return (block.children || []).reduce((sum, child) => sum + calculateBlockTotal(child), 0);
    }
    return (block.verkoopPrice || 0) * (block.quantity || 1);
}

function calculateGrandTotal(nodes: Block[]): number {
    return nodes.reduce((sum, block) => sum + calculateBlockTotal(block), 0);
}

// --- Main Component ---

export default function QuotationViewer({ quoteId, properties, blocks, tenant, lang }: QuotationViewerProps) {
    const sigCanvas = useRef<any>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isAccepted, setIsAccepted] = useState(properties?.status === 'ACCEPTED');
    const [error, setError] = useState('');
    const [signatureMode, setSignatureMode] = useState<SignatureMode>('draw');
    const [typedName, setTypedName] = useState('');
    const [uploadedSignature, setUploadedSignature] = useState<string | null>(null);
    const [consentChecked, setConsentChecked] = useState(false);
    const [consentName, setConsentName] = useState('');
    const [showDetails, setShowDetails] = useState(true);
    const [isTouch, setIsTouch] = useState(false);
    const [successAnim, setSuccessAnim] = useState(false);

    const parsedBlocks = (Array.isArray(blocks) ? blocks : []) as Block[];
    const betreft = properties?.betreft || t('quotation', lang);
    const quoteTitle = properties?.title || 'Concept';
    const existingSignature = properties?.clientSignature;
    const signedDate = properties?.signedAt;
    const validUntil = properties?.validUntil;

    const brandColor = tenant.brandColor || '#d75d00';
    const grandTotal = calculateGrandTotal(parsedBlocks);
    const vatAmount = grandTotal * 0.21;
    const totalInclVat = grandTotal + vatAmount;

    // Check expiration
    const isExpired = validUntil ? new Date(validUntil) < new Date() : false;

    // Detect touch device
    useEffect(() => {
        const touch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
        setIsTouch(touch);
        if (!touch) setSignatureMode('type'); // Default desktop to typed signature
    }, []);

    // Load Google Font for typed signature
    useEffect(() => {
        if (!document.querySelector('link[href*="Dancing+Script"]')) {
            const link = document.createElement('link');
            link.href = 'https://fonts.googleapis.com/css2?family=Dancing+Script:wght@400;700&display=swap';
            link.rel = 'stylesheet';
            document.head.appendChild(link);
        }
    }, []);

    const clearSignature = () => {
        if (signatureMode === 'draw' && sigCanvas.current) {
            sigCanvas.current.clear();
        } else if (signatureMode === 'type') {
            setTypedName('');
        } else if (signatureMode === 'upload') {
            setUploadedSignature(null);
        }
    };

    const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 2 * 1024 * 1024) {
            setError('File too large. Max 2MB.');
            return;
        }
        const reader = new FileReader();
        reader.onload = () => setUploadedSignature(reader.result as string);
        reader.readAsDataURL(file);
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        const file = e.dataTransfer.files[0];
        if (!file || !file.type.startsWith('image/')) return;
        if (file.size > 2 * 1024 * 1024) {
            setError('File too large. Max 2MB.');
            return;
        }
        const reader = new FileReader();
        reader.onload = () => setUploadedSignature(reader.result as string);
        reader.readAsDataURL(file);
    }, []);

    const getSignatureBase64 = (): string | null => {
        if (signatureMode === 'draw') {
            if (!sigCanvas.current || sigCanvas.current.isEmpty()) return null;
            return sigCanvas.current.getTrimmedCanvas().toDataURL('image/png');
        }
        if (signatureMode === 'type') {
            if (!typedName.trim() || typedName.trim().length < 2) return null;
            // Render typed name to a canvas for storage
            const canvas = document.createElement('canvas');
            canvas.width = 600;
            canvas.height = 200;
            const ctx = canvas.getContext('2d');
            if (!ctx) return null;
            ctx.fillStyle = 'transparent';
            ctx.fillRect(0, 0, 600, 200);
            ctx.font = '64px "Dancing Script", cursive';
            ctx.fillStyle = '#1a1a1a';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(typedName.trim(), 300, 100);
            return canvas.toDataURL('image/png');
        }
        if (signatureMode === 'upload') {
            return uploadedSignature;
        }
        return null;
    };

    const handleAccept = async () => {
        setError('');

        // Validation
        if (!consentChecked) {
            setError(t('portal_error_consent', lang));
            return;
        }
        if (!consentName.trim() || consentName.trim().length < 3) {
            setError(t('portal_error_name', lang));
            return;
        }

        const sig = getSignatureBase64();
        if (!sig) {
            setError(t('portal_error_signature', lang));
            return;
        }

        setIsSubmitting(true);

        const result = await acceptQuotation({
            quoteId,
            signatureBase64: sig,
            signatureMethod: signatureMode,
            consentName: consentName.trim(),
        });

        if (result.success) {
            setSuccessAnim(true);
            setTimeout(() => setIsAccepted(true), 600);
        } else {
            setError(result.error || t('portal_error_generic', lang));
            setIsSubmitting(false);
        }
    };

    const showPoweredBy = tenant.planType !== 'ENTERPRISE';

    // --- Render ---
    return (
        <div className="min-h-screen flex flex-col font-sans" style={{ backgroundColor: brandAlpha(brandColor, 0.04) }}>
            {/* Branded Header */}
            <header
                className="w-full border-b"
                style={{
                    backgroundColor: 'white',
                    borderColor: brandAlpha(brandColor, 0.15),
                }}
            >
                <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        {tenant.logoUrl ? (
                            <img
                                src={tenant.logoUrl}
                                alt={tenant.companyName}
                                className="h-10 w-auto object-contain"
                            />
                        ) : (
                            <div
                                className="h-10 w-10 rounded-lg flex items-center justify-center text-white font-black text-lg"
                                style={{ backgroundColor: brandColor }}
                            >
                                {tenant.companyName.charAt(0)}
                            </div>
                        )}
                        <span className="text-lg font-bold text-neutral-900 hidden sm:block">{tenant.companyName}</span>
                    </div>
                    <div className="text-right text-xs text-neutral-400 hidden sm:block">
                        {tenant.email && <div>{tenant.email}</div>}
                        {tenant.vatNumber && <div>{tenant.vatNumber}</div>}
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="flex-1 w-full max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-10 flex flex-col gap-6">

                {/* Expiration Banner */}
                {isExpired && (
                    <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 flex items-start gap-3">
                        <Clock className="w-5 h-5 shrink-0 mt-0.5" />
                        <p className="text-sm font-medium">{t('portal_expired', lang)}</p>
                    </div>
                )}

                {validUntil && !isExpired && (
                    <div className="flex items-center gap-2 text-sm text-neutral-500 bg-white border border-neutral-200 rounded-xl px-4 py-3 shadow-sm">
                        <Clock className="w-4 h-4" />
                        <span>{t('portal_valid_until', lang)} <strong>{new Date(validUntil).toLocaleDateString(lang === 'nl' ? 'nl-BE' : lang === 'fr' ? 'fr-BE' : 'en-GB')}</strong></span>
                    </div>
                )}

                {/* Quote Header Card */}
                <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 overflow-hidden">
                    <div className="p-6 sm:p-8 flex flex-col sm:flex-row justify-between items-start gap-4">
                        <div className="min-w-0">
                            <h1 className="text-xl sm:text-2xl font-bold text-neutral-900 break-words">{betreft}</h1>
                            <p className="text-sm text-neutral-500 font-mono mt-1">{t('portal_ref', lang)}: {quoteTitle}</p>
                        </div>
                        <div className="text-right shrink-0">
                            <p className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-1">{t('portal_total_investment', lang)}</p>
                            <p className="text-3xl sm:text-4xl font-black tabular-nums" style={{ color: brandColor }}>
                                €{totalInclVat.toFixed(2)}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Quotation Details — Collapsible */}
                <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 overflow-hidden">
                    <button
                        onClick={() => setShowDetails(!showDetails)}
                        className="w-full p-5 sm:p-6 flex items-center justify-between hover:bg-neutral-50 transition-colors"
                    >
                        <div className="flex items-center gap-3">
                            <FileText className="w-5 h-5 text-neutral-500" />
                            <h2 className="font-bold text-neutral-900">{t('portal_quotation_details', lang)}</h2>
                        </div>
                        {showDetails ? <ChevronUp className="w-5 h-5 text-neutral-400" /> : <ChevronDown className="w-5 h-5 text-neutral-400" />}
                    </button>

                    {showDetails && (
                        <div className="border-t border-neutral-100">
                            <QuoteLineItems blocks={parsedBlocks} lang={lang} brandColor={brandColor} />

                            {/* Totals Summary */}
                            <div className="border-t-2 border-neutral-200 p-6 sm:p-8">
                                <div className="flex flex-col gap-2 max-w-xs ml-auto">
                                    <div className="flex justify-between text-sm text-neutral-600">
                                        <span>{t('portal_subtotal', lang)}</span>
                                        <span className="tabular-nums font-medium">€{grandTotal.toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between text-sm text-neutral-600">
                                        <span>{t('portal_vat_21', lang)}</span>
                                        <span className="tabular-nums font-medium">€{vatAmount.toFixed(2)}</span>
                                    </div>
                                    <div className="border-t border-neutral-200 pt-2 mt-1 flex justify-between text-lg font-bold">
                                        <span>{t('portal_grand_total', lang)}</span>
                                        <span className="tabular-nums" style={{ color: brandColor }}>€{totalInclVat.toFixed(2)}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Signature Block */}
                <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 overflow-hidden">
                    <div className="p-5 sm:p-6 border-b border-neutral-100 flex items-center gap-3" style={{ backgroundColor: brandAlpha(brandColor, 0.03) }}>
                        <PenTool className="w-5 h-5 text-neutral-500" />
                        <h2 className="font-bold text-neutral-900">{t('portal_sign_title', lang)}</h2>
                    </div>

                    <div className="p-5 sm:p-6">
                        {isAccepted || existingSignature ? (
                            /* SUCCESS STATE */
                            <div className={`flex flex-col items-center justify-center py-8 sm:py-12 gap-4 transition-all duration-500 ${successAnim ? 'animate-pulse' : ''}`}>
                                <div className="relative">
                                    <CheckCircle className="w-20 h-20 text-emerald-500" />
                                    <Sparkles className="w-6 h-6 text-amber-400 absolute -top-1 -right-1 animate-bounce" />
                                </div>
                                <div className="text-center">
                                    <h3 className="text-xl sm:text-2xl font-bold text-emerald-600 mb-2">{t('portal_success_title', lang)}</h3>
                                    <p className="text-neutral-500 max-w-md">{t('portal_success_body', lang)}</p>
                                    {signedDate && (
                                        <p className="text-xs text-neutral-400 mt-4">
                                            {t('portal_signed_on', lang)}: {new Date(signedDate).toLocaleString(lang === 'nl' ? 'nl-BE' : lang === 'fr' ? 'fr-BE' : 'en-GB')}
                                        </p>
                                    )}
                                </div>
                                {existingSignature && (
                                    <div className="mt-6 p-4 border border-neutral-200 bg-neutral-50 rounded-xl shadow-sm">
                                        <img src={existingSignature} alt="Signature" className="max-h-32 object-contain" />
                                    </div>
                                )}
                            </div>
                        ) : isExpired ? (
                            /* EXPIRED STATE */
                            <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
                                <Clock className="w-12 h-12 text-neutral-300" />
                                <p className="text-neutral-500 text-sm max-w-sm">{t('portal_expired', lang)}</p>
                            </div>
                        ) : (
                            /* SIGNING STATE */
                            <div className="flex flex-col gap-5">
                                {/* Error */}
                                {error && (
                                    <div className="flex items-center gap-2 text-red-600 bg-red-50 p-3 rounded-lg text-sm border border-red-100">
                                        <AlertCircle className="w-4 h-4 shrink-0" />
                                        <span>{error}</span>
                                    </div>
                                )}

                                {/* Signature Mode Tabs */}
                                <div className="flex rounded-xl overflow-hidden border border-neutral-200 bg-neutral-100">
                                    {[
                                        { mode: 'draw' as const, icon: Pencil, label: t('portal_tab_draw', lang) },
                                        { mode: 'type' as const, icon: Type, label: t('portal_tab_type', lang) },
                                        { mode: 'upload' as const, icon: Upload, label: t('portal_tab_upload', lang) },
                                    ].map(({ mode, icon: Icon, label }) => (
                                        <button
                                            key={mode}
                                            onClick={() => setSignatureMode(mode)}
                                            className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 text-sm font-medium transition-all ${signatureMode === mode
                                                ? 'bg-white text-neutral-900 shadow-sm'
                                                : 'text-neutral-500 hover:text-neutral-700'
                                                }`}
                                        >
                                            <Icon className="w-4 h-4" />
                                            <span className="hidden sm:inline">{label}</span>
                                        </button>
                                    ))}
                                </div>

                                {/* Draw Mode */}
                                {signatureMode === 'draw' && (
                                    <div
                                        className="bg-white border-2 border-dashed rounded-xl relative overflow-hidden transition-colors"
                                        style={{ borderColor: brandAlpha(brandColor, 0.3) }}
                                    >
                                        <SignatureCanvas
                                            {...{ ref: sigCanvas } as any}
                                            canvasProps={{ className: 'w-full h-48 sm:h-64 cursor-crosshair' }}
                                            backgroundColor="transparent"
                                        />
                                        <div className="absolute top-4 right-4 text-xs font-bold uppercase tracking-widest pointer-events-none" style={{ color: brandAlpha(brandColor, 0.2) }}>
                                            {t('portal_draw_hint', lang)}
                                        </div>
                                    </div>
                                )}

                                {/* Type Mode */}
                                {signatureMode === 'type' && (
                                    <div className="flex flex-col gap-3">
                                        <input
                                            type="text"
                                            value={typedName}
                                            onChange={(e) => setTypedName(e.target.value)}
                                            placeholder={t('portal_type_placeholder', lang)}
                                            maxLength={80}
                                            className="w-full px-4 py-3 border border-neutral-300 rounded-xl text-base focus:outline-none focus:ring-2 transition-colors"
                                            style={{ focusRingColor: brandColor } as any}
                                        />
                                        <div
                                            className="border-2 border-dashed rounded-xl bg-neutral-50/50"
                                            style={{ borderColor: brandAlpha(brandColor, 0.2) }}
                                        >
                                            <TypedSignature name={typedName} color={brandColor} />
                                        </div>
                                    </div>
                                )}

                                {/* Upload Mode */}
                                {signatureMode === 'upload' && (
                                    <div
                                        className="border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer hover:bg-neutral-50"
                                        style={{ borderColor: brandAlpha(brandColor, 0.3) }}
                                        onClick={() => fileInputRef.current?.click()}
                                        onDragOver={(e) => e.preventDefault()}
                                        onDrop={handleDrop}
                                    >
                                        <input
                                            ref={fileInputRef}
                                            type="file"
                                            accept="image/png,image/jpeg"
                                            onChange={handleFileUpload}
                                            className="hidden"
                                        />
                                        {uploadedSignature ? (
                                            <div className="flex flex-col items-center gap-3">
                                                <img src={uploadedSignature} alt="Uploaded signature" className="max-h-32 object-contain rounded" />
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); setUploadedSignature(null); }}
                                                    className="text-xs text-red-500 hover:text-red-700 font-medium"
                                                >
                                                    {t('portal_clear', lang)}
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="flex flex-col items-center gap-2">
                                                <Upload className="w-10 h-10 text-neutral-300" />
                                                <p className="text-sm text-neutral-500">{t('portal_upload_hint', lang)}</p>
                                                <p className="text-xs text-neutral-400">{t('portal_upload_formats', lang)}</p>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Clear Button */}
                                <div className="flex justify-start">
                                    <button
                                        onClick={clearSignature}
                                        className="text-sm font-medium text-neutral-400 hover:text-neutral-700 transition-colors px-1 py-1"
                                    >
                                        {t('portal_clear', lang)}
                                    </button>
                                </div>

                                {/* Consent Block */}
                                <div className="border border-neutral-200 rounded-xl p-4 sm:p-5 bg-neutral-50/50 flex flex-col gap-4">
                                    <label className="flex items-start gap-3 cursor-pointer select-none">
                                        <input
                                            type="checkbox"
                                            checked={consentChecked}
                                            onChange={(e) => setConsentChecked(e.target.checked)}
                                            className="mt-0.5 w-5 h-5 rounded border-neutral-300 accent-current shrink-0"
                                            style={{ accentColor: brandColor }}
                                        />
                                        <span className="text-sm text-neutral-700 leading-relaxed">
                                            {t('portal_consent_text', lang)}
                                        </span>
                                    </label>
                                    <div className="flex flex-col gap-1.5">
                                        <label className="text-xs font-bold text-neutral-500 uppercase tracking-wider">
                                            {t('portal_consent_name_label', lang)}
                                        </label>
                                        <input
                                            type="text"
                                            value={consentName}
                                            onChange={(e) => setConsentName(e.target.value)}
                                            placeholder={t('portal_consent_name_placeholder', lang)}
                                            maxLength={100}
                                            className="w-full px-4 py-2.5 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 transition-colors"
                                            style={{ '--tw-ring-color': brandColor } as any}
                                        />
                                    </div>
                                </div>

                                {/* Accept Button */}
                                <button
                                    onClick={handleAccept}
                                    disabled={isSubmitting || !consentChecked || consentName.trim().length < 3}
                                    className="w-full py-4 text-white font-bold rounded-xl shadow-lg transition-all text-base disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
                                    style={{
                                        backgroundColor: isSubmitting ? brandAlpha(brandColor, 0.7) : brandColor,
                                    }}
                                >
                                    {isSubmitting ? t('portal_processing', lang) : t('portal_accept_button', lang)}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </main>

            {/* Powered By Footer */}
            {showPoweredBy && (
                <footer className="w-full py-6 text-center">
                    <a
                        href="https://coral-group.be"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-neutral-300 hover:text-neutral-500 transition-colors inline-flex items-center gap-1.5"
                    >
                        {t('portal_powered_by', lang)} <span className="font-semibold">CoralOS</span> · Coral Enterprises
                    </a>
                </footer>
            )}
        </div>
    );
}
