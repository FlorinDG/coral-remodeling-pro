"use client";

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useDatabaseStore } from '@/components/admin/database/store';
import { ArrowLeft, User, Briefcase, FileText, Check, X as XIcon } from 'lucide-react';
import { DragDropContext, Droppable } from '@hello-pangea/dnd';
import { Page, Block, BlockType } from '@/components/admin/database/types';
import InvoiceRow from './InvoiceRow';
import InvoiceFooterReport from './InvoiceFooterReport';
import { PDFDownloadLink, pdf } from '@react-pdf/renderer';
import { sendInvoiceToClient } from '@/app/actions/send-invoice';
import { updateInvoiceContact } from '@/app/actions/update-invoice';
import { InvoicePDFTemplate } from './InvoicePDFTemplate';
import PDFImportModal from './PDFImportModal';
import InlineDialog from '@/components/admin/shared/InlineDialog';
import { toast } from 'sonner';

import { Bot, Mail, CloudUpload, Send, AlertTriangle } from 'lucide-react';
import { Link } from '@/i18n/routing';

const FALLBACK_PAGES: Page[] = [];

export default function ClientInvoiceEngine({ id, locale }: { id: string, locale: string }) {
    const router = useRouter();
    const getDatabase = useDatabaseStore(state => state.getDatabase);
    const updatePageBlocks = useDatabaseStore(state => state.updatePageBlocks);
    const updatePageProperty = useDatabaseStore(state => state.updatePageProperty);

    const [isHydrated, setIsHydrated] = useState(false);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [isSending, setIsSending] = useState(false);
    const [isSavingToDrive, setIsSavingToDrive] = useState(false);
    const [isSendingPeppol, setIsSendingPeppol] = useState(false);
    const [tenantProfile, setTenantProfile] = useState<any>(null);
    const [offerteImportDialog, setOfferteImportDialog] = useState<{ open: boolean; quotationId: string; quotationTitle: string; lineCount: number }>({ open: false, quotationId: '', quotationTitle: '', lineCount: 0 });

    useEffect(() => {
        useDatabaseStore.persist.onFinishHydration(() => setIsHydrated(true));
        setIsHydrated(useDatabaseStore.persist?.hasHydrated() || false);

        // Fetch specific SaaS branding metadata dynamically
        fetch('/api/tenant/profile').then(res => res.json()).then(data => {
            if (data && !data.error) setTenantProfile(data);
        }).catch(e => console.error("Failed to fetch tenant profile", e));
    }, []);

    const invoice = useDatabaseStore(state => {
        const db = state.databases.find(d => d.id === 'db-invoices');
        return db?.pages.find(p => p.id === id) || null;
    });

    const projects = useDatabaseStore(state => state.databases.find(d => d.id === 'db-1')?.pages || FALLBACK_PAGES);

    // Read the raw db-clients database from Zustand (stable reference)
    const clientsDb = useDatabaseStore(state => state.databases.find(d => d.id === 'db-clients'));

    // Derive client list with useMemo to avoid infinite re-render loops
    const clients = useMemo(() => {
        if (!clientsDb) return [];
        const nameProp = clientsDb.properties.find(p => ['naam', 'name', 'voornaam', 'first', 'firstname'].some(k => p.name.toLowerCase().includes(k)));
        const lastProp = clientsDb.properties.find(p => ['achternaam', 'last', 'lastname', 'familienaam'].some(k => p.name.toLowerCase().includes(k)));
        const emailProp = clientsDb.properties.find(p => p.name.toLowerCase().includes('email'));
        const driveProp = clientsDb.properties.find(p => p.name.toLowerCase().includes('drive'));
        return clientsDb.pages.map(page => ({
            id: page.id,
            firstName: String(page.properties[nameProp?.id || 'title'] || page.properties['title'] || ''),
            lastName: String(page.properties[lastProp?.id || ''] || ''),
            email: emailProp ? String(page.properties[emailProp.id] || '') : null,
            driveFolderId: driveProp ? String(page.properties[driveProp.id] || '') : null
        }));
    }, [clientsDb]);

    // Read quotations database for linking
    const quotationsDb = useDatabaseStore(state => state.databases.find(d => d.id === 'db-quotations'));
    const quotations = useMemo(() => {
        if (!quotationsDb) return [];
        return quotationsDb.pages.map(page => ({
            id: page.id,
            title: String(page.properties['title'] || page.properties['betreft'] || 'Unnamed Offerte'),
        }));
    }, [quotationsDb]);

    if (!isHydrated) return <div className="flex h-screen items-center justify-center">Loading Engine...</div>;
    if (!invoice) return <div className="flex h-screen items-center justify-center flex-col gap-4"><h1>Invoice Not Found</h1><button onClick={() => router.back()} className="text-blue-500">Go Back</button></div>;

    const invoiceTitle = invoice.properties?.['title'] || 'Draft Invoice';
    const clientId = (invoice.properties?.['client'] as string) || '';
    const projectId = (invoice.properties?.['project'] as string) || '';
    const betreft = (invoice.properties?.['betreft'] as string) || '';
    const vatCalcMode = ((invoice.properties?.['vatCalcMode'] as string) || 'lines') as 'lines' | 'total';
    const vatRegime = (invoice.properties?.['vatRegime'] as string) || '21';

    const blocks = invoice.blocks || [];

    const handleUpdateBlock = (blockId: string, updates: Partial<Block>) => {
        const newBlocks = blocks.map(b => b.id === blockId ? { ...b, ...updates } : b);
        updatePageBlocks('db-invoices', id, newBlocks);
    };

    const handleDragEnd = (result: any) => {
        if (!result.destination) return;

        const { source, destination, draggableId } = result;

        if (source.droppableId === destination.droppableId && source.index === destination.index) {
            return;
        }

        // Deep clone tree to execute physical refactoring
        const newBlocks = JSON.parse(JSON.stringify(blocks)) as Block[];

        // Phase 11: Recursive Extractor
        let movedBlock: Block | null = null;
        const extractNode = (nodes: Block[]) => {
            for (let i = 0; i < nodes.length; i++) {
                if (nodes[i].id === draggableId) {
                    movedBlock = nodes.splice(i, 1)[0];
                    return true;
                }
                if (nodes[i].children && extractNode(nodes[i].children!)) return true;
            }
            return false;
        };

        // Phase 11: Recursive Injector
        const insertNode = (nodes: Block[], parentId: string) => {
            if (parentId === 'root') {
                nodes.splice(destination.index, 0, movedBlock!);
                return true;
            }
            for (let i = 0; i < nodes.length; i++) {
                if (nodes[i].id === parentId) {
                    nodes[i].children = nodes[i].children || [];
                    nodes[i].children!.splice(destination.index, 0, movedBlock!);
                    return true;
                }
                if (nodes[i].children && insertNode(nodes[i].children!, parentId)) return true;
            }
            return false;
        };

        extractNode(newBlocks);
        if (movedBlock) {
            insertNode(newBlocks, destination.droppableId);
            updatePageBlocks('db-invoices', id, newBlocks);
        }
    };

    const handleDeleteBlock = (blockId: string) => {
        const newBlocks = blocks.filter(b => b.id !== blockId);
        updatePageBlocks('db-invoices', id, newBlocks);
    };

    const handleDuplicateBlock = (blockId: string) => {
        const blockToDuplicate = blocks.find(b => b.id === blockId);
        if (!blockToDuplicate) return;

        const newBlock: Block = { ...blockToDuplicate, id: crypto.randomUUID() };
        const index = blocks.findIndex(b => b.id === blockId);

        const newBlocks = [...blocks];
        newBlocks.splice(index + 1, 0, newBlock);

        updatePageBlocks('db-invoices', id, newBlocks);
    };

    const handleAddBlock = (type: Block['type'] = 'line') => {
        const newBlock: Block = { id: crypto.randomUUID(), type, content: '' };
        updatePageBlocks('db-invoices', id, [...blocks, newBlock]);
    };

    const handleImportComplete = (newBlocks: Block[]) => {
        updatePageBlocks('db-invoices', id, [...blocks, ...newBlocks]);
    };

    const handleUpdateProperty = (key: string, value: any) => {
        if (!invoice) return;
        updatePageProperty('db-invoices', invoice.id, key, value);
        // Persist client relationship to Prisma
        if (key === 'client') {
            updateInvoiceContact(id, value).catch(console.error);
        }
    };

    // Deep-clone blocks with fresh IDs for import, mapping quotation verkoopPrice → invoice unitPrice
    const deepCloneBlocks = (sourceBlocks: Block[]): Block[] => {
        return sourceBlocks.map(block => ({
            ...block,
            id: crypto.randomUUID(),
            // Map quotation selling price to invoice unit price
            unitPrice: block.unitPrice || block.verkoopPrice || undefined,
            children: block.children ? deepCloneBlocks(block.children) : undefined,
        }));
    };

    // Filter blocks tree: keep only lines with non-zero verkoopPrice, and keep sections/subsections
    // that contain at least one priced line
    const filterPricedBlocks = (sourceBlocks: Block[]): Block[] => {
        return sourceBlocks.reduce<Block[]>((acc, block) => {
            if (block.type === 'section' || block.type === 'subsection' || block.type === 'post') {
                const filteredChildren = filterPricedBlocks(block.children || []);
                if (filteredChildren.length > 0) {
                    acc.push({ ...block, children: filteredChildren });
                }
            } else if (block.type === 'line') {
                const total = (block.verkoopPrice || 0) * (block.quantity || 1);
                if (total !== 0) {
                    acc.push(block);
                }
            } else {
                // Keep other block types as-is (paragraphs, headings, etc.)
                acc.push(block);
            }
            return acc;
        }, []);
    };

    // Count the total line items in a block tree
    const countLines = (sourceBlocks: Block[]): number => {
        return sourceBlocks.reduce((sum, block) => {
            if (block.type === 'section' || block.type === 'subsection' || block.type === 'post') {
                return sum + countLines(block.children || []);
            }
            if (block.type === 'line') return sum + 1;
            return sum;
        }, 0);
    };

    // Handle offerte selection — link and offer to import
    const handleOfferteSelect = (quotationId: string) => {
        handleUpdateProperty('quotation', quotationId);
        if (!quotationId) return;

        // Find the quotation's blocks
        const quotationPage = quotationsDb?.pages.find(p => p.id === quotationId);
        if (!quotationPage || !quotationPage.blocks?.length) {
            toast.info('Offerte gekoppeld, maar bevat geen regels om te importeren.');
            return;
        }

        const pricedBlocks = filterPricedBlocks(quotationPage.blocks);
        const lineCount = countLines(pricedBlocks);

        if (lineCount === 0) {
            toast.info('Offerte gekoppeld. Geen regels met prijs gevonden om te importeren.');
            return;
        }

        const quotationTitle = String(quotationPage.properties['title'] || quotationPage.properties['betreft'] || 'Offerte');
        setOfferteImportDialog({ open: true, quotationId, quotationTitle, lineCount });
    };

    // Execute the import
    const executeOfferteImport = () => {
        const quotationPage = quotationsDb?.pages.find(p => p.id === offerteImportDialog.quotationId);
        if (!quotationPage) return;

        const pricedBlocks = filterPricedBlocks(quotationPage.blocks || []);
        const clonedBlocks = deepCloneBlocks(pricedBlocks);
        updatePageBlocks('db-invoices', id, [...blocks, ...clonedBlocks]);
        toast.success(`${offerteImportDialog.lineCount} regels geïmporteerd uit "${offerteImportDialog.quotationTitle}".`);
    };

    // Deep recursive total calculation mapping for all mathematical block mutations
    const calculateGrandTotal = (nodes: Block[]): number => {
        return nodes.reduce((sum, block) => {
            if (block.isOptional) return sum; // Phase 10: Ignore optional blocks globally

            if (block.type === 'section' || block.type === 'subsection' || block.type === 'post') {
                return sum + calculateGrandTotal(block.children || []);
            }
            return sum + ((block.unitPrice || block.verkoopPrice || 0) * (block.quantity || 1));
        }, 0);
    };

    const grandTotal = calculateGrandTotal(blocks);

    const handleSendEmail = async () => {
        if (!clientId) return toast.warning('Selecteer eerst een klant om de factuur te versturen.');

        setIsSending(true);
        try {
            // Find client email from the relation database payload
            const clientRecord = clients.find(c => c.id === clientId);
            const clientEmail = String(clientRecord?.email || '');
            const clientName = String(`${clientRecord?.firstName || ''} ${clientRecord?.lastName || ''}`.trim() || 'Klant');
            const projectName = betreft || invoiceTitle || 'Factuur';

            if (!clientEmail || clientEmail === 'undefined') {
                toast.error('Deze klant heeft geen geregistreerd e-mailadres in de database.');
                setIsSending(false);
                return;
            }

            // Create React PDF document configuration
            const doc = (
                <InvoicePDFTemplate
                    blocks={blocks}
                    invoiceTitle={String(invoiceTitle)}
                    betreft={String(betreft)}
                    clientId={String(clientId)}
                    projectId={String(projectId)}
                    grandTotal={grandTotal}
                    databaseStoreState={useDatabaseStore.getState()}
                    tenantProfile={tenantProfile}
                    templateId={tenantProfile?.documentTemplate || 't1'}
                />
            );

            // Dynamically generate the PDF binary buffer natively
            const asPdf = pdf(doc);
            const blob = await asPdf.toBlob();

            // Convert to base64
            const reader = new FileReader();
            reader.readAsDataURL(blob);
            reader.onloadend = async () => {
                const base64data = (reader.result as string).split(',')[1];
                const response = await sendInvoiceToClient(id, clientEmail, clientName, String(projectName), `€${grandTotal.toFixed(2)}`, base64data);

                if (response.success) {
                    toast.success('Factuur is succesvol verzonden!');
                } else {
                    toast.error(`Fout bij verzenden: ${response.error}`);
                }
                setIsSending(false);
            };
        } catch (error) {
            console.error(error);
            toast.error('Er is iets misgegaan tijdens het genereren van de PDF.');
            setIsSending(false);
        }
    };

    const handleSaveToDrive = async () => {
        if (!clientId) return toast.warning('Selecteer eerst een klant om op te slaan in Google Drive.');

        const clientRecord = clients.find(c => c.id === clientId);
        const parentId = clientRecord?.driveFolderId;

        if (!parentId) {
            toast.warning('Deze klant heeft nog geen Google Drive folder. Synchroniseer de database eerst.');
            return;
        }

        setIsSavingToDrive(true);
        try {
            const doc = (
                <InvoicePDFTemplate
                    blocks={blocks}
                    invoiceTitle={String(invoiceTitle)}
                    betreft={String(betreft)}
                    clientId={String(clientId)}
                    projectId={String(projectId)}
                    grandTotal={grandTotal}
                    databaseStoreState={useDatabaseStore.getState()}
                    tenantProfile={tenantProfile}
                    templateId={tenantProfile?.documentTemplate || 't1'}
                />
            );

            const asPdf = pdf(doc);
            const blob = await asPdf.toBlob();

            const file = new File([blob], `Factuur_${invoiceTitle || 'Draft'}.pdf`, { type: 'application/pdf' });
            const formData = new FormData();
            formData.append('file', file);
            formData.append('parentId', String(parentId));
            formData.append('targetSubfolder', "Facturen & Creditnota's");

            const res = await fetch('/api/drive/upload', {
                method: 'POST',
                body: formData
            });

            const data = await res.json();
            if (data.success) {
                toast.success('Succesvol opgeslagen in Google Drive!');
            } else {
                toast.error(`Drive fout: ${data.error}`);
            }
        } catch (e: any) {
            console.error(e);
            toast.error('Er is iets misgegaan tijdens het opslaan: ' + e.message);
        } finally {
            setIsSavingToDrive(false);
        }
    };

    const handleSendPeppol = async () => {
        if (!clientId) return toast.warning('Selecteer eerst een klant!');
        setIsSendingPeppol(true);
        try {
            // Wait for DB sync to ensure all row calculations are mathematically synced with the backend store
            await new Promise(r => setTimeout(r, 800));

            const res = await fetch('/api/peppol/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    invoiceId: id,
                    clientId: clientId,
                    projectId: projectId,
                    betreft: betreft
                })
            });

            const data = await res.json();
            if (data.success) {
                toast.success('Factuur verzonden via Peppol/Storecove!');
            } else {
                toast.error(`Peppol fout: ${data.error}`);
            }
        } catch (e: any) {
            console.error(e);
            toast.error('Systeemfout tijdens de Storecove verbinding: ' + e.message);
        } finally {
            setIsSendingPeppol(false);
        }
    };

    const linkedQuotation = (invoice?.properties?.['quotation'] as string) || '';

    return (
        <div className="flex flex-col w-full h-full bg-white dark:bg-black text-neutral-900 dark:text-white">
            {/* Header Controls */}
            <div className="border-b border-neutral-200 dark:border-white/10 shrink-0">
                {/* Row 1: Title + Selectors + Actions */}
                <div className="flex items-center gap-4 px-4 py-3">
                    {/* Back + Title */}
                    <button
                        onClick={() => router.back()}
                        className="p-2 hover:bg-neutral-100 dark:hover:bg-white/5 rounded-md transition-colors shrink-0"
                    >
                        <ArrowLeft className="w-5 h-5 text-neutral-500" />
                    </button>
                    <div className="flex flex-col min-w-0 shrink-0">
                        <input
                            type="text"
                            value={betreft}
                            onChange={(e) => handleUpdateProperty('betreft', e.target.value)}
                            placeholder="Draft Invoice"
                            className="bg-transparent text-lg font-bold tracking-tight text-neutral-900 dark:text-white outline-none focus:ring-0 placeholder:text-neutral-400 p-0 m-0 w-[280px]"
                        />
                        <p className="text-[10px] text-neutral-400 font-mono tracking-wider uppercase">
                            Factuur {invoiceTitle}
                        </p>
                    </div>

                    {/* Separator */}
                    <div className="h-8 w-px bg-neutral-200 dark:bg-white/10 shrink-0" />

                    {/* Selectors */}
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                        {/* Client Selector */}
                        <div className="flex items-center bg-neutral-50 dark:bg-white/5 rounded-lg border border-neutral-200 dark:border-white/10 relative">
                            <User className="w-3.5 h-3.5 text-neutral-400 absolute left-2.5 pointer-events-none" />
                            <select
                                value={clientId}
                                onChange={(e) => handleUpdateProperty('client', e.target.value)}
                                className="text-xs font-medium text-neutral-700 dark:text-neutral-300 bg-transparent border-none outline-none appearance-none cursor-pointer pl-7 pr-6 py-2 focus:ring-0 w-44 truncate"
                            >
                                <option value="">Klant selecteren...</option>
                                {clients.map(client => (
                                    <option key={client.id} value={client.id} className="text-black dark:text-neutral-900">
                                        {client.firstName} {client.lastName}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Project Selector */}
                        <div className="flex items-center bg-neutral-50 dark:bg-white/5 rounded-lg border border-neutral-200 dark:border-white/10 relative">
                            <Briefcase className="w-3.5 h-3.5 text-neutral-400 absolute left-2.5 pointer-events-none" />
                            <select
                                value={projectId}
                                onChange={(e) => handleUpdateProperty('project', e.target.value)}
                                className="text-xs font-medium text-neutral-700 dark:text-neutral-300 bg-transparent border-none outline-none appearance-none cursor-pointer pl-7 pr-6 py-2 focus:ring-0 w-48 truncate"
                            >
                                <option value="">Project koppelen...</option>
                                {projects.map(project => (
                                    <option key={project.id} value={project.id} className="text-black dark:text-neutral-900">
                                        {String(project.properties['title'] || project.properties['name'] || 'Unnamed Project')}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Offerte Selector */}
                        <div className="flex items-center bg-neutral-50 dark:bg-white/5 rounded-lg border border-neutral-200 dark:border-white/10 relative">
                            <FileText className="w-3.5 h-3.5 text-neutral-400 absolute left-2.5 pointer-events-none" />
                            <select
                                value={linkedQuotation}
                                onChange={(e) => handleOfferteSelect(e.target.value)}
                                className="text-xs font-medium text-neutral-700 dark:text-neutral-300 bg-transparent border-none outline-none appearance-none cursor-pointer pl-7 pr-6 py-2 focus:ring-0 w-44 truncate"
                            >
                                <option value="">Offerte koppelen...</option>
                                {quotations.map(q => (
                                    <option key={q.id} value={q.id} className="text-black dark:text-neutral-900">
                                        {q.title}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Action Buttons — Monocolor brand-themed */}
                    <div className="flex items-center gap-1.5 shrink-0">
                        {isHydrated && (
                            <button
                                onClick={handleSendEmail}
                                disabled={isSending || !clientId}
                                className="text-xs font-semibold px-3 py-2 rounded-lg transition-all flex items-center gap-1.5 border disabled:opacity-40 disabled:cursor-not-allowed"
                                style={{
                                    backgroundColor: clientId ? 'color-mix(in srgb, var(--brand-color, #d35400) 10%, white)' : undefined,
                                    borderColor: clientId ? 'color-mix(in srgb, var(--brand-color, #d35400) 25%, transparent)' : undefined,
                                    color: clientId ? 'var(--brand-color, #d35400)' : undefined,
                                }}
                            >
                                <Mail className="w-3.5 h-3.5" /> {isSending ? 'Sending...' : 'Send'}
                            </button>
                        )}
                        {isHydrated && (
                            <button
                                onClick={handleSaveToDrive}
                                disabled={isSavingToDrive || !clientId}
                                className="text-xs font-semibold px-3 py-2 rounded-lg transition-all flex items-center gap-1.5 border disabled:opacity-40 disabled:cursor-not-allowed"
                                style={{
                                    backgroundColor: clientId ? 'color-mix(in srgb, var(--brand-color, #d35400) 10%, white)' : undefined,
                                    borderColor: clientId ? 'color-mix(in srgb, var(--brand-color, #d35400) 25%, transparent)' : undefined,
                                    color: clientId ? 'var(--brand-color, #d35400)' : undefined,
                                }}
                            >
                                <CloudUpload className="w-3.5 h-3.5" /> {isSavingToDrive ? 'Saving...' : 'Drive'}
                            </button>
                        )}
                        {isHydrated && (
                            <button
                                onClick={handleSendPeppol}
                                disabled={isSendingPeppol || !clientId}
                                className="text-xs font-semibold px-3 py-2 rounded-lg transition-all flex items-center gap-1.5 border disabled:opacity-40 disabled:cursor-not-allowed"
                                style={{
                                    backgroundColor: clientId ? 'color-mix(in srgb, var(--brand-color, #d35400) 10%, white)' : undefined,
                                    borderColor: clientId ? 'color-mix(in srgb, var(--brand-color, #d35400) 25%, transparent)' : undefined,
                                    color: clientId ? 'var(--brand-color, #d35400)' : undefined,
                                }}
                            >
                                <Send className="w-3.5 h-3.5" /> {isSendingPeppol ? 'Sending...' : 'Peppol'}
                            </button>
                        )}
                        {isHydrated && (
                            <PDFDownloadLink
                                document={
                                    <InvoicePDFTemplate
                                        blocks={blocks}
                                        invoiceTitle={String(invoiceTitle)}
                                        betreft={String(betreft)}
                                        clientId={String(clientId)}
                                        projectId={String(projectId)}
                                        grandTotal={grandTotal}
                                        databaseStoreState={useDatabaseStore.getState()}
                                        tenantProfile={tenantProfile}
                    templateId={tenantProfile?.documentTemplate || 't1'}
                                    />
                                }
                                fileName={`Factuur_${invoiceTitle || 'Draft'}.pdf`}
                                className="text-xs font-semibold px-3 py-2 rounded-lg transition-all flex items-center gap-1.5 text-white hover:opacity-90"
                                style={{ backgroundColor: 'var(--brand-color, #d35400)' }}
                            >
                                {({ blob, url, loading, error }) =>
                                    loading ? 'Generating...' : (
                                        <>
                                            <FileText className="w-3.5 h-3.5" /> Export PDF
                                        </>
                                    )
                                }
                            </PDFDownloadLink>
                        )}
                    </div>
                </div>
            </div>

            {tenantProfile && (!tenantProfile.companyName || !tenantProfile.vatNumber) && (
                <div className="bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-700/50 px-4 py-2.5 flex items-center justify-center gap-3 shrink-0">
                    <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-500 shrink-0" />
                    <p className="text-xs font-medium text-amber-800 dark:text-amber-300">
                        <strong>Identity Missing:</strong> Your PDF exports will appear incomplete. Please link your Company Name and VAT Number in the settings.
                    </p>
                    <Link href="/admin/settings/company-info" className="text-xs font-bold bg-amber-200 dark:bg-amber-600/30 text-amber-800 dark:text-amber-200 px-3 py-1 rounded hover:bg-amber-300 dark:hover:bg-amber-600/50 transition-colors ml-2">
                        Update Settings
                    </Link>
                </div>
            )}

            {/* Main Canvas Workspace */}
            <div className="flex-1 overflow-y-auto p-2 sm:p-4 relative bg-neutral-50/50 dark:bg-black">
                <div className="w-full max-w-[1400px] mx-auto flex flex-col gap-1 pb-32">

                    {/* Mathematical Blocks */}
                    <DragDropContext onDragEnd={handleDragEnd}>
                        <Droppable droppableId="root" type="block">
                            {(provided) => (
                                <div
                                    {...provided.droppableProps}
                                    ref={provided.innerRef}
                                    className="flex flex-col gap-1 w-full"
                                >
                                    {blocks.map((block, index) => (
                                        <InvoiceRow
                                            key={block.id}
                                            block={block}
                                            index={index}
                                            onUpdate={handleUpdateBlock}
                                            onDelete={handleDeleteBlock}
                                            onDuplicate={handleDuplicateBlock}
                                            vatCalcMode={vatCalcMode}
                                        />
                                    ))}
                                    {provided.placeholder}
                                </div>
                            )}
                        </Droppable>
                    </DragDropContext>

                    <div className="flex items-center gap-2 mt-2">
                        <button
                            onClick={() => handleAddBlock('section')}
                            className="text-xs font-semibold flex items-center gap-1 transition-colors py-1.5 px-3 rounded-lg shadow-sm text-white hover:opacity-90"
                            style={{ backgroundColor: 'var(--brand-color, #d35400)' }}
                        >
                            <span className="text-sm leading-none">+</span> Add Section
                        </button>
                        <button
                            onClick={() => handleAddBlock('line')}
                            className="text-xs font-semibold flex items-center gap-1 transition-colors py-1.5 px-3 rounded-lg shadow-sm border"
                            style={{
                                backgroundColor: 'color-mix(in srgb, var(--brand-color, #d35400) 6%, white)',
                                borderColor: 'color-mix(in srgb, var(--brand-color, #d35400) 20%, transparent)',
                                color: 'var(--brand-color, #d35400)',
                            }}
                        >
                            <span className="text-sm leading-none">+</span> Add Line
                        </button>
                        <div className="flex-1" />
                        <button
                            onClick={() => setIsImportModalOpen(true)}
                            className="text-xs font-semibold flex items-center gap-1.5 transition-colors py-1.5 px-3 rounded-lg shadow-sm border"
                            style={{
                                backgroundColor: 'color-mix(in srgb, var(--brand-color, #d35400) 6%, white)',
                                borderColor: 'color-mix(in srgb, var(--brand-color, #d35400) 20%, transparent)',
                                color: 'var(--brand-color, #d35400)',
                            }}
                        >
                            <Bot className="w-3.5 h-3.5" /> AI PDF Import
                        </button>
                    </div>

                    {/* Invoice Summary — Totals & VAT */}
                    <InvoiceFooterReport
                        blocks={blocks}
                        invoiceTitle={String(invoiceTitle)}
                        invoiceDate={invoice?.properties?.['invoiceDate'] as string}
                        dueDate={invoice?.properties?.['dueDate'] as string}
                        vatCalcMode={vatCalcMode}
                        vatRegime={vatRegime}
                        onVatCalcModeChange={(mode) => handleUpdateProperty('vatCalcMode', mode)}
                        onVatRegimeChange={(regime) => handleUpdateProperty('vatRegime', regime)}
                    />

                </div>
            </div>

            <PDFImportModal
                isOpen={isImportModalOpen}
                onClose={() => setIsImportModalOpen(false)}
                onImportComplete={handleImportComplete}
            />

            <InlineDialog
                isOpen={offerteImportDialog.open}
                onClose={() => setOfferteImportDialog(prev => ({ ...prev, open: false }))}
                onConfirm={executeOfferteImport}
                title="Regels importeren uit offerte?"
                message={
                    <div className="space-y-2">
                        <p>
                            De offerte <strong>"{offerteImportDialog.quotationTitle}"</strong> bevat{' '}
                            <strong>{offerteImportDialog.lineCount} regel{offerteImportDialog.lineCount !== 1 ? 's' : ''}</strong>{' '}
                            met een prijs.
                        </p>
                        <p className="text-neutral-500 dark:text-neutral-500">
                            De volledige structuur (secties, subsecties) wordt behouden. Regels zonder prijs worden overgeslagen.
                        </p>
                    </div>
                }
                confirmLabel="Importeren"
                cancelLabel="Alleen koppelen"
            />
        </div>
    );
}
