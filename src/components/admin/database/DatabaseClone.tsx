"use client";

import React, { useEffect, useState, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { useDatabaseStore } from '@/components/admin/database/store';
import { LayoutGrid, Table2, Calendar as CalendarIcon, Plus, GanttChartSquare, Settings, Clock, ChevronDown, Edit, Trash2 } from 'lucide-react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { createPortal } from 'react-dom';
import PageModal from '@/components/admin/database/components/PageModal';
import { useTenant } from '@/context/TenantContext';
import { useSession } from 'next-auth/react';
import { Property, DatabaseView } from './types';
import { isSystemDatabase, SERVER_PROVISIONED_BASES } from '@/lib/systemDatabases';
import { t } from '@/lib/document-i18n';
import { useLocale } from 'next-intl';
import { getGlobalDatabases } from '@/app/actions/global-databases';

const NotionGridDynamic = dynamic(
  () => import('@/components/admin/database/NotionGrid'),
  { ssr: false, loading: () => <div className="w-full h-[600px] bg-neutral-50 dark:bg-neutral-900/50 animate-pulse rounded-b-xl border-x border-b border-neutral-200 dark:border-white/10" /> }
);

const KanbanViewDynamic = dynamic(
  () => import('@/components/admin/database/views/KanbanView'),
  { ssr: false, loading: () => <div className="w-full h-[600px] bg-neutral-50 dark:bg-neutral-900/50 animate-pulse rounded-b-xl border-x border-b border-neutral-200 dark:border-white/10" /> }
);

const CalendarViewDynamic = dynamic(
  () => import('@/components/admin/database/views/CalendarView'),
  { ssr: false, loading: () => <div className="w-full h-[600px] bg-neutral-50 dark:bg-neutral-900/50 animate-pulse rounded-b-xl border-x border-b border-neutral-200 dark:border-white/10" /> }
);

const TimelineViewDynamic = dynamic(
  () => import('@/components/admin/database/views/TimelineView'),
  { ssr: false, loading: () => <div className="w-full h-[600px] bg-neutral-50 dark:bg-neutral-900/50 animate-pulse rounded-b-xl border-x border-b border-neutral-200 dark:border-white/10" /> }
);

interface DatabaseCloneProps {
  databaseId: string;
  headerExtra?: React.ReactNode;
  hideViewTabs?: boolean;
  hideFooterNew?: boolean;
  defaultFilter?: { propertyId: string; value: string };
  onOpenRecord?: (pageId: string) => void;
}

export default function DatabaseClone({ databaseId, headerExtra, hideViewTabs, hideFooterNew, defaultFilter, onOpenRecord }: DatabaseCloneProps) {
  // Resolve the base locked DB name to the tenant-scoped actual ID
  const { activeModules, resolveDbId } = useTenant();
  const { data: session } = useSession();
  const resolvedId = resolveDbId(databaseId);
  const database = useDatabaseStore(state => state.getDatabase(resolvedId));
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const projectIdParam = searchParams.get('projectId');
  const openParam = searchParams.get('open');
  const locale = useLocale();

  const hasCRM = activeModules.includes('CRM');
  const hasDatabases = activeModules.includes('DATABASES');

  const isImmutableContactDB = databaseId === 'db-clients' || databaseId === 'db-suppliers';
  const isLockedSchemaDB = isSystemDatabase(databaseId);
  const isStoreUngated = useDatabaseStore(state => state.isSchemaUngated(databaseId));
  const isSuperAdmin = (session?.user?.role as string) === 'SUPERADMIN' || (session?.user?.role as string) === 'PLATFORM_ADMIN';
  const isUngated = isStoreUngated || isSuperAdmin;

  const handleCloseProjectModal = () => {
    const newParams = new URLSearchParams(searchParams.toString());
    newParams.delete('projectId');
    router.replace(`${pathname}?${newParams.toString()}`);
  }

  const handleCloseOpenModal = () => {
    const newParams = new URLSearchParams(searchParams.toString());
    newParams.delete('open');
    router.replace(`${pathname}?${newParams.toString()}`);
  }

  // Restrict to Single View "All Contacts" for Free Tier on Contact Databases
  const supportedViews = useMemo(() => {
    if (!database) return [];
    let views = [...database.views];
    if (isImmutableContactDB && !hasCRM) {
      if (views.length > 0) {
        views = [views.find(v => v.name.toLowerCase().includes('all')) || views[0]];
      }
    }
    return views;
  }, [database, isImmutableContactDB, hasCRM]);

  // Renaming state
  const [renamingViewId, setRenamingViewId] = useState<string | null>(null);
  const [renamingValue, setRenamingValue] = useState("");
  const [showViewTypeSelector, setShowViewTypeSelector] = useState(false);
  const [selectorPosition, setSelectorPosition] = useState({ top: 0, left: 0 });

  // View context menu state
  const [viewMenuOpenId, setViewMenuOpenId] = useState<string | null>(null);
  const [viewMenuPosition, setViewMenuPosition] = useState({ top: 0, left: 0 });
  const viewMenuRef = React.useRef<HTMLDivElement>(null);

  const updateView = useDatabaseStore(state => state.updateView);
  const addView = useDatabaseStore(state => state.addView);

  const handleRenameStart = (viewId: string, currentName: string) => {
    setRenamingViewId(viewId);
    setRenamingValue(currentName);
  };

  const handleRenameSave = () => {
    if (renamingViewId && renamingValue.trim()) {
      updateView(resolvedId, renamingViewId, { name: renamingValue.trim() });
    }
    setRenamingViewId(null);
  };

  const handleAddView = (type: 'table' | 'board' | 'calendar' | 'timeline') => {
    const names = { table: 'Table', board: 'Board', calendar: 'Calendar', timeline: 'Timeline' };
    addView(resolvedId, {
      name: names[type],
      type,
      config: type === 'board' ? { groupByPropertyId: 'status' } : {}
    });
    setShowViewTypeSelector(false);
  };

  const handleSetViewType = (viewId: string, type: 'table' | 'board' | 'calendar' | 'timeline') => {
    const updates: Partial<DatabaseView> = { type };
    if (type === 'board') {
      updates.config = { groupByPropertyId: 'status' };
    } else {
      updates.config = {};
    }
    updateView(resolvedId, viewId, updates);
    setViewMenuOpenId(null);
  };

  const handleDeleteView = (viewId: string) => {
    if (supportedViews.length <= 1) {
      return;
    }
    if (window.confirm("Are you sure you want to delete this view?")) {
      if (viewId === activeViewId) {
        const otherView = supportedViews.find(v => v.id !== viewId);
        if (otherView) {
          setActiveViewId(otherView.id);
        }
      }
      useDatabaseStore.getState().deleteView(resolvedId, viewId);
      setViewMenuOpenId(null);
    }
  };

  const handleOpenViewMenu = (e: React.MouseEvent, viewId: string) => {
    e.preventDefault();
    e.stopPropagation();
    
    let top = 0;
    let left = 0;
    if (e.type === 'contextmenu') {
      top = e.clientY + 5;
      left = e.clientX;
    } else {
      const rect = e.currentTarget.getBoundingClientRect();
      top = rect.bottom + 5;
      left = rect.left;
    }
    
    setViewMenuOpenId(viewId);
    setViewMenuPosition({ top, left });
  };

  // Initialize synchronously to avoid a second re-render after mounting
  const [activeViewId, setActiveViewId] = useState<string | null>(() => {
    const supportedViews = database?.views || [];
    return supportedViews.length > 0 ? supportedViews[0].id : null;
  });

  // Keep activeViewId synced if the current view is somehow deleted
  useEffect(() => {
    if (database && activeViewId) {
      const supportedViews = database.views;
      const viewExists = supportedViews.some(v => v.id === activeViewId);
      if (!viewExists && supportedViews.length > 0) {
        setActiveViewId(supportedViews[0].id);
      }
    }
  }, [database, activeViewId]);

  // Auto-instantiate uninitialized databases instead of showing a manual button
  const [autoInitializing, setAutoInitializing] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  // Wait for Zustand store hydration from IndexedDB before auto-creating
  useEffect(() => {
    if (useDatabaseStore.persist.hasHydrated()) {
      setHydrated(true);
      return;
    }
    const unsub = useDatabaseStore.persist.onFinishHydration(() => {
      setHydrated(true);
    });
    return unsub;
  }, []);

  const viewSelectorRef = React.useRef<HTMLDivElement>(null);
  const addViewButtonRef = React.useRef<HTMLButtonElement>(null);

  // Close view selector on click outside
  useEffect(() => {
    if (!showViewTypeSelector) return;
    const handleClick = (e: MouseEvent) => {
      // In a Portal, we need to check if the click was inside the portal content
      if (viewSelectorRef.current?.contains(e.target as Node)) return;
      if (addViewButtonRef.current?.contains(e.target as Node)) return;
      setShowViewTypeSelector(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showViewTypeSelector]);

  // Close view context menu on click outside
  useEffect(() => {
    if (!viewMenuOpenId) return;
    const handleClick = (e: MouseEvent) => {
      if (viewMenuRef.current?.contains(e.target as Node)) return;
      setViewMenuOpenId(null);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [viewMenuOpenId]);

  // ── Default hardcoded property schemas for free-tier CRM databases ──
  const DEFAULT_PROPERTIES_MAP: Record<string, Property[]> = useMemo(() => ({
    'db-clients': [
      { id: 'title',    name: 'Naam',           type: 'text' },
      { id: 'email',    name: 'E-mail',          type: 'email' },
      { id: 'phone',    name: 'Telefoon',         type: 'phone' },
      { id: 'company',  name: 'Bedrijf',          type: 'text' },
      { id: 'vat',      name: 'BTW-nummer',       type: 'text' },
      { id: 'address',  name: 'Adres',            type: 'text' },
      { id: 'city',     name: 'Gemeente',          type: 'text' },
      { id: 'postal',   name: 'Postcode',          type: 'text' },
      { id: 'country',  name: 'Land',             type: 'text' },
      { id: 'status',   name: 'Status', type: 'select', config: { options: [
        { id: 'st-lead',     name: 'Lead',       color: 'blue'   },
        { id: 'st-active',   name: 'Actief',     color: 'green'  },
        { id: 'st-inactive', name: 'Inactief',   color: 'gray'   },
      ]}},
      { id: 'type', name: 'Type', type: 'select', config: { options: [
        { id: 'tp-private',    name: 'Particulier',  color: 'purple' },
        { id: 'tp-business',   name: 'Professionnel', color: 'orange' },
        { id: 'tp-government', name: 'Overheid',      color: 'blue'   },
      ]}},
      { id: 'language', name: 'Taal', type: 'select', config: { options: [
        { id: 'lang-nl', name: 'NL', color: 'orange' },
        { id: 'lang-fr', name: 'FR', color: 'blue'   },
        { id: 'lang-en', name: 'EN', color: 'green'  },
      ]}},
      { id: 'notes', name: 'Notities', type: 'text' },
    ],
    'db-suppliers': [
      { id: 'title',          name: 'Naam',              type: 'text'  },
      { id: 'email',          name: 'E-mail',             type: 'email' },
      { id: 'phone',          name: 'Telefoon',            type: 'phone' },
      { id: 'company',        name: 'Bedrijfsnaam',        type: 'text'  },
      { id: 'vat',            name: 'BTW-nummer',          type: 'text'  },
      { id: 'iban',           name: 'IBAN',                type: 'text'  },
      { id: 'bic',            name: 'BIC',                 type: 'text'  },
      { id: 'address',        name: 'Adres',               type: 'text'  },
      { id: 'city',           name: 'Gemeente',             type: 'text'  },
      { id: 'postal',         name: 'Postcode',             type: 'text'  },
      { id: 'country',        name: 'Land',                type: 'text'  },
      { id: 'category',       name: 'Categorie', type: 'select', config: { options: [
        { id: 'cat-materials',     name: 'Materialen',       color: 'orange' },
        { id: 'cat-services',      name: 'Diensten',          color: 'blue'   },
        { id: 'cat-subcontractor', name: 'Onderaannemer',     color: 'purple' },
        { id: 'cat-equipment',     name: 'Uitrusting',        color: 'green'  },
      ]}},
      { id: 'payment', name: 'Betalingstermijn', type: 'select', config: { options: [
        { id: 'pay-0',  name: 'Onmiddellijk', color: 'green'  },
        { id: 'pay-30', name: '30 Dagen',      color: 'blue'   },
        { id: 'pay-60', name: '60 Dagen',      color: 'orange' },
        { id: 'pay-90', name: '90 Dagen',      color: 'red'    },
      ]}},
      { id: 'contact_person', name: 'Contactpersoon',      type: 'text' },
      { id: 'website',        name: 'Website',              type: 'url'  },
      { id: 'notes',          name: 'Notities',             type: 'text' },
    ],
    'db-quotations': [
      { id: 'title',       name: 'Offerte #',         type: 'text' },
      { id: 'client',      name: 'Klant',             type: 'relation', config: { relationDatabaseId: resolveDbId('db-clients'), relationDisplayPropertyId: 'title' } },
      { id: 'betreft',     name: 'Betreft',           type: 'text' },
      { id: 'status',      name: 'Status', type: 'select', config: { options: [
        { id: 'opt-draft',    name: 'Concept',    color: 'gray'  },
        { id: 'opt-sent',     name: 'Verzonden',  color: 'blue'  },
        { id: 'opt-accepted', name: 'Aanvaard',   color: 'green' },
        { id: 'opt-rejected', name: 'Geweigerd',  color: 'red'   },
      ]}},
      { id: 'date',        name: 'Vervaldatum',       type: 'date'     },
      { id: 'totalExVat',  name: 'Totaal excl. BTW',  type: 'currency' },
      { id: 'totalVat',    name: 'BTW',               type: 'currency' },
      { id: 'totalIncVat', name: 'Totaal incl. BTW',  type: 'currency' },
      { id: 'prop-billing-rule',  name: 'Facturatiemethode',  type: 'select', config: { options: [
        { id: 'opt-fixed',    name: 'Vaste prijs',       color: 'blue' },
        { id: 'opt-progress', name: 'Vorderingsstaten', color: 'purple' },
        { id: 'opt-hourly',   name: 'In Regie',          color: 'orange' },
      ]}},
      { id: 'prop-payment-method', name: 'Betalingsvoorwaarden', type: 'select', config: { options: [
        { id: 'pay-0',  name: 'Onmiddellijk', color: 'green'  },
        { id: 'pay-8',  name: '8 Dagen',      color: 'purple' },
        { id: 'pay-14', name: '14 Dagen',     color: 'blue'   },
        { id: 'pay-30', name: '30 Dagen',     color: 'orange' },
        { id: 'pay-60', name: '60 Dagen',     color: 'red'    },
        { id: 'pay-90', name: '90 Dagen',     color: 'gray'   },
      ]}},
    ],
    'db-invoices': [
      { id: 'title',       name: 'Factuur #',         type: 'text' },
      { id: 'client',      name: 'Klant',             type: 'relation', config: { relationDatabaseId: resolveDbId('db-clients'), relationDisplayPropertyId: 'title' } },
      { id: 'betreft',     name: 'Betreft',           type: 'text' },
      { id: 'status',      name: 'Status', type: 'select', config: { options: [
        { id: 'opt-draft',          name: 'Concept',   color: 'gray'   },
        { id: 'opt-sent',           name: 'Verzonden', color: 'blue'   },
        { id: 'opt-paid',           name: 'Betaald',   color: 'green'  },
        { id: 'opt-overdue',        name: 'Vervallen', color: 'red'    },
        { id: 'opt-credited',       name: 'Gecrediteerd', color: 'pink' },
        { id: 'opt-partially-credited', name: 'Gedeeltelijk gecrediteerd', color: 'pink' },
        { id: 'opt-uncollectible',  name: 'Oninbaar',  color: 'purple' },
      ]}},
      { id: 'docType',     name: 'Document Type',     type: 'select', config: { options: [
        { id: 'opt-invoice', name: 'Factuur', color: 'blue' },
        { id: 'opt-credit-note', name: 'Creditnota', color: 'purple' },
        { id: 'opt-proforma', name: 'Proforma', color: 'orange' },
      ]}},
      { id: 'parentInvoiceId', name: 'Oorspronkelijke Factuur', type: 'relation', config: { relationDatabaseId: resolveDbId('db-invoices'), relationDisplayPropertyId: 'title' } },
      { id: 'structuredComm', name: 'Gestructureerde Mededeling', type: 'text' },
      { id: 'project',     name: 'Project',           type: 'relation', config: { relationDatabaseId: resolveDbId('db-1'), relationDisplayPropertyId: 'title' } },
      { id: 'quote',       name: 'Offerte',           type: 'relation', config: { relationDatabaseId: resolveDbId('db-quotations'), relationDisplayPropertyId: 'title' } },
      { id: 'invoiceDate',  name: 'Factuurdatum',      type: 'date'     },
      { id: 'deliveryDate', name: 'Leveringsdatum',    type: 'date'     },
      { id: 'dueDate',      name: 'Vervaldatum',       type: 'date'     },
      { id: 'totalExVat',  name: 'Totaal excl. BTW',  type: 'currency' },
      { id: 'totalVat',    name: 'BTW',               type: 'currency' },
      { id: 'totalIncVat', name: 'Totaal incl. BTW',  type: 'currency' },
      { id: 'accountantExportedAt', name: 'Verzonden naar boekhouder', type: 'checkbox' },
    ],
    'db-expenses': [
      { id: 'title',       name: 'Factuur #',         type: 'text' },
      { id: 'supplier',    name: 'Leverancier',       type: 'relation', config: { relationDatabaseId: resolveDbId('db-suppliers'), relationDisplayPropertyId: 'title' } },
      { id: 'betreft',     name: 'Omschrijving',      type: 'text' },
      { id: 'source',      name: 'Bron', type: 'select', config: { options: [
        { id: 'src-peppol', name: 'Peppol',       color: 'blue'   },
        { id: 'src-manual', name: 'Manueel',      color: 'gray'   },
        { id: 'src-pdf',    name: 'PDF Import',   color: 'purple' },
      ]}},
      { id: 'status',      name: 'Status', type: 'select', config: { options: [
        { id: 'opt-draft',    name: 'Concept',    color: 'gray'   },
        { id: 'opt-unpaid',   name: 'Onbetaald',  color: 'orange' },
        { id: 'opt-paid',     name: 'Betaald',    color: 'green'  },
        { id: 'opt-overdue',  name: 'Vervallen',  color: 'red'    },
        { id: 'opt-disputed', name: 'Betwist',    color: 'pink'   },
      ]}},
      { id: 'invoiceDate', name: 'Factuurdatum',      type: 'date'     },
      { id: 'project',     name: 'Project',           type: 'relation', config: { relationDatabaseId: resolveDbId('db-1'), relationDisplayPropertyId: 'title' } },
      { id: 'quote',       name: 'Offerte',           type: 'relation', config: { relationDatabaseId: resolveDbId('db-quotations'), relationDisplayPropertyId: 'title' } },
      { id: 'dueDate',     name: 'Vervaldatum',       type: 'date'     },
      { id: 'totalExVat',  name: 'Totaal excl. BTW',  type: 'currency' },
      { id: 'totalVat',    name: 'BTW',               type: 'currency' },
      { id: 'totalIncVat', name: 'Totaal incl. BTW',  type: 'currency' },
      { id: 'peppolDocId', name: 'Peppol Doc ID',     type: 'text'     },
      { id: 'receiptUrl',  name: 'Origineel Document', type: 'url'     },
      { id: 'accountantExportedAt', name: 'Verzonden naar boekhouder', type: 'checkbox' },
    ],
    'db-tickets': [
      { id: 'title',         name: 'Handelaar / Beschrijving', type: 'text' },
      { id: 'date',          name: 'Datum',                    type: 'date'     },
      { id: 'amount',        name: 'Totaal bedrag',            type: 'currency' },
      { id: 'vatAmount',     name: 'BTW bedrag',               type: 'currency' },
      { id: 'category',      name: 'Categorie', type: 'select', config: { options: [
        { id: 'cat-fuel',       name: 'Brandstof',          color: 'orange' },
        { id: 'cat-restaurant', name: 'Restaurant',         color: 'red'    },
        { id: 'cat-office',     name: 'Kantoorbenodigdheden', color: 'blue' },
        { id: 'cat-tools',      name: 'Gereedschap',        color: 'gray'   },
        { id: 'cat-materials',  name: 'Materialen',         color: 'yellow' },
        { id: 'cat-parking',    name: 'Parking',            color: 'purple' },
        { id: 'cat-transport',  name: 'Transport',          color: 'green'  },
        { id: 'cat-other',      name: 'Overige',            color: 'default'},
      ]}},
      { id: 'currency',      name: 'Munteenheid', type: 'select', config: { options: [
        { id: 'cur-eur', name: 'EUR', color: 'blue'   },
        { id: 'cur-usd', name: 'USD', color: 'green'  },
        { id: 'cur-gbp', name: 'GBP', color: 'purple' },
      ]}},
      { id: 'paymentMethod', name: 'Betaalmethode', type: 'select', config: { options: [
        { id: 'pm-cash',     name: 'Cash',          color: 'green'  },
        { id: 'pm-card',     name: 'Kaart',         color: 'blue'   },
        { id: 'pm-transfer', name: 'Bankoverschrijving', color: 'purple' },
      ]}},
      { id: 'receiptUrl', name: 'Bonnetje',  type: 'url'  },
      { id: 'notes',      name: 'Notities', type: 'text' },
      { id: 'peppolDocId', name: 'Peppol Doc ID',     type: 'text'     },
      { id: 'accountantExportedAt', name: 'Verzonden naar boekhouder', type: 'checkbox' },
    ],
    'db-crm': [
      { id: 'title',                                     name: 'Name',              type: 'text' },
      { id: 'c8e7ee37-b835-435c-bc01-5c713f06634e',      name: 'Address',           type: 'text' },
      { id: '8942d8a8-884d-4d05-b448-7a621c03885b',      name: 'Call Lead',         type: 'checkbox' },
      { id: '362b13f6-f1f4-4838-9893-102072ef8ce3',      name: 'Lead',              type: 'text' },
      { id: '285360da-802d-47b2-ab9e-58baff546214',      name: 'Date IN',           type: 'date' },
      { id: '5e2ce686-64a6-493c-8e5e-b877a3a67dde',      name: 'LOST',              type: 'checkbox' },
      { id: '18d12923-ca19-464f-9498-e79ad95db3fb',      name: 'Language',          type: 'select', config: { options: [
        { id: 'l-nl', name: 'NL', color: 'orange' },
        { id: 'l-fr', name: 'FR', color: 'blue' },
        { id: 'l-en', name: 'EN', color: 'green' },
      ]}},
      { id: 'ca124068-5053-447d-ab76-b31f1701c151',      name: 'Lead Type',         type: 'select', config: { options: [
        { id: 't-private', name: 'PRIVATE', color: 'purple' },
        { id: 't-b2b',     name: 'B2B',     color: 'orange' },
      ]}},
      { id: 'dbc2f18b-b1e8-4f5c-acc0-a45eb27255dc',      name: 'Mail Lead',         type: 'checkbox' },
      { id: '8bcdac4a-fd8b-4731-a108-20770f169f25',      name: 'OFF OPMAAK',        type: 'checkbox' },
      { id: 'a761db19-788e-47cb-b39e-efc72c32b2f3',      name: 'OFF sent',          type: 'checkbox' },
      { id: '27f35b45-43a4-48f5-b834-13109c3a2e77',      name: 'Offertes [C-SYS]',  type: 'relation', config: { relationDatabaseId: resolveDbId('db-quotations'), relationDisplayPropertyId: 'title' } },
      { id: '4fc8602f-47b3-4824-bea5-81a96f78b8dd',      name: 'Projects [C-SYS]',  type: 'relation', config: { relationDatabaseId: resolveDbId('db-1'), relationDisplayPropertyId: 'title' } },
      { id: 'fb17a9b3-f8d7-4278-a889-cd5e78b85ef2',      name: 'Status Note',       type: 'text' },
      { id: 'eeb6673e-5f6f-48cc-858c-760f12bb381e',      name: 'Tasks [C-SYS]',     type: 'relation', config: { relationDatabaseId: resolveDbId('db-tasks'), relationDisplayPropertyId: 'title' } },
      { id: '42b3b885-7fe6-48cf-8c88-ca29b70c2a78',      name: 'Town',              type: 'text' },
    ],
    'db-bobex': [
      { id: 'f4e58910-b8ef-4e7a-93e6-da43ffafcbe28',      name: 'Nr',                type: 'text' },
      { id: 'title',                                     name: 'Name',              type: 'text' },
      { id: 'd652eb95-9135-4eb4-abf8-46ad4e4ec1da',      name: 'Client',            type: 'relation', config: { relationDatabaseId: resolveDbId('db-clients'), relationDisplayPropertyId: 'title' } },
      { id: '2ac4178a-9824-4651-9d6c-ca0a48daa97a',      name: 'Date IN',           type: 'date' },
      { id: '1387f54e-3006-4243-881c-76c275774963',      name: 'Town',              type: 'rollup', config: { rollupPropertyId: 'd652eb95-9135-4eb4-abf8-46ad4e4ec1da', rollupTargetPropertyId: 'city' } },
      { id: 'c638f171-a658-4db8-af57-f69f89630efb',      name: 'Status Note',       type: 'text' },
      { id: 'bf82591f-c6fc-4182-a564-225c49d17c81',      name: 'Mail Lead',         type: 'checkbox' },
      { id: 'f6a9c0ab-1ec8-415b-8f3c-1499f849893b',      name: 'Call Lead',         type: 'checkbox' },
      { id: 'b5a8c62a-b651-4a14-bf68-3d1548993118',      name: 'Visit Planned',     type: 'checkbox' },
      { id: '49cb174e-9dfb-4468-b12a-5e1f647a25c9',      name: 'PROTEST',           type: 'checkbox' },
      { id: 'bcbf02cb-e841-4cc1-814f-48e08bc0e163',      name: 'OFF OPMAAK',        type: 'checkbox' },
      { id: 'eae9c882-64b1-474f-af68-cf10f811e33a',      name: 'OFF sent',          type: 'checkbox' },
      { id: 'e2f4673f-2869-445c-a738-cc818d38caf0',      name: 'WON',               type: 'checkbox' },
      { id: 'aebbaa12-8588-46b6-b2a9-1154cf5e3d99',      name: 'LOST',              type: 'checkbox' },
      { id: '7a18b79d-7976-43c7-8eb2-807bc156ea85',      name: 'Language',          type: 'select', config: { options: [
        { id: 'l-fr', name: 'FR', color: 'blue' },
        { id: 'l-nl', name: 'NL', color: 'orange' },
        { id: 'l-en', name: 'EN', color: 'green' },
        { id: 'l-ro', name: 'RO', color: 'yellow' },
        { id: 'l-ru', name: 'RUS', color: 'red' },
      ]}},
      { id: '2134bc8e-da22-4621-b8a6-91f97e7f6b36',      name: 'Lead Type',         type: 'select', config: { options: [
        { id: 't-private', name: 'PRIVATE', color: 'purple' },
        { id: 't-b2b',     name: 'B2B',     color: 'orange' },
      ]}},
      { id: 'prop-b-phone',                              name: 'Phone',             type: 'rollup', config: { rollupPropertyId: 'd652eb95-9135-4eb4-abf8-46ad4e4ec1da', rollupTargetPropertyId: 'phone' } },
    ],
    'db-1': [
      { id: 'title',             name: 'Project Naam',      type: 'text' },
      { id: 'prop-client',       name: 'Klant',             type: 'relation', config: { relationDatabaseId: resolveDbId('db-clients'), relationDisplayPropertyId: 'title' } },
      { id: 'prop-project-quote', name: 'Offerte',          type: 'relation', config: { relationDatabaseId: resolveDbId('db-quotations'), relationDisplayPropertyId: 'title' } },
      { id: 'prop-execution-status', name: 'Execution Status', type: 'select', config: { options: [
        { id: 'opt-to-do',   name: 'To Do',       color: 'gray'   },
        { id: 'opt-in-prog', name: 'In Progress', color: 'blue'   },
        { id: 'opt-done',    name: 'Done',        color: 'green'  },
        { id: 'opt-hold',    name: 'On Hold',     color: 'orange' },
        { id: 'opt-dropped', name: 'Dropped',     color: 'charcoal' },
        { id: 'opt-late',    name: 'Late',        color: 'red' },
        { id: 'opt-problems', name: 'Problems',    color: 'orange' },
      ]}},
      { id: 'prop-financial-status', name: 'Financial Status', type: 'select', config: { options: [
        { id: 'opt-quote',   name: 'Quotation',  color: 'gray'   },
        { id: 'opt-budget',  name: 'Budgeted',   color: 'yellow' },
        { id: 'opt-invo',    name: 'Invoiced',   color: 'blue'   },
        { id: 'opt-partial', name: 'Partially Paid', color: 'indigo' },
        { id: 'opt-paid',    name: 'Paid',       color: 'green'  },
      ]}},
      { id: 'prop-start-date',    name: 'Planned Start',     type: 'date' },
      { id: 'prop-end-date',      name: 'Planned End',       type: 'date' },
      { id: 'prop-actual-start',   name: 'Actual Start',      type: 'date' },
      { id: 'prop-actual-end',     name: 'Actual End',        type: 'date' },
      { id: 'prop-budget',        name: 'Internal Budget',   type: 'currency' },
      { id: 'prop-location',      name: 'Location',          type: 'text' },
      { id: 'prop-billing-rule',  name: 'Billing Rule',      type: 'select', config: { options: [
        { id: 'opt-fixed',    name: 'Vaste prijs',       color: 'blue' },
        { id: 'opt-progress', name: 'Vorderingenstaten', color: 'purple' },
        { id: 'opt-hourly',   name: 'In Regie',          color: 'orange' },
      ]}},
      { id: 'prop-rate-person-hour',    name: 'Person Hour Rate',    type: 'currency' },
      { id: 'prop-rate-equipment-hour', name: 'Equipment Hour Rate', type: 'currency' },
      { id: 'prop-actual-equipment-hours', name: 'Equipment Hours',  type: 'number' },
      // ── Project Classification ──
      { id: 'prop-project-type', name: 'Project Type', type: 'select', config: { options: [
        { id: 'type-operations', name: 'Operations', color: 'blue' },
        { id: 'type-admin', name: 'Administration', color: 'purple' },
        { id: 'type-bizdev', name: 'Business Development', color: 'green' },
      ]}},
      { id: 'prop-linked-projects', name: 'Linked Projects', type: 'relation', config: { relationDatabaseId: resolveDbId('db-1'), relationDisplayPropertyId: 'title' } },
      // ── Administration-specific ──
      { id: 'prop-admin-department', name: 'Department', type: 'select', config: { options: [
        { id: 'dept-hr', name: 'HR', color: 'pink' },
        { id: 'dept-finance', name: 'Finance', color: 'green' },
        { id: 'dept-legal', name: 'Legal', color: 'indigo' },
        { id: 'dept-it', name: 'IT', color: 'blue' },
        { id: 'dept-general', name: 'General', color: 'gray' },
      ]}},
      { id: 'prop-admin-recurring', name: 'Recurring', type: 'checkbox' },
      { id: 'prop-admin-compliance-date', name: 'Compliance Deadline', type: 'date' },
      // ── Business Development-specific ──
      { id: 'prop-bizdev-opportunity-value', name: 'Opportunity Value', type: 'currency' },
      { id: 'prop-bizdev-win-probability', name: 'Win Probability', type: 'number' },
      { id: 'prop-bizdev-stage', name: 'BD Stage', type: 'select', config: { options: [
        { id: 'bd-prospect', name: 'Prospecting', color: 'gray' },
        { id: 'bd-qualify', name: 'Qualification', color: 'blue' },
        { id: 'bd-proposal', name: 'Proposal', color: 'purple' },
        { id: 'bd-negotiation', name: 'Negotiation', color: 'orange' },
        { id: 'bd-won', name: 'Won', color: 'green' },
        { id: 'bd-lost', name: 'Lost', color: 'red' },
      ]}},
      { id: 'prop-bizdev-source', name: 'Lead Source', type: 'select', config: { options: [
        { id: 'src-referral', name: 'Referral', color: 'green' },
        { id: 'src-website', name: 'Website', color: 'blue' },
        { id: 'src-cold', name: 'Cold Outreach', color: 'gray' },
        { id: 'src-partner', name: 'Partner', color: 'purple' },
        { id: 'src-event', name: 'Event/Fair', color: 'orange' },
        { id: 'src-bobex', name: 'Bobex', color: 'yellow' },
      ]}},
      { id: 'prop-bizdev-crm-link', name: 'CRM Lead', type: 'relation', config: { relationDatabaseId: resolveDbId('db-crm'), relationDisplayPropertyId: 'title' } },
    ],
    'db-tasks': [
      { id: 'title',             name: 'Taak / Materiaal',  type: 'text' },
      { id: 'prop-task-project',  name: 'Project',           type: 'relation', config: { relationDatabaseId: resolveDbId('db-1'), relationDisplayPropertyId: 'title' } },
      { id: 'prop-task-status',   name: 'Status',            type: 'select', config: { options: [
        { id: 't-todo', name: 'To Do',   color: 'gray'   },
        { id: 't-prog', name: 'Busy',    color: 'blue'   },
        { id: 't-done', name: 'Done',    color: 'green'  },
      ]}},
      { id: 'prop-task-type',     name: 'Type',              type: 'select', config: { options: [
        { id: 'ty-task', name: 'Taak',      color: 'blue'   },
        { id: 'ty-mat',  name: 'Materiaal', color: 'orange' },
      ]}},
    ],
    'db-articles': [
      { id: 'title',              name: 'Naam',              type: 'text' },
      { id: 'prop-art-id',        name: 'ID',                type: 'text' },
      { id: 'prop-art-desc',      name: 'Omschrijving',      type: 'text' },
      { id: 'prop-art-brand',     name: 'Merk',              type: 'text' },
      { id: 'prop-art-group',     name: 'Artikelgroep',      type: 'select', config: { options: [
        { id: 'opt-general',      name: 'General',      color: 'default' },
        { id: 'opt-ruwbouw',     name: 'Ruwbouw',      color: 'gray'    },
        { id: 'opt-afwerking',   name: 'Afwerking',    color: 'blue'    },
        { id: 'opt-elektriciteit', name: 'Elektriciteit', color: 'yellow'  },
        { id: 'opt-sanitaire',    name: 'Sanitaire',    color: 'blue'    },
        { id: 'opt-ventilatie',   name: 'Ventilatie',   color: 'purple'  },
        { id: 'opt-verwarming',   name: 'Verwarming',   color: 'red'     },
      ]}},
      { id: 'prop-art-supplier',  name: 'Leverancier',       type: 'relation', config: { relationDatabaseId: resolveDbId('db-suppliers'), relationDisplayPropertyId: 'title' } },
      { id: 'prop-art-bruto',     name: 'BruttoKost',        type: 'currency' },
      { id: 'prop-art-remise',    name: 'Discount',          type: 'percent' },
      { id: 'prop-art-netto',     name: 'NettoKost',         type: 'formula', config: { formulaExpression: 'if(empty(Discount), BruttoKost, BruttoKost * Discount)' } },
      { id: 'prop-art-margin',    name: 'Marge Standard',    type: 'percent' },
      { id: 'prop-art-margin-euro', name: 'Marge€',          type: 'formula', config: { formulaExpression: 'if(empty(Marge Standard), 0, NettoKost * Marge Standard)' } },
      { id: 'prop-art-verkoop',   name: 'Verkoopprijs',      type: 'formula', config: { formulaExpression: 'NettoKost + Marge€' } },
      { id: 'prop-art-unit',      name: 'Eeh',               type: 'select', config: { options: [
        { id: 'u-stk', name: 'stk', color: 'gray'   },
        { id: 'u-m',   name: 'm',   color: 'blue'   },
        { id: 'u-m2',  name: 'm2',  color: 'green'  },
        { id: 'u-m3',  name: 'm3',  color: 'purple' },
        { id: 'u-l',   name: 'L',   color: 'yellow' },
        { id: 'u-uur', name: 'uur', color: 'orange' },
        { id: 'u-set', name: 'set', color: 'pink'   },
        { id: 'u-kg',  name: 'kg',  color: 'red'    },
      ]}},
      { id: 'prop-art-packaging', name: 'Packaging',         type: 'select', config: { options: [
        { id: 'opt-stk',   name: 'stuk',  color: 'gray'   },
        { id: 'opt-plaat', name: 'plaat', color: 'blue'   },
        { id: 'opt-rol',   name: 'rol',   color: 'yellow' },
        { id: 'opt-doos',  name: 'doos',  color: 'orange' },
      ]}},
      { id: 'prop-art-coverage',  name: 'Dekking/pak',       type: 'number' },
      { id: 'prop-art-pcs-pack',  name: 'Stuks/pak',         type: 'number' },
      { id: 'prop-art-min-order', name: 'Minimum Order',     type: 'formula', config: { formulaExpression: 'prop("Eeh") === "u-m2" ? 5 : (prop("Packaging") === "opt-plaat" ? 2 : 1)' } },
      { id: 'prop-art-variants',  name: 'Product Variants',  type: 'variants' },
    ],
    'db-payments-in': [
      { id: 'title',       name: 'Ontvangstbewijs #',  type: 'text' },
      { id: 'client',      name: 'Klant',             type: 'relation', config: { relationDatabaseId: resolveDbId('db-clients'), relationDisplayPropertyId: 'title' } },
      { id: 'project',     name: 'Project',           type: 'relation', config: { relationDatabaseId: resolveDbId('db-1'), relationDisplayPropertyId: 'title' } },
      { id: 'invoice',     name: 'Factuur',           type: 'relation', config: { relationDatabaseId: resolveDbId('db-invoices'), relationDisplayPropertyId: 'title' } },
      { id: 'suggestedInvoice', name: 'Voorgestelde Factuur', type: 'relation', config: { relationDatabaseId: resolveDbId('db-invoices'), relationDisplayPropertyId: 'title' } },
      { id: 'structuredComm', name: 'Gestructureerde Mededeling', type: 'text' },
      { id: 'amount',      name: 'Bedrag',            type: 'currency' },
      { id: 'date',        name: 'Datum',             type: 'date' },
      { id: 'method',      name: 'Betaalmethode', type: 'select', config: { options: [
        { id: 'pm-transfer', name: 'Bankoverschrijving', color: 'purple' },
        { id: 'pm-card',     name: 'Kaart',         color: 'blue' },
        { id: 'pm-cash',     name: 'Cash',          color: 'green' },
        { id: 'pm-stripe',   name: 'Stripe',        color: 'orange' },
      ]}},
      { id: 'notes',       name: 'Notities',          type: 'text' },
    ],
    'db-payments-out': [
      { id: 'title',       name: 'Betalingsreferentie', type: 'text' },
      { id: 'supplier',    name: 'Leverancier',       type: 'relation', config: { relationDatabaseId: resolveDbId('db-suppliers'), relationDisplayPropertyId: 'title' } },
      { id: 'project',     name: 'Project',           type: 'relation', config: { relationDatabaseId: resolveDbId('db-1'), relationDisplayPropertyId: 'title' } },
      { id: 'expense',     name: 'Aankoopfactuur',    type: 'relation', config: { relationDatabaseId: resolveDbId('db-expenses'), relationDisplayPropertyId: 'title' } },
      { id: 'amount',      name: 'Bedrag',            type: 'currency' },
      { id: 'date',        name: 'Datum',             type: 'date' },
      { id: 'method',      name: 'Betaalmethode', type: 'select', config: { options: [
        { id: 'pm-transfer', name: 'Bankoverschrijving', color: 'purple' },
        { id: 'pm-card',     name: 'Kaart',         color: 'blue' },
        { id: 'pm-cash',     name: 'Cash',          color: 'green' },
      ]}},
      { id: 'notes',       name: 'Notities',          type: 'text' },
    ],
  }), [resolveDbId]);

  // ── Schema Enforcement: Ensure locked databases have the correct hardcoded properties ──
  useEffect(() => {
    if (!hydrated || !database) return;
    const expectedProps = DEFAULT_PROPERTIES_MAP[databaseId]; // lookup by base ID
    if (!expectedProps) return;
    if (!isLockedSchemaDB) return;

    // We only enforce that canonical properties EXIST. 
    // We NEVER overwrite their name, type, or config, and we NEVER delete custom properties.
    // This allows Superadmins to safely customize system schemas without regular users' browsers reverting them.
    const currentIds = new Set(database.properties.map(p => p.id));
    const missingProps = expectedProps.filter((expected: Property) => !currentIds.has(expected.id));

    if (missingProps.length > 0) {
      console.log(`[Schema Enforcement] ${resolvedId}: adding ${missingProps.length} missing canonical properties`);
      const updatedProperties = [...database.properties, ...missingProps];
      useDatabaseStore.getState().updateDatabase(resolvedId, { properties: updatedProperties });
    }

    // Force 'accountantExportedAt' to be a checkbox if it exists but has a different type (legacy migration)
    const accountantProp = database.properties.find(p => p.id === 'accountantExportedAt');
    if (accountantProp && accountantProp.type !== 'checkbox') {
      console.log(`[Schema Enforcement] Updating ${resolvedId} property accountantExportedAt to type checkbox`);
      const updatedProperties = database.properties.map(p => 
        p.id === 'accountantExportedAt' ? { ...p, type: 'checkbox' as const } : p
      );
      useDatabaseStore.getState().updateDatabase(resolvedId, { properties: updatedProperties });
    }

    if (databaseId === 'db-expenses') {
      const HIDDEN_BY_DEFAULT = ['betreft', 'source', 'peppolDocId'];
      const store = useDatabaseStore.getState();
      database.views.forEach(view => {
        HIDDEN_BY_DEFAULT.forEach(propId => {
          const hasState = view.propertiesState?.some(ps => ps.propertyId === propId);
          if (!hasState) {
            store.updateViewPropertyState(resolvedId, view.id, propId, { hidden: true }); // use resolvedId
          }
        });
      });
    }

    if (databaseId === 'db-articles') {
      const HIDDEN_BY_DEFAULT = ['prop-art-brand', 'prop-art-packaging', 'prop-art-coverage', 'prop-art-pcs-pack', 'prop-art-min-order', 'prop-art-variants'];
      const store = useDatabaseStore.getState();
      database.views.forEach(view => {
        HIDDEN_BY_DEFAULT.forEach(propId => {
          const hasState = view.propertiesState?.some(ps => ps.propertyId === propId);
          if (!hasState) {
            store.updateViewPropertyState(resolvedId, view.id, propId, { hidden: true });
          }
        });
      });
    }

    // Auto-hide type-specific project properties by default (users reveal via Properties dropdown or type-filtered view)
    if (databaseId === 'db-1') {
      const TYPE_SPECIFIC_HIDDEN = [
        'prop-admin-department', 'prop-admin-recurring', 'prop-admin-compliance-date',
        'prop-bizdev-opportunity-value', 'prop-bizdev-win-probability', 'prop-bizdev-stage',
        'prop-bizdev-source', 'prop-bizdev-crm-link', 'prop-linked-projects',
        'prop-rate-person-hour', 'prop-rate-equipment-hour', 'prop-actual-equipment-hours',
      ];
      const store = useDatabaseStore.getState();
      database.views.forEach(view => {
        TYPE_SPECIFIC_HIDDEN.forEach(propId => {
          const hasState = view.propertiesState?.some(ps => ps.propertyId === propId);
          if (!hasState) {
            store.updateViewPropertyState(resolvedId, view.id, propId, { hidden: true });
          }
        });
      });
    }

    // Migrate: existing projects without a type default to Operations
    if (databaseId === 'db-1') {
      const store = useDatabaseStore.getState();
      database.pages.forEach(page => {
        const currentType = page.properties['prop-project-type'];
        if (!currentType) {
          store.updatePageProperty(resolvedId, page.id, 'prop-project-type', 'type-operations');
        }
      });
    }

    // Migrate: db-invoices docType population
    if (databaseId === 'db-invoices') {
      const store = useDatabaseStore.getState();
      database.pages.forEach(page => {
        const currentDocType = page.properties['docType'];
        if (!currentDocType) {
          const title = String(page.properties['title'] || '');
          const newType = title.startsWith('CN-') ? 'opt-credit-note' : 'opt-invoice';
          store.updatePageProperty(resolvedId, page.id, 'docType', newType);
        }
      });

      // Enforce that docType options in db-invoices includes opt-proforma
      const docTypeProp = database.properties.find(p => p.id === 'docType');
      if (docTypeProp && docTypeProp.config?.options) {
        const hasProforma = docTypeProp.config.options.some((opt: { id?: string }) => opt.id === 'opt-proforma');
        if (!hasProforma) {
          const updatedOptions = [
            ...docTypeProp.config.options,
            { id: 'opt-proforma', name: 'Proforma', color: 'orange' }
          ];
          const updatedProperties = database.properties.map(p => 
            p.id === 'docType' ? { ...p, config: { ...p.config, options: updatedOptions } } : p
          );
          store.updateDatabase(resolvedId, { properties: updatedProperties });
        }
      }

      // Enforce that status options in db-invoices include opt-credited and opt-partially-credited
      const statusProp = database.properties.find(p => p.id === 'status');
      if (statusProp && statusProp.config?.options) {
        const options = statusProp.config.options || [];
        const hasCredited = options.some((opt: { id?: string }) => opt.id === 'opt-credited');
        const hasPartiallyCredited = options.some((opt: { id?: string }) => opt.id === 'opt-partially-credited');
        
        if (!hasCredited || !hasPartiallyCredited) {
          const updatedOptions = [...options];
          if (!hasCredited) {
            updatedOptions.push({ id: 'opt-credited', name: t('engine_status_credited', locale), color: 'pink' });
          }
          if (!hasPartiallyCredited) {
            updatedOptions.push({ id: 'opt-partially-credited', name: t('engine_status_partially_credited', locale), color: 'pink' });
          }
          const updatedProperties = database.properties.map(p => 
            p.id === 'status' ? { ...p, config: { ...p.config, options: updatedOptions } } : p
          );
          store.updateDatabase(resolvedId, { properties: updatedProperties });
        }
      }

      // Enforce that parentInvoiceId is a relation to db-invoices
      const parentInvoiceProp = database.properties.find(p => p.id === 'parentInvoiceId');
      const expectedTargetDbId = resolveDbId('db-invoices');
      if (parentInvoiceProp && (parentInvoiceProp.type !== 'relation' || parentInvoiceProp.config?.relationDatabaseId !== expectedTargetDbId)) {
        const updatedProperties = database.properties.map(p => 
          p.id === 'parentInvoiceId' ? { 
            ...p, 
            type: 'relation' as const, 
            config: { relationDatabaseId: expectedTargetDbId, relationDisplayPropertyId: 'title' } 
          } : p
        );
        store.updateDatabase(resolvedId, { properties: updatedProperties });
      }
    }
  }, [hydrated, database, databaseId, resolvedId, isLockedSchemaDB, isUngated, DEFAULT_PROPERTIES_MAP, locale, resolveDbId]);


  // ── Self-healing: if the store doesn't have this DB after hydration,
  // fetch ALL databases from the server and re-hydrate the store.
  // This covers the case where the layout's getGlobalDatabases() failed
  // or was too slow — the component rescues itself instead of spinning forever.
  const [clientFetchAttempted, setClientFetchAttempted] = useState(false);

  useEffect(() => {
    if (!hydrated) return;
    if (database || autoInitializing || clientFetchAttempted) return;

    // For server-provisioned databases, NEVER auto-create locally.
    // Instead, fetch from the server — they're guaranteed to exist in Postgres.
    if (SERVER_PROVISIONED_BASES.has(databaseId)) {
      setClientFetchAttempted(true);
      console.log(`[DatabaseClone] ${resolvedId} missing from store — fetching from server`);
      getGlobalDatabases().then(serverDbs => {
        if (serverDbs.length > 0) {
          console.log(`[DatabaseClone] Got ${serverDbs.length} DBs from server — hydrating store`);
          useDatabaseStore.getState().hydrateDatabases(serverDbs);
        } else {
          console.warn('[DatabaseClone] Server returned 0 databases');
        }
      }).catch(e => console.error('[DatabaseClone] Server fetch failed:', e));
      return;
    }

    // For client-only databases, auto-create if missing
    const existing = useDatabaseStore.getState().getDatabase(resolvedId);
    if (existing) return;

    setAutoInitializing(true);
    let parsedName = 'New Workspace';
    if (databaseId === 'db-quotations') parsedName = 'Quotations';
    if (databaseId === 'db-articles') parsedName = 'Material Articles';
    if (databaseId === 'db-bestek') parsedName = 'Bestek Templates';
    if (databaseId === 'db-1') parsedName = 'Projects';
    if (databaseId === 'db-expenses') parsedName = 'Purchase Invoices';
    if (databaseId === 'db-tickets') parsedName = 'Expense Tickets';
    if (databaseId === 'db-invoices') parsedName = 'Sales Invoices';
    if (databaseId === 'db-clients') parsedName = 'Contacts';
    if (databaseId === 'db-suppliers') parsedName = 'Suppliers';
    if (databaseId === 'db-crm') parsedName = 'Main Pipeline';
    if (databaseId === 'db-bobex') parsedName = 'Bobex Pipeline';
    if (databaseId === 'db-payments-in') parsedName = 'Received Payments';
    if (databaseId === 'db-payments-out') parsedName = 'Outgoing Payments';

    const customProps = DEFAULT_PROPERTIES_MAP[databaseId];
    useDatabaseStore.getState().createDatabase(parsedName, undefined, resolvedId, customProps);
  }, [database, databaseId, resolvedId, autoInitializing, hydrated, clientFetchAttempted, DEFAULT_PROPERTIES_MAP]);

  if (!database) {
    return (
      <div className="flex flex-col items-center justify-center h-[500px] bg-white dark:bg-neutral-900 rounded-lg border border-neutral-200 dark:border-white/10 p-8 text-center space-y-4 m-6">
        <div className="w-8 h-8 border-2 border-neutral-300 border-t-[var(--brand-color,#d35400)] rounded-full animate-spin" />
        <p className="text-sm text-neutral-500 font-medium">Initializing workspace...</p>
      </div>
    );
  }

  const activeView = supportedViews.find(v => v.id === activeViewId) || supportedViews[0] || database.views[0];

  // Guard: database exists but has no views yet (newly provisioned stub with views: []).
  // Create a default table view and wait for it to be stored before rendering.
  if (!activeView) {
    if (!autoInitializing) {
      setAutoInitializing(true);
      useDatabaseStore.getState().addView(resolvedId, { name: 'All', type: 'table', propertiesState: [] });
      // addView is synchronous in the store — next render will have a view.
      setAutoInitializing(false);
    }
    return (
      <div className="flex flex-col items-center justify-center h-[500px] bg-white dark:bg-neutral-900 rounded-lg border border-neutral-200 dark:border-white/10 p-8 text-center space-y-4 m-6">
        <div className="w-8 h-8 border-2 border-neutral-300 border-t-[var(--brand-color,#d35400)] rounded-full animate-spin" />
        <p className="text-sm text-neutral-500 font-medium">Initializing view...</p>
      </div>
    );
  }

  const getViewIcon = (type: string) => {
    switch (type) {
      case 'table': return <Table2 className="w-4 h-4" />;
      case 'board': return <LayoutGrid className="w-4 h-4" />;
      case 'calendar': return <CalendarIcon className="w-4 h-4" />;
      case 'timeline': return <Clock className="w-4 h-4" />;
      default: return <Table2 className="w-4 h-4" />;
    }
  };

  const headerTabs = (
    <>
      {headerExtra}

      {/* EDIT SCHEMA FIELDS GLOBAL BUTTON — Shown for non-system DBs or ungated system DBs */}
      {(!isLockedSchemaDB || isUngated) && (
        <Link href={`/admin/settings/databases/${resolvedId}`} className="flex items-center gap-1.5 text-neutral-500 hover:text-[var(--brand-color,#d35400)] px-3 py-1 mx-2 mb-[5px] bg-neutral-100 dark:bg-white/5 hover:bg-[var(--brand-color,#d35400)]/10 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-colors shrink-0">
          <Settings className="w-3.5 h-3.5" /> {isUngated ? 'Edit Custom Fields' : 'Edit Schema Fields'}
        </Link>
      )}

      {(!hideViewTabs && supportedViews.length > 0) && (
        <div className="flex items-end gap-1 overflow-x-auto no-scrollbar h-full pt-1">
          {supportedViews.map((view) => {
            const isActive = view.id === activeViewId;
            const isRenaming = renamingViewId === view.id;

            return (
              <div key={view.id} className="relative flex items-center group">
                {isRenaming ? (
                  <div className="flex items-center bg-white dark:bg-neutral-800 rounded-t-lg px-2 py-1 mb-[-1px] border-b-2 border-orange-500 shadow-sm z-10">
                    <input
                      autoFocus
                      className="text-sm font-semibold bg-transparent outline-none w-24 text-neutral-900 dark:text-white"
                      value={renamingValue}
                      onChange={(e) => setRenamingValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleRenameSave();
                        if (e.key === 'Escape') setRenamingViewId(null);
                      }}
                      onBlur={handleRenameSave}
                    />
                  </div>
                ) : (
                  <button
                    onClick={() => setActiveViewId(view.id)}
                    onDoubleClick={() => handleRenameStart(view.id, view.name)}
                    onContextMenu={(e) => handleOpenViewMenu(e, view.id)}
                    className={`flex items-center gap-2 pl-3 pr-2 py-2.5 pb-2 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap -mb-[1px] ${isActive
                      ? 'border-neutral-900 dark:border-white text-neutral-900 dark:text-white'
                      : 'border-transparent text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'
                      }`}
                  >
                    {getViewIcon(view.type)}
                    <span>{view.name}</span>
                    <span
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleOpenViewMenu(e, view.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 transition-opacity ml-1 p-0.5 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 inline-flex items-center justify-center"
                    >
                      <ChevronDown className="w-3.5 h-3.5" />
                    </span>
                  </button>
                )}
              </div>
            );
          })}

          {(hasDatabases) && (
            <div className="relative">
              <button
                ref={addViewButtonRef}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  console.log('Plus button clicked');
                  if (addViewButtonRef.current) {
                    const rect = addViewButtonRef.current.getBoundingClientRect();
                    setSelectorPosition({ top: rect.bottom + 5, left: rect.left });
                  }
                  setShowViewTypeSelector(prev => !prev);
                }}
                className={`p-1.5 ml-1 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors mb-1.5 rounded-md ${showViewTypeSelector ? 'bg-neutral-100 dark:bg-white/10' : ''}`}
                title="Add View"
              >
                <Plus className="w-4 h-4" />
              </button>

              {showViewTypeSelector && typeof document !== 'undefined' && createPortal(
                <div 
                  ref={viewSelectorRef}
                  style={{ 
                    position: 'fixed', 
                    top: selectorPosition.top, 
                    left: selectorPosition.left,
                    zIndex: 9999
                  }}
                  className="w-44 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-white/10 rounded-xl shadow-2xl p-1.5 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-100 ring-4 ring-black/5"
                >
                  <div className="px-3 py-1.5 text-[10px] font-bold text-neutral-400 uppercase tracking-wider border-b border-neutral-100 dark:border-white/5 mb-1">
                    Add View Type
                  </div>
                  <button onClick={() => handleAddView('table')} className="flex items-center gap-2 px-3 py-2 text-sm text-neutral-600 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-white/5 rounded-lg transition-colors text-left">
                    <Table2 className="w-4 h-4" /> Table
                  </button>
                  <button onClick={() => handleAddView('board')} className="flex items-center gap-2 px-3 py-2 text-sm text-neutral-600 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-white/5 rounded-lg transition-colors text-left">
                    <LayoutGrid className="w-4 h-4" /> Board
                  </button>
                  <button onClick={() => handleAddView('calendar')} className="flex items-center gap-2 px-3 py-2 text-sm text-neutral-600 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-white/5 rounded-lg transition-colors text-left">
                    <CalendarIcon className="w-4 h-4" /> Calendar
                  </button>
                  <button onClick={() => handleAddView('timeline')} className="flex items-center gap-2 px-3 py-2 text-sm text-neutral-600 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-white/5 rounded-lg transition-colors text-left">
                    <GanttChartSquare className="w-4 h-4" /> Timeline
                  </button>
                </div>,
                document.body
              )}
            </div>
          )}
        </div>
      )}

      {viewMenuOpenId && typeof document !== 'undefined' && (() => {
        const targetView = supportedViews.find(v => v.id === viewMenuOpenId);
        if (!targetView) return null;
        return createPortal(
          <div
            ref={viewMenuRef}
            style={{
              position: 'fixed',
              top: viewMenuPosition.top,
              left: viewMenuPosition.left,
              zIndex: 9999
            }}
            className="w-48 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-white/10 rounded-xl shadow-2xl p-1.5 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-100 ring-4 ring-black/5"
          >
            <div className="px-3 py-1.5 text-[10px] font-bold text-neutral-400 uppercase tracking-wider border-b border-neutral-100 dark:border-white/5 mb-1">
              View Options
            </div>
            
            <button
              onClick={() => {
                handleRenameStart(targetView.id, targetView.name);
                setViewMenuOpenId(null);
              }}
              className="flex items-center gap-2 px-3 py-2 text-sm text-neutral-600 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-white/5 rounded-lg transition-colors text-left"
            >
              <Edit className="w-4 h-4 text-neutral-400" /> Rename View
            </button>
            
            <div className="mt-1.5 border-t border-neutral-100 dark:border-white/5 pt-1.5">
              <div className="px-3 py-1 text-[9px] font-bold text-neutral-400 uppercase tracking-wider mb-1">
                Change Type To
              </div>
              <button
                onClick={() => handleSetViewType(targetView.id, 'table')}
                className={`flex items-center gap-2 w-full px-3 py-1.5 text-sm rounded-lg transition-colors text-left ${
                  targetView.type === 'table'
                    ? 'bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 font-medium'
                    : 'text-neutral-600 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-white/5'
                }`}
              >
                <Table2 className="w-4 h-4" /> Table
              </button>
              <button
                onClick={() => handleSetViewType(targetView.id, 'board')}
                className={`flex items-center gap-2 w-full px-3 py-1.5 text-sm rounded-lg transition-colors text-left ${
                  targetView.type === 'board'
                    ? 'bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 font-medium'
                    : 'text-neutral-600 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-white/5'
                }`}
              >
                <LayoutGrid className="w-4 h-4" /> Board
              </button>
              <button
                onClick={() => handleSetViewType(targetView.id, 'calendar')}
                className={`flex items-center gap-2 w-full px-3 py-1.5 text-sm rounded-lg transition-colors text-left ${
                  targetView.type === 'calendar'
                    ? 'bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 font-medium'
                    : 'text-neutral-600 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-white/5'
                }`}
              >
                <CalendarIcon className="w-4 h-4" /> Calendar
              </button>
              <button
                onClick={() => handleSetViewType(targetView.id, 'timeline')}
                className={`flex items-center gap-2 w-full px-3 py-1.5 text-sm rounded-lg transition-colors text-left ${
                  targetView.type === 'timeline'
                    ? 'bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 font-medium'
                    : 'text-neutral-600 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-white/5'
                }`}
              >
                <Clock className="w-4 h-4" /> Timeline
              </button>
            </div>
            
            {supportedViews.length > 1 && (
              <div className="mt-1.5 border-t border-neutral-100 dark:border-white/5 pt-1.5">
                <button
                  onClick={() => handleDeleteView(targetView.id)}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-lg transition-colors text-left"
                >
                  <Trash2 className="w-4 h-4 text-red-500" /> Delete View
                </button>
              </div>
            )}
          </div>,
          document.body
        );
      })()}
    </>
  );

  return (
    <div className="flex flex-col w-full h-full min-w-0 min-h-0 bg-transparent relative">
      <div className="flex-1 min-w-0 min-h-0 w-full h-full relative">
        {activeView.type === 'table' && <NotionGridDynamic databaseId={database.id} viewId={activeView.id} renderTabs={headerTabs} lockedSchema={isLockedSchemaDB && !isUngated && !hasDatabases} preventDelete={databaseId === 'db-invoices' || databaseId.startsWith('db-invoices-') ? (row: Record<string, unknown>) => { const s = String((row?.properties as Record<string, unknown>)?.status || row?.status || 'opt-draft'); return s !== 'opt-draft'; } : undefined} hideFooterNew={!!hideFooterNew} hardFilter={defaultFilter} onOpenRecord={onOpenRecord} />}
        {activeView.type === 'board' && <KanbanViewDynamic databaseId={database.id} viewId={activeView.id} renderTabs={headerTabs} />}
        {activeView.type === 'calendar' && <CalendarViewDynamic databaseId={database.id} viewId={activeView.id} renderTabs={headerTabs} />}
        {activeView.type === 'timeline' && <TimelineViewDynamic databaseId={database.id} viewId={activeView.id} renderTabs={headerTabs} />}
      </div>

      {projectIdParam && (
        <PageModal
          databaseId={database.id}
          pageId={projectIdParam}
          onClose={handleCloseProjectModal}
        />
      )}

      {openParam && (
        <PageModal
          databaseId={database.id}
          pageId={openParam}
          onClose={handleCloseOpenModal}
        />
      )}
    </div>
  );
}
