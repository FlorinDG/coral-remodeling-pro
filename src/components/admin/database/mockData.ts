import { Database, Property, Page } from './types';

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
                { id: 'opt-done', name: 'Done', color: 'green' },
                { id: 'opt-dropped', name: 'Dropped', color: 'charcoal' },
                { id: 'opt-late', name: 'Late', color: 'red' },
                { id: 'opt-problems', name: 'Problems', color: 'orange' }
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
                { id: 'opt-partial', name: 'Partially Paid', color: 'indigo' },
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
        id: 'prop-project-quote', name: 'Offerte',          type: 'relation', config: { relationDatabaseId: 'db-quotations' }
    },
    {
        id: 'prop-custom-label', name: 'Custom Label', type: 'formula',
        config: { formulaExpression: 'concat("Task: ", prop("Name"))' }
    },
    // ── Project Classification ────────────────────────────────────
    {
        id: 'prop-project-type', name: 'Project Type', type: 'select',
        config: {
            options: [
                { id: 'type-operations', name: 'Operations', color: 'blue' },
                { id: 'type-admin', name: 'Administration', color: 'purple' },
                { id: 'type-bizdev', name: 'Business Development', color: 'green' },
            ]
        }
    },
    {
        id: 'prop-linked-projects', name: 'Linked Projects', type: 'relation',
        config: { relationDatabaseId: 'db-1' }
    },
    // ── Administration-specific ───────────────────────────────────
    {
        id: 'prop-admin-department', name: 'Department', type: 'select',
        config: {
            options: [
                { id: 'dept-hr', name: 'HR', color: 'pink' },
                { id: 'dept-finance', name: 'Finance', color: 'green' },
                { id: 'dept-legal', name: 'Legal', color: 'indigo' },
                { id: 'dept-it', name: 'IT', color: 'blue' },
                { id: 'dept-general', name: 'General', color: 'gray' },
            ]
        }
    },
    { id: 'prop-admin-recurring', name: 'Recurring', type: 'checkbox' },
    { id: 'prop-admin-compliance-date', name: 'Compliance Deadline', type: 'date' },
    // ── Business Development-specific ─────────────────────────────
    { id: 'prop-bizdev-opportunity-value', name: 'Opportunity Value', type: 'currency', config: { format: 'euro' } },
    { id: 'prop-bizdev-win-probability', name: 'Win Probability', type: 'number' },
    {
        id: 'prop-bizdev-stage', name: 'BD Stage', type: 'select',
        config: {
            options: [
                { id: 'bd-prospect', name: 'Prospecting', color: 'gray' },
                { id: 'bd-qualify', name: 'Qualification', color: 'blue' },
                { id: 'bd-proposal', name: 'Proposal', color: 'purple' },
                { id: 'bd-negotiation', name: 'Negotiation', color: 'orange' },
                { id: 'bd-won', name: 'Won', color: 'green' },
                { id: 'bd-lost', name: 'Lost', color: 'red' },
            ]
        }
    },
    {
        id: 'prop-bizdev-source', name: 'Lead Source', type: 'select',
        config: {
            options: [
                { id: 'src-referral', name: 'Referral', color: 'green' },
                { id: 'src-website', name: 'Website', color: 'blue' },
                { id: 'src-cold', name: 'Cold Outreach', color: 'gray' },
                { id: 'src-partner', name: 'Partner', color: 'purple' },
                { id: 'src-event', name: 'Event/Fair', color: 'orange' },
                { id: 'src-bobex', name: 'Bobex', color: 'yellow' },
            ]
        }
    },
    {
        id: 'prop-bizdev-crm-link', name: 'CRM Lead', type: 'relation',
        config: { relationDatabaseId: 'db-crm' }
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
        description: 'Internal workspace tasks — the single source of truth across the app.',
        icon: '✅',
        properties: [
            { id: 'title',                  name: 'Task Name',      type: 'text' },
            {
                id: 'prop-task-status', name: 'Status', type: 'select',
                config: { options: [
                    { id: 'opt-todo',    name: 'To Do',       color: 'gray'   },
                    { id: 'opt-doing',   name: 'In Progress', color: 'blue'   },
                    { id: 'opt-review',  name: 'In Review',   color: 'purple' },
                    { id: 'opt-done',    name: 'Done',        color: 'green'  },
                    { id: 'opt-dropped', name: 'Dropped',     color: 'red'    },
                ] }
            },
            { id: 'prop-task-assignee',     name: 'Assignee',       type: 'person' },
            {
                id: 'prop-task-priority', name: 'Priority', type: 'select',
                config: { options: [
                    { id: 'opt-p1', name: 'Urgent',    color: 'red'    },
                    { id: 'opt-p2', name: 'High',      color: 'orange' },
                    { id: 'opt-p3', name: 'Medium',    color: 'yellow' },
                    { id: 'opt-p4', name: 'Low',       color: 'gray'   },
                ] }
            },
            { id: 'prop-task-due',          name: 'Due Date',       type: 'date' },
            { id: 'prop-task-project',      name: 'Project',        type: 'relation', config: { relationDatabaseId: 'db-1' } },
            // ── Task-First Properties ──────────────────────────────────────
            {
                id: 'prop-task-tags', name: 'Tags', type: 'multi_select',
                config: { options: [
                    { id: 'tag-site',     name: 'On-Site',    color: 'orange' },
                    { id: 'tag-office',   name: 'Office',     color: 'blue'   },
                    { id: 'tag-design',   name: 'Design',     color: 'pink'   },
                    { id: 'tag-client',   name: 'Client',     color: 'purple' },
                    { id: 'tag-urgent',   name: 'Urgent',     color: 'red'    },
                    { id: 'tag-admin',    name: 'Admin',      color: 'gray'   },
                ] }
            },
            { id: 'prop-task-defer',        name: 'Defer Until',    type: 'date' },
            { id: 'prop-task-my-day',       name: 'My Day',         type: 'checkbox' },
            { id: 'prop-task-flagged',      name: 'Flagged',        type: 'checkbox' },
            {
                id: 'prop-task-section', name: 'Section', type: 'select',
                config: { options: [
                    { id: 'sec-planning',  name: 'Planning',    color: 'blue'   },
                    { id: 'sec-execution', name: 'Execution',   color: 'orange' },
                    { id: 'sec-review',    name: 'Review',      color: 'purple' },
                    { id: 'sec-admin',     name: 'Admin',       color: 'gray'   },
                ] }
            },
            { id: 'prop-task-recurrence',   name: 'Recurrence',     type: 'text' },
            { id: 'prop-task-depends-on',   name: 'Blocked By',     type: 'relation', config: { relationDatabaseId: 'db-tasks' } },
            { id: 'prop-task-estimated',    name: 'Estimate (min)', type: 'number' },
            { id: 'prop-task-completed-at', name: 'Completed At',   type: 'date' },
            { id: 'prop-task-notes',        name: 'Notes',          type: 'text' },
            { id: 'prop-task-reviewed-at',  name: 'Last Reviewed',  type: 'date' },
        ],
        pages: [
            {
                id: 'task-sample-1', databaseId: 'db-tasks', blocks: [],
                createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
                createdBy: 'system', lastEditedBy: 'system', order: 0,
                properties: {
                    title: 'Finalize kitchen layout drawings',
                    'prop-task-status': 'opt-doing', 'prop-task-priority': 'opt-p1',
                    'prop-task-assignee': [], 'prop-task-due': new Date(Date.now() + 86400000).toISOString().slice(0, 10),
                    'prop-task-tags': ['tag-design', 'tag-client'], 'prop-task-my-day': true,
                    'prop-task-flagged': false, 'prop-task-section': 'sec-execution',
                    'prop-task-estimated': 90, 'prop-task-notes': 'Client review scheduled Friday.',
                    'prop-task-defer': '', 'prop-task-recurrence': '',
                    'prop-task-depends-on': [], 'prop-task-completed-at': '', 'prop-task-reviewed-at': '',
                }
            },
            {
                id: 'task-sample-2', databaseId: 'db-tasks', blocks: [],
                createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
                createdBy: 'system', lastEditedBy: 'system', order: 1,
                properties: {
                    title: 'Order Carrara marble slabs',
                    'prop-task-status': 'opt-todo', 'prop-task-priority': 'opt-p2',
                    'prop-task-assignee': [], 'prop-task-due': new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10),
                    'prop-task-tags': ['tag-site'], 'prop-task-my-day': false,
                    'prop-task-flagged': true, 'prop-task-section': 'sec-planning',
                    'prop-task-estimated': 30, 'prop-task-notes': 'Check lead times with Euro-Marble.',
                    'prop-task-defer': '', 'prop-task-recurrence': '',
                    'prop-task-depends-on': [], 'prop-task-completed-at': '', 'prop-task-reviewed-at': '',
                }
            },
            {
                id: 'task-sample-3', databaseId: 'db-tasks', blocks: [],
                createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
                createdBy: 'system', lastEditedBy: 'system', order: 2,
                properties: {
                    title: 'Weekly invoice reconciliation',
                    'prop-task-status': 'opt-todo', 'prop-task-priority': 'opt-p3',
                    'prop-task-assignee': [], 'prop-task-due': new Date().toISOString().slice(0, 10),
                    'prop-task-tags': ['tag-admin', 'tag-office'], 'prop-task-my-day': true,
                    'prop-task-flagged': false, 'prop-task-section': 'sec-admin',
                    'prop-task-estimated': 45, 'prop-task-notes': '',
                    'prop-task-defer': '', 'prop-task-recurrence': 'every monday',
                    'prop-task-depends-on': [], 'prop-task-completed-at': '', 'prop-task-reviewed-at': '',
                }
            },
            {
                id: 'task-sample-4', databaseId: 'db-tasks', blocks: [],
                createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
                createdBy: 'system', lastEditedBy: 'system', order: 3,
                properties: {
                    title: 'Site inspection — bathroom tiling',
                    'prop-task-status': 'opt-done', 'prop-task-priority': 'opt-p2',
                    'prop-task-assignee': [], 'prop-task-due': new Date(Date.now() - 86400000).toISOString().slice(0, 10),
                    'prop-task-tags': ['tag-site'], 'prop-task-my-day': false,
                    'prop-task-flagged': false, 'prop-task-section': 'sec-execution',
                    'prop-task-estimated': 120, 'prop-task-notes': 'All tiles aligned. Grout curing.',
                    'prop-task-defer': '', 'prop-task-recurrence': '',
                    'prop-task-depends-on': [], 'prop-task-completed-at': new Date(Date.now() - 86400000).toISOString().slice(0, 10),
                    'prop-task-reviewed-at': '',
                }
            },
            {
                id: 'task-sample-5', databaseId: 'db-tasks', blocks: [],
                createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
                createdBy: 'system', lastEditedBy: 'system', order: 4,
                properties: {
                    title: 'Update client portal with progress photos',
                    'prop-task-status': 'opt-todo', 'prop-task-priority': 'opt-p4',
                    'prop-task-assignee': [], 'prop-task-due': new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10),
                    'prop-task-tags': ['tag-client', 'tag-office'], 'prop-task-my-day': false,
                    'prop-task-flagged': false, 'prop-task-section': 'sec-admin',
                    'prop-task-estimated': 20, 'prop-task-notes': '',
                    'prop-task-defer': new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10),
                    'prop-task-recurrence': '', 'prop-task-depends-on': ['task-sample-4'],
                    'prop-task-completed-at': '', 'prop-task-reviewed-at': '',
                }
            },
        ],
        activeFilters: [],
        views: [
            { id: 'view-task-table',    name: 'All Tasks',        type: 'table' },
            { id: 'view-task-board',    name: 'Kanban Board',     type: 'board',    config: { groupByPropertyId: 'prop-task-status' } },
            { id: 'view-task-calendar', name: 'Calendar',         type: 'calendar', config: { datePropertyId: 'prop-task-due' } },
            {
                id: 'view-task-today', name: '📅 Today', type: 'table',
                filters: [
                    { id: 'f-today-done', propertyId: 'prop-task-status', operator: 'does_not_equal', value: 'opt-done' },
                ]
            },
            {
                id: 'view-task-myday', name: '☀️ My Day', type: 'table',
                filters: [
                    { id: 'f-myday', propertyId: 'prop-task-my-day', operator: 'equals', value: 'true' },
                ]
            },
            {
                id: 'view-task-flagged', name: '🚩 Flagged', type: 'table',
                filters: [
                    { id: 'f-flagged', propertyId: 'prop-task-flagged', operator: 'equals', value: 'true' },
                ]
            },
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

            { id: 'prop-art-bruto', name: 'BruttoKost', type: 'currency' },
            { id: 'prop-art-remise', name: 'Discount', type: 'percent' },
            { id: 'prop-art-netto', name: 'NettoKost', type: 'formula', config: { formulaExpression: 'if(empty(Discount), BruttoKost, BruttoKost * (1 - Discount / 100))' } },

            { id: 'prop-art-margin', name: 'Marge Standard', type: 'percent' },
            { id: 'prop-art-margin-euro', name: 'Marge€', type: 'formula', config: { formulaExpression: 'if(empty(Marge Standard), 0, NettoKost * (Marge Standard / 100))' } },
            { id: 'prop-art-verkoop', name: 'Verkoopprijs', type: 'formula', config: { formulaExpression: 'NettoKost + Marge€' } },

            { id: 'prop-art-unit', name: 'Eeh', type: 'select', config: { options: [{ id: 'u-stk', name: 'stk', color: 'gray' }, { id: 'u-m', name: 'm', color: 'blue' }, { id: 'u-m2', name: 'm2', color: 'green' }, { id: 'u-m3', name: 'm3', color: 'purple' }, { id: 'u-l', name: 'L', color: 'yellow' }, { id: 'u-uur', name: 'uur', color: 'orange' }, { id: 'u-set', name: 'set', color: 'pink' }, { id: 'u-kg', name: 'kg', color: 'red' }] } },
            { id: 'prop-art-packaging', name: 'Packaging', type: 'select', config: { options: [{ id: 'opt-stk', name: 'stuk', color: 'gray' }, { id: 'opt-plaat', name: 'plaat', color: 'blue' }, { id: 'opt-rol', name: 'rol', color: 'yellow' }, { id: 'opt-doos', name: 'doos', color: 'orange' }] } },
            { id: 'prop-art-coverage', name: 'Dekking/pak', type: 'number' },
            { id: 'prop-art-pcs-pack', name: 'Stuks/pak', type: 'number' },
            { id: 'prop-art-min-order', name: 'Minimum Order', type: 'formula', config: { formulaExpression: 'prop("Eeh") === "u-m2" ? 5 : (prop("Packaging") === "opt-plaat" ? 2 : 1)' } },

            { id: 'prop-art-variants', name: 'Product Variants', type: 'variants' }
        ],
        pages: [
            {
                id: 'page-art-1', databaseId: 'db-articles', blocks: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), createdBy: 'system', lastEditedBy: 'system',
                properties: { 'title': 'Gyproc Platen 12mm', 'prop-art-desc': 'Standard gypsum board for interior walls.', 'prop-art-bruto': 12.50, 'prop-art-remise': 20, 'prop-art-margin': 65, 'prop-art-verkoop': 16.50, 'prop-art-unit': 'u-m2', 'prop-art-packaging': 'opt-plaat', 'prop-art-coverage': 3.12, 'prop-art-min-order': 3.12 }
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
        name: 'Pricebook (Bestek)',
        description: 'Standardized work posts with linked articles and labor — the pricebook for quotations.',
        icon: '📋',
        properties: [
            { id: 'title', name: 'Post Naam', type: 'text' },
            { id: 'prop-bst-nr', name: 'Post Nr', type: 'text' },
            { id: 'prop-bst-cat', name: 'Categorie', type: 'select', config: { options: [
                { id: 'opt-grondwerken', name: 'Grondwerken', color: 'gray' },
                { id: 'opt-ruwbouw', name: 'Ruwbouw', color: 'orange' },
                { id: 'opt-dakwerken', name: 'Dakwerken', color: 'red' },
                { id: 'opt-afwerking', name: 'Afwerking', color: 'blue' },
                { id: 'opt-elektriciteit', name: 'Elektriciteit', color: 'yellow' },
                { id: 'opt-sanitair', name: 'Sanitair', color: 'purple' },
                { id: 'opt-hvac', name: 'HVAC', color: 'green' },
                { id: 'opt-buitenaanleg', name: 'Buitenaanleg', color: 'pink' }
            ] } },
            { id: 'prop-bst-desc', name: 'Omschrijving', type: 'text' },
            { id: 'prop-bst-unit', name: 'Eenheid', type: 'select', config: { options: [
                { id: 'u-m2', name: 'm²', color: 'green' },
                { id: 'u-m3', name: 'm³', color: 'purple' },
                { id: 'u-m', name: 'm', color: 'blue' },
                { id: 'u-stk', name: 'stk', color: 'gray' },
                { id: 'u-uur', name: 'uur', color: 'orange' },
                { id: 'u-forfait', name: 'forfait', color: 'pink' }
            ] } },
            { id: 'prop-bst-articles', name: 'Artikelen', type: 'relation', config: { relationDatabaseId: 'db-articles' } },
            { id: 'prop-bst-labor-type', name: 'Arbeid Type', type: 'select', config: { options: [
                { id: 'opt-general', name: 'Algemeen (€35/u)', color: 'blue' },
                { id: 'opt-specialised', name: 'Gespecialiseerd (€45/u)', color: 'orange' }
            ] } },
            { id: 'prop-bst-labor-hours', name: 'Arbeidsuren/eenheid', type: 'number' },
            { id: 'prop-bst-total', name: 'Eenheidsprijs', type: 'formula', config: { formulaExpression: 'round2(sum(prop("Artikelen"), "Verkoopprijs") + prop("Arbeidsuren/eenheid") * (prop("Arbeid Type") === "opt-specialised" ? 45 : 35))' } }
        ],
        pages: [
            {
                id: 'page-bst-1', databaseId: 'db-bestek', blocks: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), createdBy: 'system', lastEditedBy: 'system',
                properties: {
                    'title': 'Gyproc plafond plaatsen',
                    'prop-bst-nr': 'AF-001',
                    'prop-bst-cat': 'opt-afwerking',
                    'prop-bst-desc': 'Gyproc plafond plaatsen incl. lattenstelsel, platen, voegen en afwerking. Per m².',
                    'prop-bst-unit': 'u-m2',
                    'prop-bst-articles': ['page-art-1', 'page-art-2'],
                    'prop-bst-labor-type': 'opt-general',
                    'prop-bst-labor-hours': 0.75
                }
            },
            {
                id: 'page-bst-2', databaseId: 'db-bestek', blocks: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), createdBy: 'system', lastEditedBy: 'system',
                properties: {
                    'title': 'Doucheput plaatsen',
                    'prop-bst-nr': 'SAN-001',
                    'prop-bst-cat': 'opt-sanitair',
                    'prop-bst-desc': 'Doucheput monteren en aansluiten op afvoer. Per stuk.',
                    'prop-bst-unit': 'u-stk',
                    'prop-bst-articles': ['page-art-drain-1'],
                    'prop-bst-labor-type': 'opt-specialised',
                    'prop-bst-labor-hours': 2.5
                }
            }
        ],
        activeFilters: [],
        views: [
            { id: 'view-bst-table', name: 'All Posts', type: 'table' },
            { id: 'view-bst-board', name: 'Per Categorie', type: 'board', config: { groupByPropertyId: 'prop-bst-cat' } }
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ownerId: 'system'
    },
    {
        id: 'db-documents',
        name: 'Business Documents',
        description: 'Secure vault for storing contracts, legal templates, insurance, and company disputes.',
        icon: '🗄️',
        properties: [
            { id: 'title', name: 'Document Title', type: 'text' },
            {
                id: 'prop-doc-category',
                name: 'Category',
                type: 'select',
                config: {
                    options: [
                        { id: 'opt-contract', name: 'Contracts', color: 'blue' },
                        { id: 'opt-dispute', name: 'Disputes & Legal', color: 'red' },
                        { id: 'opt-insurance', name: 'Insurance & Certs', color: 'green' },
                        { id: 'opt-support', name: 'General Support', color: 'gray' }
                    ]
                }
            },
            {
                id: 'prop-doc-status',
                name: 'Status',
                type: 'select',
                config: {
                    options: [
                        { id: 'opt-draft', name: 'Draft', color: 'gray' },
                        { id: 'opt-review', name: 'Under Review', color: 'orange' },
                        { id: 'opt-active', name: 'Active', color: 'green' },
                        { id: 'opt-expired', name: 'Expired', color: 'red' }
                    ]
                }
            },
            {
                id: 'prop-doc-project',
                name: 'Project',
                type: 'relation',
                config: { relationDatabaseId: 'db-1' }
            },
            {
                id: 'prop-doc-client',
                name: 'Client',
                type: 'relation',
                config: { relationDatabaseId: 'db-clients' }
            },
            {
                id: 'prop-doc-employee',
                name: 'Employee',
                type: 'relation',
                config: { relationDatabaseId: 'db-hr' }
            }
        ],
        pages: [],
        activeFilters: [],
        views: [{ id: 'view-doc-table', name: 'All Documents', type: 'table' }],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ownerId: 'system'
    }
];

