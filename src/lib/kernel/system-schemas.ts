/**
 * KERN-SCHEMA-1 · the canonical fields of every system database — ONE definition, read by the server
 * (provisioning + reconcile: lib/data/system-schema-reconcile.ts) and the browser (DatabaseClone).
 *
 * Found 2026-10-03 (Florin): this map lived INSIDE a screen component and reached a tenant's database
 * only when someone opened that screen — `Murgu, Catalin` had 0 fields on 10 system databases; Coral
 * had older field definitions than the code. Moved here verbatim (field ids, names, types, configs
 * unchanged); `resolveDbId` turns a base id ('db-clients') into the tenant's real database id for
 * relation targets.
 *
 * Keys are the legacy base ids ('db-articles', …) — SYSTEM_DATABASES[role].legacyBase.
 */
import { EXPENSE_CATEGORIES, COST_TYPES } from './expense-taxonomy';

const EXPENSE_CATEGORY_OPTIONS = EXPENSE_CATEGORIES.map(c => ({ id: c.id, name: c.name, color: c.color }));
const COST_TYPE_OPTIONS = COST_TYPES.map(c => ({ id: c.id, name: c.name, color: 'gray' }));

/** The kernel's own shape of a database field (L0 may not import screen types — PRE-1). Structurally a
 *  subset of the screens' `Property`, so the screens can use these as their properties. */
export interface KernelProperty {
  id: string;
  name: string;
  type: string;
  config?: Record<string, unknown>;
}

/**
 * COMMENTS-1 (Florin 2026-10-05: "universally available, part of the db schema") · fields EVERY database carries —
 * system and custom — appended by the server reconcile, never deletable. Hidden in a view until the view shows it.
 */
/**
 * VALIDATE-1 · where a purchase document came from and how far its validation is (lib/records/validation) — ONE
 * definition for purchase invoices AND tickets (a scan of either waits in "Te valideren" until approved).
 */
export const SCAN_REVIEW_FIELDS: KernelProperty[] = [
  { id: 'source',      name: 'Bron', type: 'select', config: { options: [
    { id: 'src-peppol', name: 'Peppol',       color: 'blue'   },
    { id: 'src-manual', name: 'Manueel',      color: 'gray'   },
    { id: 'src-pdf',    name: 'PDF Import',   color: 'purple' },
    { id: 'src-scan',   name: 'Scan / OCR',   color: 'pink'   },
    { id: 'src-email',  name: 'Email',        color: 'orange' },
  ]}},
  { id: 'reviewStatus', name: 'Review Status', type: 'select', config: { options: [
    { id: 'In verwerking', name: 'In verwerking', color: 'blue'   },
    { id: 'In wachtrij',   name: 'In wachtrij',   color: 'gray'   },
    { id: 'Na te kijken',  name: 'Na te kijken',  color: 'orange' },
    { id: 'Klaar',         name: 'Klaar',         color: 'green'  },
    { id: 'Goedgekeurd',   name: 'Goedgekeurd',   color: 'purple' },
    { id: 'Mislukt',       name: 'Mislukt',       color: 'red'    },
  ]}},
  { id: 'reviewReason', name: 'Review Reden', type: 'text' },
];

export const UNIVERSAL_FIELDS: KernelProperty[] = [
  { id: 'comments', name: 'Opmerkingen', type: 'comments' },
];

