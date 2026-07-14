# CoralOS — Expense Types (Belgian construction/remodeling SME)

**Purpose:** replace the current 5–6 hardcoded expense types with a proper, Belgium-grounded list for purchase-invoice / cost categorization.
**Sources:** Billit's official Belgian expense-category taxonomy (12 main categories) + Belgian PCMN class-6 (charges) conventions + construction-sector granularity. Billit article: https://www.billit.eu/nl-be/helpartikelen/snelle-invoer/bestanden-verwerken/categorieen-aankoopfacturen/
**Model note:** Billit uses two levels — a **main category** (classification) and a **cost type** (drives VAT-deductibility % and professional-use %). Recommend CoralOS mirror this: `category` (group) + optional `costType` (item) carrying `vatDeductiblePct` / `notes`. NL label first (accountant-facing), EN in parentheses.

---

## Main categories (Billit-aligned, use as the top level)
1. **Investeringen** (Investments / capital assets)
2. **Onderaannemingen** (Subcontracting)
3. **(Handels)goederen** (Trade goods / merchandise)
4. **Huur** (Rent / lease)
5. **Rollend materieel** (Vehicles / rolling stock)
6. **Algemene kosten** (General/overhead costs)
7. **Gebouwen / lokalen / kantoren** (Buildings / premises / offices)
8. **Ereloon / commissies** (Professional fees / commissions)
9. **Personeel / uitzendkrachten** (Personnel / temp labour)
10. **Opstartkosten** (Start-up costs)
11. **Verzekeringen** (Insurance)
12. **Sociale bijdragen** (Social contributions)

---

## Full list with construction-relevant cost types + VAT/deduction notes

### 1. Investeringen (Investments — capitalized, depreciated)
- Machines & groot gereedschap (machines, mixers, compressors)
- Klein materieel & handgereedschap (drills, saws — often expensed if low value)
- Steigers / bekisting / stellingen (scaffolding, formwork)
- IT-hardware (laptops, tablets, phones)
- Kantoormeubilair & inrichting
- Software & licenties (capitalized where applicable)

### 2. Onderaannemingen (Subcontracting) — **core for construction**
- Onderaanneming ruwbouw (structural subcontracting)
- Onderaanneming technieken (electrical, HVAC, plumbing subcontractors)
- Onderaanneming afwerking (plastering, painting, tiling, flooring)
- Onderaanneming speciaal (roofing, demolition, excavation)
- **VAT note:** Belgian construction *medecontractant* / verlegging van heffing (reverse charge, art. 20 KB nr.1) commonly applies — VAT shifted to the co-contractor. Tag these lines so the VAT engine sets 0% + medecontractant.

### 3. (Handels)goederen / Bouwmaterialen (Materials & goods)
- Bouwmaterialen algemeen (cement, sand, brick, timber, steel)
- Technische materialen (cables, pipes, fittings)
- Afwerkingsmaterialen (tiles, paint, plasterboard, flooring)
- Sanitair & verwarming
- Verbruiksgoederen werf (consumables: screws, tape, silicone)
- Persoonlijke beschermingsmiddelen (PPE — helmets, gloves, boots)

### 4. Huur (Rent / lease)
- Huur machines & materieel (equipment rental — cranes, lifts, containers)
- Huur werfvoorzieningen (site huts, mobile toilets, fencing)
- Huur bedrijfspand / atelier / opslag (workshop, storage)
- Operationele leasing (non-vehicle)

### 5. Rollend materieel (Vehicles) — **VAT-sensitive**
- Aankoop/leasing bedrijfswagen (personenwagen)
- Aankoop/leasing lichte vracht / bestelwagen (light truck)
- Brandstof (fuel)
- Onderhoud & herstelling voertuigen
- Verzekering voertuigen · Verkeersbelasting · Parking/tol
- **VAT note:** passenger cars → BTW-aftrek generally **max 50%** (or per formula/logbook); *lichte vracht* (true utility vans) can be **100%** deductible. Split these cost types so the deduction % differs.

