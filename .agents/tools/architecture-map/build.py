"""Regenerate the CoralOS architecture map from the roadmap.

    /private/tmp/claude-502/xlenv/bin/python .agents/tools/architecture-map/build.py [out.html]

The spreadsheet (.agents/coral-roadmap.xlsx, columns Map Layer / Map Block) is the record; the
stack section is computed from it. The narrative (since-when, critical path, decided, waiting on
Florin) is hand-kept in narrative.html next to this file. head.html holds the page's style.
Default output: /Users/florin/Claude/Artifacts/coralos-architecture-map/index.html
"""
import datetime, html, os, re, sys
import openpyxl

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
XLSX = os.path.join(REPO, '.agents', 'coral-roadmap.xlsx')
OUT = sys.argv[1] if len(sys.argv) > 1 else '/Users/florin/Claude/Artifacts/coralos-architecture-map/index.html'

CLOSED = re.compile(r'^(Done|Dropped|Decided|Resolved)', re.I)

# Layer: (tag, tag class, layer class, name, what, [(display block, regex on the raw Map Block)]).
# First match wins; anything unmatched lands in the layer's "everything else".
LAYERS = [
    ('L0', '', '', 'Kernel', 'identity, time, storage, the write primitive — pure, tenant-free', [
        ('identity — ids, roles, bindings', r'^identity|^acting-scope'),
        ('entitlement — vocabulary &amp; grants', r'^entitlement'),
        ('storage — the one blob door', r'^storage'),
        ('interaction — overlay event shield', r'^interaction'),
        ('messaging · notify transports · push', r'^messaging|^notify|^service worker'),
        ('time — duration, the break rule, dates', r'^time|^date'),
        ('write path — one door · shared plumbing · mint', r'^write path|^shared plumbing|^mint|^tenant job'),
    ]),
    ('L1', '', '', 'Core', 'records, the write path, the read model, document engine', [
        ('write path — saveRecord, intents, read model', r'^write path —? ?saveRecord|^write path$|^write path — one door|^refusals'),
        ('write path — concurrency', r'^write path — concurrency'),
        ('document engine — archive, attachments, PDF, work orders', r'^document engine|^PDF'),
        ('read path — pageIndex, hydration, accessor', r'^read path|^relation|^sync queue'),
        ('ERP core — mixed triage', r'^ERP core|^Projects|^Platform|^raw SQL|^DI conv|^schema valid|^app url'),
        ('provisioning · system schemas', r'^provisioning'),
        ('central catalogue — ERP → tenant only', r'^central catalogue'),
        ('platform services — email, notify, i18n', r'^platform services|^notify|^i18n|^job registry'),
        ('Client Portal — the two-party record', r'^Client Portal'),
        ('entitlement state · trial · plan limits', r'^entitlement|^trial|^plan-limits|^grant'),
        ('identity · audit — the actor', r'^identity|^audit|^AuditLog'),
    ]),
    ('GATE', 'g', 'gate', 'The seraph — the tenant gate', 'one-way: the tenant enters, nothing leaves', [
        ('the seraph — resolver, logicalKey, scoped accessor', r'^the seraph'),
        ('TenantScopedClient', r'^TenantScopedClient'),
        ('actor reach · platform access · operator scopes', r'^actor reach|^platform access|^operator|^authority'),
        ('logicalKey on relations · unresolved reads · host module', r'^logicalKey|^unresolved|^host module'),
        ('the edges — middleware, session, system writers, registry', r'.'),
    ]),
    ('L2', '', '', 'Modules', 'WorkHub · Projects · Calendar · Portal · Automations · Tasks', [
        ('WorkHub / time-tracker — work orders, clocking, geo', r'^WorkHub|^HR · WorkHub|^shells'),
        ('HR — scheduling, reporting, dashboard', r'^HR'),
        ('Projects', r'^Projects|^journal'),
        ('Calendar module', r'^Calendar'),
        ('Client Portal', r'^Client Portal'),
        ('Library — packs, nudges, supplier carts', r'^Library|^integrations'),
        ('Automations · Tasks · Mobile/PWA · Records', r'^Automations|^Tasks|^Database|^reminders|^cron'),
    ]),
    ('MODULE GATE', 'mg', 'mgate', 'The other gates', 'entitlement · actor reach · export lock — asked for, never asserted', [
        ('entitlement — modules → submodules → quota · tiers', r'^entitlement —'),
        ('entitlement map · DATABASES entitlement', r'^entitlement map|^DATABASES'),
        ('export lock · accountant export', r'^export lock|^accountant'),
        ('support-access consent', r'^support-access'),
    ]),
    ('L3', '', '', 'Submodules', 'the surfaces — tasks, timesheets, quotations, grid, shells', [
        ('HR — timesheets, clocking, invoicing hours', r'^HR — timesheets|^HR — clock|^HR / Workforce|^werkbon'),
        ('HR — scheduling', r'^HR — scheduling|^time-tracker scheduling'),
        ('Tasks submodule', r'^Tasks|^task |^recurrence'),
        ('Quotations · invoices engine', r'^Quotations|^ClientInvoiceEngine'),
        ('Finance — purchase invoices, protest, orders, VAT', r'^Finance|^incoming PO|^bordereau'),
        ('grid / record surface primitives', r'^grid|^NotionGrid|^DbProperties|^relation consumers|^useExportCSV|^data repair'),
        ('shells &amp; navigation — WorkHubShell', r'^shells'),
        ('Expenses — receipts, OCR', r'^Expenses'),
        ('Projects', r'^Projects'),
    ]),
    ('L4', '', '', 'Leaves', 'dialogs, panels, indicators', [
        ('date display · Belgian formats', r'^date display'),
        ('design system · settings · indicators', r'^design|^settings|^impersonation|^notification|^module enablement'),
        ('export dialog · project tabs · screens', r'^export|^project tabs|^dynamic-db|^m/tasks|^FilterToolbar|^DbProperties|^document'),
    ]),
    ('⟂', 'x', '', 'Cross-cutting', 'CI gates · release · type debt · process', [
        ('process &amp; housekeeping — incl. the type-debt plan', r'^process|^housekeeping'),
        ('CI gates', r'^CI'),
        ('release · test suite · architecture decisions', r'^release|^test|^architecture|^deployment'),
    ]),
]
LAYER_ALIAS = {'—': '⟂'}


