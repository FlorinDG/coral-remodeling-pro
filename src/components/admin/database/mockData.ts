import { Database, Property, Page } from './types';
import { v4 as uuidv4 } from 'uuid';

export const mockProperties: Property[] = [
    { id: 'title', name: 'Name', type: 'text' },
    {
        id: 'prop-execution-status',
        name: 'Execution Status',
        type: 'select',
        config: {
            options: [
                { id: 'opt-to-do', name: 'To Do', color: 'gray' },
                { id: 'opt-in-prog', name: 'In Progress', color: 'blue' },
                { id: 'opt-done', name: 'Done', color: 'green' }
            ]
        }
    },
    {
        id: 'prop-financial-status',
        name: 'Financial Status',
        type: 'select',
        config: {
            options: [
                { id: 'opt-quote', name: 'Quotation', color: 'gray' },
                { id: 'opt-budget', name: 'Budgeted', color: 'yellow' },
                { id: 'opt-invo', name: 'Invoiced', color: 'blue' },
                { id: 'opt-paid', name: 'Paid', color: 'green' },
                { id: 'opt-overdue', name: 'Overdue', color: 'red' }
            ]
        }
    },
    { id: 'prop-assignee', name: 'Assignee', type: 'person' },
    { id: 'prop-start-date', name: 'Planned Start', type: 'date' },
    { id: 'prop-end-date', name: 'Planned End', type: 'date' },
    { id: 'prop-actual-start', name: 'Actual Start', type: 'date' },
    { id: 'prop-actual-end', name: 'Actual End', type: 'date' },
    { id: 'prop-budget', name: 'Internal Budget', type: 'currency', config: { format: 'euro' } },
    { id: 'prop-actual-costs', name: 'Actual Costs', type: 'currency', config: { format: 'euro' } },
    { id: 'prop-due-date', name: 'Due Date', type: 'date' },
    {
        id: 'prop-priority', name: 'Priority', type: 'select',
        config: {
            options: [
                { id: 'opt-low', name: 'Low', color: 'green' },
                { id: 'opt-med', name: 'Medium', color: 'yellow' },
                { id: 'opt-high', name: 'High', color: 'red' }
            ]
        }
    },
    {
        id: 'prop-client-relation', name: 'Client Relation', type: 'relation',
        config: { relationDatabaseId: 'db-clients' }
    },
    {
        id: 'prop-client-email-rollup', name: 'Client Email', type: 'rollup',
        config: { rollupPropertyId: 'prop-client-relation', rollupTargetPropertyId: 'prop-client-email' }
    },
    {
        id: 'prop-client-phone-rollup', name: 'Client Phone', type: 'rollup',
        config: { rollupPropertyId: 'prop-client-relation', rollupTargetPropertyId: 'prop-client-phone' }
    },
    {
        id: 'prop-supplier-relation', name: 'Supplier Relation', type: 'relation',
        config: { relationDatabaseId: 'db-suppliers' }
    },
    {
        id: 'prop-supplier-email-rollup', name: 'Supplier Email', type: 'rollup',
        config: { rollupPropertyId: 'prop-supplier-relation', rollupTargetPropertyId: 'prop-supplier-email' }
    },
    {
        id: 'prop-name-length', name: 'Name Length', type: 'formula',
        config: { formulaExpression: 'length(prop("Name"))' }
    },
    {
        id: 'prop-custom-label', name: 'Custom Label', type: 'formula',
        config: { formulaExpression: 'concat("Task: ", prop("Name"))' }
    }
];

