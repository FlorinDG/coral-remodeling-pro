/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useDatabaseStore } from '@/components/admin/database/store';
import { ArrowLeft, User, Briefcase, FileText, Check, X as XIcon, ReceiptText, PanelRight, Trash2, ExternalLink, Plus, Info, Database } from 'lucide-react';
import { useTenant } from '@/context/TenantContext';
import { DragDropContext, Droppable } from '@hello-pangea/dnd';
import { Page, Block, BlockType } from '@/components/admin/database/types';
import InvoiceRow from './InvoiceRow';
import InvoiceFooterReport from './InvoiceFooterReport';
import { pdf } from '@react-pdf/renderer';
import { generatePdfBlob } from '@/lib/generate-pdf';
import { sendInvoiceToClient } from '@/app/actions/send-invoice';
import { getInvoiceById } from '@/app/actions/get-invoice';
import { updateInvoiceContact } from '@/app/actions/update-invoice';
import { createPrismaInvoice } from '@/app/actions/create-invoice';
import { getNextDocumentNumber } from '@/app/actions/next-document-number';

import { InvoicePDFTemplate } from './InvoicePDFTemplate';
import PDFImportModal from './PDFImportModal';
import { QuoteSendModal } from '../quotations/QuoteSendModal';
import { calculateInvoiceTotals } from '@/lib/invoice-totals';
import InlineDialog from '@/components/admin/shared/InlineDialog';
import DbPropertiesPanel from '@/components/admin/database/components/DbPropertiesPanel';
import ErrorBoundary from '@/components/common/ErrorBoundary';
import { toast } from 'sonner';
import { createPageServerFirst } from '@/app/actions/pages';
import { t } from '@/lib/document-i18n';
import CreateClientModal from './CreateClientModal';
import CreateProjectModal from './CreateProjectModal';
import SearchableSelect from '@/components/ui/SearchableSelect';
import { Bot, Mail, CloudUpload, Send, AlertTriangle, ChevronDown, Search, Type, ImageIcon } from 'lucide-react';
import { Link } from '@/i18n/routing';

const FALLBACK_PAGES: Page[] = [];

