import { Database, Property, Page } from './types';
import { v4 as uuidv4 } from 'uuid';

export const mockProperties: Property[] = [
    { id: 'title', name: 'Name', type: 'text' },
    {
        id: 'prop-status',
        name: 'Status',
        type: 'select',
        config: {
            options: [
                { id: 'opt-1', name: 'To Do', color: 'gray' },
                { id: 'opt-2', name: 'In Progress', color: 'blue' },
                { id: 'opt-3', name: 'Done', color: 'green' }
            ]
        }
    },
    { id: 'prop-assignee', name: 'Assignee', type: 'person' },
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
            'prop-status': 'opt-2',
            'prop-assignee': ['user-1'],
            'prop-due-date': '2026-03-15',
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
            'prop-status': 'opt-1',
            'prop-assignee': ['user-2'],
            'prop-due-date': '2026-03-20',
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
        id: 'page-client-1',
        databaseId: 'db-clients',
        properties: {
            'title': 'John Doe Architecture',
            'prop-client-email': 'john@doe-arch.com',
            'prop-client-phone': '+32 470 12 34 56'
        },
        blocks: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: 'system',
        lastEditedBy: 'system'
    },
    {
        id: 'page-client-2',
        databaseId: 'db-clients',
        properties: {
            'title': 'Emma Smith Interiors',
            'prop-client-email': 'emma@smith-interiors.be',
            'prop-client-phone': '+32 471 23 45 67'
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
            { id: 'view-2', name: 'Status Board', type: 'board', config: { groupByPropertyId: 'prop-status' } },
            { id: 'view-3', name: 'Project Calendar', type: 'calendar', config: { datePropertyId: 'prop-due-date' } }
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ownerId: 'user-1'
    },
    {
        id: 'db-clients',
        name: 'Clients Database',
        description: 'Master list of all clients.',
        icon: '👥',
        properties: [
            { id: 'title', name: 'Name', type: 'text' },
            { id: 'prop-client-email', name: 'Email', type: 'email' },
            { id: 'prop-client-phone', name: 'Phone', type: 'phone' }
        ],
        pages: mockClientPages,
        activeFilters: [],
        views: [
            { id: 'view-client-table', name: 'All Clients', type: 'table' }
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
        description: 'Manage sales leads and customer relationships.',
        icon: '🎯',
        properties: [
            { id: 'title', name: 'Lead Name', type: 'text' },
            { id: 'prop-crm-status', name: 'Status', type: 'select', config: { options: [{ id: 'opt-new', name: 'New', color: 'blue' }, { id: 'opt-contacted', name: 'Contacted', color: 'yellow' }, { id: 'opt-won', name: 'Won', color: 'green' }] } },
            { id: 'prop-crm-value', name: 'Estimated Value', type: 'number', config: { format: 'euro' } }
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
        description: 'Manage specialized leads and requests from Bobex.',
        icon: '🔗',
        properties: [
            { id: 'title', name: 'Bobex Client & Request', type: 'text' },
            { id: 'prop-bobex-status', name: 'Status', type: 'select', config: { options: [{ id: 'opt-b-new', name: 'New Request', color: 'blue' }, { id: 'opt-b-contacted', name: 'Contacted', color: 'yellow' }, { id: 'opt-b-won', name: 'Won', color: 'green' }, { id: 'opt-b-lost', name: 'Lost / Expired', color: 'red' }] } },
            { id: 'prop-bobex-value', name: 'Quoted Value', type: 'number', config: { format: 'euro' } }
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
            { id: 'prop-quote-status', name: 'Status', type: 'select', config: { options: [{ id: 'opt-draft', name: 'Draft', color: 'gray' }, { id: 'opt-sent', name: 'Sent', color: 'blue' }, { id: 'opt-accepted', name: 'Accepted', color: 'green' }] } },
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
            { id: 'prop-task-due', name: 'Due Date', type: 'date' }
        ],
        pages: [],
        activeFilters: [],
        views: [{ id: 'view-task-table', name: 'Active Tasks', type: 'table' }],
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
        description: 'Knowledge base and blog post content management.',
        icon: '📚',
        properties: [
            { id: 'title', name: 'Article Title', type: 'text' },
            { id: 'prop-art-status', name: 'Status', type: 'select', config: { options: [{ id: 'opt-draft', name: 'Draft', color: 'yellow' }, { id: 'opt-published', name: 'Published', color: 'green' }] } },
            { id: 'prop-art-author', name: 'Author', type: 'text' }
        ],
        pages: [
            {
                id: 'page-art-1', databaseId: 'db-articles', blocks: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), createdBy: 'system', lastEditedBy: 'system',
                properties: { 'title': 'The Future of Luxury Kitchens in 2026', 'prop-art-status': 'opt-published', 'prop-art-author': 'Design Team' }
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
            { id: 'title', name: 'Specification Title', type: 'text' },
            { id: 'prop-bst-code', name: 'Code Reference', type: 'text' },
            { id: 'prop-bst-category', name: 'Category', type: 'select', config: { options: [{ id: 'opt-elec', name: 'Electrical', color: 'yellow' }, { id: 'opt-plumb', name: 'Plumbing', color: 'blue' }] } }
        ],
        pages: [],
        activeFilters: [],
        views: [{ id: 'view-bst-table', name: 'All Specs', type: 'table' }],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ownerId: 'system'
    }
];
