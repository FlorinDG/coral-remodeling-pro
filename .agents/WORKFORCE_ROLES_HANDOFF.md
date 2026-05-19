# AI Handoff: Workforce Management & Role Enhancement
> Read /pd.md FIRST. Every rule there is a hard constraint.

## Context
CoralOS is a Belgian SaaS ERP. Single Next.js 15 app on Vercel.
Three domains: coral-sys (store), app.coral-group.be (ERP admin), www.coral-group.be (site).
Auth: NextAuth v5 JWT. Roles stored as plain String in User.role (Prisma).
Module access: stored as JSON in User.moduleAccess `{ "INVOICING": "ALL", "CRM": "OWN", ... }`.

## What We Are Building
8-step feature: specialist roles + unlimited seats on paid plans + project assignment matrix.

## APPROVED DECISIONS
- FREE plan: 1 user hard cap stays. PRO/ENTERPRISE/FOUNDER/CUSTOM: Infinity (remove code block).
- Stripe handles per-seat billing independently — code never blocks on seat count for paid plans.
- "CRM" label wiped from all UI text. Internal module key `CRM` stays in middleware/DB.
- Offertes role = Enterprise tier only.
- Offertes sees: Contacts, assigned Projects, Article Library (/admin/library). NO Financials.
- Project assignment = new Prisma table `UserProjectAccess` (many-to-many), matrix UI with checkboxes.

## DO NOT TOUCH (PD-protected)
- src/components/admin/database/components/AddColumnFlyout.tsx (Formula = Enterprise gate)
- src/components/admin/database/NotionGrid.tsx (Add Column = Pro+ gate)
- src/lib/plan-limits.ts (Peppol quotas)
- src/components/admin/DatabaseClone.tsx (schema locks)
- src/lib/pdf-stationery.ts (watermark gates)
- ACCOUNTANT role behavior in AdminLayout + NotionGrid
- Any route not listed in the 8 steps below

## EXECUTION ORDER (never parallel, always sequential)

### STEP 1 — prisma/schema.prisma
Add model after ShiftAttachment (line 934):
```
model UserProjectAccess {
  id        String   @id @default(cuid())
  tenantId  String
  userId    String
  projectId String
  createdAt DateTime @default(now())
  tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  @@unique([userId, projectId])
  @@index([tenantId])
  @@index([userId])
}
```
Add to Tenant model relations: `userProjectAccesses UserProjectAccess[]`
Then run: `npx prisma migrate dev --name add_user_project_access`

### STEP 2 — src/lib/roles.ts
Add to ROLES constant (after ACCOUNTANT):
```
BOOKKEEPING:     'BOOKKEEPING',
TEAMLEAD:        'TEAMLEAD',
PROJECT_MANAGER: 'PROJECT_MANAGER',
HR_OFFICER:      'HR_OFFICER',
OFFERTES:        'OFFERTES',
```
Add all 5 to ERP_ROLES array.
Change PLAN_USER_LIMITS: PRO: Infinity (was 3). Keep FREE: 1.

### STEP 3 — src/app/api/tenant/users/route.ts
The seat check block (lines 96-109). Change condition:
```typescript
if (!isAccountantInvite && maxUsers !== Infinity) {
    // existing count check and 403 response — unchanged
}
```
This makes the block skip entirely for paid plans (Infinity check).

### STEP 4 — src/app/api/tenant/project-access/route.ts (NEW FILE)
Create this file. GET returns projectIds for a userId. PUT replaces all assignments.
Auth: only WORKSPACE_OWNER_ROLES can PUT. Any ERP role can GET their own.
DB: prisma.userProjectAccess CRUD. Use $transaction for atomic replace on PUT.

### STEP 5 — src/middleware.ts
After the MODULE_GATE block, before pendingLocaleCookie section, insert:
```typescript
const ROLE_ROUTE_ALLOWLISTS: Partial<Record<string, string[]>> = {
    OFFERTES:        ['/admin/quotations', '/admin/contacts', '/admin/library', '/admin/projects-management', '/admin/settings', '/admin/dashboard'],
    BOOKKEEPING:     ['/admin/financials', '/admin/contacts', '/admin/suppliers', '/admin/library', '/admin/settings', '/admin/dashboard'],
    HR_OFFICER:      ['/admin/hr', '/admin/settings', '/admin/dashboard'],
    TEAMLEAD:        ['/admin/projects-management', '/admin/tasks', '/admin/calendar', '/admin/hr', '/admin/settings', '/admin/dashboard'],
    PROJECT_MANAGER: ['/admin/projects-management', '/admin/tasks', '/admin/calendar', '/admin/contacts', '/admin/settings', '/admin/dashboard'],
};
const roleAllowList = ROLE_ROUTE_ALLOWLISTS[role ?? ''];
if (roleAllowList && isLoggedIn) {
    const strippedVirtual = virtualPath.replace(/^\/(en|fr|nl|ro|ru)\//, '/');
    const allowed = roleAllowList.some(r => strippedVirtual.startsWith(r));
    if (!allowed) {
        const locale = resolveLocale(req);
        return NextResponse.redirect(new URL(`/${locale}${roleAllowList[0]}`, req.nextUrl.origin));
    }
}
```

