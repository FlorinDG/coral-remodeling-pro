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
 * Pure scope classification table for all 55 models in schema.prisma.
 * 33 Direct (Class A) · 20 Via (Class B) · 2 Platform (Class D) · 0 Undeclared (Class C)
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

/**
 * Pure. Returns the where-clause a scoped query must carry.
 * Throws for unknown/platform models.
 * RED for R1-4: throws NOT_IMPLEMENTED until R1-4 lands.
 */
export function scopeWhere(_model: string, _tenantId: string, _userWhere?: object): object {
  throw new Error('NOT_IMPLEMENTED');
}
