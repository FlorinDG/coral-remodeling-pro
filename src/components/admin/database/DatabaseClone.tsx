"use client";

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useDatabaseStore } from '@/components/admin/database/store';
import { LayoutGrid, Table2, Calendar as CalendarIcon, Plus, GanttChartSquare, Settings, Database as DatabaseIcon } from 'lucide-react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import PageModal from '@/components/admin/database/components/PageModal';
import { useTenant } from '@/context/TenantContext';

const NotionGridDynamic = dynamic(
  () => import('@/components/admin/database/NotionGrid'),
  { ssr: false, loading: () => <div className="w-full h-[600px] bg-neutral-50 dark:bg-neutral-900/50 animate-pulse rounded-b-xl border-x border-b border-neutral-200 dark:border-white/10" /> }
);

const BoardViewDynamic = dynamic(
  () => import('@/components/admin/database/views/BoardView'),
  { ssr: false, loading: () => <div className="w-full h-[600px] bg-neutral-50 dark:bg-neutral-900/50 animate-pulse rounded-b-xl border-x border-b border-neutral-200 dark:border-white/10" /> }
);

const CalendarViewDynamic = dynamic(
  () => import('@/components/admin/database/views/CalendarView'),
  { ssr: false, loading: () => <div className="w-full h-[600px] bg-neutral-50 dark:bg-neutral-900/50 animate-pulse rounded-b-xl border-x border-b border-neutral-200 dark:border-white/10" /> }
);

