export const hrTabs = [
    { label: 'WORKHUB', href: '/admin/hr/time-tracker', id: 'workhub' },
    { label: 'WORKFORCE SCHEDULER', href: '/admin/hr/time-tracker/schedule', id: 'scheduler' },
    { label: 'EMPLOYEES', href: '/admin/hr/employees', id: 'employees' }
];

export const relationsTabs = [
    { label: 'CONTACTS', href: '/admin/contacts', id: 'contacts' },
    { label: 'LEVERANCIERS (SUPPLIERS)', href: '/admin/suppliers', id: 'suppliers' },
    { label: 'SALES PIPELINE', href: '/admin/crm', id: 'pipeline' }
];

export const frontendTabs = [
    { label: 'PAGES / CONTENT', href: '/admin/content', id: 'content' },
    { label: 'SERVICES', href: '/admin/services', id: 'services' },
    { label: 'PORTFOLIO', href: '/admin/projects', id: 'portfolio' },
];

export const libraryTabs = [
    { label: 'ARTICLES', href: '/admin/library/articles', id: 'articles' },
    { label: 'BESTEK', href: '/admin/library/bestek', id: 'bestek' }
];

export const projectsTabs = [
    { label: 'CLIENT PORTALS', href: '/admin/portals', id: 'portals' },
    { label: 'PROJECTS DATABASE', href: '/admin/projects-management', id: 'database' },
    { label: 'PLANNING TIMELINE', href: '/admin/projects-management/planning', id: 'planning' }
];

// Financial tab i18n key map (fallback to hardcoded if no translator provided)
const FINANCIAL_TAB_KEYS: Record<string, string> = {
    'fin-aankoop': 'purchaseInvoices',
    'fin-tickets': 'expenseTickets',
    'fin-cred-aankoop': 'purchaseCreditNotes',
    'fin-cred-verkoop': 'salesCreditNotes',
    'fin-facturen': 'salesInvoices',
    'fin-offertes': 'quotations',
};

const financialTabsBase = [
    { label: 'FACTUREN', href: '/admin/financials/income/invoices', id: 'fin-facturen' },
    { label: 'OFFERTES', href: '/admin/quotations', id: 'fin-offertes' },
    { label: 'AANKOOPFACTUREN', href: '/admin/financials/expenses/invoices', id: 'fin-aankoop' },
    { label: 'ONKOSTENFICHES', href: '/admin/financials/expenses/tickets', id: 'fin-tickets' },
    { label: 'CREDITNOTA - AANKOOP', href: '/admin/financials/expenses/credit-notes', id: 'fin-cred-aankoop' },
    { label: 'CREDITNOTA - VERKOOP', href: '/admin/financials/income/credit-notes', id: 'fin-cred-verkoop' },
];

// Returns localized financial tabs; t is optional (from useTranslations('Admin'))
export function getFinancialTabs(t?: (key: string) => string, tHas?: (key: string) => boolean) {
    if (!t || !tHas) return financialTabsBase;
    return financialTabsBase.map(tab => {
        const key = `nav.financialTabs.${FINANCIAL_TAB_KEYS[tab.id]}`;
        return { ...tab, label: tHas(key) ? t(key) : tab.label };
    });
}

// Backward compat: export the base tabs as default
export const financialTabs = financialTabsBase;

// Settings tabs i18n key map
const SETTINGS_TAB_KEYS: Record<string, string> = {
    'company-info': 'companyInfo',
    'ui': 'uiLayout',
    'opt-calendar': 'calendar',
    'opt-financials': 'financials',
    'opt-hr': 'hr',
    'opt-library': 'library',
    'opt-projects': 'projects',
    'opt-relations': 'relations',
    'opt-tasks': 'tasks',
    'opt-website': 'website',
};

const settingsTabsBase = [
    { label: 'COMPANY INFO', href: '/admin/settings/company-info', id: 'company-info' },
    { label: 'UI LAYOUT', href: '/admin/settings/ui', id: 'ui' },
    { label: 'CALENDAR', href: '/admin/settings/calendar', id: 'opt-calendar' },
    { label: 'FINANCIALS', href: '/admin/settings/financials', id: 'opt-financials' },
    { label: 'HR', href: '/admin/settings/hr', id: 'opt-hr' },
    { label: 'LIBRARY', href: '/admin/settings/library', id: 'opt-library' },
    { label: 'PROJECTS', href: '/admin/settings/projects', id: 'opt-projects' },
    { label: 'RELATIONS', href: '/admin/settings/relations', id: 'opt-relations' },
    { label: 'TASKS', href: '/admin/settings/tasks', id: 'opt-tasks' },
    { label: 'WEBSITE', href: '/admin/settings/website', id: 'opt-website' }
];

export function getSettingsTabs(t?: (key: string) => string, tHas?: (key: string) => boolean) {
    if (!t || !tHas) return settingsTabsBase;
    return settingsTabsBase.map(tab => {
        const key = `nav.settings.${SETTINGS_TAB_KEYS[tab.id]}`;
        return { ...tab, label: tHas(key) ? t(key) : tab.label };
    });
}

export const settingsTabs = settingsTabsBase;

