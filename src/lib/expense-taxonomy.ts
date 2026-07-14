export interface ExpenseCategory {
    id: string;
    name: string; // NL label
    nameEn: string;
    color: string;
}

export interface ExpenseCostType {
    id: string;
    categoryId: string;
    name: string; // NL label
    nameEn: string;
    vatDeductiblePct: 0 | 50 | 100;
    incomeTaxDeductiblePct: number; // Informative for export
    medecontractant: boolean; // True for construction subcontracting
    vatExempt: boolean; // True for insurance, banking
}

export const EXPENSE_CATEGORIES: ExpenseCategory[] = [
    { id: 'cat-1', name: 'Investeringen', nameEn: 'Investments', color: 'blue' },
    { id: 'cat-2', name: 'Onderaannemingen', nameEn: 'Subcontracting', color: 'orange' },
    { id: 'cat-3', name: '(Handels)goederen', nameEn: 'Trade goods / merchandise', color: 'emerald' },
    { id: 'cat-4', name: 'Huur', nameEn: 'Rent / lease', color: 'purple' },
    { id: 'cat-5', name: 'Rollend materieel', nameEn: 'Vehicles / rolling stock', color: 'red' },
    { id: 'cat-6', name: 'Algemene kosten', nameEn: 'General / overhead', color: 'gray' },
    { id: 'cat-7', name: 'Gebouwen / lokalen / kantoren', nameEn: 'Buildings / premises', color: 'stone' },
    { id: 'cat-8', name: 'Ereloon / commissies', nameEn: 'Professional fees', color: 'indigo' },
    { id: 'cat-9', name: 'Personeel / uitzendkrachten', nameEn: 'Personnel / temp labour', color: 'pink' },
    { id: 'cat-10', name: 'Opstartkosten', nameEn: 'Start-up costs', color: 'yellow' },
    { id: 'cat-11', name: 'Verzekeringen', nameEn: 'Insurance', color: 'teal' },
    { id: 'cat-12', name: 'Sociale bijdragen', nameEn: 'Social contributions', color: 'cyan' },
];