export function canonicalSchemas(resolveDbId: (base: string) => string): Record<string, KernelProperty[]> {
  const schemas: Record<string, KernelProperty[]> = ({
  'db-site-visits': [
    { id: 'title',        name: 'Titel',            type: 'text' },
    { id: 'client',       name: 'Klant',            type: 'relation', config: { relationDatabaseId: resolveDbId('db-clients'), relationDisplayPropertyId: 'title' } },
    { id: 'contact',      name: 'Contactpersoon',   type: 'text' },
    { id: 'scope',        name: 'Werf Scope',       type: 'text' },
    { id: 'location',     name: 'Projectlocatie',   type: 'location' },
    { id: 'notes',        name: 'Notities',         type: 'text' },
    { id: 'photos',       name: 'Foto\'s',          type: 'text' },
  ],
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
    { id: 'location',    name: 'Projectlocatie',    type: 'location' },
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
    // PROFORMA-1: the proforma this invoice was made from (two documents; the proforma stays as the client received it)
    { id: 'proforma',    name: 'Proforma',          type: 'relation', config: { relationDatabaseId: resolveDbId('db-invoices'), relationDisplayPropertyId: 'title' } },
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
    { id: 'prop-payment-method', name: 'Betalingsvoorwaarden', type: 'select', config: { options: [
      { id: 'pay-0',  name: 'Onmiddellijk', color: 'green'  },
      { id: 'pay-8',  name: '8 Dagen',      color: 'purple' },
      { id: 'pay-14', name: '14 Dagen',     color: 'blue'   },
      { id: 'pay-30', name: '30 Dagen',     color: 'orange' },
      { id: 'pay-60', name: '60 Dagen',     color: 'red'    },
      { id: 'pay-90', name: '90 Dagen',     color: 'gray'   },
    ]}},
  ],
  'db-expenses': [
    { id: 'title',       name: 'Factuur #',         type: 'text' },
    { id: 'supplier',    name: 'Leverancier',       type: 'relation', config: { relationDatabaseId: resolveDbId('db-suppliers'), relationDisplayPropertyId: 'title' } },
    { id: 'docType',     name: 'Document Type',     type: 'select', config: { options: [
      { id: 'opt-invoice', name: 'Factuur', color: 'blue' },
      { id: 'opt-credit-note', name: 'Creditnota', color: 'purple' },
    ]}},
    { id: 'betreft',     name: 'Omschrijving',      type: 'text' },
    ...SCAN_REVIEW_FIELDS,
    { id: 'ocrConfidence', name: 'OCR Betrouwbaarheid', type: 'percent' },
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
    { id: 'structuredCommunication', name: 'Gestructureerde Mededeling', type: 'text' },
    { id: 'supplierIban', name: 'IBAN', type: 'text' },
    { id: 'supplierBic',  name: 'BIC', type: 'text' },
    { id: 'reverseCharge', name: 'Btw Verlegd / Medecontractant', type: 'checkbox' },
    { id: 'vatBreakdown', name: 'BTW Uitsplitsing', type: 'text' },
    { id: 'supplierAddress', name: 'Adres Leverancier', type: 'text' },
    { id: 'peppolDocId', name: 'Peppol Doc ID',     type: 'text'     },
    { id: 'receiptUrl',  name: 'Origineel Document', type: 'url'     },
    { id: 'accountantExportedAt', name: 'Verzonden naar boekhouder', type: 'checkbox' },
    { id: 'deliveryDate', name: 'Leveringsdatum',    type: 'date'     },
    { id: 'ourRef',       name: 'Onze Referentie',   type: 'text'     },
    { id: 'currency',     name: 'Munteenheid', type: 'select', config: { options: [
      { id: 'cur-eur', name: 'EUR', color: 'green' },
      { id: 'cur-usd', name: 'USD', color: 'blue'  },
      { id: 'cur-gbp', name: 'GBP', color: 'gray'  },
    ]}},
    { id: 'vatRegime',    name: 'BTW-regime', type: 'select', config: { options: [
      { id: 'reg-domestic', name: 'Binnenland',      color: 'blue'   },
      { id: 'reg-reverse',  name: 'Medecontractant', color: 'orange' },
      { id: 'reg-intracom', name: 'Intracommunautair', color: 'purple' },
    ]}},
    // EDIT-1: built from the kernel taxonomy — the ONE list the editor, the grid and the export read
    { id: 'category',     name: 'Categorie', type: 'select', config: { options: EXPENSE_CATEGORY_OPTIONS } },
    { id: 'costType',     name: 'Kostensoort', type: 'select', config: { options: COST_TYPE_OPTIONS } },
    { id: 'ledgerAccount', name: 'Grootboekrekening', type: 'text'     },
    { id: 'notes',         name: 'Opmerkingen (intern)', type: 'text'  },
    { id: 'paidDate',      name: 'Betaaldatum',      type: 'date'     },
    { id: 'paymentMethod', name: 'Betaalwijze', type: 'select', config: { options: [
      { id: 'pay-transfer', name: 'Overschrijving/SEPA', color: 'blue'   },
      { id: 'pay-card',     name: 'Kaart',               color: 'purple' },
      { id: 'pay-cash',     name: 'Cash',                color: 'gray'   },
      { id: 'pay-domicile', name: 'Domiciliëring',        color: 'orange' },
    ]}},
  ],
  'db-tickets': [
    { id: 'title',         name: 'Handelaar / Beschrijving', type: 'text' },
    { id: 'date',          name: 'Datum',                    type: 'date'     },
    { id: 'amount',        name: 'Totaal bedrag',            type: 'currency' },
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
    { id: 'vatDeductiblePct', name: 'BTW Aftrekbaarheid (%)', type: 'number' },
    { id: 'accountantExportedAt', name: 'Verzonden naar boekhouder', type: 'checkbox' },
    ...SCAN_REVIEW_FIELDS,
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
    { id: 'location',          name: 'Location',          type: 'location' },
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
    { id: 'prop-location',      name: 'Location',          type: 'location' },
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
    { id: 'prop-task-due',          name: 'Due Date',      type: 'date' },
    { id: 'prop-task-defer',        name: 'Defer Until',   type: 'date' },
    { id: 'prop-task-flagged',      name: 'Flagged',       type: 'checkbox' },
    { id: 'prop-task-my-day',       name: 'My Day',        type: 'checkbox' },
    { id: 'prop-task-priority',     name: 'Priority',      type: 'select', config: { options: [
      { id: 'opt-p1', name: 'Urgent', color: 'red' },
      { id: 'opt-p2', name: 'High',   color: 'orange' },
      { id: 'opt-p3', name: 'Medium', color: 'yellow' },
      { id: 'opt-p4', name: 'Low',    color: 'gray' },
    ]}},
    { id: 'prop-task-notes',        name: 'Notes',         type: 'text' },
    { id: 'prop-task-completed-at', name: 'Completed At',  type: 'date' },
    { id: 'prop-task-parent',       name: 'Hoofdtaak',     type: 'relation', config: { relationDatabaseId: resolveDbId('db-tasks'), relationDisplayPropertyId: 'title' } },
    { id: 'prop-task-attachments',  name: 'Bijlagen',      type: 'text' },
    { id: 'prop-task-recurrence',   name: 'Herhaling',     type: 'text' },
    { id: 'prop-task-reminder',     name: 'Herinnering',   type: 'select', config: { options: [
      { id: 'opt-rem-none',        name: 'Geen',               color: 'gray'   },
      { id: 'opt-rem-morning',     name: 'Ochtend vervaldatum',color: 'blue'   },
      { id: 'opt-rem-day-before',  name: '1 dag vooraf',       color: 'orange' },
    ]}},
    { id: 'prop-task-recurrence-anchor', name: 'Herhaling basis', type: 'select', config: { options: [
      { id: 'opt-anchor-due',        name: 'Vanaf vervaldatum', color: 'blue' },
      { id: 'opt-anchor-completion', name: 'Vanaf voltooiing',  color: 'green' },
    ]}},
  ],
  // From the seed (mockData.ts 'db-bestek') — it had no canonical definition in the screen (KERN-SCHEMA-1).
  'db-bestek': [
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
    { id: 'prop-bst-articles', name: 'Artikelen', type: 'relation', config: { relationDatabaseId: resolveDbId('db-articles') } },
    { id: 'prop-bst-labor-type', name: 'Arbeid Type', type: 'select', config: { options: [
        { id: 'opt-general', name: 'Algemeen (€35/u)', color: 'blue' },
        { id: 'opt-specialised', name: 'Gespecialiseerd (€45/u)', color: 'orange' }
    ] } },
    { id: 'prop-bst-labor-hours', name: 'Arbeidsuren/eenheid', type: 'number' },
    { id: 'prop-bst-total', name: 'Eenheidsprijs', type: 'formula', config: { formulaExpression: 'round2(sum(prop("Artikelen"), "Verkoopprijs") + prop("Arbeidsuren/eenheid") * (prop("Arbeid Type") === "opt-specialised" ? 45 : 35))' } }
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
    { id: 'prop-art-netto',     name: 'NettoKost',         type: 'formula', config: { formulaExpression: 'round(if(empty(Discount), BruttoKost, BruttoKost * (1 - Discount / 100)), 2)' } },
    { id: 'prop-art-margin',    name: 'Marge Standard',    type: 'percent' },
    { id: 'prop-art-margin-euro', name: 'Marge€',          type: 'formula', config: { formulaExpression: 'if(empty(Marge Standard), 0, NettoKost * Marge Standard / 100)' } },
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
});
  for (const k of Object.keys(schemas)) {
    schemas[k] = [...schemas[k], ...UNIVERSAL_FIELDS.filter(u => !schemas[k].some(p => p.id === u.id))];
  }
  return schemas;
}

/**
 * The canonical field ids of a system database, by its legacy base ('db-crm') — the fields a tenant can never
 * delete or retype (DB-DEF-1: the server door and the schema page read the same list; the page used to guess
 * them from the id's shape, which failed for the databases whose canonical ids are UUIDs, e.g. CRM).
 */
export function canonicalFieldIds(legacyBase: string | null | undefined): Set<string> {
    const universal = UNIVERSAL_FIELDS.map(p => p.id);
    if (!legacyBase) return new Set(universal);
    return new Set([...(canonicalSchemas(b => b)[legacyBase] || []).map(p => p.id), ...universal]);
}