export default function ClientInvoiceEngine({ id, locale }: { id: string, locale: string }) {
    const router = useRouter();
    const { activeModules, resolveDbId, tenant } = useTenant();
    const hasProjects = activeModules.includes('PROJECTS');
    const getDatabase = useDatabaseStore(state => state.getDatabase);
    const updatePageBlocks = useDatabaseStore(state => state.updatePageBlocks);
    const updatePageProperty = useDatabaseStore(state => state.updatePageProperty);
    const createPage = useDatabaseStore(state => state.createPage);

    // Resolve tenant-scoped DB IDs — handles both bare ('db-invoices') and scoped ('db-invoices-xxx')
    const invoicesDbId   = resolveDbId('db-invoices');
    const clientsDbId    = resolveDbId('db-clients');
    const projectDbId    = resolveDbId('db-1');
    const quotationsDbId = resolveDbId('db-quotations');

    const [isHydrated, setIsHydrated] = useState(() => {
        if (typeof window === "undefined") return false;
        return useDatabaseStore.persist?.hasHydrated() || false;
    });
    const [hydrationAttempted, setHydrationAttempted] = useState(false);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [isSending, setIsSending] = useState(false);
    const [isSavingToDrive, setIsSavingToDrive] = useState(false);
    const [isSendingPeppol, setIsSendingPeppol] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);
    const [showProperties, setShowProperties] = useState(false);
    const [offerteImportDialog, setOfferteImportDialog] = useState<{ open: boolean; quotationId: string; quotationTitle: string; lineCount: number }>({ open: false, quotationId: '', quotationTitle: '', lineCount: 0 });
    const [peppolLimitDialog, setPeppolLimitDialog] = useState(false);
    const [showNewClientModal, setShowNewClientModal] = useState(false);
    const [showNewProjectModal, setShowNewProjectModal] = useState(false);
    const [isQuotationDropdownOpen, setIsQuotationDropdownOpen] = useState(false);
    const [isStatusDropdownOpen, setIsStatusDropdownOpen] = useState(false);
    const [quotationSearch, setQuotationSearch] = useState('');
    const [importedQuotationIds, setImportedQuotationIds] = useState<string[]>([]);
    const quotationContainerRef = useRef<HTMLDivElement>(null);

    // Close quotation dropdown on outside click
    useEffect(() => {
        if (!isQuotationDropdownOpen) return;
        const handleClick = (e: MouseEvent) => {
            if (quotationContainerRef.current && !quotationContainerRef.current.contains(e.target as Node)) {
                setIsQuotationDropdownOpen(false);
                setQuotationSearch('');
            }
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, [isQuotationDropdownOpen]);

    useEffect(() => {
        const unsubscribe = useDatabaseStore.persist.onFinishHydration(() => setIsHydrated(true));

        return () => {
            if (unsubscribe) unsubscribe();
        };
    }, []);

    const invoice = useDatabaseStore(state => {
        const db = state.databases.find(d => d.id === invoicesDbId);
        return db?.pages.find(p => p.id === id) || null;
    });

    // Hydrate from Prisma if Zustand store doesn't have this invoice (different browser/cleared cache)
    useEffect(() => {
        if (!isHydrated || invoice || hydrationAttempted) return;
        setHydrationAttempted(true);

        getInvoiceById(id).then(result => {
            if (result.success && result.invoice) {
                const inv = result.invoice;
                const db = useDatabaseStore.getState().databases.find(d => d.id === invoicesDbId);
                if (db && !db.pages.find(p => p.id === inv.id)) {
                    useDatabaseStore.getState().addConfirmedPage({
                        id: inv.id,
                        databaseId: invoicesDbId,
                        createdBy: '',
                        lastEditedBy: '',
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString(),
                        properties: {
                            title: inv.invoiceNumber,
                            status: inv.status === 'DRAFT' ? 'opt-unpaid' : inv.status.toLowerCase(),
                            client: inv.contactId || '',
                            betreft: '',
                            date: inv.issueDate,
                            dueDate: inv.dueDate,
                            isLocked: inv.isLocked,
                            snapshotData: inv.snapshotData as any,
                            peppolDocumentId: inv.peppolDocumentId,
                            peppolState: inv.peppolState,
                            parentInvoiceId: inv.parentInvoiceId ? [inv.parentInvoiceId] : [],
                            docType: inv.type === 'CREDIT_NOTE' ? 'opt-credit-note' : (inv.type === 'PROFORMA' ? 'opt-proforma' : 'opt-invoice'),
                        },
                        blocks: [],
                    });
                }
            }
        }).catch(console.error);
    }, [isHydrated, invoice, hydrationAttempted, id, invoicesDbId]);

    // Initialize importedQuotationIds once when the invoice is loaded
    useEffect(() => {
        if (invoice && importedQuotationIds.length === 0) {
            const raw = invoice.properties?.['quotation'];
            const initialIds = Array.isArray(raw)
                ? raw.filter(Boolean).map(String)
                : [String(raw)].filter(Boolean);
            if (initialIds.length > 0) {
                setImportedQuotationIds(initialIds);
            }
        }
    }, [invoice, importedQuotationIds.length]);

    const projects = useDatabaseStore(state => state.databases.find(d => d.id === projectDbId)?.pages || FALLBACK_PAGES);

    const clientsDb = useDatabaseStore(state => state.databases.find(d => d.id === clientsDbId));

    // Derive client list with useMemo to avoid infinite re-render loops
    const clients = useMemo(() => {
        if (!clientsDb) return [];
        const nameProp = clientsDb.properties.find(p => ['naam', 'name', 'voornaam', 'first', 'firstname', 'prénom', 'prenom'].some(k => p.name.toLowerCase().includes(k)));
        const lastProp = clientsDb.properties.find(p => ['achternaam', 'last', 'lastname', 'familienaam', 'nom'].some(k => p.name.toLowerCase().includes(k)));
        const emailProp = clientsDb.properties.find(p => p.type === 'email') || clientsDb.properties.find(p => ['email', 'e-mail', 'mail', 'courriel'].some(k => p.name.toLowerCase().includes(k)));
        const driveProp = clientsDb.properties.find(p => p.type === 'url' && p.name.toLowerCase().includes('drive')) || clientsDb.properties.find(p => p.name.toLowerCase().includes('drive'));
        const vatProp = clientsDb.properties.find(p => ['btw', 'vat', 'ondernemingsnummer', 'kbo', 'enterprise', 'tva'].some(k => p.name.toLowerCase().includes(k)));
        const addressProp = clientsDb.properties.find(p => ['adres', 'address', 'straat', 'street', 'rue'].some(k => p.name.toLowerCase().includes(k)));
        const postalProp = clientsDb.properties.find(p => ['postal', 'zip', 'postcode', 'code postal'].some(k => p.name.toLowerCase().includes(k)));
        const cityProp = clientsDb.properties.find(p => ['city', 'stad', 'gemeente', 'town', 'ville'].some(k => p.name.toLowerCase().includes(k)));
        const countryProp = clientsDb.properties.find(p => ['country', 'land', 'pays'].some(k => p.name.toLowerCase().includes(k)));
        const langProp = clientsDb.properties.find(p => p.id === 'language') || clientsDb.properties.find(p => ['taal', 'language', 'lang', 'langue'].some(k => p.name.toLowerCase().includes(k)));
        
        return clientsDb.pages.map(page => {
            const street = addressProp ? String(page.properties[addressProp.id] || '').trim() : '';
            const postal = postalProp ? String(page.properties[postalProp.id] || '').trim() : '';
            const city = cityProp ? String(page.properties[cityProp.id] || '').trim() : '';
            const country = countryProp ? String(page.properties[countryProp.id] || '').trim() : '';

            let fullAddress = street;
            if (postal || city) {
                fullAddress += (fullAddress ? ', ' : '') + [postal, city].filter(Boolean).join(' ');
            }
            if (country) {
                fullAddress += (fullAddress ? ', ' : '') + country;
            } else if (fullAddress) {
                fullAddress += ', België';
            }

            return {
                id: page.id,
                firstName: String(page.properties[nameProp?.id || 'title'] || page.properties['title'] || ''),
                lastName: String(page.properties[lastProp?.id || ''] || ''),
                email: emailProp ? String(page.properties[emailProp.id] || '') : null,
                driveFolderId: driveProp ? String(page.properties[driveProp.id] || '') : null,
                vatNumber: vatProp ? String(page.properties[vatProp.id] || '') : null,
                address: fullAddress || null,
                language: langProp ? String(page.properties[langProp.id] || '') : 'lang-nl',
            };
        });
    }, [clientsDb]);

    // Read quotations database for linking
    const quotationsDb = useDatabaseStore(state => state.databases.find(d => d.id === quotationsDbId));
    const quotations = useMemo(() => {
        if (!quotationsDb) return [];
        return quotationsDb.pages.map(page => ({
            id: page.id,
            title: String(page.properties['title'] || 'Unnamed Offerte'),
            betreft: String(page.properties['betreft'] || ''),
        })).sort((a, b) => b.title.localeCompare(a.title, undefined, { numeric: true, sensitivity: 'base' }));
    }, [quotationsDb]);

    // Find credit notes linked to this invoice — MUST be before early returns (Rules of Hooks)
    const creditNotes = useMemo(() => {
        if (!invoice) return [];
        const db = useDatabaseStore.getState().databases.find(d => d.id === invoicesDbId);
        if (!db) return [];
        const invoiceNum = String(invoice.properties?.['title'] || '');
        if (!invoiceNum) return [];
        return db.pages.filter(p => {
            const parentId = p.properties['parentInvoiceId'];
            const isMatch = Array.isArray(parentId) ? parentId.includes(id) : parentId === id;
            if (isMatch) return true; // Follow explicit link
            return false;
        });
    }, [invoice, id]);

    const creditedTotal = creditNotes.reduce((sum, cn) => sum + Math.abs(Number(cn.properties['totalIncVat']) || 0), 0);
    const creditNoteInfos = creditNotes.map(cn => ({
        id: cn.id,
        title: String(cn.properties['title'] || 'Credit Note'),
        amount: Number(cn.properties['totalIncVat']) || 0,
    }));

    // Sync financial summary back to database properties for the grid view
    // Must be placed before early returns to satisfy Rules of Hooks
    useEffect(() => {
        if (!invoice || !isHydrated) return;
        const blocks = invoice.blocks || [];

        const vatMode = ((invoice.properties?.['vatCalcMode'] as string) || 'lines') as 'lines' | 'total';
        const vatReg = (invoice.properties?.['vatRegime'] as string) || '21';

        const totals = calculateInvoiceTotals(blocks, { vatCalcMode: vatMode, vatRegime: vatReg });
        const roundedEx = totals.subtotal;
        const roundedVat = totals.totalVAT;
        const roundedInc = totals.totalInclVAT;

        if (invoice.properties?.['totalExVat'] !== roundedEx) updatePageProperty(invoicesDbId, invoice.id, 'totalExVat', roundedEx);
        if (invoice.properties?.['totalVat'] !== roundedVat) updatePageProperty(invoicesDbId, invoice.id, 'totalVat', roundedVat);
        if (invoice.properties?.['totalIncVat'] !== roundedInc) updatePageProperty(invoicesDbId, invoice.id, 'totalIncVat', roundedInc);

        // Status update logic for credit notes
        // Guard: never overwrite terminal statuses (paid, uncollectible) with credited status
        const currentStatus = String(invoice.properties?.['status'] || 'opt-draft');
        const terminalStatuses = ['opt-paid', 'opt-uncollectible'];
        if (!terminalStatuses.includes(currentStatus)) {
            if (creditedTotal >= roundedInc && roundedInc > 0) {
                if (currentStatus !== 'opt-credited') {
                    updatePageProperty(invoicesDbId, invoice.id, 'status', 'opt-credited');
                }
            } else if (creditedTotal > 0 && roundedInc > 0) {
                if (currentStatus !== 'opt-partially-credited') {
                    updatePageProperty(invoicesDbId, invoice.id, 'status', 'opt-partially-credited');
                }
            }
        }

        // FIN-4: Persist credited % and amount for grid visibility
        const creditedPct = roundedInc > 0 ? Math.round((creditedTotal / roundedInc) * 100) : 0;
        const creditedDisplay = creditedTotal > 0
            ? `${creditedPct}% — €${new Intl.NumberFormat('nl-BE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(creditedTotal)}`
            : '';
        if (invoice.properties?.['creditedPercent'] !== creditedDisplay) {
            updatePageProperty(invoicesDbId, invoice.id, 'creditedPercent', creditedDisplay);
        }
    }, [invoice?.blocks, invoice?.properties?.['vatCalcMode'], invoice?.properties?.['vatRegime'], isHydrated, creditedTotal]);

    const rawQuotation = invoice?.properties?.['quotation'];
    const linkedQuotations = useMemo<string[]>(() => {
        if (!rawQuotation) return [];
        if (Array.isArray(rawQuotation)) {
            return rawQuotation.filter(Boolean).map(String);
        }
        return [String(rawQuotation)].filter(Boolean);
    }, [rawQuotation]);

    const rawClient = invoice?.properties?.['client'];
    const clientId = Array.isArray(rawClient) ? (rawClient[0] || '') : (rawClient as string) || '';

    const docLanguage = useMemo(() => {
        if (!invoice) return 'nl';
        const docLangProp = invoice.properties?.['docLanguage'] as string;
        if (docLangProp) return docLangProp;

        const clientRecord = clients.find(c => c.id === clientId);
        if (clientRecord?.language) {
            const rawLang = clientRecord.language.toLowerCase();
            if (rawLang.includes('fr')) return 'fr';
            if (rawLang.includes('en')) return 'en';
            return 'nl';
        }
        return tenant?.documentLanguage || 'nl';
    }, [invoice, clients, clientId, tenant?.documentLanguage]);
    // Calculate totals using the shared calculator
    const totals = useMemo(() => {
        const blks = invoice?.blocks || [];
        const vatMode = ((invoice?.properties?.['vatCalcMode'] as string) || 'lines') as 'lines' | 'total';
        const vatReg = (invoice?.properties?.['vatRegime'] as string) || '21';
        return calculateInvoiceTotals(blks, { vatCalcMode: vatMode, vatRegime: vatReg });
    }, [invoice?.blocks, invoice?.properties?.['vatCalcMode'], invoice?.properties?.['vatRegime']]);

    if (!isHydrated) return <div className="flex h-screen items-center justify-center">Loading Engine...</div>;
    if (!invoice && !hydrationAttempted) return <div className="flex h-screen items-center justify-center">Syncing invoice data...</div>;
    if (!invoice) return <div className="flex h-screen items-center justify-center flex-col gap-4"><h1>Invoice Not Found</h1><button onClick={() => router.back()} className="text-orange-500">Go Back</button></div>;

    const invoiceTitle = invoice.properties?.['title'] || 'Draft Invoice';
    const rawProject = invoice.properties?.['project'];
    const projectId = Array.isArray(rawProject) ? (rawProject[0] || '') : (rawProject as string) || '';
    const betreft = (invoice.properties?.['betreft'] as string) || '';
    const vatCalcMode = ((invoice.properties?.['vatCalcMode'] as string) || 'lines') as 'lines' | 'total';
    const vatRegime = (invoice.properties?.['vatRegime'] as string) || '21';
    const invoiceStatus = (invoice.properties?.['status'] as string) || 'opt-draft';
    const isDraft = invoiceStatus === 'opt-draft';
    const isLocked = Boolean(invoice.properties?.['isLocked'] || false);
    const snapshotData = (invoice.properties?.['snapshotData'] as any) || null;
    const isCreditNote = String(invoice.properties?.['docType']) === 'opt-credit-note';
    const isProforma = String(invoice.properties?.['docType']) === 'opt-proforma';
    
    // UI Link to Parent Invoice
    const parentInvoiceIdRaw = invoice.properties?.['parentInvoiceId'];
    const parentInvoiceId = Array.isArray(parentInvoiceIdRaw) ? parentInvoiceIdRaw[0] : (parentInvoiceIdRaw as string | undefined);
    const parentInvoiceTitle = parentInvoiceId ? useDatabaseStore.getState().databases.find(d => d.id === invoicesDbId)?.pages.find(p => p.id === parentInvoiceId)?.properties['title'] : null;

    const blocks = invoice.blocks || [];

    // Deep clone blocks with fresh IDs
    const cloneInvoiceBlocks = (sourceBlocks: Block[]): Block[] => {
        return sourceBlocks.map(block => ({
            ...block,
            id: crypto.randomUUID(),
            children: block.children ? cloneInvoiceBlocks(block.children) : undefined,
        }));
    };

    // Create Credit Nota from this invoice
    const handleCreateCreditNote = async () => {
        const invoiceNum = String(invoiceTitle);
        // Use the configured credit note numbering system — NEVER fall back to a wrong number (FIN-7)
        let cnNumber: string;
        try {
            const numResult = await getNextDocumentNumber('creditnote');
            if (numResult.success && numResult.number) {
                cnNumber = numResult.number;
            } else {
                console.error('getNextDocumentNumber failed for creditnote:', numResult.error);
                toast.error(`Creditnota nummer kon niet worden aangemaakt: ${numResult.error || 'onbekende fout'}. Controleer de nummeringsinstellingen.`);
                return;
            }
        } catch (e) {
            console.error('getNextDocumentNumber threw for creditnote:', e);
            toast.error('Er is een fout opgetreden bij het genereren van het creditnota nummer. Probeer opnieuw.');
            return;
        }
        const result = await createPageServerFirst(invoicesDbId, {
            title: cnNumber,
            client: clientId,
            status: 'opt-draft',
            betreft: `Creditnota voor ${invoiceNum}`,
            parentInvoiceId: [id], // Explicitly link to original as a relation array
            docType: 'opt-credit-note'
        });
        if (result.success) {
            const clonedBlocks = cloneInvoiceBlocks(blocks);
            const newPage = { ...result.page, blocks: clonedBlocks };
            
            // Add directly with the blocks populated
            useDatabaseStore.getState().addConfirmedPage(newPage);
            useDatabaseStore.getState().updatePageBlocks(invoicesDbId, newPage.id, clonedBlocks);

            // Create corresponding Prisma Invoice record
            await createPrismaInvoice(result.page.id, cnNumber, 'CREDIT_NOTE', id);
            router.push(`/admin/financials/income/credit-notes/${result.page.id}`);
        }
    };

    const handleUpdateBlock = (blockId: string, updates: Partial<Block>) => {
        const newBlocks = blocks.map(b => b.id === blockId ? { ...b, ...updates } : b);
        updatePageBlocks(invoicesDbId, id, newBlocks);
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
            updatePageBlocks(invoicesDbId, id, newBlocks);
        }
    };

    const handleDeleteBlock = (blockId: string) => {
        const newBlocks = blocks.filter(b => b.id !== blockId);
        updatePageBlocks(invoicesDbId, id, newBlocks);
    };

    const handleDuplicateBlock = (blockId: string) => {
        const blockToDuplicate = blocks.find(b => b.id === blockId);
        if (!blockToDuplicate) return;

        const newBlock: Block = { ...blockToDuplicate, id: crypto.randomUUID() };
        const index = blocks.findIndex(b => b.id === blockId);

        const newBlocks = [...blocks];
        newBlocks.splice(index + 1, 0, newBlock);

        updatePageBlocks(invoicesDbId, id, newBlocks);
    };

    const handleAddBlock = (type: Block['type'] = 'line') => {
        const newBlock: Block = { id: crypto.randomUUID(), type, content: '' };
        updatePageBlocks(invoicesDbId, id, [...blocks, newBlock]);
    };

    const handleImportComplete = (newBlocks: Block[]) => {
        updatePageBlocks(invoicesDbId, id, [...blocks, ...newBlocks]);
    };

    const handleUpdateProperty = (key: string, value: any) => {
        if (!invoice) return;
        updatePageProperty(invoicesDbId, invoice.id, key, value);
        // Persist client relationship to Prisma
        if (key === 'client') {
            updateInvoiceContact(id, value).catch(console.error);
        }
        if (key === 'docType') {
            if (value === 'opt-proforma') {
                updatePageProperty(invoicesDbId, invoice.id, 'title', 'Proforma');
            } else if (value === 'opt-invoice' && String(invoice.properties['title']) === 'Proforma') {
                getNextDocumentNumber('invoice').then(result => {
                    if (result.success && result.number) {
                        updatePageProperty(invoicesDbId, invoice.id, 'title', result.number);
                    }
                }).catch(console.error);
            } else if (value === 'opt-credit-note' && String(invoice.properties['title']) === 'Proforma') {
                updatePageProperty(invoicesDbId, invoice.id, 'title', `CN-${invoice.id.substring(0, 8).toUpperCase()}`);
            }
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

    // Execute the import
    const executeOfferteImport = () => {
        const quotationPage = quotationsDb?.pages.find(p => p.id === offerteImportDialog.quotationId);
        if (!quotationPage) return;

        const pricedBlocks = filterPricedBlocks(quotationPage.blocks || []);
        const clonedBlocks = deepCloneBlocks(pricedBlocks);
        updatePageBlocks(invoicesDbId, id, [...blocks, ...clonedBlocks]);
        
        // Track imported quotation to warn against duplicate imports in active session
        setImportedQuotationIds(prev => {
            if (prev.includes(offerteImportDialog.quotationId)) return prev;
            return [...prev, offerteImportDialog.quotationId];
        });

        toast.success(`${offerteImportDialog.lineCount} regels geïmporteerd uit "${offerteImportDialog.quotationTitle}".`);
    };

    const grandTotal = totals.subtotal;

    // Helper: build resolved client info for PDF templates
    const buildClientInfo = () => {
        // If locked, MUST use snapshot data (Legal requirement)
        if (isLocked && snapshotData?.customer) {
            return {
                name: snapshotData.customer.name,
                address: snapshotData.customer.address,
                vatNumber: snapshotData.customer.vat,
                email: snapshotData.customer.email,
            };
        }

        // Otherwise pull live from CRM
        const clientRecord = clients.find(c => c.id === clientId);
        return {
            name: `${clientRecord?.firstName || ''} ${clientRecord?.lastName || ''}`.trim() || 'Klant',
            address: clientRecord?.address || undefined,
            vatNumber: clientRecord?.vatNumber || undefined,
            email: clientRecord?.email || undefined,
        };
    };

    const [showSendModal, setShowSendModal] = useState(false);
    const [sendModalPdfBase64, setSendModalPdfBase64] = useState<string>('');

    const handleSendEmailClick = async () => {
        if (!clientId) return toast.warning('Selecteer eerst een klant om de factuur te versturen.');

        setIsSending(true);
        try {
            const clientRecord = clients.find(c => c.id === clientId);
            const clientEmail = String(clientRecord?.email || '');
            const clientName = String(`${clientRecord?.firstName || ''} ${clientRecord?.lastName || ''}`.trim() || 'Klant');
            const projectName = betreft || invoiceTitle || 'Factuur';

            if (!clientEmail || clientEmail === 'undefined') {
                toast.error('Deze klant heeft geen geregistreerd e-mailadres in de database.');
                setIsSending(false);
                return;
            }

            const doc = (
                <InvoicePDFTemplate
                    blocks={blocks}
                    invoiceTitle={String(invoiceTitle)}
                    betreft={String(betreft)}
                    clientInfo={buildClientInfo()}
                    projectId={String(projectId)}
                    grandTotal={grandTotal}
                    databaseStoreState={useDatabaseStore.getState()}
                    tenantProfile={tenant}
                    templateId={tenant?.documentTemplate || 't1'}
                    language={docLanguage}
                    invoiceDate={invoice?.properties?.['invoiceDate'] as string}
                    deliveryDate={invoice?.properties?.['deliveryDate'] as string}
                    dueDate={invoice?.properties?.['dueDate'] as string}
                    docType={String(invoice.properties?.['docType'] || '')}
                    vatCalcMode={((invoice?.properties?.['vatCalcMode'] as string) || 'lines') as any}
                    vatRegime={invoice?.properties?.['vatRegime'] as string}
                    structuredComm={invoice?.properties?.['structuredComm'] as string}
                />
            );

            const blob = await generatePdfBlob(doc, tenant);

            const reader = new FileReader();
            reader.readAsDataURL(blob);
            reader.onloadend = async () => {
                const base64data = (reader.result as string).split(',')[1];
                setSendModalPdfBase64(base64data);
                setShowSendModal(true);
                setIsSending(false);
            };
        } catch (error) {
            console.error(error);
            toast.error('Er is iets misgegaan tijdens het genereren van de PDF.');
            setIsSending(false);
        }
    };

    const executeSendEmail = async (subjectOverride: string, bodyOverride: string, attachmentKeys: string[]) => {
        const clientRecord = clients.find(c => c.id === clientId);
        const clientEmail = String(clientRecord?.email || '');
        const clientName = String(`${clientRecord?.firstName || ''} ${clientRecord?.lastName || ''}`.trim() || 'Klant');
        const projectName = betreft || invoiceTitle || 'Factuur';

        setIsSending(true);
        try {
            const response = await sendInvoiceToClient(
                id, clientEmail, clientName, String(projectName),
                `€${grandTotal.toFixed(2)}`, sendModalPdfBase64,
                bodyOverride,
                String(tenant?.commercialName || tenant?.companyName || ''),
                docLanguage,
                tenant?.brandColor,
                tenant?.email || undefined,
                subjectOverride,
                attachmentKeys
            );

            if (response.success) {
                // Auto-transition to "sent" status
                handleUpdateProperty('status', 'opt-sent');
                toast.success('Factuur is succesvol verzonden!');
                setShowSendModal(false);
            } else {
                toast.error(`Fout bij verzenden: ${response.error}`);
            }
        } catch (e) {
            console.error(e);
            toast.error('Verzenden mislukt.');
        } finally {
            setIsSending(false);
        }
    };

    const handleSaveToDrive = async () => {
        if (!clientId) return toast.warning('Selecteer eerst een klant om op te slaan in Google Drive.');

        const clientRecord = clients.find(c => c.id === clientId);
        let parentId = clientRecord?.driveFolderId;

        setIsSavingToDrive(true);
        try {
            if (!parentId) {
                // Auto-create client folder
                const clientName = `${clientRecord?.firstName || ''} ${clientRecord?.lastName || ''}`.trim() || 'Klant';
                const initRes = await fetch('/api/drive/init', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        databaseId: clientsDbId,
                        pageId: clientId,
                        title: clientName,
                    }),
                });
                if (!initRes.ok) {
                    throw new Error(`Auto-provisioning client Drive folder failed: ${await initRes.text()}`);
                }
                const initData = await initRes.json();
                parentId = initData.driveFolderId;
                
                // Write back to database store so the record locally has the driveFolderId
                if (parentId && clientsDb) {
                    const driveProp = clientsDb.properties.find(p => p.name.toLowerCase().includes('drive'));
                    if (driveProp) {
                        useDatabaseStore.getState().updatePageProperty(clientsDbId, clientId, driveProp.id, parentId);
                    }
                }
            }

            if (!parentId) {
                throw new Error('Geen Google Drive folder ID ontvangen.');
            }

            const doc = (
                <InvoicePDFTemplate
                    blocks={blocks}
                    invoiceTitle={String(invoiceTitle)}
                    betreft={String(betreft)}
                    clientInfo={buildClientInfo()}
                    projectId={String(projectId)}
                    grandTotal={grandTotal}
                    databaseStoreState={useDatabaseStore.getState()}
                    tenantProfile={tenant}
                    templateId={tenant?.documentTemplate || 't1'}
                    language={docLanguage}
                    invoiceDate={invoice?.properties?.['invoiceDate'] as string}
                    deliveryDate={invoice?.properties?.['deliveryDate'] as string}
                    dueDate={invoice?.properties?.['dueDate'] as string}
                    docType={String(invoice.properties?.['docType'] || '')}
                    vatCalcMode={((invoice?.properties?.['vatCalcMode'] as string) || 'lines') as any}
                    vatRegime={invoice?.properties?.['vatRegime'] as string}
                    structuredComm={invoice?.properties?.['structuredComm'] as string}
                />
            );

            const asPdf = pdf(doc);
            const blob = await generatePdfBlob(doc, tenant);

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
        const selectedClient = clients.find(c => c.id === clientId);
        if (!selectedClient) return toast.error('Klant niet gevonden in database.');

        setIsSendingPeppol(true);
        try {
            // Wait for DB sync to ensure all row calculations are mathematically synced with the backend store
            await new Promise(r => setTimeout(r, 800));

            const invoiceDateProp = invoice?.properties?.['date'] || invoice?.properties?.['datum'] || '';
            const dueDateProp = invoice?.properties?.['dueDate'] || invoice?.properties?.['vervaldatum'] || '';

            const res = await fetch('/api/peppol/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    invoiceId: id,
                    invoiceTitle: String(invoiceTitle),
                    betreft: betreft,
                    invoiceDate: invoiceDateProp ? String(invoiceDateProp) : undefined,
                    dueDate: dueDateProp ? String(dueDateProp) : undefined,
                    blocks: blocks,
                    structuredComm: invoice?.properties?.['structuredComm'] as string | undefined,
                    isCreditNote,
                    parentInvoiceId,
                    client: {
                        firstName: selectedClient.firstName,
                        lastName: selectedClient.lastName,
                        email: selectedClient.email,
                        vatNumber: selectedClient.vatNumber,
                        address: selectedClient.address || '',
                    },
                })
            });

            // SEND-2: Guard .json() — a non-JSON error page (e.g. HTML 500) would throw here
            let data: any;
            try {
                data = await res.json();
            } catch {
                const text = await res.text().catch(() => '');
                toast.error(`Peppol fout: server gaf een onverwacht antwoord (HTTP ${res.status}). ${text.substring(0, 100)}`);
                return;
            }

            if (!res.ok) {
                toast.error(`Peppol fout: ${data?.issues || data?.error || `HTTP ${res.status}`}`);
                return;
            }

            if (data.success) {
                // Auto-transition to "sent" status
                handleUpdateProperty('status', 'opt-sent');
                toast.success(isCreditNote ? 'Creditnota succesvol verzonden via Peppol! ✅' : 'Factuur succesvol verzonden via Peppol! ✅');
            } else if (data.code === 'PEPPOL_SEND_LIMIT') {
                setPeppolLimitDialog(true);
            } else {
                toast.error(`Peppol fout: ${data.issues || data.error}`);
            }
        } catch (e: any) {
            console.error(e);
            toast.error('Systeemfout bij Peppol verzending: ' + e.message);
        } finally {
            setIsSendingPeppol(false);
        }
    };

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
                        title="Vorige pagina"
                    >
                        <ArrowLeft className="w-5 h-5 text-neutral-500" />
                    </button>
                    <Link
                        href={isCreditNote ? '/admin/financials/income/credit-notes' : '/admin/financials/income/invoices'}
                        className="p-2 hover:bg-neutral-100 dark:hover:bg-white/5 rounded-md transition-colors shrink-0 flex items-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-900 dark:hover:text-white font-medium"
                        title={isCreditNote ? 'Naar Creditnota\'s database' : 'Naar Facturen database'}
                    >
                        <Database className="w-4 h-4" />
                        <span className="hidden sm:inline">Database</span>
                    </Link>
                    <div className="flex flex-col min-w-0 shrink-0">
                        <input
                            type="text"
                            value={betreft}
                            onChange={(e) => handleUpdateProperty('betreft', e.target.value)}
                            placeholder={isCreditNote ? 'Credit Note' : 'Draft Invoice'}
                            disabled={isLocked || !isDraft}
                            className="bg-transparent text-lg font-bold tracking-tight text-neutral-900 dark:text-white outline-none focus:ring-0 placeholder:text-neutral-400 p-0 m-0 w-[280px] disabled:opacity-70"
                        />
                            <div className="flex items-center gap-2">
                                <p className="text-[10px] text-neutral-400 font-mono tracking-wider uppercase flex items-center gap-2">
                                    {isProforma ? 'Proforma' : isCreditNote ? 'Creditnota' : 'Factuur'} {invoiceTitle}
                                    {parentInvoiceTitle && (
                                        <>
                                            <span>•</span>
                                            <Link href={`/admin/financials/income/invoices/${parentInvoiceId}`} className="hover:text-neutral-600 dark:hover:text-neutral-200 underline decoration-dashed">
                                                Link: {String(parentInvoiceTitle)}
                                            </Link>
                                        </>
                                    )}
                                </p>
                                
                                {/* Interactive document type selector */}
                                {isHydrated && (() => {
                                    const currentDocType = String(invoice.properties?.['docType'] || 'opt-invoice');
                                    const DOCTYPE_MAP: Record<string, { label: string; bg: string; text: string; dot: string }> = {
                                        'opt-invoice':     { label: 'Factuur',     bg: 'bg-blue-50 dark:bg-blue-900/30',     text: 'text-blue-700 dark:text-blue-300',       dot: 'bg-blue-500' },
                                        'opt-credit-note': { label: 'Creditnota',  bg: 'bg-pink-50 dark:bg-pink-900/30',     text: 'text-pink-700 dark:text-pink-300',       dot: 'bg-pink-500' },
                                        'opt-proforma':    { label: 'Proforma',    bg: 'bg-amber-50 dark:bg-amber-900/30',   text: 'text-amber-700 dark:text-amber-300',     dot: 'bg-amber-500' },
                                    };
                                    const current = DOCTYPE_MAP[currentDocType] || DOCTYPE_MAP['opt-invoice'];
                                    
                                    if (!isDraft || isLocked) {
                                        return (
                                            <div className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md ${current.bg} ${current.text}`}>
                                                <span className={`w-1.5 h-1.5 rounded-full ${current.dot}`} />
                                                {current.label}
                                            </div>
                                        );
                                    }

                                    return (
                                        <div className="relative group/doctype">
                                            <button
                                                className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md ${current.bg} ${current.text} transition-all hover:ring-2 hover:ring-neutral-300 dark:hover:ring-white/20`}
                                            >
                                                <span className={`w-1.5 h-1.5 rounded-full ${current.dot}`} />
                                                {current.label}
                                            </button>
                                            <div className="absolute top-full left-0 mt-1 w-40 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-white/10 rounded-xl shadow-xl p-1 z-50 opacity-0 pointer-events-none group-hover/doctype:opacity-100 group-hover/doctype:pointer-events-auto transition-all duration-150">
                                                {Object.entries(DOCTYPE_MAP).map(([typeId, d]) => (
                                                    <button
                                                        key={typeId}
                                                        onClick={() => handleUpdateProperty('docType', typeId)}
                                                        className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${typeId === currentDocType ? 'bg-neutral-100 dark:bg-white/10' : 'hover:bg-neutral-50 dark:hover:bg-white/5'} ${d.text}`}
                                                    >
                                                        <span className={`w-2 h-2 rounded-full ${d.dot}`} />
                                                        {d.label}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })()}

                                {/* Interactive status selector */}
                                {isHydrated && (() => {
                                    const STATUS_MAP: Record<string, { label: string; bg: string; text: string; dot: string }> = {
                                        'opt-draft':              { label: t('engine_status_draft', locale), bg: 'bg-neutral-100 dark:bg-neutral-800', text: 'text-neutral-600 dark:text-neutral-300', dot: 'bg-neutral-400' },
                                        'opt-sent':               { label: t('engine_status_sent', locale), bg: 'bg-orange-50 dark:bg-orange-900/30',     text: 'text-orange-700 dark:text-orange-300',       dot: 'bg-orange-500' },
                                        'opt-paid':               { label: t('engine_status_paid', locale), bg: 'bg-green-50 dark:bg-green-900/30',   text: 'text-green-700 dark:text-green-300',     dot: 'bg-green-500' },
                                        'opt-overdue':            { label: t('engine_status_overdue', locale), bg: 'bg-red-50 dark:bg-red-900/30',       text: 'text-red-700 dark:text-red-300',         dot: 'bg-red-500' },
                                        'opt-credited':           { label: t('engine_status_credited', locale), bg: 'bg-pink-50 dark:bg-pink-900/30', text: 'text-pink-700 dark:text-pink-300', dot: 'bg-pink-500' },
                                        'opt-partially-credited': { label: t('engine_status_partially_credited', locale), bg: 'bg-pink-50 dark:bg-pink-900/30', text: 'text-pink-700 dark:text-pink-300', dot: 'bg-pink-400' },
                                        'opt-uncollectible':      { label: t('engine_status_uncollectible', locale), bg: 'bg-purple-50 dark:bg-purple-900/30', text: 'text-purple-700 dark:text-purple-300',   dot: 'bg-purple-500' },
                                    };
                                    const current = STATUS_MAP[invoiceStatus] || STATUS_MAP['opt-draft'];
                                    return (
                                        <div className="relative">
                                            <button
                                                onClick={() => setIsStatusDropdownOpen(!isStatusDropdownOpen)}
                                                className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md cursor-pointer ${current.bg} ${current.text} transition-all hover:ring-2 hover:ring-neutral-300 dark:hover:ring-white/20`}
                                            >
                                                <span className={`w-1.5 h-1.5 rounded-full ${current.dot}`} />
                                                {current.label}
                                            </button>
                                            {isStatusDropdownOpen && (
                                                <>
                                                    <div className="fixed inset-0 z-40" onClick={() => setIsStatusDropdownOpen(false)} />
                                                    <div className="absolute top-full left-0 mt-1 w-40 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-white/10 rounded-xl shadow-xl p-1 z-50">
                                                        {Object.entries(STATUS_MAP).map(([id, s]) => (
                                                            <button
                                                                key={id}
                                                                onClick={() => { handleUpdateProperty('status', id); setIsStatusDropdownOpen(false); }}
                                                                className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${id === invoiceStatus ? 'bg-neutral-100 dark:bg-white/10' : 'hover:bg-neutral-50 dark:hover:bg-white/5'} ${s.text}`}
                                                            >
                                                                <span className={`w-2 h-2 rounded-full ${s.dot}`} />
                                                                {s.label}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    );
                                })()}
                                {isLocked && (
                                    <span className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20">
                                        <Check className="w-2.5 h-2.5" /> Fiscale Lock
                                    </span>
                                )}
                            </div>
                    </div>

                    {/* Separator */}
                    <div className="h-8 w-px bg-neutral-200 dark:bg-white/10 shrink-0" />

                    {/* Selectors */}
                    <div className="flex items-center gap-2 flex-1 min-w-0 overflow-x-auto no-scrollbar">
                        {/* Client Selector */}
                        <div className="flex items-center bg-neutral-50 dark:bg-white/5 rounded-lg border border-neutral-200 dark:border-white/10 relative">
                            <User className="w-3.5 h-3.5 text-neutral-400 absolute left-2.5 z-10 pointer-events-none" />
                            <div className="flex-1 w-48 pl-6">
                                <SearchableSelect
                                    value={clientId}
                                    onChange={(value) => handleUpdateProperty('client', value)}
                                    disabled={!isDraft}
                                    placeholder="Klant selecteren..."
                                    searchPlaceholder="Zoek klant..."
                                    emptyLabel="Geen klanten gevonden"
                                    className="border-none bg-transparent shadow-none ring-0 h-9"
                                    options={clients.map(client => ({
                                        value: client.id,
                                        label: `${client.firstName} ${client.lastName}`
                                    }))}
                                />
                            </div>
                            {clientId && (
                                <Link
                                    href={`/admin/database/${clientsDbId}/${clientId}`}
                                    className="absolute right-1.5 p-0.5 rounded hover:bg-neutral-200 dark:hover:bg-white/10 transition-colors"
                                    title="Open fiche"
                                >
                                    <ExternalLink className="w-3 h-3 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200" />
                                </Link>
                            )}
                        </div>
                        {/* New Client Button */}
                        {isDraft && (
                            <button
                                onClick={() => setShowNewClientModal(true)}
                                className="p-2 rounded-lg border border-dashed border-neutral-300 dark:border-white/15 hover:border-[var(--brand-color,#d35400)] hover:bg-[var(--brand-color,#d35400)]/5 text-neutral-400 hover:text-[var(--brand-color,#d35400)] transition-all shrink-0"
                                title="Nieuwe klant aanmaken"
                            >
                                <Plus className="w-3.5 h-3.5" />
                            </button>
                        )}

                        {/* Project Selector — only for tenants with project management */}
                        {hasProjects && (
                        <>
                        <div className="flex items-center bg-neutral-50 dark:bg-white/5 rounded-lg border border-neutral-200 dark:border-white/10 relative">
                            <Briefcase className="w-3.5 h-3.5 text-neutral-400 absolute left-2.5 pointer-events-none" />
                            <select
                                value={projectId}
                                onChange={(e) => handleUpdateProperty('project', e.target.value)}
                                disabled={false}
                                className="text-xs font-medium text-neutral-700 dark:text-neutral-300 bg-transparent border-none outline-none appearance-none cursor-pointer pl-7 pr-6 py-2 focus:ring-0 w-48 truncate disabled:opacity-60 disabled:cursor-default"
                            >
                                <option value="">Project koppelen...</option>
                                {projects.map(project => (
                                    <option key={project.id} value={project.id} className="text-black dark:text-neutral-900">
                                        {String(project.properties['title'] || project.properties['name'] || 'Unnamed Project')}
                                    </option>
                                ))}
                            </select>
                            {projectId && (
                                <Link
                                    href={`/admin/database/${projectDbId}/${projectId}`}
                                    className="absolute right-1.5 p-0.5 rounded hover:bg-neutral-200 dark:hover:bg-white/10 transition-colors"
                                    title="Open fiche"
                                >
                                    <ExternalLink className="w-3 h-3 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200" />
                                </Link>
                            )}
                        </div>
                        {/* New Project Button */}
                        {isDraft && (
                            <button
                                onClick={() => setShowNewProjectModal(true)}
                                className="p-2 rounded-lg border border-dashed border-neutral-300 dark:border-white/15 hover:border-[var(--brand-color,#d35400)] hover:bg-[var(--brand-color,#d35400)]/5 text-neutral-400 hover:text-[var(--brand-color,#d35400)] transition-all shrink-0"
                                title="Nieuw project aanmaken"
                            >
                                <Plus className="w-3.5 h-3.5" />
                            </button>
                        )}
                        </>
                        )}

                        {/* Custom Offerte Multi-Selector */}
                        <div ref={quotationContainerRef} className="relative shrink-0">
                            <button
                                type="button"
                                disabled={false}
                                onClick={() => setIsQuotationDropdownOpen(!isQuotationDropdownOpen)}
                                className="flex items-center gap-1.5 px-3 py-2 bg-neutral-50 dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-lg text-xs font-semibold text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-white/10 transition-all disabled:opacity-60 disabled:cursor-default cursor-pointer outline-none focus:ring-1 focus:ring-orange-500/30"
                            >
                                <FileText className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                                <span className="truncate max-w-[12rem]">
                                    {linkedQuotations.length === 0
                                        ? 'Offertes koppelen...'
                                        : linkedQuotations.length === 1
                                            ? (quotations.find(q => q.id === linkedQuotations[0])?.betreft || quotations.find(q => q.id === linkedQuotations[0])?.title || '1 Offerte')
                                            : `${linkedQuotations.length} offertes gekoppeld`}
                                </span>
                                <ChevronDown className="w-3 h-3 text-neutral-400 shrink-0 transition-transform duration-200" style={{ transform: isQuotationDropdownOpen ? 'rotate(180deg)' : 'none' }} />
                            </button>

                            {isQuotationDropdownOpen && (
                                <div className="absolute right-0 mt-1.5 w-80 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-white/10 rounded-xl shadow-2xl z-50 p-2 flex flex-col gap-2 animate-in fade-in zoom-in-95 duration-100 max-h-80 overflow-hidden">
                                    {/* Search input */}
                                    <div className="relative shrink-0">
                                        <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-neutral-400" />
                                        <input
                                            type="text"
                                            placeholder="Zoek offerte..."
                                            value={quotationSearch}
                                            onChange={(e) => setQuotationSearch(e.target.value)}
                                            className="w-full pl-8 pr-3 py-1.5 text-xs bg-neutral-50 dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-lg outline-none focus:border-orange-500 transition-colors text-neutral-900 dark:text-white"
                                        />
                                    </div>

                                    {/* List */}
                                    <div className="overflow-y-auto flex-1 flex flex-col gap-0.5 max-h-60 pr-0.5 no-scrollbar">
                                        {(() => {
                                            const filtered = quotations.filter(q => {
                                                if (!quotationSearch.trim()) return true;
                                                const term = quotationSearch.toLowerCase();
                                                return q.title.toLowerCase().includes(term) || q.betreft.toLowerCase().includes(term);
                                            });

                                            if (filtered.length === 0) {
                                                return <div className="py-4 text-center text-xs italic text-neutral-400">Geen offertes gevonden</div>;
                                            }

                                            return filtered.map(q => {
                                                const isLinked = linkedQuotations.includes(q.id);
                                                return (
                                                    <button
                                                        key={q.id}
                                                        type="button"
                                                        onClick={() => {
                                                            if (isLinked) {
                                                                const next = linkedQuotations.filter(id => id !== q.id);
                                                                handleUpdateProperty('quotation', next);
                                                                toast.success('Offerte ontkoppeld.');
                                                            } else {
                                                                const next = [...linkedQuotations, q.id];
                                                                handleUpdateProperty('quotation', next);
                                                                
                                                                // Trigger import check
                                                                const qPage = quotationsDb?.pages.find(p => p.id === q.id);
                                                                if (qPage && qPage.blocks?.length) {
                                                                    const pricedBlocks = filterPricedBlocks(qPage.blocks);
                                                                    const lineCount = countLines(pricedBlocks);
                                                                    if (lineCount > 0) {
                                                                        const quotationTitle = String(qPage.properties['title'] || qPage.properties['betreft'] || 'Offerte');
                                                                        setOfferteImportDialog({ open: true, quotationId: q.id, quotationTitle, lineCount });
                                                                    } else {
                                                                        toast.info('Offerte gekoppeld. Geen regels met prijs gevonden.');
                                                                    }
                                                                } else {
                                                                    toast.info('Offerte gekoppeld, maar bevat geen regels.');
                                                                }
                                                            }
                                                        }}
                                                        className="w-full flex items-center justify-between p-2 hover:bg-neutral-50 dark:hover:bg-white/5 rounded-lg transition-all text-left text-xs group"
                                                    >
                                                        <div className="flex flex-col min-w-0 pr-2">
                                                            <span className="font-bold text-neutral-800 dark:text-neutral-200 truncate">
                                                                {q.betreft || 'Geen onderwerp'}
                                                            </span>
                                                            <span className="text-[10px] text-neutral-400 dark:text-neutral-500 font-mono">
                                                                {q.title}
                                                            </span>
                                                        </div>
                                                        <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-all ${
                                                            isLinked
                                                                ? 'border-orange-500 bg-orange-500 text-white'
                                                                : 'border-neutral-300 dark:border-white/10 group-hover:border-neutral-400'
                                                        }`}>
                                                            {isLinked && <Check className="w-3 h-3 stroke-[3]" />}
                                                        </div>
                                                    </button>
                                                );
                                            });
                                        })()}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Properties panel toggle */}
                    <div className="flex items-center gap-1.5 shrink-0">
                        <button
                            onClick={() => setShowProperties(v => !v)}
                            title={showProperties ? 'Hide properties' : 'Show record properties'}
                            className={`p-2 rounded-lg border transition-all ${
                                showProperties
                                    ? 'border-orange-300 dark:border-orange-700 text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20'
                                    : 'border-neutral-200 dark:border-white/10 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-white/5'
                            }`}
                        >
                            <PanelRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* Row 2: Linked Quotation Badges */}
                {linkedQuotations.length > 0 && (
                    <div className="flex items-center gap-2 px-4 pb-3 flex-wrap border-t border-neutral-100 dark:border-white/5 pt-2 bg-neutral-50/50 dark:bg-white/[0.01]">
                        <span className="text-[10px] font-extrabold text-neutral-400 dark:text-neutral-500 uppercase tracking-widest flex items-center gap-1 shrink-0">
                            <FileText className="w-3.5 h-3.5 text-orange-500" /> Gekoppelde offertes:
                        </span>
                        {linkedQuotations.map(qId => {
                            const q = quotations.find(item => item.id === qId);
                            if (!q) return null;
                            return (
                                <div
                                    key={qId}
                                    className="flex items-center gap-1.5 px-2.5 py-1 bg-orange-50 dark:bg-orange-500/10 border border-orange-200 dark:border-orange-500/20 text-orange-700 dark:text-orange-300 rounded-full text-xs font-semibold hover:border-orange-300 dark:hover:border-orange-500/35 transition-colors"
                                >
                                    <span className="truncate max-w-[12rem]" title={q.betreft}>
                                        {q.betreft ? `${q.betreft} (${q.title})` : q.title}
                                    </span>
                                    {isDraft && !isLocked && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const next = linkedQuotations.filter(id => id !== qId);
                                                handleUpdateProperty('quotation', next);
                                                toast.success('Offerte ontkoppeld.');
                                            }}
                                            className="hover:bg-orange-100 dark:hover:bg-orange-500/20 p-0.5 rounded-full transition-colors cursor-pointer text-orange-500 hover:text-orange-700 dark:hover:text-orange-300"
                                        >
                                            <XIcon className="w-3 h-3 stroke-[2.5]" />
                                        </button>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Relational tracing banners (Invoices <-> Credit Notes) */}
            {isHydrated && (() => {
                if (isCreditNote && parentInvoiceId) {
                    return (
                        <div className="bg-blue-50 dark:bg-blue-950/20 border-b border-blue-200 dark:border-blue-700/50 px-6 py-2.5 flex items-center justify-between shrink-0 text-xs text-blue-700 dark:text-blue-300">
                            <div className="flex items-center gap-2">
                                <Info className="w-4 h-4 text-blue-500 shrink-0" />
                                <span>Deze creditnota is gekoppeld aan originele factuur <strong>{parentInvoiceTitle || 'Factuur'}</strong>.</span>
                            </div>
                            <Link href={`/admin/financials/income/invoices/${parentInvoiceId}`} className="font-bold underline hover:opacity-85">
                                Open originele factuur →
                            </Link>
                        </div>
                    );
                }
                if (!isCreditNote && !isProforma && creditNotes.length > 0) {
                    const totalCreditedText = creditNoteInfos.map(cn => cn.title).join(', ');
                    return (
                        <div className="bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-700/50 px-6 py-2.5 flex items-center justify-between shrink-0 text-xs text-amber-700 dark:text-amber-300">
                            <div className="flex items-center gap-2">
                                <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                                <span>Deze factuur is gecrediteerd via creditnota(&apos;s): <strong>{totalCreditedText}</strong> (Totaal gecrediteerd: €{creditedTotal.toFixed(2)}).</span>
                            </div>
                            <div className="flex items-center gap-3">
                                {creditNoteInfos.map(cn => (
                                    <Link key={cn.id} href={`/admin/financials/income/invoices/${cn.id}`} className="font-bold underline hover:opacity-85">
                                        Open {cn.title} →
                                    </Link>
                                ))}
                            </div>
                        </div>
                    );
                }
                return null;
            })()}

            {tenant && (!tenant.companyName || !tenant.vatNumber) && (
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

            {/* Main Canvas + optional Properties Panel */}
            <div className="flex flex-1 overflow-hidden">
                {/* Canvas */}
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
                                            readOnly={isLocked || !isDraft}
                                        />
                                    ))}
                                    {provided.placeholder}
                                </div>
                            )}
                        </Droppable>
                    </DragDropContext>

                    {(isDraft && !isLocked) && <div className="flex items-center gap-2 mt-2">
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
                        <button
                            onClick={() => handleAddBlock('text')}
                            className="text-xs font-semibold flex items-center gap-1 transition-colors py-1.5 px-3 rounded-lg shadow-sm border text-neutral-600 dark:text-neutral-300 border-neutral-200 dark:border-white/10 hover:bg-neutral-100 dark:hover:bg-white/5"
                        >
                            <Type className="w-3.5 h-3.5" /> Text
                        </button>
                        <button
                            onClick={() => handleAddBlock('image')}
                            className="text-xs font-semibold flex items-center gap-1 transition-colors py-1.5 px-3 rounded-lg shadow-sm border text-neutral-600 dark:text-neutral-300 border-neutral-200 dark:border-white/10 hover:bg-neutral-100 dark:hover:bg-white/5"
                        >
                            <ImageIcon className="w-3.5 h-3.5" /> Image
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
                    </div>}

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
                        onInvoiceDateChange={(date) => handleUpdateProperty('invoiceDate', date)}
                        onDueDateChange={(date) => handleUpdateProperty('dueDate', date)}
                        creditedAmount={creditedTotal}
                        creditNoteCount={creditNotes.length}
                        creditNotes={creditNoteInfos}
                        isLocked={isLocked}
                        language={docLanguage}
                        onLanguageChange={(lang) => handleUpdateProperty('docLanguage', lang)}
                        structuredComm={invoice?.properties?.['structuredComm'] as string}
                    />

                </div>
                </div>

                {/* DB Properties Panel — shows all record fields including Excel-imported ones */}
                {showProperties && (
                    <aside className="w-72 flex-shrink-0 border-l border-neutral-200 dark:border-white/10 overflow-hidden">
                        <ErrorBoundary componentName="DbPropertiesPanel">
                            <DbPropertiesPanel
                                databaseId={invoicesDbId}
                                pageId={id}
                                title="Record Properties"
                            />
                        </ErrorBoundary>
                    </aside>
                )}
            </div>

            {/* ── Bottom Action Bar ─────────────────────────────────────── */}
            {isHydrated && (
                <div className="shrink-0 border-t border-neutral-200 dark:border-white/10 bg-white dark:bg-black px-4 py-3">
                    <div className="flex items-center gap-3 max-w-[1400px] mx-auto">
                        {/* Left group: document actions */}
                        <div className="flex items-center gap-2 flex-wrap">
                            {(!isCreditNote && !isProforma) && (
                                <button
                                    onClick={handleCreateCreditNote}
                                    className="text-sm font-semibold px-5 py-2.5 rounded-xl transition-all flex items-center gap-2 border hover:opacity-90 active:scale-[0.97]"
                                    style={{
                                        backgroundColor: 'color-mix(in srgb, var(--brand-color, #d35400) 10%, white)',
                                        borderColor: 'color-mix(in srgb, var(--brand-color, #d35400) 25%, transparent)',
                                        color: 'var(--brand-color, #d35400)',
                                    }}
                                >
                                    <ReceiptText className="w-4 h-4" /> Credit Nota
                                </button>
                            )}
                            <button
                                onClick={handleSendEmailClick}
                                disabled={isSending || !clientId}
                                className="text-sm font-semibold px-5 py-2.5 rounded-xl transition-all flex items-center gap-2 border disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 active:scale-[0.97]"
                                style={{
                                    backgroundColor: clientId ? 'color-mix(in srgb, var(--brand-color, #d35400) 10%, white)' : undefined,
                                    borderColor: clientId ? 'color-mix(in srgb, var(--brand-color, #d35400) 25%, transparent)' : undefined,
                                    color: clientId ? 'var(--brand-color, #d35400)' : undefined,
                                }}
                            >
                                <Mail className="w-4 h-4" /> {isSending ? 'Sending...' : 'Send'}
                            </button>
                            <button
                                onClick={handleSaveToDrive}
                                disabled={isSavingToDrive || !clientId}
                                className="text-sm font-semibold px-5 py-2.5 rounded-xl transition-all flex items-center gap-2 border disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 active:scale-[0.97]"
                                style={{
                                    backgroundColor: clientId ? 'color-mix(in srgb, var(--brand-color, #d35400) 10%, white)' : undefined,
                                    borderColor: clientId ? 'color-mix(in srgb, var(--brand-color, #d35400) 25%, transparent)' : undefined,
                                    color: clientId ? 'var(--brand-color, #d35400)' : undefined,
                                }}
                            >
                                <CloudUpload className="w-4 h-4" /> {isSavingToDrive ? 'Saving...' : 'Drive'}
                            </button>
                            <button
                                onClick={handleSendPeppol}
                                disabled={isSendingPeppol || !clientId || isLocked || isProforma}
                                className="text-sm font-semibold px-5 py-2.5 rounded-xl transition-all flex items-center gap-2 border disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 active:scale-[0.97]"
                                style={{
                                    backgroundColor: (clientId && !isLocked && !isProforma) ? 'color-mix(in srgb, var(--brand-color, #d35400) 10%, white)' : undefined,
                                    borderColor: (clientId && !isLocked && !isProforma) ? 'color-mix(in srgb, var(--brand-color, #d35400) 25%, transparent)' : undefined,
                                    color: (clientId && !isLocked && !isProforma) ? 'var(--brand-color, #d35400)' : undefined,
                                }}
                            >
                                <Send className="w-4 h-4" /> {isSendingPeppol ? 'Sending...' : 'Peppol'}
                            </button>
                        </div>

                        <div className="flex-1" />

                        {/* Right group: export + delete */}
                        <div className="flex items-center gap-2">
                            <button
                                onClick={async () => {
                                    if (isDownloading) return;
                                    setIsDownloading(true);
                                    try {
                                        const doc = (
                                            <InvoicePDFTemplate
                                                blocks={blocks}
                                                invoiceTitle={String(invoiceTitle)}
                                                betreft={String(betreft)}
                                                clientInfo={buildClientInfo()}
                                                projectId={String(projectId)}
                                                grandTotal={grandTotal}
                                                databaseStoreState={useDatabaseStore.getState()}
                                                tenantProfile={tenant}
                                                templateId={tenant?.documentTemplate || 't1'}
                                                language={docLanguage}
                                                invoiceDate={invoice?.properties?.['invoiceDate'] as string}
                                                deliveryDate={invoice?.properties?.['deliveryDate'] as string}
                                                dueDate={invoice?.properties?.['dueDate'] as string}
                                                docType={String(invoice.properties?.['docType'] || '')}
                                                vatCalcMode={((invoice?.properties?.['vatCalcMode'] as string) || 'lines') as any}
                                                vatRegime={invoice?.properties?.['vatRegime'] as string}
                                                structuredComm={invoice?.properties?.['structuredComm'] as string}
                                            />
                                        );
                                        const blob = await generatePdfBlob(doc, tenant);
                                        const url = URL.createObjectURL(blob);
                                        const a = document.createElement('a');
                                        a.href = url;
                                        a.download = `Factuur_${invoiceTitle || 'Draft'}.pdf`;
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
                                className="text-sm font-bold px-5 py-2.5 rounded-xl transition-all flex items-center gap-2 text-white hover:opacity-90 active:scale-[0.97] disabled:opacity-60 shadow-sm"
                                style={{ backgroundColor: 'var(--brand-color, #d35400)' }}
                            >
                                <FileText className="w-4 h-4" />
                                {isDownloading ? 'Generating...' : 'Export PDF'}
                            </button>

                            {isDraft && (
                                <button
                                    onClick={() => {
                                        if (window.confirm('Are you sure you want to permanently delete this draft invoice?')) {
                                            const deletePage = useDatabaseStore.getState().deletePage;
                                            deletePage(invoicesDbId, id);
                                            router.back();
                                        }
                                    }}
                                    className="text-sm font-semibold px-5 py-2.5 rounded-xl transition-all flex items-center gap-2 border text-red-500 border-red-200 dark:border-red-800/40 hover:bg-red-50 dark:hover:bg-red-900/20 active:scale-[0.97]"
                                >
                                    <Trash2 className="w-4 h-4" /> Delete
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}


            <PDFImportModal
                isOpen={isImportModalOpen}
                onClose={() => setIsImportModalOpen(false)}
                onImportComplete={handleImportComplete}
                onMetadataExtracted={(meta) => {
                    // Auto-fill invoice page properties from extracted document metadata
                    if (meta.documentRef) handleUpdateProperty('title', meta.documentRef);
                    if (meta.documentDate) handleUpdateProperty('invoiceDate', meta.documentDate);
                    if (meta.grandTotalExcl != null) handleUpdateProperty('totalExVat', meta.grandTotalExcl);
                    if (meta.vatAmount != null) handleUpdateProperty('totalVat', meta.vatAmount);
                    if (meta.grandTotalIncl != null) handleUpdateProperty('totalIncVat', meta.grandTotalIncl);
                    if (meta.customerName) {
                        // Try to match a client by name
                        const match = clients.find(c => 
                            `${c.firstName} ${c.lastName}`.toLowerCase().trim().includes(meta.customerName!.toLowerCase().trim()) ||
                            meta.customerName!.toLowerCase().trim().includes(`${c.firstName} ${c.lastName}`.toLowerCase().trim())
                        );
                        if (match) handleUpdateProperty('client', match.id);
                    }
                }}
            />

            <InlineDialog
                isOpen={offerteImportDialog.open}
                onClose={() => setOfferteImportDialog(prev => ({ ...prev, open: false }))}
                onConfirm={executeOfferteImport}
                title="Regels importeren uit offerte?"
                message={
                    <div className="space-y-2 text-sm">
                        <p>
                            De offerte <strong>&quot;{offerteImportDialog.quotationTitle}&quot;</strong> bevat{' '}
                            <strong>{offerteImportDialog.lineCount} regel{offerteImportDialog.lineCount !== 1 ? 's' : ''}</strong>{' '}
                            met een prijs.
                        </p>
                        {importedQuotationIds.includes(offerteImportDialog.quotationId) && (
                            <div className="flex items-start gap-2 p-2 rounded bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-900/30">
                                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                                <span className="text-xs">
                                    <strong>Opgelet:</strong> De regels van deze offerte zijn mogelijk al geïmporteerd in deze factuur.
                                </span>
                            </div>
                        )}
                        <p className="text-neutral-500 dark:text-neutral-500">
                            De volledige structuur (secties, subsecties) wordt behouden. Regels zonder prijs worden overgeslagen.
                        </p>
                    </div>
                }
                confirmLabel="Importeren"
                cancelLabel="Alleen koppelen"
            />

            <InlineDialog
                isOpen={peppolLimitDialog}
                onClose={() => setPeppolLimitDialog(false)}
                onConfirm={() => router.push(`/${locale}/admin/settings/billing`)}
                title="Peppol Limiet Bereikt"
                message="Je hebt je maandelijkse limiet voor het verzenden van Peppol facturen bereikt. Om meer facturen te verzenden via e-invoice.be, kan je upgraden naar een hoger plan of een volume pack aankopen in de instellingen."
                confirmLabel="Upgrade Plan"
                cancelLabel="Sluiten"
            />

            <CreateClientModal
                isOpen={showNewClientModal}
                onClose={() => setShowNewClientModal(false)}
                onCreated={(pageId) => handleUpdateProperty('client', pageId)}
                createPage={createPage}
                clientsDbId={clientsDbId}
            />

            <CreateProjectModal
                isOpen={showNewProjectModal}
                onClose={() => setShowNewProjectModal(false)}
                onCreated={(pageId) => handleUpdateProperty('project', pageId)}
                createPage={createPage}
                projectDbId={projectDbId}
                preselectedClientId={clientId}
            />

            <QuoteSendModal
                isOpen={showSendModal}
                onClose={() => setShowSendModal(false)}
                onSend={executeSendEmail}
                clientEmail={clients.find(c => c.id === clientId)?.email || ''}
                defaultSubject={`${t('subject_invoice', docLanguage)}: ${betreft || invoiceTitle} — ${tenant?.commercialName || tenant?.companyName || 'Coral'}`}
                defaultBody={t('email_invoice_body', docLanguage)}
                projectId={projectId || undefined}
                documentId={id}
                documentType="invoice"
                documentFileName={`${t('invoice', docLanguage)}_${(betreft || invoiceTitle || '').replace(/[^a-zA-Z0-9]/g, '_')}.pdf`}
                isSending={isSending}
            />

        </div>
    );
}