export const COST_TYPES: ExpenseCostType[] = [
    // 1. Investeringen
    { id: 'ct-1-1', categoryId: 'cat-1', name: 'Machines & groot gereedschap', nameEn: 'Machines & large tools', vatDeductiblePct: 100, incomeTaxDeductiblePct: 100, medecontractant: false, vatExempt: false },
    { id: 'ct-1-2', categoryId: 'cat-1', name: 'Klein materieel & handgereedschap', nameEn: 'Small equipment & hand tools', vatDeductiblePct: 100, incomeTaxDeductiblePct: 100, medecontractant: false, vatExempt: false },
    { id: 'ct-1-3', categoryId: 'cat-1', name: 'Steigers / bekisting / stellingen', nameEn: 'Scaffolding / formwork', vatDeductiblePct: 100, incomeTaxDeductiblePct: 100, medecontractant: false, vatExempt: false },
    { id: 'ct-1-4', categoryId: 'cat-1', name: 'IT-hardware', nameEn: 'IT hardware', vatDeductiblePct: 100, incomeTaxDeductiblePct: 100, medecontractant: false, vatExempt: false },
    { id: 'ct-1-5', categoryId: 'cat-1', name: 'Kantoormeubilair & inrichting', nameEn: 'Office furniture & fittings', vatDeductiblePct: 100, incomeTaxDeductiblePct: 100, medecontractant: false, vatExempt: false },
    { id: 'ct-1-6', categoryId: 'cat-1', name: 'Software & licenties', nameEn: 'Software & licenses', vatDeductiblePct: 100, incomeTaxDeductiblePct: 100, medecontractant: false, vatExempt: false },

    // 2. Onderaannemingen (Subcontracting)
    { id: 'ct-2-1', categoryId: 'cat-2', name: 'Onderaanneming ruwbouw', nameEn: 'Subcontracting structural works', vatDeductiblePct: 100, incomeTaxDeductiblePct: 100, medecontractant: true, vatExempt: false },
    { id: 'ct-2-2', categoryId: 'cat-2', name: 'Onderaanneming technieken', nameEn: 'Subcontracting technical works', vatDeductiblePct: 100, incomeTaxDeductiblePct: 100, medecontractant: true, vatExempt: false },
    { id: 'ct-2-3', categoryId: 'cat-2', name: 'Onderaanneming afwerking', nameEn: 'Subcontracting finishing works', vatDeductiblePct: 100, incomeTaxDeductiblePct: 100, medecontractant: true, vatExempt: false },
    { id: 'ct-2-4', categoryId: 'cat-2', name: 'Onderaanneming speciaal', nameEn: 'Subcontracting special works', vatDeductiblePct: 100, incomeTaxDeductiblePct: 100, medecontractant: true, vatExempt: false },

    // 3. (Handels)goederen / Bouwmaterialen
    { id: 'ct-3-1', categoryId: 'cat-3', name: 'Bouwmaterialen algemeen', nameEn: 'General building materials', vatDeductiblePct: 100, incomeTaxDeductiblePct: 100, medecontractant: false, vatExempt: false },
    { id: 'ct-3-2', categoryId: 'cat-3', name: 'Technische materialen', nameEn: 'Technical materials', vatDeductiblePct: 100, incomeTaxDeductiblePct: 100, medecontractant: false, vatExempt: false },
    { id: 'ct-3-3', categoryId: 'cat-3', name: 'Afwerkingsmaterialen', nameEn: 'Finishing materials', vatDeductiblePct: 100, incomeTaxDeductiblePct: 100, medecontractant: false, vatExempt: false },
    { id: 'ct-3-4', categoryId: 'cat-3', name: 'Sanitair & verwarming', nameEn: 'Sanitary & heating', vatDeductiblePct: 100, incomeTaxDeductiblePct: 100, medecontractant: false, vatExempt: false },
    { id: 'ct-3-5', categoryId: 'cat-3', name: 'Verbruiksgoederen werf', nameEn: 'Site consumables', vatDeductiblePct: 100, incomeTaxDeductiblePct: 100, medecontractant: false, vatExempt: false },
    { id: 'ct-3-6', categoryId: 'cat-3', name: 'Persoonlijke beschermingsmiddelen', nameEn: 'PPE (Personal Protective Equipment)', vatDeductiblePct: 100, incomeTaxDeductiblePct: 100, medecontractant: false, vatExempt: false },

    // 4. Huur
    { id: 'ct-4-1', categoryId: 'cat-4', name: 'Huur machines & materieel', nameEn: 'Equipment & machinery rental', vatDeductiblePct: 100, incomeTaxDeductiblePct: 100, medecontractant: false, vatExempt: false },
    { id: 'ct-4-2', categoryId: 'cat-4', name: 'Huur werfvoorzieningen', nameEn: 'Site facilities rental', vatDeductiblePct: 100, incomeTaxDeductiblePct: 100, medecontractant: false, vatExempt: false },
    { id: 'ct-4-3', categoryId: 'cat-4', name: 'Huur bedrijfspand / atelier / opslag', nameEn: 'Premises / workshop rental', vatDeductiblePct: 100, incomeTaxDeductiblePct: 100, medecontractant: false, vatExempt: false },
    { id: 'ct-4-4', categoryId: 'cat-4', name: 'Operationele leasing', nameEn: 'Operational leasing', vatDeductiblePct: 100, incomeTaxDeductiblePct: 100, medecontractant: false, vatExempt: false },

    // 5. Rollend materieel
    { id: 'ct-5-1', categoryId: 'cat-5', name: 'Aankoop/leasing bedrijfswagen', nameEn: 'Purchase/lease company car', vatDeductiblePct: 50, incomeTaxDeductiblePct: 100, medecontractant: false, vatExempt: false },
    { id: 'ct-5-2', categoryId: 'cat-5', name: 'Aankoop/leasing lichte vracht', nameEn: 'Purchase/lease light truck', vatDeductiblePct: 100, incomeTaxDeductiblePct: 100, medecontractant: false, vatExempt: false },
    { id: 'ct-5-3', categoryId: 'cat-5', name: 'Brandstof', nameEn: 'Fuel', vatDeductiblePct: 100, incomeTaxDeductiblePct: 100, medecontractant: false, vatExempt: false }, // Mixed deduction, defaulting to 100 for lichte vracht
    { id: 'ct-5-4', categoryId: 'cat-5', name: 'Onderhoud & herstelling voertuigen', nameEn: 'Vehicle maintenance & repair', vatDeductiblePct: 100, incomeTaxDeductiblePct: 100, medecontractant: false, vatExempt: false },
    { id: 'ct-5-5', categoryId: 'cat-5', name: 'Verzekering voertuigen', nameEn: 'Vehicle insurance', vatDeductiblePct: 0, incomeTaxDeductiblePct: 100, medecontractant: false, vatExempt: true },
    { id: 'ct-5-6', categoryId: 'cat-5', name: 'Verkeersbelasting', nameEn: 'Road tax', vatDeductiblePct: 0, incomeTaxDeductiblePct: 100, medecontractant: false, vatExempt: true },
    { id: 'ct-5-7', categoryId: 'cat-5', name: 'Parking/tol', nameEn: 'Parking/tolls', vatDeductiblePct: 100, incomeTaxDeductiblePct: 100, medecontractant: false, vatExempt: false },

    // 6. Algemene kosten
    { id: 'ct-6-1', categoryId: 'cat-6', name: 'Kantoorbenodigdheden', nameEn: 'Office supplies', vatDeductiblePct: 100, incomeTaxDeductiblePct: 100, medecontractant: false, vatExempt: false },
    { id: 'ct-6-2', categoryId: 'cat-6', name: 'Telefonie & internet', nameEn: 'Telephony & internet', vatDeductiblePct: 100, incomeTaxDeductiblePct: 100, medecontractant: false, vatExempt: false },
    { id: 'ct-6-3', categoryId: 'cat-6', name: 'Post & verzending', nameEn: 'Post & shipping', vatDeductiblePct: 100, incomeTaxDeductiblePct: 100, medecontractant: false, vatExempt: false },
    { id: 'ct-6-4', categoryId: 'cat-6', name: 'Bankkosten', nameEn: 'Bank charges', vatDeductiblePct: 0, incomeTaxDeductiblePct: 100, medecontractant: false, vatExempt: true },
    { id: 'ct-6-5', categoryId: 'cat-6', name: 'Abonnementen & lidgelden', nameEn: 'Subscriptions & memberships', vatDeductiblePct: 100, incomeTaxDeductiblePct: 100, medecontractant: false, vatExempt: false },
    { id: 'ct-6-6', categoryId: 'cat-6', name: 'Drukwerk & marketing', nameEn: 'Printing & marketing', vatDeductiblePct: 100, incomeTaxDeductiblePct: 100, medecontractant: false, vatExempt: false },
    { id: 'ct-6-7', categoryId: 'cat-6', name: 'Werkkledij', nameEn: 'Workwear', vatDeductiblePct: 100, incomeTaxDeductiblePct: 100, medecontractant: false, vatExempt: false },
    { id: 'ct-6-8', categoryId: 'cat-6', name: 'Restaurant & maaltijden', nameEn: 'Restaurant & meals', vatDeductiblePct: 0, incomeTaxDeductiblePct: 69, medecontractant: false, vatExempt: false },
    { id: 'ct-6-9', categoryId: 'cat-6', name: 'Receptie- & relatiegeschenken', nameEn: 'Gifts', vatDeductiblePct: 0, incomeTaxDeductiblePct: 50, medecontractant: false, vatExempt: false },
    { id: 'ct-6-10', categoryId: 'cat-6', name: 'Onthaalkosten', nameEn: 'Reception costs', vatDeductiblePct: 0, incomeTaxDeductiblePct: 50, medecontractant: false, vatExempt: false },

    // 7. Gebouwen / lokalen / kantoren
    { id: 'ct-7-1', categoryId: 'cat-7', name: 'Nutsvoorzieningen', nameEn: 'Utilities', vatDeductiblePct: 100, incomeTaxDeductiblePct: 100, medecontractant: false, vatExempt: false },
    { id: 'ct-7-2', categoryId: 'cat-7', name: 'Onderhoud & schoonmaak gebouw', nameEn: 'Building maintenance & cleaning', vatDeductiblePct: 100, incomeTaxDeductiblePct: 100, medecontractant: false, vatExempt: false },
    { id: 'ct-7-3', categoryId: 'cat-7', name: 'Herstellingen & klein onderhoud pand', nameEn: 'Repairs & minor maintenance', vatDeductiblePct: 100, incomeTaxDeductiblePct: 100, medecontractant: false, vatExempt: false },
    { id: 'ct-7-4', categoryId: 'cat-7', name: 'Onroerende voorheffing', nameEn: 'Property tax', vatDeductiblePct: 0, incomeTaxDeductiblePct: 100, medecontractant: false, vatExempt: true },
    { id: 'ct-7-5', categoryId: 'cat-7', name: 'Alarm / bewaking', nameEn: 'Alarm / security', vatDeductiblePct: 100, incomeTaxDeductiblePct: 100, medecontractant: false, vatExempt: false },

    // 8. Ereloon / commissies
    { id: 'ct-8-1', categoryId: 'cat-8', name: 'Boekhouder / accountant', nameEn: 'Accountant', vatDeductiblePct: 100, incomeTaxDeductiblePct: 100, medecontractant: false, vatExempt: false },
    { id: 'ct-8-2', categoryId: 'cat-8', name: 'Advocaat / notaris', nameEn: 'Lawyer / notary', vatDeductiblePct: 100, incomeTaxDeductiblePct: 100, medecontractant: false, vatExempt: false },
    { id: 'ct-8-3', categoryId: 'cat-8', name: 'Architect / ingenieur / veiligheid', nameEn: 'Architect / engineer / safety', vatDeductiblePct: 100, incomeTaxDeductiblePct: 100, medecontractant: false, vatExempt: false },
    { id: 'ct-8-4', categoryId: 'cat-8', name: 'Consultancy & advies', nameEn: 'Consultancy & advice', vatDeductiblePct: 100, incomeTaxDeductiblePct: 100, medecontractant: false, vatExempt: false },
    { id: 'ct-8-5', categoryId: 'cat-8', name: 'Commissies / makelaarsloon', nameEn: 'Commissions / brokerage', vatDeductiblePct: 100, incomeTaxDeductiblePct: 100, medecontractant: false, vatExempt: false },

    // 9. Personeel / uitzendkrachten
    { id: 'ct-9-1', categoryId: 'cat-9', name: 'Uitzendkrachten / interim', nameEn: 'Temp agency labour', vatDeductiblePct: 100, incomeTaxDeductiblePct: 100, medecontractant: false, vatExempt: false },
    { id: 'ct-9-2', categoryId: 'cat-9', name: 'Lonen & wedden', nameEn: 'Wages & salaries', vatDeductiblePct: 0, incomeTaxDeductiblePct: 100, medecontractant: false, vatExempt: true },
    { id: 'ct-9-3', categoryId: 'cat-9', name: 'Vorming & opleiding', nameEn: 'Training & education', vatDeductiblePct: 100, incomeTaxDeductiblePct: 100, medecontractant: false, vatExempt: false },
    { id: 'ct-9-4', categoryId: 'cat-9', name: 'Arbeidsgeneeskunde', nameEn: 'Occupational health', vatDeductiblePct: 100, incomeTaxDeductiblePct: 100, medecontractant: false, vatExempt: false },
    { id: 'ct-9-5', categoryId: 'cat-9', name: 'Reis- & verblijfkosten personeel', nameEn: 'Travel & accommodation staff', vatDeductiblePct: 100, incomeTaxDeductiblePct: 100, medecontractant: false, vatExempt: false },

    // 10. Opstartkosten
    { id: 'ct-10-1', categoryId: 'cat-10', name: 'Oprichtingskosten', nameEn: 'Incorporation costs', vatDeductiblePct: 100, incomeTaxDeductiblePct: 100, medecontractant: false, vatExempt: false },
    { id: 'ct-10-2', categoryId: 'cat-10', name: 'KBO / publicatiekosten Staatsblad', nameEn: 'KBO / publication costs', vatDeductiblePct: 0, incomeTaxDeductiblePct: 100, medecontractant: false, vatExempt: true },
    { id: 'ct-10-3', categoryId: 'cat-10', name: 'Eerste inrichting / materiaal', nameEn: 'Initial setup / material', vatDeductiblePct: 100, incomeTaxDeductiblePct: 100, medecontractant: false, vatExempt: false },

    // 11. Verzekeringen
    { id: 'ct-11-1', categoryId: 'cat-11', name: 'BA uitbating & BA na levering', nameEn: 'General liability', vatDeductiblePct: 0, incomeTaxDeductiblePct: 100, medecontractant: false, vatExempt: true },
    { id: 'ct-11-2', categoryId: 'cat-11', name: 'Tienjarige aansprakelijkheid', nameEn: 'Decennial liability', vatDeductiblePct: 0, incomeTaxDeductiblePct: 100, medecontractant: false, vatExempt: true },
    { id: 'ct-11-3', categoryId: 'cat-11', name: 'ABR / alle bouwplaatsrisico\'s', nameEn: 'All-site-risk', vatDeductiblePct: 0, incomeTaxDeductiblePct: 100, medecontractant: false, vatExempt: true },
    { id: 'ct-11-4', categoryId: 'cat-11', name: 'Arbeidsongevallen', nameEn: 'Workplace accidents', vatDeductiblePct: 0, incomeTaxDeductiblePct: 100, medecontractant: false, vatExempt: true },
    { id: 'ct-11-5', categoryId: 'cat-11', name: 'Materieel- / machineverzekering', nameEn: 'Equipment / machinery insurance', vatDeductiblePct: 0, incomeTaxDeductiblePct: 100, medecontractant: false, vatExempt: true },

    // 12. Sociale bijdragen
    { id: 'ct-12-1', categoryId: 'cat-12', name: 'Sociale bijdragen zelfstandige', nameEn: 'Self-employed social contributions', vatDeductiblePct: 0, incomeTaxDeductiblePct: 100, medecontractant: false, vatExempt: true },
    { id: 'ct-12-2', categoryId: 'cat-12', name: 'RSZ / ONSS werkgeversbijdragen', nameEn: 'Employer social security', vatDeductiblePct: 0, incomeTaxDeductiblePct: 100, medecontractant: false, vatExempt: true },
    { id: 'ct-12-3', categoryId: 'cat-12', name: 'Sociaal verzekeringsfonds', nameEn: 'Social insurance fund', vatDeductiblePct: 0, incomeTaxDeductiblePct: 100, medecontractant: false, vatExempt: true },
    { id: 'ct-12-4', categoryId: 'cat-12', name: 'Aanvullend pensioen / VAPZ', nameEn: 'Supplementary pension', vatDeductiblePct: 0, incomeTaxDeductiblePct: 100, medecontractant: false, vatExempt: true },
];