### 6. Algemene kosten (General / overhead)
- Kantoorbenodigdheden (office supplies)
- Telefonie & internet
- Post & verzending
- Bankkosten (bank charges — VAT-exempt)
- Abonnementen & lidgelden (subscriptions, federation memberships — e.g. Bouwunie/Confederatie Bouw)
- Drukwerk & marketing / reclame
- Werkkledij (branded workwear — deductible)
- Restaurant & maaltijden — **VAT deductible 0%; income-tax deductible ~69%**
- Receptie- & relatiegeschenken — **restaurant/reception 0% VAT; gifts limited**
- Onthaalkosten (reception costs — **50% income-tax deductible, 0% VAT**)

### 7. Gebouwen / lokalen / kantoren (Premises)
- Nutsvoorzieningen (utilities: electricity, gas, water)
- Onderhoud & schoonmaak gebouw
- Herstellingen & klein onderhoud pand
- Onroerende voorheffing (property tax — no VAT)
- Alarm / bewaking

### 8. Ereloon / commissies (Professional fees)
- Boekhouder / accountant / fiscalist
- Advocaat / notaris / juridisch
- Architect / studiebureau / ingenieur / EPB-verslaggever / veiligheidscoördinator
- Consultancy & advies
- Commissies / makelaarsloon

### 9. Personeel / uitzendkrachten (Personnel)
- Uitzendkrachten / interim (temp agency labour)
- Lonen & wedden (wages — usually own ledger, not a purchase invoice)
- Vorming & opleiding (training, VCA certificates)
- Arbeidsgeneeskunde / medisch onderzoek (occupational health — e.g. Mensura/IDEWE)
- Reis- & verblijfkosten personeel

### 10. Opstartkosten (Start-up)
- Oprichtingskosten (notary, incorporation)
- KBO / publicatiekosten Staatsblad
- Eerste inrichting / eerste materiaal

### 11. Verzekeringen (Insurance)
- BA uitbating & BA na levering (general/professional liability)
- **Tienjarige aansprakelijkheid (decennial — legally mandatory for construction since 2018)**
- ABR / alle bouwplaatsrisico's (all-site-risk)
- Arbeidsongevallen (workplace-accident insurance — mandatory)
- Materieel- / machineverzekering
- **VAT note:** insurance premiums are VAT-exempt (subject to taxe d'assurance).

### 12. Sociale bijdragen (Social contributions)
- Sociale bijdragen zelfstandige (self-employed social contributions)
- RSZ / ONSS werkgeversbijdragen (employer social security)
- Sociaal verzekeringsfonds
- Aanvullend pensioen / VAPZ / IPT

---

## DECISION (Florin 2026-07-12): TWO-LEVEL — category → cost type, with deduction %s. Build this.

### Spec for the coder
- **Two required levels on each expense/purchase-invoice:** `category` (one of the 12 main categories) → `costType` (one of the cost types under it). The costType select is filtered by the chosen category.
- **Each `costType` carries attributes** (seed data, editable per tenant later):
  - `vatDeductiblePct`: 100 | 50 | 0 (default from the notes above — cars 50, vans/utility 100, restaurant 0, reception 0, insurance/bank exempt→0, most operating costs 100).
  - `incomeTaxDeductiblePct` (info/notes): e.g. restaurant 69, reception 50, car costs per formula. Store as a note/number so the accountant export is correct.
  - `medecontractant` (bool): true for subcontracting + on-site construction works → VAT engine applies reverse-charge (0% + shifted) automatically.
  - `vatExempt` (bool): insurance, bank charges, social contributions.
- **Seed** the full taxonomy above (12 categories, all cost types) as the default catalog; let the tenant add/rename cost types (like Billit links a chosen category to the supplier for auto-suggest — nice-to-have, phase 2).
- **Labels NL-primary** (accountant-facing) with FR/EN i18n; Belgian tenant base.
- **Auto-suggest (phase 2):** remember the last category→costType chosen per supplier and pre-fill it on the next invoice from that supplier.

### Acceptance
Categorizing a purchase invoice: pick category → costType list narrows correctly; the line inherits `vatDeductiblePct` / `medecontractant`; a subcontractor invoice auto-applies medecontractant; the expense dashboard and VAT-return export reflect the deduction %s. NL labels render, FR/EN switch cleanly.
