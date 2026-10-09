# HR-ENTITY-SERAPH — `api/hr/[entity]` onto the seraph (Planner plan, unattended run 2026-10-10)

**Why.** `src/app/api/hr/[entity]/route.ts` (1,016 lines: GET 162 · POST 427 · PATCH 660 · DELETE 920) is the last
large HR door on raw `prisma`. It sits on the R1-5 allowlist, and it carries **crew clock-in**. Every tenant
constraint in it is written by hand today. On the scoped client (`scopeFromSession`) the tenant is enforced by the
seraph: a forgotten `tenantId` can no longer read or write another tenant.

**Why not built unattended.** "A defect stops a crew" (CODER-QUEUE HR fence), and nobody can test clock-in at night.
**Plan only.** It is built in a daytime session, verified on the preview with a real clock-in / out, then promoted.

## Census — every raw call (39 lines, generated from the file)

The scope rule (`lib/data/scope-rules.ts`) exists for every model the route touches:

| Model | Rule | Note |
|---|---|---|
| ScheduledShift, ClockEntry, Employee, AuditLog, User, TimeOffRequest, HrTeam, ShiftTemplate, WorkerSchedule, HrProject, HrApprovalRequest, HrSupportMessage | direct | `tenantId` injected / checked |
| GlobalPage | via `database` | reads only |
| HrTeamMember | via `team` | a create must name `teamId`, and the team must be this tenant's |
| ShiftTask, ShiftAttachment | via `shift` | a create must name `shiftId`, and the shift must be this tenant's |
| Tenant | **platform** | `platformDb()` — the named door, never the scoped client |

```
line | call
87 | function getModel(entity: string) {
91 |     return (prisma as any)[modelName];
107 |     const page = await prisma.globalPage.findFirst({
137 |             const row = await (getModel(entity) as any)?.findUnique({ where: { id }, select: { shiftId: true } });
152 |     const ids = (await prisma.scheduledShift.findMany({ where, select: { id: true } })).map(r => r.id);
154 |     const signed = await prisma.auditLog.findMany({
171 |     const model = getModel(entity);
230 |             const pages = await prisma.globalPage.findMany({
253 |             const tenant = await prisma.tenant.findUnique({
265 |                     const shifts = await prisma.scheduledShift.findMany({
299 |                 const tasks = await prisma.globalPage.findMany({
342 |                 const users = await prisma.user.findMany({
346 |                 const employees = await prisma.employee.findMany({
359 |                     const legacyEmployees = await prisma.employee.findMany({
397 |                     const entries = await prisma.clockEntry.findMany({
440 |     const model = getModel(entity);
458 |         const parent = await prisma.scheduledShift.findFirst({
524 |         const subject = await prisma.user.findFirst({
538 |                 const open = await prisma.clockEntry.findFirst({
556 |             const employee = await prisma.employee.findFirst({
572 |                 parentShift = await prisma.scheduledShift.findFirst({
673 |     const model = getModel(entity);
689 |             const member = await (prisma as any).hrTeamMember.findUnique({ 
701 |             const parentShift = await prisma.scheduledShift.findFirst({
763 |             const existingEntry = await prisma.clockEntry.findUnique({ where: { id } });
829 |                 prisma.clockEntry.update({ where: { id }, data }),
838 |                 const anchor = await prisma.scheduledShift.findFirst({ where: { id, tenantId: ctx.tenantId }, select: { id: true, seriesId: true
844 |                         prisma.scheduledShift.updateMany({ where, data: { ...fields, lastEditedBy: ctx.userId } }),
845 |                         prisma.scheduledShift.update({ where: { id }, data: data as Prisma.ScheduledShiftUncheckedUpdateInput }),
869 |                         await prisma.clockEntry.updateMany({
880 |                         const entry = await prisma.clockEntry.create({
933 |     const model = getModel(entity);
948 |             const member = await (prisma as any).hrTeamMember.findUnique({ 
960 |             const parentShift = await prisma.scheduledShift.findFirst({
981 |         const row = await prisma.clockEntry.findFirst({ where: { id, tenantId: ctx.tenantId }, select: { invoicedAt: true } });
994 |             const anchor = await prisma.scheduledShift.findFirst({ where: { id, tenantId: ctx.tenantId }, select: { id: true, seriesId: true, sh
1000 |                     prisma.scheduledShift.deleteMany({ where: { ...where, clockEntries: { none: {} } } }),
1001 |                     prisma.scheduledShift.count({ where }),
1002 |                     prisma.scheduledShift.delete({ where: { id } }),
```

## Steps — one commit each, a throw-proof test each
1. **`db = await scopeFromSession()`** once per handler. `getModel(entity)` returns `db[modelName]`, not
   `prisma[modelName]`. The `Tenant` reads (`prisma.tenant.*`) go through `platformDb()`.
2. **The hand-written `tenantId` filters stay**, belt and braces: the scoped client ANDs its own. Remove them only in
   a later pass.
3. **Via-model creates (POST for `team-members`, `shift-tasks`, `shift-attachments`):** make sure the body's
   `teamId` / `shiftId` reaches `data`; the scoped client refuses a create without its parent. Read the POST branch for
   each before the change.
4. **Transactions:** any `prisma.$transaction` becomes `db.$transaction`. Interactive transactions on the scoped
   client are typed through `TenantScopedClient`, as in `lib/data/records`.
5. **Remove the route from the R1-5 allowlist** (eslint.config.mjs) and lower the CEILING in
   `tests/seraph-gate.test.ts` by one.
6. **Tests:**
   - a census test: no `prisma.` left in the route except via `platformDb()`;
   - a fake-scoped-client test per verb proving a cross-tenant id is refused (GET, PATCH, DELETE by id of another
     tenant → 404/refusal);
   - a via create without its parent → refused.
   Throw proofs for each.

## Verification before promotion (daytime, Florin or the Planner on the preview)
- **WorkHub:** clock in, clock out, a break; the entry shows in the timesheet.
- **Scheduler:** create, move and delete a shift; add a task and an attachment to a shift.
- **Leave:** request and approve.
- **Teams:** add and remove a member.
- **Employees:** edit a profile (EMP-PROFILE-1 fields).
- **The audit log** shows the actor.

Owner: the Planner (fenced from the coder). Status: **planned, waiting for a daytime slot.**
