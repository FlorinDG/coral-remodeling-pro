"use client";

import React, { useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { acceptInvoice } from '@/app/actions/accept-invoice';
import { Block } from '@/components/admin/database/types';
import { PenTool, CheckCircle, FileText, AlertCircle } from 'lucide-react';

const SignatureCanvas = dynamic(() => import('react-signature-canvas'), { ssr: false });

export default function InvoiceViewer({ invoiceId, properties, blocks }: { invoiceId: string, properties: any, blocks: any }) {
    const sigCanvas = useRef<any>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isAccepted, setIsAccepted] = useState(properties?.status === 'ACCEPTED');
    const [error, setError] = useState('');

    const parsedBlocks = (Array.isArray(blocks) ? blocks : []) as Block[];
    const betreft = properties?.betreft || 'Factuur';
    const invoiceTitle = properties?.title || 'Concept';
    const existingSignature = properties?.clientSignature;
    const signedDate = properties?.signedAt;

    const calculateGrandTotal = (nodes: Block[]): number => {
        return nodes.reduce((sum, block) => {
            if (block.isOptional) return sum;
            if (block.type === 'section' || block.type === 'subsection' || block.type === 'post') {
                return sum + calculateGrandTotal(block.children || []);
            }
            return sum + ((block.verkoopPrice || 0) * (block.quantity || 1));
        }, 0);
    };

    const grandTotal = calculateGrandTotal(parsedBlocks);

    const clearSignature = () => {
        if (sigCanvas.current) {
            sigCanvas.current.clear();
        }
    };

    const handleAccept = async () => {
        if (!sigCanvas.current || sigCanvas.current.isEmpty()) {
            setError('Plaats a.u.b. uw handtekening voordat u akkoord gaat.');
            return;
        }

        setIsSubmitting(true);
        setError('');

        // Extract native Canvas base64 export
        const signatureBase64 = sigCanvas.current.getTrimmedCanvas().toDataURL('image/png');

        const result = await acceptInvoice(invoiceId, signatureBase64);
        if (result.success) {
            setIsAccepted(true);
        } else {
            setError(result.error || 'Er ging iets mis tijdens het verwerken van uw handtekening.');
            setIsSubmitting(false);
        }
    };

    return (
        <div className="flex flex-col gap-8 w-full">
            {/* Minimal Read-Only Presentation */}
            <div className="bg-white rounded-xl shadow-sm border border-neutral-200 overflow-hidden">
                <div className="p-8 border-b border-neutral-100 flex justify-between items-start">
                    <div>
                        <h1 className="text-2xl font-bold text-neutral-900">{betreft}</h1>
                        <p className="text-sm text-neutral-500 font-mono mt-1">REF: {invoiceTitle}</p>
                    </div>
                    <div className="text-right">
                        <p className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-1">Totaal Investering</p>
                        <p className="text-3xl font-black text-[#d75d00]">€{grandTotal.toFixed(2)}</p>
                    </div>
                </div>

                <div className="p-8 bg-neutral-50/50 flex flex-col items-center justify-center text-center gap-4 py-16">
                    <FileText className="w-12 h-12 text-neutral-300" />
                    <p className="text-neutral-500 max-w-sm">
                        De uitgebreide berekening en details van deze factuur vindt u in de originele PDF die u per e-mail is toegestuurd.
                    </p>
                </div>
            </div>

            {/* Interactive Signature Block */}
            <div className="bg-white rounded-xl shadow-sm border border-neutral-200 overflow-hidden">
                <div className="p-6 border-b border-neutral-100 bg-neutral-50 flex items-center gap-3">
                    <PenTool className="w-5 h-5 text-neutral-500" />
                    <h2 className="font-bold text-neutral-900">Digitaal Ondertekenen</h2>
                </div>

                <div className="p-6">
                    {isAccepted || existingSignature ? (
                        <div className="flex flex-col items-center justify-center py-8 gap-4">
                            <CheckCircle className="w-16 h-16 text-emerald-500" />
                            <div className="text-center">
                                <h3 className="text-xl font-bold text-emerald-600 mb-1">Factuur Succesvol Geaccepteerd!</h3>
                                <p className="text-neutral-500">Bedankt voor het vertrouwen. Wij nemen spoedig contact met u op.</p>
                                {signedDate && (
                                    <p className="text-xs text-neutral-400 mt-4">Ondertekend op: {new Date(signedDate).toLocaleString()}</p>
                                )}
                            </div>
                            {existingSignature && (
                                <div className="mt-6 p-4 border border-neutral-200 bg-white rounded-lg shadow-sm">
                                    <img src={existingSignature} alt="Handtekening" className="max-h-32 object-contain" />
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="flex flex-col gap-4">
                            <p className="text-sm text-neutral-600 mb-2">
                                Door hieronder te tekenen en op &quot;Factuur Accepteren&quot; te klikken, gaat u officieel akkoord met de uitvoering van het project.
                            </p>

                            {error && (
                                <div className="flex items-center gap-2 text-red-600 bg-red-50 p-3 rounded-lg text-sm border border-red-100">
                                    <AlertCircle className="w-4 h-4 shrink-0" />
                                    <span>{error}</span>
                                </div>
                            )}

                            <div className="bg-white border-2 border-dashed border-neutral-300 rounded-xl relative overflow-hidden group hover:border-[#d75d00]/50 transition-colors">
                                <SignatureCanvas
                                    {...{ ref: sigCanvas } as any}
                                    canvasProps={{ className: 'w-full h-64 cursor-crosshair' }}
                                    backgroundColor="transparent"
                                />
                                <div className="absolute top-4 right-4 text-xs font-bold text-neutral-300 uppercase tracking-widest pointer-events-none">
                                    Teken Hier
                                </div>
                            </div>

                            <div className="flex justify-between items-center mt-2">
                                <button
                                    onClick={clearSignature}
                                    className="text-sm font-medium text-neutral-500 hover:text-neutral-900 transition-colors px-4 py-2"
                                >
                                    Wissen
                                </button>
                                <button
                                    onClick={handleAccept}
                                    disabled={isSubmitting}
                                    className={`px-8 py-3 bg-[#d75d00] hover:bg-[#b04b00] text-white font-bold rounded-lg shadow-sm transition-all focus:ring-4 focus:ring-[#d75d00]/20 ${isSubmitting ? 'opacity-70 cursor-wait' : ''}`}
                                >
                                    {isSubmitting ? 'Bezig met verwerken...' : 'Factuur Accepteren'}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