const GanttViewDynamic = dynamic(
  () => import('@/components/admin/database/views/GanttView'),
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
  const database = useDatabaseStore(state => state.getDatabase(databaseId));
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const projectIdParam = searchParams.get('projectId');

  const { activeModules } = useTenant();
  const hasCRM = activeModules.includes('CRM');
  const hasDatabases = activeModules.includes('DATABASES');

  const isImmutableContactDB = databaseId === 'db-clients' || databaseId === 'db-suppliers';
  const isFinancialDB = databaseId === 'db-invoices' || databaseId === 'db-expenses' || databaseId === 'db-tickets';
  const isLockedSchemaDB = isImmutableContactDB || isFinancialDB || databaseId === 'db-quotations';

  const handleCloseProjectModal = () => {
    const newParams = new URLSearchParams(searchParams.toString());
    newParams.delete('projectId');
    router.replace(`${pathname}?${newParams.toString()}`);
  }

  // Initialize synchronously to avoid a second re-render after mounting
  const [activeViewId, setActiveViewId] = useState<string | null>(() => {
    const supportedViews = database?.views?.filter(v => v.type !== 'timeline') || [];
    return supportedViews.length > 0 ? supportedViews[0].id : null;
  });

  // Keep activeViewId synced if the current view is somehow deleted
  useEffect(() => {
    if (database && activeViewId) {
      const supportedViews = database.views.filter(v => v.type !== 'timeline');
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
      { id: 'title', name: 'Name', type: 'text' },
      { id: 'email', name: 'Email', type: 'email' },
      { id: 'phone', name: 'Phone', type: 'phone' },
      { id: 'company', name: 'Company', type: 'text' },
      { id: 'vat', name: 'VAT Number', type: 'text' },
      { id: 'address', name: 'Address', type: 'text' },
      { id: 'city', name: 'City', type: 'text' },
      { id: 'postal', name: 'Postal Code', type: 'text' },
      { id: 'country', name: 'Country', type: 'text' },
      { id: 'status', name: 'Status', type: 'select', config: { options: [
        { id: 'st-lead', name: 'Lead', color: 'blue' },
        { id: 'st-active', name: 'Active', color: 'green' },
        { id: 'st-inactive', name: 'Inactive', color: 'gray' },
      ]}},
      { id: 'type', name: 'Type', type: 'select', config: { options: [
        { id: 'tp-private', name: 'Particulier', color: 'purple' },
        { id: 'tp-business', name: 'Professionnel', color: 'orange' },
        { id: 'tp-government', name: 'Overheid', color: 'blue' },
      ]}},
      { id: 'language', name: 'Language', type: 'select', config: { options: [
        { id: 'lang-nl', name: 'NL', color: 'orange' },
        { id: 'lang-fr', name: 'FR', color: 'blue' },
        { id: 'lang-en', name: 'EN', color: 'green' },
      ]}},
      { id: 'notes', name: 'Notes', type: 'text' },
    ],
    'db-suppliers': [
      { id: 'title', name: 'Name', type: 'text' },
      { id: 'email', name: 'Email', type: 'email' },
      { id: 'phone', name: 'Phone', type: 'phone' },
      { id: 'company', name: 'Company', type: 'text' },
      { id: 'vat', name: 'VAT Number', type: 'text' },
      { id: 'iban', name: 'IBAN', type: 'text' },
      { id: 'bic', name: 'BIC', type: 'text' },
      { id: 'address', name: 'Address', type: 'text' },
      { id: 'city', name: 'City', type: 'text' },
      { id: 'postal', name: 'Postal Code', type: 'text' },
      { id: 'country', name: 'Country', type: 'text' },
      { id: 'category', name: 'Category', type: 'select', config: { options: [
        { id: 'cat-materials', name: 'Materials', color: 'orange' },
        { id: 'cat-services', name: 'Services', color: 'blue' },
        { id: 'cat-subcontractor', name: 'Subcontractor', color: 'purple' },
        { id: 'cat-equipment', name: 'Equipment', color: 'green' },
      ]}},
      { id: 'payment', name: 'Payment Terms', type: 'select', config: { options: [
        { id: 'pay-0', name: 'Immediate', color: 'green' },
        { id: 'pay-30', name: '30 Days', color: 'blue' },
        { id: 'pay-60', name: '60 Days', color: 'orange' },
        { id: 'pay-90', name: '90 Days', color: 'red' },
      ]}},
      { id: 'contact_person', name: 'Contact Person', type: 'text' },
      { id: 'website', name: 'Website', type: 'url' },
      { id: 'notes', name: 'Notes', type: 'text' },
    ],
    'db-quotations': [
      { id: 'title', name: 'Quote Number', type: 'text' },
      { id: 'client', name: 'Client', type: 'relation', config: { relationDatabaseId: 'db-clients', relationDisplayPropertyId: 'title' } },
      { id: 'betreft', name: 'Betreft', type: 'text' },
      { id: 'status', name: 'Status', type: 'select', config: { options: [
        { id: 'opt-draft', name: 'Draft', color: 'gray' },
        { id: 'opt-sent', name: 'Sent', color: 'blue' },
        { id: 'opt-accepted', name: 'Accepted', color: 'green' },
        { id: 'opt-rejected', name: 'Rejected', color: 'red' },
      ]}},
      { id: 'date', name: 'Expiry Date', type: 'date' },
      { id: 'totalExVat', name: 'Total excl. VAT', type: 'currency' },
      { id: 'totalVat', name: 'VAT', type: 'currency' },
      { id: 'totalIncVat', name: 'Total incl. VAT', type: 'currency' },
    ],
    'db-invoices': [
      { id: 'title', name: 'Invoice #', type: 'text' },
      { id: 'client', name: 'Client', type: 'relation', config: { relationDatabaseId: 'db-clients', relationDisplayPropertyId: 'title' } },
      { id: 'betreft', name: 'Betreft', type: 'text' },
      { id: 'status', name: 'Status', type: 'select', config: { options: [
        { id: 'opt-draft', name: 'Draft', color: 'gray' },
        { id: 'opt-sent', name: 'Sent', color: 'blue' },
        { id: 'opt-paid', name: 'Paid', color: 'green' },
        { id: 'opt-overdue', name: 'Overdue', color: 'red' },
      ]}},
      { id: 'invoiceDate', name: 'Invoice Date', type: 'date' },
      { id: 'dueDate', name: 'Due Date', type: 'date' },
      { id: 'totalExVat', name: 'Total excl. VAT', type: 'currency' },
      { id: 'totalVat', name: 'VAT', type: 'currency' },
      { id: 'totalIncVat', name: 'Total incl. VAT', type: 'currency' },
    ],
    'db-expenses': [
      { id: 'title', name: 'Invoice #', type: 'text' },
      { id: 'supplier', name: 'Supplier', type: 'relation', config: { relationDatabaseId: 'db-suppliers', relationDisplayPropertyId: 'title' } },
      { id: 'betreft', name: 'Description', type: 'text' },
      { id: 'source', name: 'Source', type: 'select', config: { options: [
        { id: 'src-peppol', name: 'Peppol', color: 'blue' },
        { id: 'src-manual', name: 'Manual', color: 'gray' },
        { id: 'src-pdf', name: 'PDF Import', color: 'purple' },
      ]}},
      { id: 'status', name: 'Status', type: 'select', config: { options: [
        { id: 'opt-draft', name: 'Draft', color: 'gray' },
        { id: 'opt-received', name: 'Received', color: 'blue' },
        { id: 'opt-unpaid', name: 'Unpaid', color: 'orange' },
        { id: 'opt-paid', name: 'Paid', color: 'green' },
        { id: 'opt-overdue', name: 'Overdue', color: 'red' },
        { id: 'opt-disputed', name: 'Disputed', color: 'pink' },
      ]}},
      { id: 'invoiceDate', name: 'Invoice Date', type: 'date' },
      { id: 'dueDate', name: 'Due Date', type: 'date' },
      { id: 'totalExVat', name: 'Total excl. VAT', type: 'currency' },
      { id: 'totalVat', name: 'VAT', type: 'currency' },
      { id: 'totalIncVat', name: 'Total incl. VAT', type: 'currency' },
      { id: 'peppolDocId', name: 'Peppol Doc ID', type: 'text' },
    ],
    'db-tickets': [
      { id: 'title', name: 'Merchant / Description', type: 'text' },
      { id: 'date', name: 'Date', type: 'date' },
      { id: 'amount', name: 'Total Amount', type: 'currency' },
      { id: 'vatAmount', name: 'VAT Amount', type: 'currency' },
      { id: 'category', name: 'Category', type: 'select', config: { options: [
        { id: 'cat-fuel', name: 'Fuel', color: 'orange' },
        { id: 'cat-restaurant', name: 'Restaurant', color: 'red' },
        { id: 'cat-office', name: 'Office Supplies', color: 'blue' },
        { id: 'cat-tools', name: 'Tools', color: 'gray' },
        { id: 'cat-materials', name: 'Materials', color: 'yellow' },
        { id: 'cat-parking', name: 'Parking', color: 'purple' },
        { id: 'cat-transport', name: 'Transport', color: 'green' },
        { id: 'cat-other', name: 'Other', color: 'default' },
      ]}},
      { id: 'currency', name: 'Currency', type: 'select', config: { options: [
        { id: 'cur-eur', name: 'EUR', color: 'blue' },
        { id: 'cur-usd', name: 'USD', color: 'green' },
        { id: 'cur-gbp', name: 'GBP', color: 'purple' },
      ]}},
      { id: 'paymentMethod', name: 'Payment Method', type: 'select', config: { options: [
        { id: 'pm-cash', name: 'Cash', color: 'green' },
        { id: 'pm-card', name: 'Card', color: 'blue' },
        { id: 'pm-transfer', name: 'Bank Transfer', color: 'purple' },
      ]}},
      { id: 'receiptUrl', name: 'Receipt Image', type: 'url' },
      { id: 'notes', name: 'Notes', type: 'text' },
    ],
  };

  // ── Schema Enforcement: Always ensure locked databases have the correct hardcoded properties ──
  useEffect(() => {
    if (!hydrated || !database) return;
    const expectedProps = DEFAULT_PROPERTIES_MAP[databaseId];
    if (!expectedProps) return;
    // Only enforce for locked schema databases
    if (!isLockedSchemaDB) return;

    // Deep compare: check IDs, types, names, and config match
    const schemasMatch = expectedProps.length === database.properties.length &&
      expectedProps.every((expected: any) => {
        const current = database.properties.find(p => p.id === expected.id);
        if (!current) return false;
        if (current.type !== expected.type) return false;
        if (current.name !== expected.name) return false;
        // Compare config (relation targets, select options, etc.)
        if (JSON.stringify(current.config || {}) !== JSON.stringify(expected.config || {})) return false;
        return true;
      });

    if (!schemasMatch) {
      console.log(`[Schema Enforcement] Resetting ${databaseId} properties to canonical schema`);
      useDatabaseStore.getState().updateDatabase(databaseId, { properties: expectedProps });
    }
  }, [hydrated, database, databaseId]);


  useEffect(() => {
    if (!hydrated) return; // Don't act before store is loaded from IndexedDB
    if (database || autoInitializing) return; // Already exists or already creating

    // Double-check the store directly (in case of race condition)
    const existing = useDatabaseStore.getState().getDatabase(databaseId);
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
    useDatabaseStore.getState().createDatabase(parsedName, undefined, databaseId, customProps as any);
  }, [database, databaseId, autoInitializing, hydrated]);

  if (!database) {
    return (
      <div className="flex flex-col items-center justify-center h-[500px] bg-white dark:bg-neutral-900 rounded-lg border border-neutral-200 dark:border-white/10 p-8 text-center space-y-4 m-6">
        <div className="w-8 h-8 border-2 border-neutral-300 border-t-[var(--brand-color,#d35400)] rounded-full animate-spin" />
        <p className="text-sm text-neutral-500 font-medium">Initializing workspace...</p>
      </div>
    );
  }

  // Restrict to Single View "All Contacts" for Free Tier on Contact Databases
  let supportedViews = database.views.filter(v => v.type !== 'timeline');
  if (isImmutableContactDB && !hasCRM) {
    if (supportedViews.length > 0) {
      supportedViews = [supportedViews.find(v => v.name.toLowerCase().includes('all')) || supportedViews[0]];
    }
  }

  const activeView = supportedViews.find(v => v.id === activeViewId) || supportedViews[0] || database.views[0];

  const getViewIcon = (type: string) => {
    switch (type) {
      case 'table': return <Table2 className="w-4 h-4" />;
      case 'board': return <LayoutGrid className="w-4 h-4" />;
      case 'calendar': return <CalendarIcon className="w-4 h-4" />;
      case 'timeline': return <GanttChartSquare className="w-4 h-4" />;
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
        {activeView.type === 'table' && <NotionGridDynamic databaseId={database.id} viewId={activeView.id} renderTabs={headerTabs} lockedSchema={isLockedSchemaDB && !hasDatabases} preventDelete={databaseId === 'db-invoices'} hideFooterNew={!!hideFooterNew} hardFilter={defaultFilter} />}
        {activeView.type === 'board' && <BoardViewDynamic databaseId={database.id} viewId={activeView.id} renderTabs={headerTabs} />}
        {activeView.type === 'calendar' && <CalendarViewDynamic databaseId={database.id} viewId={activeView.id} renderTabs={headerTabs} />}
        {activeView.type === 'timeline' && <GanttViewDynamic databaseId={database.id} viewId={activeView.id} renderTabs={headerTabs} />}
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
