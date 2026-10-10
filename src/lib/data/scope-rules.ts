export type ScopeRule =
  | { kind: 'direct' }                      // has tenantId
  | { kind: 'via'; through: string }        // relation field name on THIS model
  | { kind: 'platform' };                   // Tenant, VerificationToken — scoped client refuses

export class UnclassifiedModelError extends Error {
  constructor(model: string) {
    super(`Unclassified model: ${model}. A model absent from SCOPE fails closed.`);
    this.name = 'UnclassifiedModelError';
  }
}

export class PlatformModelError extends Error {
  constructor(model: string) {
    super(`Platform model ${model} cannot be accessed via scoped client. Use platformDb().`);
    this.name = 'PlatformModelError';
  }
}

/**
 * Pure scope classification table for all 58 models in schema.prisma.
 * 34 Direct (Class A) · 20 Via (Class B) · 2 Platform (Class D) · 0 Undeclared (Class C)
 */
export const SCOPE: Readonly<Record<string, ScopeRule>> = {
  // Class D: Platform models (2)
  Tenant: { kind: 'platform' },
  VerificationToken: { kind: 'platform' },

  // Class A: Direct models with tenantId (33)
  Lead: { kind: 'direct' },
  Booking: { kind: 'direct' },
  ClientPortal: { kind: 'direct' },
  Event: { kind: 'direct' },
  User: { kind: 'direct' },
  SiteContent: { kind: 'direct' },
  CMS_Service: { kind: 'direct' },
  CMS_Project: { kind: 'direct' },
  HrApprovalRequest: { kind: 'direct' },
  HrSupportMessage: { kind: 'direct' },
  PromotionalBanner: { kind: 'direct' },
  NotionConnection: { kind: 'direct' },
  ConnectedEmailAccount: { kind: 'direct' },
  Contact: { kind: 'direct' },
  Invoice: { kind: 'direct' },
  Quotation: { kind: 'direct' },
  Employee: { kind: 'direct' },
  InternalProject: { kind: 'direct' },
  Supplier: { kind: 'direct' },
  GlobalDatabase: { kind: 'direct' },
  ClockEntry: { kind: 'direct' },
  ScheduledShift: { kind: 'direct' },
  TaskNote: { kind: 'direct' },       // TASK-CREW-1: carries its own tenantId (FK, cascade)
  ShiftTemplate: { kind: 'direct' },
  HrTeam: { kind: 'direct' },
  TimeOffRequest: { kind: 'direct' },
  WorkerSchedule: { kind: 'direct' },
  HrProject: { kind: 'direct' },
  UserProjectAccess: { kind: 'direct' },
  Notification: { kind: 'direct' },
  HrAnnouncement: { kind: 'direct' },
  HrDocument: { kind: 'direct' },
  RateChangeAudit: { kind: 'direct' },
  AuditLog: { kind: 'direct' },
  Comment: { kind: 'direct' },
  TraceCounter: { kind: 'direct' },   // TRACE-1: the per-tenant counter of a trace series (tenantId FK, cascade)        // COMMENTS-1: a thread on a record (tenantId FK, cascade)

  // Class B: Transitive models scoped via parent relation (20)
  ProjectUpdate: { kind: 'via', through: 'portal' },
  Task: { kind: 'via', through: 'portal' },
  Document: { kind: 'via', through: 'portal' },
  ProjectMedia: { kind: 'via', through: 'portal' },
  Message: { kind: 'via', through: 'portal' },
  Account: { kind: 'via', through: 'user' },
  Session: { kind: 'via', through: 'user' },
  CMS_ProjectImage: { kind: 'via', through: 'project' },
  NotionEntry: { kind: 'via', through: 'connection' },
  PlatformLead: { kind: 'via', through: 'contact' },
  SalesOpportunity: { kind: 'via', through: 'contact' },
  InvoiceItem: { kind: 'via', through: 'invoice' },
  QuotationItem: { kind: 'via', through: 'quotation' },
  TimeEntry: { kind: 'via', through: 'employee' },
  GlobalPage: { kind: 'via', through: 'database' },
  HrTeamMember: { kind: 'via', through: 'team' },
  ShiftTask: { kind: 'via', through: 'shift' },
  ShiftAttachment: { kind: 'via', through: 'shift' },
  HrAnnouncementRead: { kind: 'via', through: 'announcement' },
  HrDocumentAcknowledgment: { kind: 'via', through: 'document' },
};

type Where = Record<string, unknown>;
const isPlainObject = (v: unknown): v is Where => !!v && typeof v === 'object' && !Array.isArray(v);

/** The tenant constraint for a model — `{ tenantId }` (direct) or `{ [parentRelation]: { tenantId } }` (via).
 *  Every via parent is direct today; tests/tenant-isolation.test.ts fails the build if a via-of-via
 *  appears, because it would need a chained clause built on purpose, not inferred. */
function tenantClause(model: string, tenantId: string): Where {
  const rule = SCOPE[model];
  if (!rule) throw new UnclassifiedModelError(model);
  if (rule.kind === 'platform') throw new PlatformModelError(model);
  if (rule.kind === 'direct') return { tenantId };
  return { [rule.through]: { tenantId } };
}

/** The scope WINS at every key it names; the caller's other filters are kept beside it. A user
 *  where cannot overwrite the tenant, and anything it adds (OR, NOT, AND) is ANDed with the scope
 *  at top level by Prisma — it can narrow the result, never widen it past the tenant. */
function mergeScope(user: Where, scope: Where): Where {
  const out: Where = { ...user };
  for (const [k, v] of Object.entries(scope)) {
    out[k] = isPlainObject(v) && isPlainObject(user[k]) ? mergeScope(user[k] as Where, v) : v;
  }
  return out;
}

/**
 * Pure. The where-clause a scoped query must carry (R1-4 — the core of the TenantScopedClient).
 * Throws UnclassifiedModelError (absent from SCOPE → fails closed) or PlatformModelError.
 */
export function scopeWhere(model: string, tenantId: string, userWhere?: object): object {
  if (!tenantId) throw new Error(`scopeWhere(${model}): no tenant — refusing to build an unscoped where`);
  const clause = tenantClause(model, tenantId);
  return userWhere && isPlainObject(userWhere) ? mergeScope(userWhere, clause) : clause;
}