export const mockPages: Page[] = [
    {
        id: 'page-db1-req1',
        databaseId: 'db-1',
        properties: {
            'title': 'Finalize Kitchen Renderings',
            'prop-execution-status': 'opt-in-prog',
            'prop-financial-status': 'opt-paid',
            'prop-assignee': ['user-1'],
            'prop-start-date': '2026-03-01',
            'prop-end-date': '2026-03-14',
            'prop-due-date': '2026-03-15',
            'prop-budget': 12000,
            'prop-actual-costs': 8500,
            'prop-priority': 'opt-high',
            'prop-client-relation': ['page-client-1'],
            'prop-supplier-relation': ['page-supplier-1']
        },
        blocks: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: 'system',
        lastEditedBy: 'system'
    },
    {
        id: 'page-db1-req2',
        databaseId: 'db-1',
        properties: {
            'title': 'Order Carrara Marble',
            'prop-execution-status': 'opt-to-do',
            'prop-financial-status': 'opt-quote',
            'prop-assignee': ['user-2'],
            'prop-start-date': '2026-03-10',
            'prop-end-date': '2026-03-18',
            'prop-due-date': '2026-03-20',
            'prop-budget': 25000,
            'prop-actual-costs': 4000,
            'prop-priority': 'opt-med',
            'prop-client-relation': [],
            'prop-supplier-relation': []
        },
        blocks: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: 'system',
        lastEditedBy: 'system'
    }
];

export const mockClientPages: Page[] = [
    {
        id: 'page-contact-1',
        databaseId: 'db-clients',
        properties: {
            'title': 'John Doe Architecture',
            'prop-first-name': 'John',
            'prop-last-name': 'Doe',
            'prop-client-email': 'john@doe-arch.com',
            'prop-client-phone-mobile': '+32 470 12 34 56',
            'prop-contact-type': 'opt-partner',
            'prop-client-status': 'opt-active',
            'prop-language': 'opt-en',
            'prop-address-main': 'Brussels, Belgium',
            'prop-vat-number': 'BE0123.456.789'
        },
        blocks: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: 'system',
        lastEditedBy: 'system'
    },
    {
        id: 'page-contact-2',
        databaseId: 'db-clients',
        properties: {
            'title': 'Emma Smith',
            'prop-first-name': 'Emma',
            'prop-last-name': 'Smith',
            'prop-client-email': 'emma.smith@gmail.com',
            'prop-client-phone-mobile': '+32 471 23 45 67',
            'prop-contact-type': 'opt-b2c',
            'prop-client-status': 'opt-lead',
            'prop-lead-source': 'opt-web',
            'prop-language': 'opt-nl',
            'prop-address-main': 'Antwerp, Belgium',
            'prop-portal-access': false
        },
        blocks: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: 'system',
        lastEditedBy: 'system'
    },
    {
        id: 'page-contact-3',
        databaseId: 'db-clients',
        properties: {
            'title': 'BuildIt Supplies NV',
            'prop-first-name': 'Marc',
            'prop-last-name': 'Janssens',
            'prop-client-email': 'contact@buildit-supplies.be',
            'prop-client-phone-office': '+32 2 123 45 67',
            'prop-contact-type': 'opt-supplier',
            'prop-client-status': 'opt-active',
            'prop-language': 'opt-nl',
            'prop-address-main': 'Ghent, Belgium',
            'prop-vat-number': 'BE0987.654.321'
        },
        blocks: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: 'system',
        lastEditedBy: 'system'
    }
];

