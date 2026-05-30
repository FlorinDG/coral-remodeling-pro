const fs = require('fs');

function replaceFile(path, isServer, replacements) {
    if (!fs.existsSync(path)) return;
    let content = fs.readFileSync(path, 'utf8');
    
    // Add import if missing
    if (isServer) {
        if (!content.includes('getTranslations')) {
            content = content.replace(/(import .* from ['"]lucide-react['"];)/, "$1\nimport { getTranslations } from 'next-intl/server';");
        }
        if (!content.includes('const t = await getTranslations')) {
            content = content.replace(/(const { locale } = await params;)/, "$1\n    const t = await getTranslations('Mobile');");
        }
    } else {
        if (!content.includes('useTranslations')) {
            content = content.replace(/(import .* from ['"]lucide-react['"];)/, "$1\nimport { useTranslations } from 'next-intl';");
        }
        if (!content.includes('const t = useTranslations')) {
            content = content.replace(/(export default function .* {)/, "$1\n    const t = useTranslations('Mobile');");
        }
    }

    for (const [search, replace] of Object.entries(replacements)) {
        content = content.split(search).join(replace);
    }

    fs.writeFileSync(path, content);
    console.log(`Updated ${path}`);
}

replaceFile('src/app/[locale]/m/invoices/page.tsx', true, {
    'Sales Invoices': "{t('inv_title')}",
    'New\n': "{t('inv_new')}\n",
    'No invoices yet': "{t('inv_empty_title')}",
    'Create your first invoice to get started.': "{t('inv_empty_desc')}",
    'Create Invoice': "{t('dash_create_invoice')}"
});

replaceFile('src/app/[locale]/m/invoices/new/page.tsx', false, {
    'Back\n': "{t('inv_form_back')}\n",
    'New Invoice': "{t('inv_form_new')}",
    'Create\n': "{t('inv_form_create')}\n",
    'Client</label>': "{t('inv_form_client')}</label>",
    '"Search or select client..."': "t('inv_form_search_client')",
    'Invoice Date</label>': "{t('inv_form_date')}</label>",
    'Due Date</label>': "{t('inv_form_due')}</label>",
    'Line Items</label>': "{t('inv_form_lines')}</label>",
    '"Description"': "t('inv_form_desc')",
    'Qty</label>': "{t('inv_form_qty')}</label>",
    'Unit €</label>': "{t('inv_form_unit')}</label>",
    'VAT %</label>': "{t('inv_form_vat')}</label>",
    'Add Line\n': "{t('inv_form_add_line')}\n",
    '>Subtotal<': ">{t('inv_form_subtotal')}<",
    '>VAT<': ">{t('inv_form_vat_total')}<",
    '>Total<': ">{t('inv_form_total')}<"
});

replaceFile('src/app/[locale]/m/expenses/page.tsx', false, {
    'Expenses</h1>': "{t('exp_title')}</h1>",
    'Tickets & Receipts</p>': "{t('exp_subtitle')}</p>",
    'OCR Scans</span>': "{t('exp_ocr_scans')}</span>",
    'used</span>': "{t('exp_used')}</span>",
    'No expenses yet</p>': "{t('exp_empty_title')}</p>",
    'Tap the camera icon below to scan a receipt.</p>': "{t('exp_empty_desc')}</p>"
});

replaceFile('src/app/[locale]/m/purchases/page.tsx', true, {
    'Purchase Invoices</h1>': "{t('pur_title')}</h1>",
    '>Inbox</p>': ">{t('pur_subtitle')}</p>",
    'Peppol Inbox is Active</p>': "{t('pur_peppol_active')}</p>",
    'Invoices sent to your company number arrive here automatically. \n                        Your {planType} plan includes {limit} received invoices per month.': "{t('pur_peppol_desc', { plan: planType, limit })}",
    'No purchases yet</p>': "{t('pur_empty_title')}</p>",
    'When suppliers send you Peppol e-invoices, they will appear here.': "{t('pur_empty_desc')}",
    ">Paid<": ">{t('pur_paid')}<",
    ">To Pay<": ">{t('pur_to_pay')}<"
});

replaceFile('src/app/[locale]/m/clients/page.tsx', false, {
    'Clients</h1>': "{t('cli_title')}</h1>",
    '>Directory</p>': ">{t('cli_subtitle')}</p>",
    '"Search clients..."': "t('cli_search')",
    "{searchQuery ? 'No clients found' : 'No clients yet'}": "{searchQuery ? t('cli_empty_search') : t('cli_empty_title')}",
    "{searchQuery ? 'Try a different search term.' : 'Add your first client to start creating invoices.'}": "{searchQuery ? t('cli_empty_search_desc') : t('cli_empty_desc')}",
    'Call\n': "{t('cli_call')}\n",
    'Email\n': "{t('cli_email')}\n"
});

let adminLayout = fs.readFileSync('src/components/AdminLayout.tsx', 'utf8');
if (adminLayout.includes('Try our new mobile-optimized view!')) {
    adminLayout = adminLayout.replace('Try our new mobile-optimized view!', "{t('banner_try_mobile')}");
    adminLayout = adminLayout.replace('Open Mobile App', "{t('banner_open_app')}");
    
    // Check if `const t = useTranslations('Admin');` exists, we'll just use that 'Admin' translation since it's already there
    // Actually, I put the banner strings in Mobile. Let's just add it to Admin as well to avoid breaking the existing `t` usage in AdminLayout.
    fs.writeFileSync('src/components/AdminLayout.tsx', adminLayout);
}

