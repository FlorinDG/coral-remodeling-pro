"use client";

import React, { useEffect, useMemo, useState, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import ErrorBoundary from '@/components/common/ErrorBoundary';
import { useDatabaseStore } from '@/components/admin/database/store';
import { ArrowLeft, User, Briefcase, FileText, Calendar, PanelRight, ExternalLink, FilePlus2, Receipt, Undo2, ClipboardCheck, Database, ChevronsUpDown, Scissors, Eye, MoreHorizontal } from 'lucide-react';
import { useTenant } from '@/context/TenantContext';
import { DragDropContext, Droppable, DropResult } from '@hello-pangea/dnd';
import { Page, Block, PropertyValue } from '@/components/admin/database/types';
import QuotationRow from './QuotationRow';
import QuotationFooterReport from './QuotationFooterReport';
import { generatePdfBlob } from '@/lib/generate-pdf';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { sendQuotationToClient } from '@/app/actions/send-quote';
import { QuotationPDFTemplate } from './QuotationPDFTemplate';
import PDFImportModal from './PDFImportModal';
import CreateVorderingstaatModal from './CreateVorderingstaatModal';
import { QuoteSendModal } from './QuoteSendModal';
import { TemplateId } from '@/components/admin/shared/templateStyles';
import DbPropertiesPanel from '@/components/admin/database/components/DbPropertiesPanel';
import SelectDropdown from '@/components/admin/database/components/SelectDropdown';
import SearchableSelect from '@/components/ui/SearchableSelect';
import { canAccess } from '@/lib/feature-flags';
import { t as ti18n } from '@/lib/document-i18n';
import { calculateInvoiceTotals } from '@/lib/invoice-totals';
import { createPrismaInvoice } from "@/app/actions/create-invoice";
import { getNextDocumentNumber } from "@/app/actions/next-document-number";
import { generateClientSideDocNumber } from "@/lib/docNumberFallback";

import { Bot, Mail, CloudUpload, AlertTriangle } from 'lucide-react';
import { Link } from '@/i18n/routing';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import InternalTasklist from './InternalTasklist';

const FALLBACK_PAGES: Page[] = [];

interface TenantProfile {
    companyName?: string;
    vatNumber?: string;
    brandColor?: string;
    documentTemplate?: TemplateId;
    documentLanguage?: string;
    logoUrl?: string;
    planType?: string;
    [key: string]: unknown;
}

export default function ClientQuotationEngine({ id, locale }: { id: string, locale: string }) {
    const tPlaceholders = useTranslations('Admin.placeholders');
    const router = useRouter();
    const pathname = usePathname();
    const isMobileRoute = pathname.includes('/m/');
    const { activeModules, planType, resolveDbId, tenant } = useTenant();
    const hasProjects  = activeModules.includes('PROJECTS');
    // Library access: PRO+ feature (article search, save-to-library, PDF library import)
    const hasLibraryAccess = canAccess('QUOTATION_LIBRARY_SEARCH', planType);
    // Dedup: PRO+ feature — detect lines already present in the quotation before import
    const canDedup         = canAccess('QUOTATION_PDF_IMPORT_DEDUP', planType);
    const getDatabase = useDatabaseStore(state => state.getDatabase);
    const updatePageBlocks = useDatabaseStore(state => state.updatePageBlocks);
    const updatePageProperty = useDatabaseStore(state => state.updatePageProperty);
    const createPage = useDatabaseStore(state => state.createPage);

    // Resolve tenant-scoped DB IDs once — stable across re-renders via useTenant context
    const quotationsDbId = resolveDbId('db-quotations');
    const clientsDbId    = resolveDbId('db-clients');
    const projectDbId    = resolveDbId('db-1');

    const [isHydrated, setIsHydrated] = useState(() => {
        if (typeof window === "undefined") return false;
        return useDatabaseStore.persist?.hasHydrated() || false;
    });
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [isVorderingModalOpen, setIsVorderingModalOpen] = useState(false);
    const [isSending, setIsSending] = useState(false);
    const [isSavingToDrive, setIsSavingToDrive] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);
    const [isPreviewing, setIsPreviewing] = useState(false);
    const [showProperties, setShowProperties] = useState(false);
    const [isDraggingGlobal, setIsDraggingGlobal] = useState(false);
    const [showSendModal, setShowSendModal] = useState(false);
    const [sendModalPdfBase64, setSendModalPdfBase64] = useState<string>('');

    // Universal Transactional Undo History Setup
    const [history, setHistory] = useState<Block[][]>([]);
    const historyRef = useRef<Block[][]>([]);
    const blocksRef = useRef<Block[]>([]);
    const quotationsDbIdRef = useRef<string>('');
    const idRef = useRef<string>('');

    // Dynamic timing & pending refs for keystroke-level undo debouncing
    const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const pendingHistoryBlocksRef = useRef<Block[] | null>(null);

    useEffect(() => {
        const unsubscribe = useDatabaseStore.persist.onFinishHydration(() => setIsHydrated(true));

        return () => {
            if (unsubscribe) unsubscribe();
            if (debounceTimeoutRef.current) {
                clearTimeout(debounceTimeoutRef.current);
            }
        };
    }, []);

    const quotation = useDatabaseStore(state => {
        const db = state.databases.find(d => d.id === quotationsDbId);
        return db?.pages.find(p => p.id === id) || null;
    });

    const projects = useDatabaseStore(state => state.databases.find(d => d.id === projectDbId)?.pages || FALLBACK_PAGES);

    // Read the resolved clients database from Zustand
    const clientsDb = useDatabaseStore(state => state.databases.find(d => d.id === clientsDbId));

    const blocks = quotation?.blocks || [];

    useEffect(() => {
        historyRef.current = history;
    }, [history]);

    useEffect(() => {
        blocksRef.current = blocks;
    }, [blocks]);

    useEffect(() => {
        quotationsDbIdRef.current = quotationsDbId;
        idRef.current = id;
    }, [quotationsDbId, id]);

    useEffect(() => {
        return () => {
            if (debounceTimeoutRef.current) {
                clearTimeout(debounceTimeoutRef.current);
            }
        };
    }, []);

    const savePendingHistoryImmediate = () => {
        if (debounceTimeoutRef.current) {
            clearTimeout(debounceTimeoutRef.current);
            debounceTimeoutRef.current = null;
        }
        if (pendingHistoryBlocksRef.current) {
            pushToHistory(pendingHistoryBlocksRef.current);
            pendingHistoryBlocksRef.current = null;
        }
    };

    const pushToHistoryDebounced = (currentBlocks: Block[]) => {
        if (!pendingHistoryBlocksRef.current) {
            pendingHistoryBlocksRef.current = JSON.parse(JSON.stringify(currentBlocks)) as Block[];
        }
        if (debounceTimeoutRef.current) {
            clearTimeout(debounceTimeoutRef.current);
        }
        debounceTimeoutRef.current = setTimeout(() => {
            savePendingHistoryImmediate();
        }, 800);
    };

    const pushToHistory = (currentBlocks: Block[]) => {
        const clone = JSON.parse(JSON.stringify(currentBlocks)) as Block[];
        setHistory(prev => {
            if (prev.length > 0 && JSON.stringify(prev[prev.length - 1]) === JSON.stringify(clone)) {
                return prev;
            }
            const next = [...prev, clone];
            if (next.length > 20) {
                next.shift();
            }
            return next;
        });
    };

    const handleUndo = () => {
        savePendingHistoryImmediate();
        const currentHistory = historyRef.current;
        if (currentHistory.length === 0) return;
        
        const nextHistory = [...currentHistory];
        const previousState = nextHistory.pop();
        
        setHistory(nextHistory);
        
        if (previousState) {
            updatePageBlocks(quotationsDbIdRef.current, idRef.current, previousState);
            toast.success('Bewerking ongedaan gemaakt');
        }
    };

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const isZ = e.key.toLowerCase() === 'z';
            const isMod = e.metaKey || e.ctrlKey;
            const isShift = e.shiftKey;
            
            if (isMod && isZ && !isShift) {
                e.preventDefault();
                handleUndo();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, []);

    const isStructuralChange = (oldBlocks: Block[], newBlocks: Block[]): boolean => {
        const getStructure = (nodes: Block[]): string => {
            return (nodes || []).map(node => {
                const childStruct = node.children ? getStructure(node.children) : '';
                const variantStr = node.selectedVariants ? JSON.stringify(node.selectedVariants) : '';
                return `${node.id}:${node.type}:${!!node.isOptional}:${node.articleId || ''}:${node.bestekId || ''}:${variantStr}[${childStruct}]`;
            }).join(',');
        };
        return getStructure(oldBlocks) !== getStructure(newBlocks);
    };

    // Derive client list with useMemo to avoid infinite re-render loops
    const clients = useMemo(() => {
        if (!clientsDb) return [];
        const nameProp = clientsDb.properties.find(p => ['naam', 'name', 'voornaam', 'first', 'firstname', 'prénom', 'prenom'].some(k => p.name.toLowerCase().includes(k)));
        const lastProp = clientsDb.properties.find(p => ['achternaam', 'last', 'lastname', 'familienaam', 'nom'].some(k => p.name.toLowerCase().includes(k)));
        const emailProp = clientsDb.properties.find(p => p.type === 'email') || clientsDb.properties.find(p => ['email', 'e-mail', 'mail', 'courriel'].some(k => p.name.toLowerCase().includes(k)));
        const driveProp = clientsDb.properties.find(p => p.type === 'url' && p.name.toLowerCase().includes('drive')) || clientsDb.properties.find(p => p.name.toLowerCase().includes('drive'));
        const vatProp = clientsDb.properties.find(p => ['btw', 'vat', 'ondernemingsnummer', 'kbo', 'enterprise', 'tva'].some(k => p.name.toLowerCase().includes(k)));
        const addressProp = clientsDb.properties.find(p => ['adres', 'address', 'straat', 'street', 'rue'].some(k => p.name.toLowerCase().includes(k)));
        const langProp = clientsDb.properties.find(p => p.id === 'language') || clientsDb.properties.find(p => ['taal', 'language', 'lang', 'langue'].some(k => p.name.toLowerCase().includes(k)));
        return clientsDb.pages.map(page => ({
            id: page.id,
            firstName: String(page.properties[nameProp?.id || 'title'] || page.properties['title'] || ''),
            lastName: String(page.properties[lastProp?.id || ''] || ''),
            email: emailProp ? String(page.properties[emailProp.id] || '') : null,
            driveFolderId: driveProp ? String(page.properties[driveProp.id] || '') : null,
            vatNumber: vatProp ? String(page.properties[vatProp.id] || '') : null,
            address: addressProp ? String(page.properties[addressProp.id] || '') : null,
            language: langProp ? String(page.properties[langProp.id] || '') : 'lang-nl',
        }));
    }, [clientsDb]);

    // Sync financial summary back to database properties for the grid view
    // Must be placed before early returns to satisfy Rules of Hooks
    useEffect(() => {
        if (!quotation || !isHydrated) return;
        const currentBlocks = quotation.blocks || [];

        const vatMode = ((quotation.properties?.['vatCalcMode'] as string) || 'lines') as 'lines' | 'total';
        const vatReg = (quotation.properties?.['vatRegime'] as string) || '21';

        const totals = calculateInvoiceTotals(currentBlocks, { vatCalcMode: vatMode, vatRegime: vatReg });
        const roundedEx = totals.subtotal;
        const roundedVat = totals.totalVAT;
        const roundedInc = totals.totalInclVAT;

        if (quotation.properties?.['totalExVat'] !== roundedEx) updatePageProperty(quotationsDbId, quotation.id, 'totalExVat', roundedEx);
        if (quotation.properties?.['totalVat'] !== roundedVat) updatePageProperty(quotationsDbId, quotation.id, 'totalVat', roundedVat);
        if (quotation.properties?.['totalIncVat'] !== roundedInc) updatePageProperty(quotationsDbId, quotation.id, 'totalIncVat', roundedInc);
    }, [quotation?.blocks, quotation?.properties?.['vatCalcMode'], quotation?.properties?.['vatRegime'], isHydrated, quotationsDbId, updatePageProperty]);

    const rawProject = quotation?.properties?.['project'];
    const projectId = Array.isArray(rawProject) ? (rawProject[0] || '') : (rawProject as string) || '';
    const project = useMemo(() => {
        if (!projectId) return null;
        return projects.find(p => p.id === projectId) || null;
    }, [projects, projectId]);

    const rawClient = quotation?.properties?.['client'];
    const clientId = Array.isArray(rawClient) ? (rawClient[0] || '') : (rawClient as string) || '';

    // Calculate totals using the shared calculator
    const totals = useMemo(() => {
        const vatMode = ((quotation?.properties?.['vatCalcMode'] as string) || 'lines') as 'lines' | 'total';
        const vatReg = (quotation?.properties?.['vatRegime'] as string) || '21';
        return calculateInvoiceTotals(blocks || [], { vatCalcMode: vatMode, vatRegime: vatReg });
    }, [blocks, quotation?.properties?.['vatCalcMode'], quotation?.properties?.['vatRegime']]);

    const grandTotalExcl = totals.subtotal;
    const vatAmount = totals.totalVAT;
    const totalIncVat = totals.totalInclVAT;

    const docLanguage = useMemo(() => {
        if (!quotation) return 'nl';
        const docLangProp = quotation.properties?.['docLanguage'] as string;
        if (docLangProp) return docLangProp;

        const clientRecord = clients.find(c => c.id === clientId);
        if (clientRecord?.language) {
            const rawLang = clientRecord.language.toLowerCase();
            if (rawLang.includes('fr')) return 'fr';
            if (rawLang.includes('en')) return 'en';
            return 'nl';
        }
        return tenant?.documentLanguage || 'nl';
    }, [quotation, clients, clientId, tenant?.documentLanguage]);

    if (!isHydrated) return <div className="flex h-screen items-center justify-center">{ti18n('engine_loading', locale)}</div>;
    if (!quotation) return <div className="flex h-screen items-center justify-center flex-col gap-4"><h1>{ti18n('engine_not_found', locale)}</h1><button onClick={() => router.back()} className="text-blue-500">{ti18n('engine_go_back', locale)}</button></div>;

    const quotationTitle = String(quotation.properties?.['title'] || ti18n('engine_draft_quotation', locale));
    const billingRule = (quotation.properties?.['prop-billing-rule'] as string) || 'opt-fixed';
    const paymentTerms = (quotation.properties?.['prop-payment-method'] as string) || 'pay-30';
    const betreft = (quotation.properties?.['betreft'] as string) || '';
    const quotationStatus = (quotation.properties?.['status'] as string) || '';
    const quotationDate = (quotation.properties?.['date'] as string) || '';
    const vatCalcMode = ((quotation.properties?.['vatCalcMode'] as string) || 'lines') as 'lines' | 'total';
    const vatRegime = (quotation.properties?.['vatRegime'] as string) || '21';

    const handleUpdateBlock = (blockId: string, updates: Partial<Block>) => {
        const newBlocks = blocks.map(b => b.id === blockId ? { ...b, ...updates } : b);
        
        const structural = isStructuralChange(blocks, newBlocks);
        if (structural) {
            savePendingHistoryImmediate();
            pushToHistory(blocks);
        } else {
            pushToHistoryDebounced(blocks);
        }
        
        updatePageBlocks(quotationsDbId, id, newBlocks);
    };

    const handleDragEnd = (result: DropResult) => {
        setIsDraggingGlobal(false);
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

        const findNode = (nodes: Block[], targetId: string): Block | null => {
            for (const node of nodes) {
                if (node.id === targetId) return node;
                if (node.children) {
                    const found = findNode(node.children, targetId);
                    if (found) return found;
                }
            }
            return null;
        };

        extractNode(newBlocks);

        if (movedBlock) {
            // Hierarchy Protection: Prevent containers from being nested inside calculation lines
            if (destination.droppableId !== 'root') {
                const parentBlock = findNode(blocks, destination.droppableId);
                if (parentBlock) {
                    const isParentContainer = parentBlock.type === 'section' || parentBlock.type === 'subsection' || parentBlock.type === 'post';
                    const isMovedContainer = (movedBlock as Block).type === 'section' || (movedBlock as Block).type === 'subsection' || (movedBlock as Block).type === 'post';
                    
                    if (!isParentContainer && isMovedContainer) {
                        toast.error('Mappen/secties kunnen niet in een calculatieregel worden geplaatst.');
                        return;
                    }
                }
            }

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

            const inserted = insertNode(newBlocks, destination.droppableId);
            // Boundary & Deletion Protection: Only update blocks array if insertion was fully successful
            if (inserted) {
                savePendingHistoryImmediate();
                pushToHistory(blocks);
                updatePageBlocks(quotationsDbId, id, newBlocks);
            }
        }
    };

    const handleDeleteBlock = (blockId: string) => {
        savePendingHistoryImmediate();
        pushToHistory(blocks);
        const newBlocks = blocks.filter(b => b.id !== blockId);
        updatePageBlocks(quotationsDbId, id, newBlocks);
    };

    const handleDuplicateBlock = (blockId: string) => {
        const blockToDuplicate = blocks.find(b => b.id === blockId);
        if (!blockToDuplicate) return;

        savePendingHistoryImmediate();
        pushToHistory(blocks);
        const newBlock: Block = { ...blockToDuplicate, id: crypto.randomUUID() };
        const index = blocks.findIndex(b => b.id === blockId);

        const newBlocks = [...blocks];
        newBlocks.splice(index + 1, 0, newBlock);

        updatePageBlocks(quotationsDbId, id, newBlocks);
    };

    const handleAddBlock = (type: Block['type'] = 'line') => {
        savePendingHistoryImmediate();
        pushToHistory(blocks);
        const newBlock: Block = { id: crypto.randomUUID(), type, content: '' };
        updatePageBlocks(quotationsDbId, id, [...blocks, newBlock]);
    };

    const handleImportComplete = (newBlocks: Block[]) => {
        savePendingHistoryImmediate();
        pushToHistory(blocks);
        updatePageBlocks(quotationsDbId, id, [...blocks, ...newBlocks]);
    };

    const handleUpdateProperty = (key: string, value: PropertyValue) => {
        if (!quotation) return;
        updatePageProperty(quotationsDbId, quotation.id, key, value);
    };





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




    const handleSendEmailClick = async () => {
        if (!clientId) return toast.warning('Selecteer eerst een klant om de offerte te versturen.');

        setIsSending(true);
        try {
            const clientRecord = clients.find(c => c.id === clientId);
            const clientEmail = String(clientRecord?.email || '');

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
                    grandTotalExcl={grandTotalExcl}
                    grandTotalIncl={totalIncVat}
                    vatAmount={vatAmount}
                    databaseStoreState={useDatabaseStore.getState()}
                    tenantProfile={tenant}
                    templateId={tenant?.documentTemplate || 't1'}
                    language={docLanguage}
                    vatCalcMode={vatCalcMode}
                    vatRegime={vatRegime}
                    billingRule={billingRule}
                    paymentTerms={paymentTerms}
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
        const projectName = betreft || quotationTitle || 'Offerte';

        setIsSending(true);
        try {
            const response = await sendQuotationToClient(
                id, clientEmail, clientName, String(projectName),
                `€${totalIncVat.toFixed(2)}`, sendModalPdfBase64,
                bodyOverride,
                String(tenant?.commercialName || tenant?.companyName || ''),
                docLanguage,
                tenant?.brandColor,
                tenant?.email || undefined,
                subjectOverride,
                attachmentKeys
            );

            if (response.success) {
                toast.success('Offerte is succesvol verzonden!');
                setShowSendModal(false);
                handleUpdateProperty('status', 'opt-sent');
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
        if (!clientId) return toast.warning('Selecteer eerst een klant om op te slaan.');

        setIsSavingToDrive(true);
        try {
            const doc = (
                <QuotationPDFTemplate
                    blocks={blocks}
                    quotationTitle={String(quotationTitle)}
                    betreft={String(betreft)}
                    clientInfo={buildClientInfo()}
                    projectId={String(projectId)}
                    grandTotalExcl={grandTotalExcl}
                    grandTotalIncl={totalIncVat}
                    vatAmount={vatAmount}
                    databaseStoreState={useDatabaseStore.getState()}
                    tenantProfile={tenant}
                    templateId={tenant?.documentTemplate || 't1'}
                    language={docLanguage}
                    vatCalcMode={vatCalcMode}
                    vatRegime={vatRegime}
                    billingRule={billingRule}
                    paymentTerms={paymentTerms}
                />
            );

            const blob = await generatePdfBlob(doc, tenant);

            const file = new File([blob], `Offerte_${quotationTitle || 'Draft'}.pdf`, { type: 'application/pdf' });
            const formData = new FormData();
            formData.append('file', file);

            const { uploadFileAction } = await import('@/app/actions/files');
            const result = await uploadFileAction(formData, 'quotation', quotation.id);

            if (result.success) {
                toast.success('Succesvol opgeslagen in dossier!');
            } else {
                toast.error(`Opslaan mislukt: ${result.error}`);
            }
        } catch (e: unknown) {
            console.error(e);
            toast.error('Er is iets misgegaan tijdens het opslaan: ' + (e instanceof Error ? e.message : String(e)));
        } finally {
            setIsSavingToDrive(false);
        }
    };

    const handleHandover = () => {
        if (!clientId) return toast.warning('Selecteer eerst een klant om het project te starten.');

        const projectDbId = resolveDbId('db-1');
        const tasksDbId = resolveDbId('db-tasks');

        // 1. Create a Project in db-1
        const newProject = createPage(projectDbId, {
            title: `[EXEC] ${betreft || quotationTitle}`,
            'prop-execution-status': 'opt-to-do',
            'prop-financial-status': 'opt-quote',
            'prop-client': [clientId],
            'prop-budget': grandTotalExcl,
            'prop-start-date': quotationDate || '',
            'prop-end-date': quotationDate || '',
            'prop-billing-rule': billingRule,
        });

        if (!newProject) {
            toast.error('Project aanmaken mislukt.');
            return;
        }

        // 2. Map blocks to Tasks in db-tasks
        const extractTasks = (nodes: Block[]) => {
            nodes.forEach(block => {
                if (block.type === 'line' || block.type === 'post') {
                    createPage(tasksDbId, {
                        title: block.content || 'Uitvoerende Taak',
                        'prop-task-status': 't-todo',
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

        // 4. Navigate to the newly created project
        if (isMobileRoute) {
            router.push(`/${locale}/m`);
        } else {
            router.push(`/${locale}/admin/projects-management?projectId=${newProject.id}`);
        }
    };

    // Convert accepted quotation → invoice
    const handleConvertToInvoice = async () => {
        if (!clientId) return toast.warning('Selecteer eerst een klant.');

        const invoiceDbId = resolveDbId('db-invoices');
        const today = new Date().toISOString().split('T')[0];

        try {
            // Generate the next sequential invoice number
            const numResult = await getNextDocumentNumber('invoice');
            const invoiceNumber = numResult.success && numResult.number
                ? numResult.number
                : generateClientSideDocNumber(tenant, 'invoice');

            // Create invoice with data from quotation
            const newInvoice = createPage(invoiceDbId, {
                title: invoiceNumber,
                client: [clientId],
                betreft: betreft || quotationTitle,
                status: 'opt-draft',
                invoiceDate: today,
                deliveryDate: today,
                totalExVat: Math.round((quotation?.properties?.['totalExVat'] as number || grandTotalExcl) * 100) / 100,
                totalVat: Math.round((quotation?.properties?.['totalVat'] as number || vatAmount) * 100) / 100,
                totalIncVat: Math.round((quotation?.properties?.['totalIncVat'] as number || totalIncVat) * 100) / 100,
            });

            if (!newInvoice) {
                toast.error('Factuur aanmaken mislukt.');
                return;
            }

            // Create the Prisma invoice record with the confirmed page ID
            await createPrismaInvoice(newInvoice.id, invoiceNumber);

            // Copy line items (blocks) to the invoice
            if (blocks.length > 0) {
                // Deep clone blocks with new IDs to avoid cross-references
                const cloneBlocks = (nodes: Block[]): Block[] => {
                    return nodes.map(b => ({
                        ...b,
                        id: crypto.randomUUID(),
                        children: b.children ? cloneBlocks(b.children) : undefined,
                    }));
                };
                updatePageBlocks(invoiceDbId, newInvoice.id, cloneBlocks(blocks));
            }

            toast.success('Factuur aangemaakt vanuit offerte!');
            if (isMobileRoute) {
                router.push(`/${locale}/m/invoices/${newInvoice.id}`);
            } else {
                router.push(`/${locale}/admin/financials/income/invoices/${newInvoice.id}`);
            }
        } catch (e) {
            console.error('Failed to convert quotation to invoice:', e);
            toast.error('Factuur aanmaken mislukt door een systeemfout.');
        }
    };

    // Create an addendum — independent quotation linked to the parent
    const handleCreateAddendum = () => {
        const addendumTitle = `ADD-${quotationTitle}`;
        const newPage = createPage(quotationsDbId, {
            title: addendumTitle,
            client: clientId || '',
            project: projectId || '',
            betreft: `Addendum: ${betreft || quotationTitle}`,
            status: 'opt-draft',
            parentQuoteId: id,
            vatCalcMode: vatCalcMode,
            vatRegime: vatRegime,
        });
        if (newPage) {
            toast.success('Addendum aangemaakt!');
            if (isMobileRoute) {
                router.push(`/${locale}/m/quotes/${newPage.id}`);
            } else {
                router.push(`/${locale}/admin/quotations/${newPage.id}`);
            }
        } else {
            toast.error('Addendum aanmaken mislukt.');
        }
    };

    return (
        <ErrorBoundary componentName="QuotationEngine">
            <div className="flex flex-col w-full min-h-screen md:h-full bg-white dark:bg-black text-neutral-900 dark:text-white">
            {/* Header Controls */}
            <div className="border-b border-neutral-200 dark:border-white/10 shrink-0">
                {/* Row 1: Back + Title + Actions */}
                <div className="flex items-center gap-3 px-4 py-2.5">
                    <button
                        onClick={() => router.back()}
                        className="p-2 hover:bg-neutral-100 dark:hover:bg-white/5 rounded-md transition-colors shrink-0"
                        title="Vorige pagina"
                    >
                        <ArrowLeft className="w-5 h-5 text-neutral-500" />
                    </button>
                    {!isMobileRoute && (
                        <Link
                            href="/admin/quotations"
                            className="p-2 hover:bg-neutral-100 dark:hover:bg-white/5 rounded-md transition-colors shrink-0 flex items-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-900 dark:hover:text-white font-medium"
                            title="Naar Offertes database"
                        >
                            <Database className="w-4 h-4" />
                            <span className="hidden sm:inline">Database</span>
                        </Link>
                    )}
                    <div className="flex flex-col min-w-0 flex-1">
                        <input
                            type="text"
                            value={betreft}
                            onChange={(e) => handleUpdateProperty('betreft', e.target.value)}
                            placeholder={ti18n('engine_draft_quotation', locale)}
                            className="bg-transparent text-lg font-bold tracking-tight text-neutral-900 dark:text-white outline-none focus:ring-0 placeholder:text-neutral-400 p-0 m-0 w-full max-w-[400px]"
                        />
                        <p className="text-[10px] text-neutral-400 font-mono tracking-wider uppercase">
                            {ti18n('quotation', locale)} {quotationTitle}
                        </p>
                    </div>

                    {/* Right side actions */}
                    <div className="flex items-center gap-1.5 shrink-0 ml-auto">
                        {/* Undo Button */}
                        <button
                            onClick={handleUndo}
                            disabled={history.length === 0}
                            title={history.length === 0 ? 'Niets om ongedaan te maken' : 'Ongedaan maken (Cmd+Z)'}
                            className={`p-2 rounded-lg border transition-all ${
                                history.length === 0
                                    ? 'border-neutral-200 dark:border-white/5 text-neutral-300 dark:text-white/10 cursor-not-allowed opacity-40 bg-transparent'
                                    : 'border-neutral-200 dark:border-white/10 text-neutral-600 dark:text-neutral-300 hover:text-orange-600 dark:hover:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/20 hover:border-orange-300 dark:hover:border-orange-700'
                            }`}
                        >
                            <Undo2 className="w-4 h-4" />
                        </button>

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
                {/* Row 2: Selectors — responsive wrap */}
                <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2 px-3 md:px-4 py-2 border-t border-neutral-100 dark:border-white/5 bg-neutral-50/50 dark:bg-white/[0.02] w-full">
                    {/* Client Selector */}
                    <div className="flex items-center bg-white dark:bg-white/5 rounded-lg border border-neutral-200 dark:border-white/10 relative w-full sm:w-auto">
                        <User className="w-3.5 h-3.5 text-neutral-400 absolute left-2.5 z-10 pointer-events-none" />
                        <div className="flex-1 w-full sm:w-44 pl-6">
                            <SearchableSelect
                                value={clientId}
                                onChange={(value) => handleUpdateProperty('client', value)}
                                disabled={false}
                                placeholder={ti18n('engine_select_client', locale)}
                                searchPlaceholder="Zoek klant..."
                                emptyLabel="Geen klanten gevonden"
                                className="border-none bg-transparent shadow-none ring-0 h-8 text-xs"
                                borderless
                                options={clients.map(client => ({
                                    value: client.id,
                                    label: `${client.firstName} ${client.lastName}`
                                }))}
                            />
                        </div>
                        {clientId && (
                            <Link
                                href={isMobileRoute ? `/m/clients` : `/admin/database/${clientsDbId}/${clientId}`}
                                className="absolute right-1.5 z-10 p-0.5 rounded hover:bg-neutral-200 dark:hover:bg-white/10 transition-colors"
                                title={ti18n('engine_open_record', locale)}
                            >
                                <ExternalLink className="w-3 h-3 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200" />
                            </Link>
                        )}
                    </div>
                    {/* Project Selector */}
                    {hasProjects && (
                        <div className="flex items-center bg-white dark:bg-white/5 rounded-lg border border-neutral-200 dark:border-white/10 relative w-full sm:w-auto">
                            <Briefcase className="w-3.5 h-3.5 text-neutral-400 absolute left-2.5 z-10 pointer-events-none" />
                            <div className="flex-1 w-full sm:w-48 pl-6">
                                <SearchableSelect
                                    value={projectId}
                                    onChange={(value) => handleUpdateProperty('project', value)}
                                    disabled={false}
                                    placeholder={ti18n('engine_link_project', locale)}
                                    searchPlaceholder="Zoek project..."
                                    emptyLabel="Geen projecten gevonden"
                                    className="border-none bg-transparent shadow-none ring-0 h-8 text-xs"
                                    borderless
                                    options={projects.map(project => ({
                                        value: project.id,
                                        label: String(project.properties['title'] || project.properties['name'] || 'Unnamed Project')
                                    }))}
                                />
                            </div>
                            {projectId && (
                                <Link
                                    href={isMobileRoute ? `/m` : `/admin/database/${projectDbId}/${projectId}`}
                                    className="absolute right-1.5 z-10 p-0.5 rounded hover:bg-neutral-200 dark:hover:bg-white/10 transition-colors"
                                    title={ti18n('engine_open_record', locale)}
                                >
                                    <ExternalLink className="w-3 h-3 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200" />
                                </Link>
                            )}
                        </div>
                    )}

                    {/* Project Billing Rule Badge */}
                    {projectId && project && (() => {
                        const BILLING_RULES_MAP: Record<string, { label: string; color: string }> = {
                            'opt-fixed':    { label: 'Vaste prijs',       color: 'bg-blue-500/10 text-blue-500 border-blue-500/25' },
                            'opt-progress': { label: 'Vorderingenstaten', color: 'bg-purple-500/10 text-purple-500 border-purple-500/25' },
                            'opt-hourly':   { label: 'In Regie',          color: 'bg-orange-500/10 text-orange-500 border-orange-500/25' },
                        };
                        const rule = String(project.properties?.['prop-billing-rule'] || 'opt-fixed');
                        const cfg = BILLING_RULES_MAP[rule] || BILLING_RULES_MAP['opt-fixed'];
                        return (
                            <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1.5 rounded-lg border ${cfg.color} animate-in fade-in zoom-in-95 duration-200`}>
                                Billing: {cfg.label}
                            </span>
                        );
                    })()}

                    {/* Status Selector */}
                    {(() => {
                        const db = getDatabase(quotationsDbId);
                        const statusProp = db?.properties.find(p => p.id === 'status');
                        const statusOptions = statusProp?.config?.options || [
                            { id: 'opt-draft', name: ti18n('engine_status_draft', locale), color: 'gray' },
                            { id: 'opt-sent', name: ti18n('engine_status_sent', locale), color: 'blue' },
                            { id: 'opt-accepted', name: ti18n('engine_status_accepted', locale), color: 'green' },
                            { id: 'opt-rejected', name: ti18n('engine_status_rejected', locale), color: 'red' },
                        ];
                        return (
                            <div className="flex items-center bg-white dark:bg-white/5 rounded-lg border border-neutral-200 dark:border-white/10 relative px-2.5 py-1.5 w-full sm:w-auto">
                                <FileText className="w-3.5 h-3.5 text-neutral-400 mr-1.5 flex-shrink-0" />
                                <SelectDropdown
                                    value={quotationStatus || null}
                                    options={statusOptions}
                                    onChange={(v) => handleUpdateProperty('status', v ?? '')}
                                    placeholder={ti18n('engine_status', locale)}
                                    compact
                                />
                            </div>
                        );
                    })()}

                    {/* Billing Rule Selector */}
                    {(() => {
                        const db = getDatabase(quotationsDbId);
                        const billingProp = db?.properties.find(p => p.id === 'prop-billing-rule');
                        const billingOptions = billingProp?.config?.options || [
                            { id: 'opt-fixed', name: 'Vaste prijs', color: 'blue' },
                            { id: 'opt-progress', name: 'Vorderingsstaten', color: 'purple' },
                            { id: 'opt-hourly', name: 'In Regie', color: 'orange' },
                        ];
                        return (
                            <div className="flex items-center bg-white dark:bg-white/5 rounded-lg border border-neutral-200 dark:border-white/10 relative px-2.5 py-1.5 w-full sm:w-auto">
                                <Receipt className="w-3.5 h-3.5 text-neutral-400 mr-1.5 flex-shrink-0" />
                                <SelectDropdown
                                    value={billingRule}
                                    options={billingOptions}
                                    onChange={(v) => handleUpdateProperty('prop-billing-rule', v ?? 'opt-fixed')}
                                    placeholder={tPlaceholders('billingMethod')}
                                    compact
                                />
                            </div>
                        );
                    })()}

                    {/* Payment Terms Selector */}
                    {(() => {
                        const db = getDatabase(quotationsDbId);
                        const paymentProp = db?.properties.find(p => p.id === 'prop-payment-method');
                        const paymentOptions = paymentProp?.config?.options || [
                            { id: 'pay-0',  name: 'Onmiddellijk', color: 'green'  },
                            { id: 'pay-8',  name: '8 Dagen',      color: 'purple' },
                            { id: 'pay-14', name: '14 Dagen',     color: 'blue'   },
                            { id: 'pay-30', name: '30 Dagen',     color: 'orange' },
                            { id: 'pay-60', name: '60 Dagen',     color: 'red'    },
                            { id: 'pay-90', name: '90 Dagen',     color: 'gray'   },
                        ];
                        return (
                            <div className="flex items-center bg-white dark:bg-white/5 rounded-lg border border-neutral-200 dark:border-white/10 relative px-2.5 py-1.5 w-full sm:w-auto">
                                <ClipboardCheck className="w-3.5 h-3.5 text-neutral-400 mr-1.5 flex-shrink-0" />
                                <SelectDropdown
                                    value={paymentTerms}
                                    options={paymentOptions}
                                    onChange={(v) => handleUpdateProperty('prop-payment-method', v ?? 'pay-30')}
                                    placeholder={tPlaceholders('paymentTerms')}
                                    compact
                                />
                            </div>
                        );
                    })()}

                    {/* Date Input */}
                    <div className="flex items-center bg-white dark:bg-white/5 rounded-lg border border-neutral-200 dark:border-white/10 relative w-full sm:w-auto">
                        <Calendar className="w-3.5 h-3.5 text-neutral-400 absolute left-2.5 pointer-events-none" />
                        <input
                            type="date"
                            value={quotationDate}
                            onChange={(e) => handleUpdateProperty('date', e.target.value)}
                            className="text-xs font-medium text-neutral-700 dark:text-neutral-300 bg-transparent border-none outline-none cursor-pointer pl-7 pr-3 py-2 focus:ring-0 w-36"
                        />
                    </div>
                </div>
            </div>

            {tenant && (!tenant.companyName || !tenant.vatNumber) && (
                <div className="bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-700/50 px-3 md:px-4 py-2.5 flex items-center justify-center gap-3 shrink-0">
                    <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-500 shrink-0" />
                    <p className="text-xs font-medium text-amber-800 dark:text-amber-300">
                        <strong>{ti18n('engine_identity_missing', locale)}</strong> {ti18n('engine_identity_warning', locale)}
                    </p>
                    <Link href={isMobileRoute ? "/m/settings?tab=company-info" : "/admin/settings/company-info"} className="text-xs font-bold bg-amber-200 dark:bg-amber-600/30 text-amber-800 dark:text-amber-200 px-3 py-1 rounded hover:bg-amber-300 dark:hover:bg-amber-600/50 transition-colors ml-2">
                        {ti18n('engine_update_settings', locale)}
                    </Link>
                </div>
            )}

            {/* Main Canvas + optional Properties Panel */}
            <div className="flex flex-1 overflow-visible md:overflow-hidden">
                {/* Canvas */}
                <div className="flex-1 overflow-y-visible md:overflow-y-auto p-2 sm:p-4 relative bg-neutral-50/50 dark:bg-black">
                    <div className="w-full max-w-[1400px] mx-auto flex flex-col gap-1 pb-32">

                        {/* Mathematical Blocks */}
                        <DragDropContext onDragStart={() => setIsDraggingGlobal(true)} onDragEnd={handleDragEnd}>
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
                                                vatCalcMode={vatCalcMode}
                                                language={docLanguage}
                                                isDraggingGlobal={isDraggingGlobal}
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
                                title={ti18n('engine_add_section', locale)}
                            >
                                <span className="text-sm leading-none">+</span> {!isMobileRoute && ti18n('engine_add_section', locale)}
                            </button>
                            <button
                                onClick={() => handleAddBlock('line')}
                                className="text-xs font-semibold flex items-center gap-1 transition-colors py-1.5 px-3 rounded-lg shadow-sm border"
                                style={{
                                    backgroundColor: 'color-mix(in srgb, var(--brand-color, #d35400) 6%, white)',
                                    borderColor: 'color-mix(in srgb, var(--brand-color, #d35400) 20%, transparent)',
                                    color: 'var(--brand-color, #d35400)',
                                }}
                                title={ti18n('engine_add_line', locale)}
                            >
                                <span className="text-sm leading-none">+</span> {!isMobileRoute && ti18n('engine_add_line', locale)}
                            </button>
                            <button
                                onClick={() => handleAddBlock('text')}
                                className="text-xs font-semibold flex items-center gap-1 transition-colors py-1.5 px-3 rounded-lg shadow-sm border border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-white/5"
                                title="Vrije Tekst"
                            >
                                <span className="text-sm leading-none">+</span> {!isMobileRoute && "Vrije Tekst"}
                            </button>
                            <button
                                onClick={() => handleAddBlock('space')}
                                className="text-xs font-semibold flex items-center gap-1.5 transition-colors py-1.5 px-3 rounded-lg shadow-sm border border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-white/5"
                                title="Spacer"
                            >
                                <ChevronsUpDown className="w-3.5 h-3.5" /> {!isMobileRoute && "Spacer"}
                            </button>
                            <button
                                onClick={() => handleAddBlock('page-break')}
                                className="text-xs font-semibold flex items-center gap-1.5 transition-colors py-1.5 px-3 rounded-lg shadow-sm border border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-white/5"
                                title="Page Break"
                            >
                                <Scissors className="w-3.5 h-3.5" /> {!isMobileRoute && "Page Break"}
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
                            language={docLanguage}
                            onLanguageChange={(lang) => handleUpdateProperty('docLanguage', lang)}
                        />

                    </div>
                </div>

                {/* DB Properties Panel — shows all record fields including Excel-imported ones */}
                {showProperties && (
                    <aside className="w-80 lg:w-96 flex-shrink-0 border-l border-neutral-200 dark:border-white/10 overflow-hidden flex flex-col">
                        <div className="flex-1 overflow-y-auto">
                            <ErrorBoundary componentName="DbPropertiesPanel">
                                <DbPropertiesPanel
                                    databaseId={quotationsDbId}
                                    pageId={id}
                                    title={ti18n('engine_record_properties', locale)}
                                    liveProperties={quotation?.properties}
                                    onChange={(propId, newVal) => handleUpdateProperty(propId, newVal)}
                                />
                            </ErrorBoundary>
                        </div>
                        <InternalTasklist 
                            tasks={(quotation?.properties?.['internalTasks'] as { id: string; text: string; completed: boolean }[]) || []}
                            onTasksChange={(tasks) => handleUpdateProperty('internalTasks', tasks)}
                            brandColor="var(--brand-color, #d35400)"
                        />
                    </aside>
                )}
            </div>

                 {/* ── Sticky Bottom Action Bar ── */}
            {isHydrated && (
                <div className={`sticky ${isMobileRoute ? 'bottom-16 md:bottom-0' : 'bottom-0'} z-30 border-t border-neutral-200 dark:border-white/10 bg-white/95 dark:bg-black/95 backdrop-blur-xl px-4 py-3 shrink-0`}>
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 max-w-[1400px] mx-auto w-full">
                        {/* Primary action buttons */}
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full max-w-full overflow-hidden">
                            <button
                                onClick={handleSendEmailClick}
                                disabled={isSending || !clientId}
                                className="text-xs font-semibold px-5 py-2.5 rounded-xl transition-all flex items-center justify-center gap-2 border disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 active:scale-[0.97] shadow-sm w-full sm:w-auto shrink-0 whitespace-nowrap overflow-hidden text-ellipsis"
                                style={{
                                    backgroundColor: clientId ? 'color-mix(in srgb, var(--brand-color, #d35400) 10%, white)' : undefined,
                                    borderColor: clientId ? 'color-mix(in srgb, var(--brand-color, #d35400) 25%, transparent)' : undefined,
                                    color: clientId ? 'var(--brand-color, #d35400)' : undefined,
                                }}
                            >
                                <Mail className="w-3.5 h-3.5" /> {isSending ? ti18n('engine_sending', locale) : ti18n('engine_send', locale)}
                            </button>

                            <button
                                onClick={async () => {
                                    if (isPreviewing) return;
                                    setIsPreviewing(true);
                                    try {
                                        const doc = (
                                            <QuotationPDFTemplate
                                                blocks={blocks}
                                                quotationTitle={String(quotationTitle)}
                                                betreft={String(betreft)}
                                                clientInfo={buildClientInfo()}
                                                projectId={String(projectId)}
                                                grandTotalExcl={grandTotalExcl}
                                                grandTotalIncl={totalIncVat}
                                                vatAmount={vatAmount}
                                                databaseStoreState={useDatabaseStore.getState()}
                                                tenantProfile={tenant}
                                                templateId={tenant?.documentTemplate || 't1'}
                                                language={docLanguage}
                                                showSubcomponents={false}
                                                vatCalcMode={vatCalcMode}
                                                vatRegime={vatRegime}
                                                billingRule={billingRule}
                                                paymentTerms={paymentTerms}
                                            />
                                        );
                                        const blob = await generatePdfBlob(doc, tenant);
                                        const url = URL.createObjectURL(blob);
                                        window.open(url, '_blank');
                                    } catch (e) {
                                        console.error('[PDF] preview failed:', e);
                                        toast.error('PDF preview mislukt.');
                                    } finally {
                                        setIsPreviewing(false);
                                    }
                                }}
                                disabled={isPreviewing}
                                className="text-xs font-semibold px-5 py-2.5 rounded-xl transition-all flex items-center justify-center gap-2 border dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-white/5 active:scale-[0.97] disabled:opacity-60 shadow-sm w-full sm:w-auto shrink-0 whitespace-nowrap"
                            >
                                <Eye className="w-3.5 h-3.5" />
                                {isPreviewing ? ti18n('engine_generating', locale) : (locale === 'fr' ? 'Aperçu PDF' : locale === 'en' ? 'Preview PDF' : 'Voorbeeld PDF')}
                            </button>

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
                                                grandTotalExcl={grandTotalExcl}
                                                grandTotalIncl={totalIncVat}
                                                vatAmount={vatAmount}
                                                databaseStoreState={useDatabaseStore.getState()}
                                                tenantProfile={tenant}
                                                templateId={tenant?.documentTemplate || 't1'}
                                                language={docLanguage}
                                                showSubcomponents={false}
                                                vatCalcMode={vatCalcMode}
                                                vatRegime={vatRegime}
                                                billingRule={billingRule}
                                                paymentTerms={paymentTerms}
                                            />
                                        );
                                        const blob = await generatePdfBlob(doc, tenant);
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
                                className="text-xs font-semibold px-5 py-2.5 rounded-xl transition-all flex items-center justify-center gap-2 text-white hover:opacity-90 active:scale-[0.97] disabled:opacity-60 shadow-sm w-full sm:w-auto shrink-0 whitespace-nowrap overflow-hidden text-ellipsis"
                                style={{ backgroundColor: 'var(--brand-color, #d35400)' }}
                            >
                                <FileText className="w-3.5 h-3.5" />
                                {isDownloading ? ti18n('engine_generating', locale) : ti18n('engine_export_pdf', locale)}
                            </button>

                            <div className="hidden sm:block flex-1" />

                            {/* Dropdown for other actions */}
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <button className="text-xs font-semibold px-5 py-2.5 rounded-xl transition-all flex items-center justify-center gap-2 border border-neutral-200 dark:border-white/10 hover:bg-neutral-50 dark:hover:bg-white/5 active:scale-[0.97] cursor-pointer w-full sm:w-auto shrink-0 whitespace-nowrap overflow-hidden text-ellipsis">
                                        <MoreHorizontal className="w-4 h-4 text-neutral-500" />
                                        <span>Meer acties</span>
                                    </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-56 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-white/10 rounded-xl shadow-xl p-1 z-[150]">
                                    {(() => {
                                        const db = getDatabase(quotationsDbId);
                                        const statusProp = db?.properties.find(p => p.id === 'status');
                                        const acceptedOpt = statusProp?.config?.options?.[2]?.id;
                                        const currentStatus = String(quotation?.properties?.['status'] || '');
                                        const isAccepted = currentStatus === 'ACCEPTED' || currentStatus === 'opt-accepted' || (acceptedOpt && currentStatus === acceptedOpt);
                                        
                                        return (
                                            <>
                                                {hasProjects && isAccepted && (
                                                    <DropdownMenuItem
                                                        onClick={handleHandover}
                                                        className="flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-lg hover:bg-neutral-50 dark:hover:bg-white/5 cursor-pointer text-neutral-700 dark:text-neutral-200"
                                                    >
                                                        <Briefcase className="w-3.5 h-3.5" /> {ti18n('engine_handover', locale)}
                                                    </DropdownMenuItem>
                                                )}
                                                {isAccepted && (
                                                    <DropdownMenuItem
                                                        onClick={handleConvertToInvoice}
                                                        className="flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-lg hover:bg-neutral-50 dark:hover:bg-white/5 cursor-pointer text-neutral-700 dark:text-neutral-200"
                                                    >
                                                        <Receipt className="w-3.5 h-3.5" /> Factureren
                                                    </DropdownMenuItem>
                                                )}
                                            </>
                                        );
                                    })()}

                                    {projectId && project && (
                                        <DropdownMenuItem
                                            onClick={() => setIsVorderingModalOpen(true)}
                                            className="flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-lg hover:bg-neutral-50 dark:hover:bg-white/5 cursor-pointer text-neutral-700 dark:text-neutral-200"
                                        >
                                            <ClipboardCheck className="w-3.5 h-3.5" /> Create Vorderingstaat
                                        </DropdownMenuItem>
                                    )}

                                    <DropdownMenuItem
                                        onClick={handleCreateAddendum}
                                        className="flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-lg hover:bg-neutral-50 dark:hover:bg-white/5 cursor-pointer text-neutral-700 dark:text-neutral-200"
                                    >
                                        <FilePlus2 className="w-3.5 h-3.5" /> {ti18n('engine_create_addendum', locale)}
                                    </DropdownMenuItem>

                                    {hasProjects && (
                                        <DropdownMenuItem
                                            onClick={handleSaveToDrive}
                                            disabled={isSavingToDrive || !clientId}
                                            className="flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-lg hover:bg-neutral-50 dark:hover:bg-white/5 cursor-pointer text-neutral-700 dark:text-neutral-200 disabled:opacity-40"
                                        >
                                            <CloudUpload className="w-3.5 h-3.5" /> {isSavingToDrive ? ti18n('engine_saving', locale) : ti18n('engine_drive', locale)}
                                        </DropdownMenuItem>
                                    )}

                                    <DropdownMenuItem
                                        onClick={() => setIsImportModalOpen(true)}
                                        className="flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-lg hover:bg-neutral-50 dark:hover:bg-white/5 cursor-pointer text-neutral-700 dark:text-neutral-200"
                                    >
                                        <Bot className="w-3.5 h-3.5" /> {ti18n('engine_ai_import', locale)}
                                    </DropdownMenuItem>

                                    <DropdownMenuSeparator className="my-1 border-t border-neutral-100 dark:border-white/5" />

                                    <DropdownMenuItem
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
                                                        grandTotalExcl={grandTotalExcl}
                                                        grandTotalIncl={totalIncVat}
                                                        vatAmount={vatAmount}
                                                        databaseStoreState={useDatabaseStore.getState()}
                                                        tenantProfile={tenant}
                                                        templateId={tenant?.documentTemplate || 't1'}
                                                        language={docLanguage}
                                                        showSubcomponents={true}
                                                        vatCalcMode={vatCalcMode}
                                                        vatRegime={vatRegime}
                                                        billingRule={billingRule}
                                                        paymentTerms={paymentTerms}
                                                    />
                                                );
                                                const blob = await generatePdfBlob(doc, tenant);
                                                const url = URL.createObjectURL(blob);
                                                const a = document.createElement('a');
                                                a.href = url;
                                                a.download = `Offerte_Detail_${quotationTitle || 'Draft'}.pdf`;
                                                a.click();
                                                setTimeout(() => URL.revokeObjectURL(url), 10000);
                                            } catch (e) {
                                                console.error('[PDF] detailed export failed:', e);
                                                toast.error('PDF genereren mislukt.');
                                            } finally {
                                                setIsDownloading(false);
                                            }
                                        }}
                                        disabled={isDownloading}
                                        className="flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-lg hover:bg-neutral-50 dark:hover:bg-white/5 cursor-pointer text-neutral-700 dark:text-neutral-200 disabled:opacity-60"
                                    >
                                        <FileText className="w-3.5 h-3.5" /> {ti18n('engine_export_detailed', locale)}
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    </div>
                </div>
            )}

            <PDFImportModal
                isOpen={isImportModalOpen}
                onClose={() => setIsImportModalOpen(false)}
                onImportComplete={handleImportComplete}
                existingBlocks={blocks}
                canDedup={canDedup}
            />

            {projectId && project && (
                <CreateVorderingstaatModal
                    isOpen={isVorderingModalOpen}
                    onClose={() => setIsVorderingModalOpen(false)}
                    blocks={blocks}
                    projectId={String(projectId)}
                    project={project}
                    updatePageProperty={updatePageProperty}
                    projectDbId={projectDbId}
                    quotationId={id}
                    quotationTitle={String(quotationTitle)}
                    locale={locale}
                />
            )}

            <QuoteSendModal
                isOpen={showSendModal}
                onClose={() => setShowSendModal(false)}
                onSend={executeSendEmail}
                clientEmail={clients.find(c => c.id === clientId)?.email || ''}
                defaultSubject={`${ti18n('subject_quote', docLanguage)}: ${betreft || quotationTitle} — ${tenant?.commercialName || tenant?.companyName || 'Coral'}`}
                defaultBody={ti18n('email_quote_body', docLanguage)}
                projectId={projectId || undefined}
                documentId={id}
                documentType="quotation"
                documentFileName={`${ti18n('quotation', docLanguage)}_${(betreft || quotationTitle || '').replace(/[^a-zA-Z0-9]/g, '_')}.pdf`}
                isSending={isSending}
            />

        </div>
        </ErrorBoundary>
    );
}
