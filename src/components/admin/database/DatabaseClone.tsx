"use client";

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useDatabaseStore } from '@/components/admin/database/store';
import { LayoutGrid, Table2, Calendar as CalendarIcon, Plus, GanttChartSquare, Settings, Database as DatabaseIcon, Clock } from 'lucide-react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import PageModal from '@/components/admin/database/components/PageModal';
import { useTenant } from '@/context/TenantContext';

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
}

export default function DatabaseClone({ databaseId, headerExtra, hideViewTabs, hideFooterNew, defaultFilter }: DatabaseCloneProps) {
  // Resolve the base locked DB name to the tenant-scoped actual ID
  const { activeModules, resolveDbId } = useTenant();
  const resolvedId = resolveDbId(databaseId);
  const database = useDatabaseStore(state => state.getDatabase(resolvedId));
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const projectIdParam = searchParams.get('projectId');

  const hasCRM = activeModules.includes('CRM');
  const hasDatabases = activeModules.includes('DATABASES');

  const isImmutableContactDB = databaseId === 'db-clients' || databaseId === 'db-suppliers';
  const isFinancialDB = databaseId === 'db-invoices' || databaseId === 'db-expenses' || databaseId === 'db-tickets';
  const isLockedSchemaDB = isImmutableContactDB || isFinancialDB;

  const handleCloseProjectModal = () => {
    const newParams = new URLSearchParams(searchParams.toString());
    newParams.delete('projectId');
    router.replace(`${pathname}?${newParams.toString()}`);
  }

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
    const unsub = useDatabaseStore.persist.onFinishHydration(() => {
      setHydrated(true);
    });
    // If already hydrated (store was loaded before this component mounted)
    if (useDatabaseStore.persist.hasHydrated()) {
      setHydrated(true);
    }
    return unsub;
  }, []);

  // ── Default hardcoded property schemas for free-tier CRM databases ──
  const DEFAULT_PROPERTIES_MAP: Record<string, any[]> = {
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
    ],
    'db-invoices': [
      { id: 'title',       name: 'Factuur #',         type: 'text' },
      { id: 'client',      name: 'Klant',             type: 'relation', config: { relationDatabaseId: resolveDbId('db-clients'), relationDisplayPropertyId: 'title' } },
      { id: 'betreft',     name: 'Betreft',           type: 'text' },
      { id: 'status',      name: 'Status', type: 'select', config: { options: [
        { id: 'opt-draft',   name: 'Concept',   color: 'gray'  },
        { id: 'opt-sent',    name: 'Verzonden', color: 'blue'  },
        { id: 'opt-paid',    name: 'Betaald',   color: 'green' },
        { id: 'opt-overdue', name: 'Vervallen', color: 'red'   },
      ]}},
      { id: 'invoiceDate', name: 'Factuurdatum',      type: 'date'     },
      { id: 'dueDate',     name: 'Vervaldatum',       type: 'date'     },
      { id: 'totalExVat',  name: 'Totaal excl. BTW',  type: 'currency' },
      { id: 'totalVat',    name: 'BTW',               type: 'currency' },
      { id: 'totalIncVat', name: 'Totaal incl. BTW',  type: 'currency' },
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
      { id: 'dueDate',     name: 'Vervaldatum',       type: 'date'     },
      { id: 'totalExVat',  name: 'Totaal excl. BTW',  type: 'currency' },
      { id: 'totalVat',    name: 'BTW',               type: 'currency' },
      { id: 'totalIncVat', name: 'Totaal incl. BTW',  type: 'currency' },
      { id: 'peppolDocId', name: 'Peppol Doc ID',     type: 'text'     },
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
    ],
  };

  // ── Schema Enforcement: Always ensure locked databases have the correct hardcoded properties ──
  useEffect(() => {
    if (!hydrated || !database) return;
    const expectedProps = DEFAULT_PROPERTIES_MAP[databaseId]; // lookup by base ID
    if (!expectedProps) return;
    if (!isLockedSchemaDB) return;

    const schemasMatch = expectedProps.length === database.properties.length &&
      expectedProps.every((expected: any) => {
        const current = database.properties.find(p => p.id === expected.id);
        if (!current) return false;
        if (current.type !== expected.type) return false;
        if (current.name !== expected.name) return false;
        if (JSON.stringify(current.config || {}) !== JSON.stringify(expected.config || {})) return false;
        return true;
      });

    if (!schemasMatch) {
      console.log(`[Schema Enforcement] Resetting ${resolvedId} properties to canonical schema`);
      useDatabaseStore.getState().updateDatabase(resolvedId, { properties: expectedProps }); // use resolvedId
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
  }, [hydrated, database, databaseId, resolvedId]);


  useEffect(() => {
    if (!hydrated) return;
    if (database || autoInitializing) return;

    const existing = useDatabaseStore.getState().getDatabase(resolvedId); // use resolvedId
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

    const customProps = DEFAULT_PROPERTIES_MAP[databaseId];
    useDatabaseStore.getState().createDatabase(parsedName, undefined, resolvedId, customProps as any); // use resolvedId
  }, [database, databaseId, resolvedId, autoInitializing, hydrated]);

  if (!database) {
    return (
      <div className="flex flex-col items-center justify-center h-[500px] bg-white dark:bg-neutral-900 rounded-lg border border-neutral-200 dark:border-white/10 p-8 text-center space-y-4 m-6">
        <div className="w-8 h-8 border-2 border-neutral-300 border-t-[var(--brand-color,#d35400)] rounded-full animate-spin" />
        <p className="text-sm text-neutral-500 font-medium">Initializing workspace...</p>
      </div>
    );
  }

  // Restrict to Single View "All Contacts" for Free Tier on Contact Databases
  let supportedViews = [...database.views];
  if (isImmutableContactDB && !hasCRM) {
    if (supportedViews.length > 0) {
      supportedViews = [supportedViews.find(v => v.name.toLowerCase().includes('all')) || supportedViews[0]];
    }
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

      {/* EDIT SCHEMA FIELDS GLOBAL BUTTON — Hidden for locked schema DBs on free tier */}
      {(!isLockedSchemaDB || hasDatabases) && (
        <Link href={`/admin/settings/databases/${databaseId}`} className="flex items-center gap-1.5 text-neutral-500 hover:text-[var(--brand-color,#d35400)] px-3 py-1 mx-2 mb-[5px] bg-neutral-100 dark:bg-white/5 hover:bg-[var(--brand-color,#d35400)]/10 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-colors shrink-0">
          <Settings className="w-3.5 h-3.5" /> Edit Schema Fields
        </Link>
      )}

      {(!hideViewTabs && supportedViews.length > 0) && (
        <div className="flex items-end gap-1 overflow-x-auto no-scrollbar h-full pt-1">
          {supportedViews.map((view) => {
            const isActive = view.id === activeViewId;
            return (
              <button
                key={view.id}
                onClick={() => setActiveViewId(view.id)}
                className={`flex items-center gap-2 px-3 py-2.5 pb-2 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap -mb-[1px] ${isActive
                  ? 'border-neutral-900 dark:border-white text-neutral-900 dark:text-white'
                  : 'border-transparent text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'
                  }`}
              >
                {getViewIcon(view.type)}
                {view.name}
              </button>
            );
          })}

          {(hasDatabases) && (
            <button
              className="p-1.5 ml-1 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors mb-1.5"
              title="Add View"
            >
              <Plus className="w-4 h-4" />
            </button>
          )}
        </div>
      )}
    </>
  );

  return (
    <div className="flex flex-col w-full h-full min-w-0 min-h-0 bg-transparent relative">
      <div className="flex-1 min-w-0 min-h-0 w-full h-full overflow-hidden relative">
        {activeView.type === 'table' && <NotionGridDynamic databaseId={database.id} viewId={activeView.id} renderTabs={headerTabs} lockedSchema={isLockedSchemaDB && !hasDatabases} preventDelete={databaseId === 'db-invoices' || databaseId.startsWith('db-invoices-') ? (row: any) => { const s = String(row?.properties?.status || row?.status || 'opt-draft'); return s !== 'opt-draft'; } : undefined} hideFooterNew={!!hideFooterNew} hardFilter={defaultFilter} />}
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
    </div>
  );
}
