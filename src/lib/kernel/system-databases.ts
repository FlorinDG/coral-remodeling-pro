/**
 * system-databases.ts — KERNEL (L0)
 *
 * The single canonical vocabulary for system database roles and display names.
 * Pure definitions: NO Prisma imports, NO server dependencies, CLIENT SAFE.
 * Governed by coral-kernel-system-databases.md and KERN-5.
 */

export const SYSTEM_DATABASE_ROLES = [
    'invoices',
    'clients',
    'suppliers',
    'expenses',
    'tickets',
    'quotations',
    'payments-in',
    'payments-out',
    'projects',
    'tasks',
    'articles',
    'crm',
    'bobex',
    'bestek',
    'journal-general',
    'hr',
] as const;

export type SystemDatabaseRole = typeof SYSTEM_DATABASE_ROLES[number];

export const SYSTEM_DATABASE_NAMES: Record<SystemDatabaseRole, string> = {
    'invoices':        'Sales Invoices',
    'clients':         'Contacts',
    'suppliers':       'Suppliers',
    'expenses':        'Purchase Invoices',
    'tickets':         'Expense Tickets',
    'quotations':      'Quotations',
    'payments-in':     'Received Payments',
    'payments-out':    'Paid Payments',
    'projects':        'Projects',
    'tasks':           'Tasks',
    'articles':        'Material Articles',
    'crm':             'CRM',
    'bobex':           'Bobex',
    'bestek':          'Bestek Templates',
    'journal-general': 'General Journal',
    'hr':              'HR',
};