export const mockDatabases: Database[] = [
    {
        id: 'db-1',
        name: 'Projects Tracker',
        description: 'Track all ongoing remodeling projects.',
        icon: '🏗️',
        properties: mockProperties,
        pages: mockPages,
        activeFilters: [],
        views: [
            { id: 'view-1', name: 'All Projects', type: 'table' },
            { id: 'view-2', name: 'Execution Board', type: 'board', config: { groupByPropertyId: 'prop-execution-status' } },
            { id: 'view-4', name: 'Financial Pipeline', type: 'board', config: { groupByPropertyId: 'prop-financial-status' } }
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ownerId: 'user-1'
    },
    {
        id: 'db-clients',
        name: 'Contacts Database',
        description: 'Central list of all professional contacts, excluding workforce.',
        icon: '📇',
        properties: [
            { id: 'title', name: 'Company / Full Name', type: 'text' },
            { id: 'prop-first-name', name: 'First Name', type: 'text' },
            { id: 'prop-last-name', name: 'Last Name', type: 'text' },
            { id: 'prop-client-email', name: 'Primary Email', type: 'email' },
            { id: 'prop-client-phone-mobile', name: 'Mobile Phone', type: 'phone' },
            { id: 'prop-client-phone-office', name: 'Office Phone', type: 'phone' },
            {
                id: 'prop-contact-type',
                name: 'Contact Type',
                type: 'select',
                config: {
                    options: [
                        { id: 'opt-b2c', name: 'Residential Client', color: 'blue' },
                        { id: 'opt-commercial', name: 'Commercial Client', color: 'purple' },
                        { id: 'opt-partner', name: 'Architect Partner', color: 'pink' },
                        { id: 'opt-supplier', name: 'Supplier / Vendor', color: 'orange' },
                        { id: 'opt-other', name: 'Other', color: 'gray' }
                    ]
                }
            },
            {
                id: 'prop-client-status',
                name: 'Status',
                type: 'select',
                config: {
                    options: [
                        { id: 'opt-lead', name: 'Lead', color: 'yellow' },
                        { id: 'opt-prospect', name: 'Qualified Prospect', color: 'orange' },
                        { id: 'opt-active', name: 'Active Client', color: 'green' },
                        { id: 'opt-past', name: 'Past Client', color: 'gray' },
                        { id: 'opt-archived', name: 'Archived', color: 'red' }
                    ]
                }
            },
            {
                id: 'prop-lead-source',
                name: 'Lead Source',
                type: 'select',
                config: {
                    options: [
                        { id: 'opt-web', name: 'Website Form', color: 'blue' },
                        { id: 'opt-bobex', name: 'Bobex', color: 'purple' },
                        { id: 'opt-referral', name: 'Referral', color: 'pink' },
                        { id: 'opt-ads', name: 'Google Ads', color: 'green' },
                        { id: 'opt-direct', name: 'Direct Contact', color: 'orange' }
                    ]
                }
            },
            {
                id: 'prop-language',
                name: 'Language',
                type: 'select',
                config: {
                    options: [
                        { id: 'opt-nl', name: 'Dutch', color: 'blue' },
                        { id: 'opt-fr', name: 'French', color: 'red' },
                        { id: 'opt-en', name: 'English', color: 'gray' },
                        { id: 'opt-ro', name: 'Romanian', color: 'yellow' }
                    ]
                }
            },
            { id: 'prop-address-main', name: 'Address', type: 'places' },
            { id: 'prop-vat-number', name: 'VAT Number', type: 'text' },
            { id: 'prop-portal-access', name: 'Portal Access', type: 'checkbox' },
            { id: 'prop-next-followup', name: 'Next Follow-up', type: 'date' }
        ],
        pages: mockClientPages,
        activeFilters: [],
        views: [
            { id: 'view-contact-all', name: 'All Contacts', type: 'table' },
            {
                id: 'view-contact-active',
                name: 'Active Clients',
                type: 'table',
                filters: [
                    { id: 'filter-active', propertyId: 'prop-client-status', operator: 'equals', value: 'opt-active' }
                ]
            },
            {
                id: 'view-contact-b2b',
                name: 'B2B Partners',
                type: 'table',
                filters: [
                    { id: 'filter-partner', propertyId: 'prop-contact-type', operator: 'equals', value: 'opt-partner' }
                ]
            },
            {
                id: 'view-contact-followup',
                name: 'Pending Follow-ups',
                type: 'board',
                config: { groupByPropertyId: 'prop-client-status' }
            }
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ownerId: 'user-1'
    },
    {
        id: 'db-suppliers',
        name: 'Suppliers Directory',
        description: 'Central list of all material suppliers.',
        icon: '📦',
        properties: [
            { id: 'title', name: 'Name', type: 'text' },
            { id: 'prop-supplier-email', name: 'Email', type: 'email' },
            { id: 'prop-address-main', name: 'Address', type: 'places' },
            { id: 'prop-vat-number', name: 'BTW', type: 'text' },
            { id: 'prop-supplier-phone', name: 'Phone', type: 'phone' },
            {
                id: 'prop-supplier-type', name: 'Type', type: 'select',
                config: {
                    options: [
                        { id: 'opt-material', name: 'Material Supplier', color: 'orange' },
                        { id: 'opt-subcontractor', name: 'Subcontractor', color: 'blue' },
                        { id: 'opt-logistics', name: 'Logistics', color: 'purple' },
                        { id: 'opt-services', name: 'Services', color: 'green' },
                        { id: 'opt-other', name: 'Other', color: 'gray' }
                    ]
                }
            },
        ],
        pages: [
            {
                id: 'page-supplier-1',
                databaseId: 'db-suppliers',
                properties: {
                    'title': 'Euro-Marble Supply Group',
                    'prop-supplier-email': 'orders@euro-marble.com'
                },
                blocks: [],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                createdBy: 'system',
                lastEditedBy: 'system'
            },
            {
                id: 'page-supplier-2',
                databaseId: 'db-suppliers',
                properties: {
                    'title': 'Premium Woodworks BV',
                    'prop-supplier-email': 'sales@premiumwood.be'
                },
                blocks: [],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                createdBy: 'system',
                lastEditedBy: 'system'
            }
        ],
        activeFilters: [],
        views: [
            { id: 'view-supplier-table', name: 'All Suppliers', type: 'table' }
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ownerId: 'user-1'
    },
    {
        id: 'db-crm',
        name: 'CRM: Leads & Pipeline',
        description: 'Standard organic leads and sales opportunities trajectory.',
        icon: '🎯',
        properties: [
            { id: 'title', name: 'Opportunity Name', type: 'text' },
            { id: 'prop-c-contact', name: 'Contact', type: 'relation', config: { relationDatabaseId: 'db-clients' } },
            { id: 'prop-c-source', name: 'Source', type: 'select', config: { options: [{ id: 'opt-web', name: 'Website', color: 'blue' }, { id: 'opt-ref', name: 'Referral', color: 'purple' }, { id: 'opt-bobex-conv', name: 'Bobex Conv.', color: 'green' }] } },
            { id: 'prop-c-datein', name: 'Date In', type: 'date' },
            {
                id: 'prop-crm-status', name: 'Status', type: 'select', config: {
                    options: [
                        { id: 'opt-new', name: 'New', color: 'blue' },
                        { id: 'opt-qual', name: 'Qualification', color: 'purple' },
                        { id: 'opt-opm', name: 'Oferte Opmaak', color: 'yellow' },
                        { id: 'opt-sent', name: 'Offerte Sent', color: 'orange' },
                        { id: 'opt-won', name: 'Won', color: 'green' },
                        { id: 'opt-lost', name: 'Lost', color: 'red' }
                    ]
                }
            },
            { id: 'prop-c-visit', name: 'Visit Planned', type: 'checkbox' },
            { id: 'prop-crm-value', name: 'Estimated Value', type: 'number', config: { format: 'euro' } },
            { id: 'prop-c-note', name: 'Note', type: 'text' }
        ],
        pages: [],
        activeFilters: [],
        views: [{ id: 'view-crm-table', name: 'Pipeline Table', type: 'table' }],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ownerId: 'system'
    },
    {
        id: 'db-bobex',
        name: 'Bobex Pipeline',
        description: 'Specialized flow for purchased Bobex leads.',
        icon: '🔗',
        properties: [
            { id: 'title', name: 'Request Summary', type: 'text' },
            { id: 'prop-b-extnr', name: 'Nr', type: 'text' },
            { id: 'prop-b-contact', name: 'Client', type: 'relation', config: { relationDatabaseId: 'db-clients' } },
            { id: 'prop-b-datein', name: 'Date In', type: 'date' },
            { id: 'prop-b-location', name: 'Location', type: 'text' },
            {
                id: 'prop-bobex-status', name: 'Status', type: 'select', config: {
                    options: [
                        { id: 'opt-b-new', name: 'New', color: 'blue' },
                        { id: 'opt-b-qual', name: 'Qualification', color: 'purple' },
                        { id: 'opt-b-opm', name: 'Oferte Opmaak', color: 'yellow' },
                        { id: 'opt-b-sent', name: 'Offerte Sent', color: 'orange' },
                        { id: 'opt-b-won', name: 'Won', color: 'green' },
                        { id: 'opt-b-lost', name: 'Lost', color: 'red' }
                    ]
                }
            },
            { id: 'prop-b-mail', name: 'Mail Lead', type: 'checkbox' },
            { id: 'prop-b-call', name: 'Call Lead', type: 'checkbox' },
            { id: 'prop-b-visit', name: 'Visit Planned', type: 'checkbox' },
            { id: 'prop-b-note', name: 'Status Note', type: 'text' }
        ],
        pages: [],
        activeFilters: [],
        views: [{ id: 'view-bobex-table', name: 'Bobex Requests Table', type: 'table' }],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ownerId: 'system'
    },
    {
        id: 'db-quotations',
        name: 'Quotations Tracker',
        description: 'Generate and track project estimates.',
        icon: '📄',
        properties: [
            { id: 'title', name: 'Quote Title', type: 'text' },
            { id: 'status', name: 'Status', type: 'select', config: { options: [{ id: 'opt-draft', name: 'Concept', color: 'gray' }, { id: 'opt-sent', name: 'Verzonden', color: 'blue' }, { id: 'opt-accepted', name: 'Aanvaard', color: 'green' }, { id: 'opt-rejected', name: 'Geweigerd', color: 'red' }] } },
            { id: 'prop-quote-amount', name: 'Total Amount', type: 'number', config: { format: 'euro' } }
        ],
        pages: [],
        activeFilters: [],
        views: [{ id: 'view-quote-table', name: 'All Quotes', type: 'table' }],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ownerId: 'system'
    },
    {
        id: 'db-tasks',
        name: 'Task Management',
        description: 'Track internal technical and design tasks.',
        icon: '✅',
        properties: [
            { id: 'title', name: 'Task Name', type: 'text' },
            { id: 'prop-task-status', name: 'Status', type: 'select', config: { options: [{ id: 'opt-todo', name: 'To Do', color: 'gray' }, { id: 'opt-doing', name: 'In Progress', color: 'blue' }, { id: 'opt-done', name: 'Done', color: 'green' }] } },
            { id: 'prop-task-assignee', name: 'Assignee', type: 'text' },
            { id: 'prop-task-priority', name: 'Priority', type: 'select', config: { options: [{ id: 'opt-low', name: 'Low', color: 'green' }, { id: 'opt-med', name: 'Medium', color: 'yellow' }, { id: 'opt-high', name: 'High', color: 'red' }] } },
            { id: 'prop-task-due', name: 'Due Date', type: 'date' },
            { id: 'prop-task-project', name: 'Project Link', type: 'relation', config: { relationDatabaseId: 'db-1' } }
        ],
        pages: [],
        activeFilters: [],
        views: [
            { id: 'view-task-table', name: 'All Tasks List', type: 'table' },
            { id: 'view-task-board', name: 'Kanban Board', type: 'board', config: { groupByPropertyId: 'prop-task-status' } },
            { id: 'view-task-calendar', name: 'Timeline Calendar', type: 'calendar', config: { datePropertyId: 'prop-task-due' } }
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ownerId: 'system'
    },
    {
        id: 'db-invoices',
        name: 'Invoices Ledger',
        description: 'Track incoming payments and billed invoices.',
        icon: '💵',
        properties: [
            { id: 'title', name: 'Invoice Number', type: 'text' },
            { id: 'prop-inv-client', name: 'Client', type: 'text' },
            { id: 'prop-inv-status', name: 'Status', type: 'select', config: { options: [{ id: 'opt-unpaid', name: 'Unpaid', color: 'red' }, { id: 'opt-paid', name: 'Paid', color: 'green' }] } },
            { id: 'prop-inv-amount', name: 'Amount', type: 'number', config: { format: 'euro' } }
        ],
        pages: [],
        activeFilters: [],
        views: [{ id: 'view-inv-table', name: 'All Invoices', type: 'table' }],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ownerId: 'system'
    },
    {
        id: 'db-expenses',
        name: 'Expenses',
        description: 'Track outgoing payments and company expenses.',
        icon: '💳',
        properties: [
            { id: 'title', name: 'Receipt / Item', type: 'text' },
            { id: 'prop-exp-category', name: 'Category', type: 'select', config: { options: [{ id: 'opt-equipment', name: 'Equipment', color: 'orange' }, { id: 'opt-software', name: 'Software', color: 'blue' }, { id: 'opt-travel', name: 'Travel', color: 'purple' }] } },
            { id: 'prop-exp-amount', name: 'Amount', type: 'number', config: { format: 'euro' } }
        ],
        pages: [],
        activeFilters: [],
        views: [{ id: 'view-exp-table', name: 'All Expenses', type: 'table' }],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ownerId: 'system'
    },
    {
        id: 'db-hr',
        name: 'Employee Directory',
        description: 'Manage internal staff and HR records.',
        icon: '🧑‍💼',
        properties: [
            { id: 'title', name: 'Employee Name', type: 'text' },
            { id: 'prop-hr-role', name: 'Job Title', type: 'text' },
            { id: 'prop-hr-department', name: 'Department', type: 'select', config: { options: [{ id: 'opt-mgmt', name: 'Management', color: 'purple' }, { id: 'opt-design', name: 'Design', color: 'pink' }, { id: 'opt-build', name: 'Construction', color: 'orange' }] } },
            { id: 'prop-hr-status', name: 'Status', type: 'select', config: { options: [{ id: 'opt-active', name: 'Active', color: 'green' }, { id: 'opt-inactive', name: 'Inactive', color: 'red' }] } }
        ],
        pages: [
            {
                id: '11111111-1111-1111-1111-111111111111', databaseId: 'db-hr', blocks: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), createdBy: 'system', lastEditedBy: 'system',
                properties: { 'title': 'Florin', 'prop-hr-role': 'Project Manager', 'prop-hr-department': 'opt-mgmt', 'prop-hr-status': 'opt-active' }
            },
            {
                id: '22222222-2222-2222-2222-222222222222', databaseId: 'db-hr', blocks: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), createdBy: 'system', lastEditedBy: 'system',
                properties: { 'title': 'Alex', 'prop-hr-role': 'Designer', 'prop-hr-department': 'opt-design', 'prop-hr-status': 'opt-active' }
            },
            {
                id: '33333333-3333-3333-3333-333333333333', databaseId: 'db-hr', blocks: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), createdBy: 'system', lastEditedBy: 'system',
                properties: { 'title': 'John (On Leave)', 'prop-hr-role': 'Builder', 'prop-hr-department': 'opt-build', 'prop-hr-status': 'opt-inactive' }
            }
        ],
        activeFilters: [],
        views: [{ id: 'view-hr-table', name: 'Active Staff', type: 'table' }],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ownerId: 'system'
    },
    {
        id: 'db-articles',
        name: 'Articles Library',
        description: 'Global master catalog for materials, labor, and services.',
        icon: '📚',
        properties: [
            { id: 'title', name: 'Naam', type: 'text' },
            { id: 'prop-art-id', name: 'ID', type: 'text' },
            { id: 'prop-art-desc', name: 'Omschrijving', type: 'text' },
            { id: 'prop-art-brand', name: 'Merk', type: 'text' },
            { id: 'prop-art-group', name: 'Artikelgroep', type: 'select', config: { options: [{ id: 'opt-general', name: 'General', color: 'default' }, { id: 'opt-ruwbouw', name: 'Ruwbouw', color: 'gray' }, { id: 'opt-afwerking', name: 'Afwerking', color: 'blue' }, { id: 'opt-elektriciteit', name: 'Elektriciteit', color: 'yellow' }, { id: 'opt-sanitaire', name: 'Sanitaire', color: 'blue' }, { id: 'opt-ventilatie', name: 'Ventilatie', color: 'purple' }, { id: 'opt-verwarming', name: 'Verwarming', color: 'red' }] } },
            { id: 'prop-art-supplier', name: 'Leverancier', type: 'relation', config: { relationDatabaseId: 'db-suppliers' } },

            { id: 'prop-art-bruto', name: 'Brutoprijs', type: 'number', config: { format: 'euro' } },
            { id: 'prop-art-remise', name: 'Lever.%', type: 'number', config: { format: 'percent' } },
            { id: 'prop-art-netto', name: 'Netto kostprijs', type: 'formula', config: { formulaExpression: 'round2(prop("Brutoprijs") * (1 - (prop("Lever.%") / 100)))' } },

            { id: 'prop-art-margin', name: 'Marge', type: 'number', config: { format: 'percent' } },
            { id: 'prop-art-margin-euro', name: 'Marge€', type: 'formula', config: { formulaExpression: 'round2(prop("Netto kostprijs") * (prop("Marge") / 100))' } },
            { id: 'prop-art-verkoop', name: 'Verkoopprijs', type: 'formula', config: { formulaExpression: 'round2(prop("Netto kostprijs") + prop("Marge€"))' } },

            { id: 'prop-art-unit', name: 'Eeh', type: 'select', config: { options: [{ id: 'u-stk', name: 'stk', color: 'gray' }, { id: 'u-m', name: 'm', color: 'blue' }, { id: 'u-m2', name: 'm2', color: 'green' }, { id: 'u-m3', name: 'm3', color: 'purple' }, { id: 'u-l', name: 'L', color: 'yellow' }, { id: 'u-uur', name: 'uur', color: 'orange' }, { id: 'u-set', name: 'set', color: 'pink' }, { id: 'u-kg', name: 'kg', color: 'red' }] } },
            { id: 'prop-art-packaging', name: 'Packaging', type: 'select', config: { options: [{ id: 'opt-stk', name: 'stuk', color: 'gray' }, { id: 'opt-plaat', name: 'plaat', color: 'blue' }, { id: 'opt-rol', name: 'rol', color: 'yellow' }, { id: 'opt-doos', name: 'doos', color: 'orange' }] } },
            { id: 'prop-art-min-order', name: 'Minimum Order', type: 'formula', config: { formulaExpression: 'prop("Eeh") === "u-m2" ? 5 : (prop("Packaging") === "opt-plaat" ? 2 : 1)' } },

            { id: 'prop-art-variants', name: 'Product Variants', type: 'variants' }
        ],
        pages: [
            {
                id: 'page-art-1', databaseId: 'db-articles', blocks: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), createdBy: 'system', lastEditedBy: 'system',
                properties: { 'title': 'Gyproc Platen 12mm', 'prop-art-desc': 'Standard gypsum board for interior walls.', 'prop-art-bruto': 12.50, 'prop-art-remise': 20, 'prop-art-margin': 65, 'prop-art-verkoop': 16.50, 'prop-art-unit': 'u-m2', 'prop-art-packaging': 'plaat', 'prop-art-min-order': 3.12 }
            },
            {
                id: 'page-art-2', databaseId: 'db-articles', blocks: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), createdBy: 'system', lastEditedBy: 'system',
                properties: { 'title': 'Isolatie 10cm', 'prop-art-desc': 'Acoustic thermal fiberglass insulation wrap.', 'prop-art-bruto': 8.00, 'prop-art-remise': 15, 'prop-art-margin': 65, 'prop-art-verkoop': 11.20, 'prop-art-unit': 'u-m2' }
            },
            {
                id: 'page-art-drain-1', databaseId: 'db-articles', blocks: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), createdBy: 'system', lastEditedBy: 'system',
                properties: {
                    'title': 'Shower Drain',
                    'prop-art-desc': 'Premium drainage channel.',
                    'prop-art-variants': [
                        { id: 'axis-color', name: 'Color', options: [{ id: 'opt-stainless', name: 'Stainless', priceDelta: 0 }, { id: 'opt-chrome', name: 'Chrome', priceDelta: 0 }, { id: 'opt-black', name: 'Matte Black', priceDelta: 20 }] },
                        { id: 'axis-length', name: 'Length', options: [{ id: 'opt-70', name: '70cm', priceDelta: 0 }, { id: 'opt-80', name: '80cm', priceDelta: 10 }, { id: 'opt-90', name: '90cm', priceDelta: 20 }, { id: 'opt-100', name: '100cm', priceDelta: 30 }] },
                        { id: 'axis-depth', name: 'Depth Profile', options: [{ id: 'opt-shallow', name: 'Shallow (65mm)', priceDelta: 0 }, { id: 'opt-deep', name: 'Deep (90mm)', priceDelta: 15 }] }
                    ]
                }
            }
        ],
        activeFilters: [],
        views: [{ id: 'view-art-table', name: 'Content Pipeline', type: 'table' }],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ownerId: 'system'
    },
    {
        id: 'db-bestek',
        name: 'Bestek Specifications',
        description: 'Standardized technical specifications and building codes context.',
        icon: '🏗️',
        properties: [
            { id: 'title', name: 'Artikel', type: 'text' }
        ],
        pages: [],
        activeFilters: [],
        views: [{ id: 'view-bst-table', name: 'All Specs', type: 'table' }],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ownerId: 'system'
    }
];
