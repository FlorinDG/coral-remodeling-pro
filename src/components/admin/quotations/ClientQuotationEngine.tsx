"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useDatabaseStore } from '@/components/admin/database/store';
import { ArrowLeft, User, Briefcase, FileText, Calendar } from 'lucide-react';
import { useTenant } from '@/context/TenantContext';
import { DragDropContext, Droppable } from '@hello-pangea/dnd';
import { Page, Block, BlockType } from '@/components/admin/database/types';
import QuotationRow from './QuotationRow'; // Assuming QuotationRow is a sibling component
import QuotationFooterReport from './QuotationFooterReport';
import { pdf } from '@react-pdf/renderer';
import { sendQuotationToClient } from '@/app/actions/send-quote';
import { QuotationPDFTemplate } from './QuotationPDFTemplate';
import PDFImportModal from './PDFImportModal';
import { canAccess } from '@/lib/feature-flags';

import { Bot, Mail, CloudUpload, AlertTriangle } from 'lucide-react';
import { Link } from '@/i18n/routing';
import { toast } from 'sonner';

const FALLBACK_PAGES: Page[] = [];

export default function ClientQuotationEngine({ id, locale }: { id: string, locale: string }) {
    const router = useRouter();
    const { activeModules, planType, resolveDbId } = useTenant();
    const hasProjects  = activeModules.includes('PROJECTS');
    const hasCRM       = activeModules.includes('CRM');
    // Library access: PRO+ feature (article search, save-to-library, PDF library import)
    const hasLibraryAccess = canAccess('QUOTATION_LIBRARY_SEARCH', planType);
    const getDatabase = useDatabaseStore(state => state.getDatabase);
    const updatePageBlocks = useDatabaseStore(state => state.updatePageBlocks);
    const updatePageProperty = useDatabaseStore(state => state.updatePageProperty);
    const createPage = useDatabaseStore(state => state.createPage);

    // Resolve tenant-scoped DB IDs once — stable across re-renders via useTenant context
    const quotationsDbId = resolveDbId('db-quotations');
    const clientsDbId    = resolveDbId('db-clients');

    const [isHydrated, setIsHydrated] = useState(false);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [isSending, setIsSending] = useState(false);
    const [isSavingToDrive, setIsSavingToDrive] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);
    const [tenantProfile, setTenantProfile] = useState<any>(null);

    useEffect(() => {
        useDatabaseStore.persist.onFinishHydration(() => setIsHydrated(true));
        setIsHydrated(useDatabaseStore.persist?.hasHydrated() || false);

        // Fetch specific SaaS branding metadata dynamically
        fetch('/api/tenant/profile').then(res => res.json()).then(data => {
            if (data && !data.error) setTenantProfile(data);
        }).catch(e => console.error("Failed to fetch tenant profile", e));
    }, []);

    const quotation = useDatabaseStore(state => {
        const db = state.databases.find(d => d.id === quotationsDbId);
        return db?.pages.find(p => p.id === id) || null;
    });

    const projects = useDatabaseStore(state => state.databases.find(d => d.id === 'db-1')?.pages || FALLBACK_PAGES);

    // Read the resolved clients database from Zustand
    const clientsDb = useDatabaseStore(state => state.databases.find(d => d.id === clientsDbId));

    // Derive client list with useMemo to avoid infinite re-render loops
    const clients = useMemo(() => {
        if (!clientsDb) return [];
        const nameProp = clientsDb.properties.find(p => ['naam', 'name', 'voornaam', 'first', 'firstname'].some(k => p.name.toLowerCase().includes(k)));
        const lastProp = clientsDb.properties.find(p => ['achternaam', 'last', 'lastname', 'familienaam'].some(k => p.name.toLowerCase().includes(k)));
        const emailProp = clientsDb.properties.find(p => p.name.toLowerCase().includes('email'));
        const driveProp = clientsDb.properties.find(p => p.name.toLowerCase().includes('drive'));
        const vatProp = clientsDb.properties.find(p => ['btw', 'vat', 'ondernemingsnummer', 'kbo', 'enterprise'].some(k => p.name.toLowerCase().includes(k)));
        const addressProp = clientsDb.properties.find(p => ['adres', 'address', 'straat', 'street'].some(k => p.name.toLowerCase().includes(k)));
        return clientsDb.pages.map(page => ({
            id: page.id,
            firstName: String(page.properties[nameProp?.id || 'title'] || page.properties['title'] || ''),
            lastName: String(page.properties[lastProp?.id || ''] || ''),
            email: emailProp ? String(page.properties[emailProp.id] || '') : null,
            driveFolderId: driveProp ? String(page.properties[driveProp.id] || '') : null,
            vatNumber: vatProp ? String(page.properties[vatProp.id] || '') : null,
            address: addressProp ? String(page.properties[addressProp.id] || '') : null,
        }));
    }, [clientsDb]);

    // Sync financial summary back to database properties for the grid view
    // Must be placed before early returns to satisfy Rules of Hooks
    useEffect(() => {
        if (!quotation || !isHydrated) return;
        const blocks = quotation.blocks || [];

        const calcTotals = (nodes: Block[]): { exVat: number; vat: number } => {
            return nodes.reduce((acc, block) => {
                if (block.isOptional) return acc;
                if (block.type === 'section' || block.type === 'subsection' || block.type === 'post') {
                    const childTotals = calcTotals(block.children || []);
                    return { exVat: acc.exVat + childTotals.exVat, vat: acc.vat + childTotals.vat };
                }
                const lineTotal = (block.verkoopPrice || 0) * (block.quantity || 1);
                const lineVatRate = block.vatMedecontractant ? 0 : (block.vatRate ?? 21);
                return { exVat: acc.exVat + lineTotal, vat: acc.vat + lineTotal * (lineVatRate / 100) };
            }, { exVat: 0, vat: 0 });
        };

        const vatMode = ((quotation.properties?.['vatCalcMode'] as string) || 'lines') as 'lines' | 'total';
        const vatReg = (quotation.properties?.['vatRegime'] as string) || '21';

        let totalExVat = 0;
        let totalVat = 0;

        if (vatMode === 'total') {
            const totals = calcTotals(blocks);
            totalExVat = totals.exVat;
            const rate = vatReg === 'medecontractant' ? 0 : parseFloat(vatReg) / 100;
            totalVat = totalExVat * rate;
        } else {
            const totals = calcTotals(blocks);
            totalExVat = totals.exVat;
            totalVat = totals.vat;
        }

        const roundedEx = Math.round(totalExVat * 100) / 100;
        const roundedVat = Math.round(totalVat * 100) / 100;
        const roundedInc = Math.round((totalExVat + totalVat) * 100) / 100;
        if (quotation.properties?.['totalExVat'] !== roundedEx) updatePageProperty(quotationsDbId, quotation.id, 'totalExVat', roundedEx);
        if (quotation.properties?.['totalVat'] !== roundedVat) updatePageProperty(quotationsDbId, quotation.id, 'totalVat', roundedVat);
        if (quotation.properties?.['totalIncVat'] !== roundedInc) updatePageProperty(quotationsDbId, quotation.id, 'totalIncVat', roundedInc);
    }, [quotation?.blocks, isHydrated]);

    if (!isHydrated) return <div className="flex h-screen items-center justify-center">Loading Engine...</div>;
    if (!quotation) return <div className="flex h-screen items-center justify-center flex-col gap-4"><h1>Quotation Not Found</h1><button onClick={() => router.back()} className="text-blue-500">Go Back</button></div>;

    const quotationTitle = quotation.properties?.['title'] || 'Draft Quotation';
    const rawClient = quotation.properties?.['client'];
    const clientId = Array.isArray(rawClient) ? (rawClient[0] || '') : (rawClient as string) || '';
    const rawProject = quotation.properties?.['project'];
    const projectId = Array.isArray(rawProject) ? (rawProject[0] || '') : (rawProject as string) || '';
    const betreft = (quotation.properties?.['betreft'] as string) || '';
    const quotationStatus = (quotation.properties?.['status'] as string) || '';
    const quotationDate = (quotation.properties?.['date'] as string) || '';
    const vatCalcMode = ((quotation.properties?.['vatCalcMode'] as string) || 'lines') as 'lines' | 'total';
    const vatRegime = (quotation.properties?.['vatRegime'] as string) || '21';

    const blocks = quotation.blocks || [];

    const handleUpdateBlock = (blockId: string, updates: Partial<Block>) => {
        const newBlocks = blocks.map(b => b.id === blockId ? { ...b, ...updates } : b);
        updatePageBlocks(quotationsDbId, id, newBlocks);
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
            updatePageBlocks(quotationsDbId, id, newBlocks);
        }
    };

    const handleDeleteBlock = (blockId: string) => {
        const newBlocks = blocks.filter(b => b.id !== blockId);
        updatePageBlocks(quotationsDbId, id, newBlocks);
    };

    const handleDuplicateBlock = (blockId: string) => {
        const blockToDuplicate = blocks.find(b => b.id === blockId);
        if (!blockToDuplicate) return;

        const newBlock: Block = { ...blockToDuplicate, id: crypto.randomUUID() };
        const index = blocks.findIndex(b => b.id === blockId);

        const newBlocks = [...blocks];
        newBlocks.splice(index + 1, 0, newBlock);

        updatePageBlocks(quotationsDbId, id, newBlocks);
    };

    const handleAddBlock = (type: Block['type'] = 'line') => {
        const newBlock: Block = { id: crypto.randomUUID(), type, content: '' };
        updatePageBlocks(quotationsDbId, id, [...blocks, newBlock]);
    };

    const handleImportComplete = (newBlocks: Block[]) => {
        updatePageBlocks('db-quotations', id, [...blocks, ...newBlocks]);
    };

    const handleUpdateProperty = (key: string, value: any) => {
        if (!quotation) return;
        updatePageProperty(quotationsDbId, quotation.id, key, value);
    };

    // Deep recursive total calculation mapping for all mathematical block mutations
    const calculateGrandTotal = (nodes: Block[]): number => {
        return nodes.reduce((sum, block) => {
            if (block.isOptional) return sum; // Phase 10: Ignore optional blocks globally

            if (block.type === 'section' || block.type === 'subsection' || block.type === 'post') {
                return sum + calculateGrandTotal(block.children || []);
            }
            return sum + ((block.verkoopPrice || 0) * (block.quantity || 1));
        }, 0);
    };

    const grandTotal = calculateGrandTotal(blocks);
    const vatAmount = grandTotal * 0.21;
    const totalIncVat = grandTotal + vatAmount;



    // Helper: build resolved client info for PDF templates
    const buildClientInfo = () => {
        const clientRecord = clients.find(c => c.id === clientId);
        return {
            name: `${clientRecord?.firstName || ''} ${clientRecord?.lastName || ''}`.trim() || 'Klant',
            address: clientRecord?.address || undefined,
            vatNumber: clientRecord?.vatNumber || undefined,
            email: clientRecord?.email || undefined,
        };
    };

    const docLanguage = tenantProfile?.documentLanguage || 'nl';

    const handleSendEmail = async () => {
        if (!clientId) return toast.warning('Selecteer eerst een klant om de offerte te versturen.');

        setIsSending(true);
        try {
            const clientRecord = clients.find(c => c.id === clientId);
            const clientEmail = String(clientRecord?.email || '');
            const clientName = String(`${clientRecord?.firstName || ''} ${clientRecord?.lastName || ''}`.trim() || 'Klant');
            const projectName = betreft || quotationTitle || 'Offerte';

            if (!clientEmail || clientEmail === 'undefined') {
                toast.error('Deze klant heeft geen geregistreerd e-mailadres in de database.');
                setIsSending(false);
                return;
            }

            const doc = (
                <QuotationPDFTemplate
                    blocks={blocks}
                    quotationTitle={String(quotationTitle)}
                    betreft={String(betreft)}
                    clientInfo={buildClientInfo()}
                    projectId={String(projectId)}
                    grandTotal={grandTotal}
                    databaseStoreState={useDatabaseStore.getState()}
                    tenantProfile={tenantProfile}
                    templateId={tenantProfile?.documentTemplate || 't1'}
                    language={docLanguage}
                />
            );

            const asPdf = pdf(doc);
            const blob = await asPdf.toBlob();

            const reader = new FileReader();
            reader.readAsDataURL(blob);
            reader.onloadend = async () => {
                const base64data = (reader.result as string).split(',')[1];
                const response = await sendQuotationToClient(
                    id, clientEmail, clientName, String(projectName),
                    `€${grandTotal.toFixed(2)}`, base64data,
                    undefined,
                    tenantProfile?.companyName || 'Coral Enterprises',
                    docLanguage,
                    tenantProfile?.brandColor
                );

                if (response.success) {
                    toast.success('Offerte is succesvol verzonden!');
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
                <QuotationPDFTemplate
                    blocks={blocks}
                    quotationTitle={String(quotationTitle)}
                    betreft={String(betreft)}
                    clientInfo={buildClientInfo()}
                    projectId={String(projectId)}
                    grandTotal={grandTotal}
                    databaseStoreState={useDatabaseStore.getState()}
                    tenantProfile={tenantProfile}
                    templateId={tenantProfile?.documentTemplate || 't1'}
                    language={docLanguage}
                />
            );

            const asPdf = pdf(doc);
            const blob = await asPdf.toBlob();

            const file = new File([blob], `Offerte_${quotationTitle || 'Draft'}.pdf`, { type: 'application/pdf' });
            const formData = new FormData();
            formData.append('file', file);
            formData.append('parentId', String(parentId));
            formData.append('targetSubfolder', 'Offertes');

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

    const handleHandover = () => {
        if (!clientId) return toast.warning('Selecteer eerst een klant om het project te starten.');

        // 1. Create a Project in db-1
        const newProject = createPage('db-1', {
            title: `[EXEC] ${betreft || quotationTitle}`,
            'prop-execution-status': 'opt-to-do',
            'prop-financial-status': 'opt-quote',
            'prop-client-relation': [clientId],
            'prop-budget': grandTotal
        });

        if (!newProject) {
            toast.error('Project aanmaken mislukt.');
            return;
        }

        // 2. Map blocks to Tasks in db-tasks
        const extractTasks = (nodes: Block[]) => {
            nodes.forEach(block => {
                if (block.type === 'line' || block.type === 'post') {
                    createPage('db-tasks', {
                        title: block.content || 'Uitvoerende Taak',
                        'prop-task-status': 'opt-todo',
                        'prop-task-project': [newProject.id]
                    });
                }
                if (block.children) {
                    extractTasks(block.children);
                }
            });
        };

        extractTasks(blocks);

        // 3. Link the quotation to the new project
        handleUpdateProperty('project', newProject.id);

        toast.success('Project aangemaakt en taken toegewezen!');

        // 4. Navigate to the new Bordereau route
        router.push(`/nl/admin/projects-management/bordereau/${newProject.id}`);
    };

    return (
        <div className="flex flex-col w-full h-full bg-white dark:bg-black text-neutral-900 dark:text-white">
            {/* Header Controls */}
            <div className="border-b border-neutral-200 dark:border-white/10 shrink-0">
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
                            placeholder="Draft Quotation"
                            className="bg-transparent text-lg font-bold tracking-tight text-neutral-900 dark:text-white outline-none focus:ring-0 placeholder:text-neutral-400 p-0 m-0 w-[280px]"
                        />
                        <p className="text-[10px] text-neutral-400 font-mono tracking-wider uppercase">
                            Offerte {quotationTitle}
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
                        {hasProjects && (
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
                        )}

                        {/* Status Selector */}
                        <div className="flex items-center bg-neutral-50 dark:bg-white/5 rounded-lg border border-neutral-200 dark:border-white/10 relative">
                            <FileText className="w-3.5 h-3.5 text-neutral-400 absolute left-2.5 pointer-events-none" />
                            <select
                                value={quotationStatus}
                                onChange={(e) => handleUpdateProperty('status', e.target.value)}
                                className="text-xs font-medium text-neutral-700 dark:text-neutral-300 bg-transparent border-none outline-none appearance-none cursor-pointer pl-7 pr-6 py-2 focus:ring-0 w-32 truncate"
                            >
                                <option value="">Status...</option>
                                <option value="opt-draft">Draft</option>
                                <option value="opt-sent">Sent</option>
                                <option value="opt-accepted">Accepted</option>
                                <option value="opt-rejected">Rejected</option>
                            </select>
                        </div>

                        {/* Date Input */}
                        <div className="flex items-center bg-neutral-50 dark:bg-white/5 rounded-lg border border-neutral-200 dark:border-white/10 relative">
                            <Calendar className="w-3.5 h-3.5 text-neutral-400 absolute left-2.5 pointer-events-none" />
                            <input
                                type="date"
                                value={quotationDate}
                                onChange={(e) => handleUpdateProperty('date', e.target.value)}
                                className="text-xs font-medium text-neutral-700 dark:text-neutral-300 bg-transparent border-none outline-none cursor-pointer pl-7 pr-3 py-2 focus:ring-0 w-36"
                            />
                        </div>
                    </div>

                    {/* Action Buttons — Monocolor brand-themed */}
                    <div className="flex items-center gap-1.5 shrink-0">
                        {hasProjects && isHydrated && (String(quotation?.properties?.['status']) === 'ACCEPTED' || String(quotation?.properties?.['status']) === 'opt-accepted' || String(quotation?.properties?.['prop-quote-status']) === 'opt-accepted' || String(quotation?.properties?.['prop-quote-status']) === 'ACCEPTED') && (
                            <button
                                onClick={handleHandover}
                                className="text-xs font-semibold px-3 py-2 rounded-lg transition-all flex items-center gap-1.5 border"
                                style={{
                                    backgroundColor: 'color-mix(in srgb, var(--brand-color, #d35400) 10%, white)',
                                    borderColor: 'color-mix(in srgb, var(--brand-color, #d35400) 25%, transparent)',
                                    color: 'var(--brand-color, #d35400)',
                                }}
                            >
                                <Briefcase className="w-3.5 h-3.5" /> Handover
                            </button>
                        )}
                        {hasCRM && isHydrated && (
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
                        {hasProjects && isHydrated && (
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
                                onClick={async () => {
                                    if (isDownloading) return;
                                    setIsDownloading(true);
                                    try {
                                        const doc = (
                                            <QuotationPDFTemplate
                                                blocks={blocks}
                                                quotationTitle={String(quotationTitle)}
                                                betreft={String(betreft)}
                                                clientInfo={buildClientInfo()}
                                                projectId={String(projectId)}
                                                grandTotal={grandTotal}
                                                databaseStoreState={useDatabaseStore.getState()}
                                                tenantProfile={tenantProfile}
                                                templateId={tenantProfile?.documentTemplate || 't1'}
                                                language={docLanguage}
                                            />
                                        );
                                        const blob = await pdf(doc).toBlob();
                                        const url = URL.createObjectURL(blob);
                                        const a = document.createElement('a');
                                        a.href = url;
                                        a.download = `Offerte_${quotationTitle || 'Draft'}.pdf`;
                                        a.click();
                                        setTimeout(() => URL.revokeObjectURL(url), 10000);
                                    } catch (e) {
                                        console.error('[PDF] export failed:', e);
                                        toast.error('PDF genereren mislukt.');
                                    } finally {
                                        setIsDownloading(false);
                                    }
                                }}
                                disabled={isDownloading}
                                className="text-xs font-semibold px-3 py-2 rounded-lg transition-all flex items-center gap-1.5 text-white hover:opacity-90 disabled:opacity-60"
                                style={{ backgroundColor: 'var(--brand-color, #d35400)' }}
                            >
                                <FileText className="w-3.5 h-3.5" />
                                {isDownloading ? 'Generating...' : 'Export PDF'}
                            </button>
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
                                        <QuotationRow
                                            key={block.id}
                                            block={block}
                                            index={index}
                                            onUpdate={handleUpdateBlock}
                                            onDelete={handleDeleteBlock}
                                            onDuplicate={handleDuplicateBlock}
                                            hasLibraryAccess={hasLibraryAccess}
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

                    {/* Phase 10: Financial Summary & Profitability */}
                    <QuotationFooterReport
                        blocks={blocks}
                        quotationTitle={String(quotationTitle)}
                        expiryDate={quotationDate}
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
        </div >
    );
}