def load():
    ws = openpyxl.load_workbook(XLSX, read_only=True)['Roadmap']
    rows = list(ws.iter_rows(values_only=True))
    ix = {k: i for i, k in enumerate(rows[0])}
    out = []
    for r in rows[1:]:
        if not r[ix['ID']]:
            continue
        status = str(r[ix['Status']] or 'Open')
        out.append({
            'layer': LAYER_ALIAS.get(r[ix['Map Layer']], r[ix['Map Layer']]),
            'block': str(r[ix['Map Block']] or ''),
            'open': not CLOSED.match(status),
            'p0': str(r[ix['Priority']] or '').upper() == 'P0',
        })
    return out


def stats(items):
    n = len(items)
    o = sum(i['open'] for i in items)
    p = sum(i['open'] and i['p0'] for i in items)
    return n, o, p


def blk(name, items):
    n, o, p = stats(items)
    pct = round(100 * o / n) if n else 0
    warn = ' class="warn"' if p >= 2 and p * 3 >= o else ''
    cnt = f'<b>{n}</b> · ' + (f'{o} open' if o else 'closed') + (f' · <span class="p">{p}</span>' if p else '')
    return (f'    <div class="blk"><span class="bn">{name}</span><span class="bar"><i{warn} style="width:{pct}%"></i></span>'
            f'<span class="cnt">{cnt}</span></div>')


def main():
    items = load()
    known = {l[0] for l in LAYERS}
    stray = sorted({str(i['layer']) for i in items if i['layer'] not in known})
    if stray:
        sys.exit(f'Unknown Map Layer value(s): {stray} — fix the spreadsheet or LAYER_ALIAS')

    parts = []
    for tag, tcls, lcls, name, what, groups in LAYERS:
        mine = [i for i in items if i['layer'] == tag]
        buckets = {g: [] for g, _ in groups}
        rest = []
        for i in mine:
            for g, rx in groups:
                if re.search(rx, i['block']):
                    buckets[g].append(i)
                    break
            else:
                rest.append(i)
        n, o, p = stats(mine)
        rows = [blk(g, buckets[g]) for g, _ in groups if buckets[g]]
        if rest:
            rows.append(blk('everything else', rest))
        tagc = f' {tcls}' if tcls else ''
        layc = f' {lcls}' if lcls else ''
        p0 = f' · <span class="p0">{p} P0</span>' if p else ''
        parts.append(f'''<div class="layer{layc}">
  <div class="lhead"><span class="tag{tagc}">{tag}</span><span class="lname">{name}</span>
    <span class="lwhat">{what}</span>
    <span class="lnums"><b>{n}</b> items · {o} open{p0}</span></div>
  <div class="blocks">
{chr(10).join(rows)}
  </div>
</div>''')

    n, o, p = stats(items)
    today = datetime.date.today()
    date = f'{today.day} {today.strftime("%B %Y")}'
    narrative = open(os.path.join(HERE, 'narrative.html')).read()
    narrative = narrative.replace('{{ITEMS}}', str(n)).replace('{{DATE}}', date)
    head = open(os.path.join(HERE, 'head.html')).read()
    since, rest = narrative.split('<!-- STACK -->')
    page = f'''<!DOCTYPE html>
<script type="application/json" id="cowork-artifact-meta">
{{
  "name": "Coralos Architecture Map",
  "schemaVersion": 1,
  "description": "CoralOS architecture map — a projection of .agents/coral-roadmap.xlsx ({n} items). The kernel → core → seraph → module → other gates → submodule → leaves stack with open/P0 counts per block, what shipped since 28 Sep, the critical path, what has been decided, and what waits on Florin."
}}
</script>
<html lang="en">
{head}<body>
<div class="wrap">

<h1>CoralOS — Architecture Map</h1>
<div class="sub">A projection of <code>.agents/coral-roadmap.xlsx</code> · {n} items · regenerated {date}</div>

<div class="totals">
  <div class="tot"><div class="n">{n}</div><div class="k">items</div></div>
  <div class="tot"><div class="n">{o}</div><div class="k">open</div></div>
  <div class="tot"><div class="n" style="color:#c2410c">{p}</div><div class="k">open P0</div></div>
  <div class="tot"><div class="n">{len(LAYERS)}</div><div class="k">layers</div></div>
  <div class="tot"><div class="n">{n - o}</div><div class="k">closed</div></div>
</div>
{since}
<h2>The stack</h2>

{chr(10).join(parts)}
{rest}
</div>
</body>
</html>
'''
    open(OUT, 'w').write(page)
    print(f'{OUT}: {n} items · {o} open · {p} open P0')


if __name__ == '__main__':
    main()