### STEP 6 — src/components/AdminLayout.tsx
Replace the ACCOUNTANT_SIDEBAR_IDS const + its usage in isModuleLocked with:
```typescript
const ROLE_SIDEBAR_ALLOW: Partial<Record<string, string[]>> = {
    ACCOUNTANT:      ['dashboard', 'financials', 'contacts', 'suppliers', 'quotations', 'settings'],
    BOOKKEEPING:     ['dashboard', 'financials', 'contacts', 'suppliers', 'library', 'settings'],
    OFFERTES:        ['dashboard', 'quotations', 'contacts', 'library', 'projects', 'settings'],
    HR_OFFICER:      ['dashboard', 'hr', 'settings'],
    TEAMLEAD:        ['dashboard', 'projects', 'tasks', 'calendar', 'hr', 'settings'],
    PROJECT_MANAGER: ['dashboard', 'projects', 'tasks', 'calendar', 'contacts', 'settings'],
};
const isModuleLocked = (moduleId: string) => {
    if (userRole === 'SUPERADMIN') return false;
    const allowList = ROLE_SIDEBAR_ALLOW[userRole];
    if (allowList) return !allowList.includes(moduleId);
    const requiredModules = MODULE_MAP[moduleId];
    if (!requiredModules) return false;
    return !requiredModules.some(m => activeModules.includes(m));
};
```
Keep `const isAccountant = userRole === 'ACCOUNTANT';` — it's still used for the DB export UI and read-only banner.

### STEP 7 — src/app/[locale]/admin/settings/team/page.tsx
Multiple edits in one file. Use multi_replace_file_content tool.
a) MODULE_LABELS: change CRM value from 'CRM & Contacts' to 'Contacts'
b) ROLE_OPTIONS: add 5 new entries with icons + tier + desc
c) Add ROLE_ACCESS_DEFAULTS map (see plan for full map)
d) Wire: when inviteRole changes, auto-set inviteAccess = ROLE_ACCESS_DEFAULTS[inviteRole] ?? {}
e) Update getRoleLabel + getRoleIcon for new role strings
f) Seats badge: show "N members" when maxUsers === Infinity, else "N / M seats"
g) Add ProjectAssignmentMatrix component (fetch /api/tenant/project-access, list db-projects pages, checkbox per row, PUT on toggle)
h) Render matrix in isEditing expand area when user has PROJECTS access != 'NONE'

### STEP 8 — .agents/workflows/pd.md
After all above steps pass lint + manual check:
Update "Included seats" row: PRO/ENT → Unlimited (Stripe-billed).
Add 5 new roles to Known Premises table.
Note UserProjectAccess table and /api/tenant/project-access endpoint.

## KEY FILE LOCATIONS
- src/lib/roles.ts — role constants (line 9-45), PLAN_USER_LIMITS (line 82-88)
- src/app/api/tenant/users/route.ts — seat check lines 96-109
- src/middleware.ts — MODULE_GATE lines 171-184, insert after line 195
- src/components/AdminLayout.tsx — isModuleLocked line 146-154, ACCOUNTANT_SIDEBAR_IDS line 144
- src/app/[locale]/admin/settings/team/page.tsx — 537 lines, MODULES const line 30, MODULE_LABELS line 32, ROLE_OPTIONS line 49, AccessEditor line 462
- prisma/schema.prisma — 934 lines, User model line 319, Tenant relations line 129-155

## LINT RULE
Run `npm run lint` after EVERY step. Zero errors before next step. This is a hard rule per /pd.md.

## VERIFICATION (run after step 8)
1. FREE plan: invite 2nd user → SEAT_LIMIT_REACHED
2. PRO plan: invite 4th, 5th user → succeeds
3. OFFERTES user login → sidebar: Quotations, Contacts, Library, Projects, Settings only
4. OFFERTES user navigate to /admin/financials → redirect to /admin/quotations
5. BOOKKEEPING user → sidebar: Financials, Contacts, Suppliers, Library, Settings
6. Project matrix in Team Settings → check a project → DB row in UserProjectAccess
7. ACCOUNTANT → unchanged behavior
8. APP_MANAGER → full sidebar, no restrictions
9. No "CRM" text visible in any UI element

## PATTERN NOTES
- Module key `CRM` stays in activeModules array, middleware MODULE_GATE, MODULE_MAP in AdminLayout
- Only the display label changes: MODULE_LABELS['CRM'] = 'Contacts'
- The sidebar item id 'sales' maps to CRM module — that label comes from i18n key 'sidebar.sales'
- Projects in CoralOS = GlobalPage rows inside the GlobalDatabase where id = 'db-projects-<tenantId8>'
- The UserProjectAccess.projectId stores GlobalPage.id strings
