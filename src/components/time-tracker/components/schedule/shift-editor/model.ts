/**
 * SHIFT EDITOR · PURE MODEL (WH-7)
 *
 * Pure, zero-dependency, zero React, zero fetch logic for the shift editor.
 * Replaces inline date arithmetic and snake_case payload generation from
 * CreateShiftForm.tsx and EditShiftDialog.tsx.
 *
 * All calendar math goes through kernel/shift-time string helpers:
 * `addDaysYmd`, `weekdayOfYmd`, `daysBetweenYmd`.
 * Payloads are strictly camelCase Partial<ScheduledShift>.
 */
import {
  addDaysYmd,
  weekdayOfYmd,
  daysBetweenYmd,
} from '@/lib/kernel/shift-time';
import type { ScheduledShift } from '@/components/time-tracker/hooks/useScheduledShifts';

export type ShiftScheduleType = 'single' | 'recurring' | 'leave';
export type ShiftEditScope = 'occurrence' | 'following' | 'series';

export interface ShiftEditorFormInput {
  userIds: string[];
  projectId?: string | null;
  contactPageId?: string | null;
  shiftDate: string;        // 'YYYY-MM-DD'
  shiftEndDate?: string;    // 'YYYY-MM-DD' (for multi-day or leave)
  shiftStart: string;       // 'HH:mm'
  shiftEnd: string;         // 'HH:mm'
  role?: string | null;
  notes?: string | null;
  siteAddress?: string | null;
  materialsEnabled: boolean;
  scheduleType: ShiftScheduleType;
  // Recurrence configuration
  recurringWeeks?: number;   // 1..52
  selectedDays?: number[];   // 0 (Sun) .. 6 (Sat)
  // Leave configuration
  leaveReason?: string;
  includeWeekends?: boolean;
}

export interface ShiftValidationResult {
  valid: boolean;
  errors: Record<string, string>;
}

/**
 * Payloads sent to onCreateShift / useScheduledShifts.createShift.
 * Strictly camelCase matching ScheduledShift.
 * Derived from ScheduledShift per Planner review (C2, M1/M2).
 */
export type CreateShiftPayload = Pick<
  ScheduledShift,
  'userId' | 'shiftDate' | 'shiftStart' | 'shiftEnd' | 'status'
> & {
  projectId?: ScheduledShift['projectId'];
  role?: ScheduledShift['role'];
  notes?: ScheduledShift['notes'];
  shiftName?: ScheduledShift['shiftName'];
  seriesId?: ScheduledShift['seriesId'];
  contactPageId?: string | null;
  siteAddress?: string | null;
  materialsEnabled: boolean;
};

/**
 * Payloads sent to onUpdateShift / useScheduledShifts.updateShift.
 * Strictly camelCase matching ScheduledShift.
 * Derived from ScheduledShift per Planner review (C2, M1/M2).
 */
export type UpdateShiftPayload = Partial<
  Pick<
    ScheduledShift,
    'userId' | 'shiftDate' | 'shiftStart' | 'shiftEnd'
  > & {
    projectId?: ScheduledShift['projectId'];
    role?: ScheduledShift['role'];
    notes?: ScheduledShift['notes'];
    seriesId?: ScheduledShift['seriesId'];
    contactPageId?: string | null;
    siteAddress?: string | null;
    materialsEnabled?: boolean;
  }
>;

export interface ShiftAuditLogEntry {
  action: string;
  createdAt?: string;
  after?: unknown;
}

export interface ShiftLockState {
  locked: boolean;
  reason?: string;
  signedNumber?: string;
  signedBy?: string;
  signedAt?: string;
}

/**
 * Validates shift editor input for both create and edit flows.
 */
export function validateShiftForm(input: ShiftEditorFormInput): ShiftValidationResult {
  const errors: Record<string, string> = {};

  if (!input.userIds || input.userIds.length === 0) {
    errors.userIds = 'Please select at least one employee';
  }

  if (!input.shiftDate) {
    errors.shiftDate = 'Date is required';
  }

  if (input.shiftEndDate && daysBetweenYmd(input.shiftDate, input.shiftEndDate) < 0) {
    errors.shiftEndDate = 'End date must be after start date';
  }

  if (!input.shiftStart) {
    errors.shiftStart = 'Start time is required';
  }

  if (!input.shiftEnd) {
    errors.shiftEnd = 'End time is required';
  }

  if (input.scheduleType === 'recurring') {
    if (!input.selectedDays || input.selectedDays.length === 0) {
      errors.selectedDays = 'Please select at least one day for recurring shifts';
    }
    if (!input.recurringWeeks || input.recurringWeeks < 1) {
      errors.recurringWeeks = 'Weeks must be at least 1';
    }
  }

  if (input.scheduleType === 'leave') {
    if (!input.leaveReason || !input.leaveReason.trim()) {
      errors.leaveReason = 'Leave reason is required';
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * Expands recurring shift dates across weeks for given days of week.
 * DST-SAFE: built strictly using kernel string arithmetic (`addDaysYmd`, `weekdayOfYmd`).
 * Never uses `Date` objects or `toISOString()`.
 */
export function expandRecurringShiftDates(
  startDate: string,
  recurringWeeks: number,
  selectedDays: number[]
): string[] {
  if (recurringWeeks <= 0 || selectedDays.length === 0) return [];
  const startWeekday = weekdayOfYmd(startDate);
  const dates: string[] = [];

  for (let week = 0; week < recurringWeeks; week++) {
    for (const dayOfWeek of selectedDays) {
      let daysToAdd = dayOfWeek - startWeekday;
      if (daysToAdd < 0) daysToAdd += 7;
      const targetDate = addDaysYmd(startDate, daysToAdd + week * 7);
      dates.push(targetDate);
    }
  }

  return Array.from(new Set(dates)).sort();
}

/**
 * Expands multi-day consecutive dates (e.g. for leave or multi-day single jobs).
 * Filters out weekend days when `includeWeekends` is false.
 */
export function expandRangeShiftDates(
  startDate: string,
  endDate: string,
  includeWeekends: boolean = true
): string[] {
  const diff = daysBetweenYmd(startDate, endDate);
  if (diff < 0) return [];
  const maxDays = Math.min(diff, 364);
  const dates: string[] = [];

  for (let offset = 0; offset <= maxDays; offset++) {
    const d = addDaysYmd(startDate, offset);
    const dow = weekdayOfYmd(d);
    if (!includeWeekends && (dow === 0 || dow === 6)) continue;
    dates.push(d);
  }

  return dates;
}

/**
 * Builds the exact array of payloads for `onCreateShift`.
 * - Multi-worker single-day shifts share a single `seriesId` (WO-2 visit work order grain).
 * - Multi-day shifts share a single `seriesId`.
 * - Single worker single-day shifts have `seriesId: undefined`.
 * - Recurring shifts share a single `seriesId`.
 * - Leave is NOT a shift (LEAVE-1): a leave form yields no shift payloads — see buildLeaveRequests.
 */
export function buildCreateShiftPayloads(
  input: ShiftEditorFormInput,
  seriesIdGenerator: () => string = () => crypto.randomUUID()
): CreateShiftPayload[] {
  const {
    userIds,
    projectId,
    contactPageId,
    shiftDate,
    shiftEndDate,
    shiftStart,
    shiftEnd,
    role,
    notes,
    siteAddress,
    materialsEnabled,
    scheduleType,
    recurringWeeks = 1,
    selectedDays = [],
    includeWeekends = true,
  } = input;

  if (userIds.length === 0) return [];

  const useRecurring = scheduleType === 'recurring';
  if (scheduleType === 'leave') return [];   // LEAVE-1: leave is a TimeOffRequest (buildLeaveRequests)

  if (useRecurring) {
    const dates = expandRecurringShiftDates(shiftDate, recurringWeeks, selectedDays);
    const seriesId = seriesIdGenerator();
    const payloads: CreateShiftPayload[] = [];

    for (const d of dates) {
      for (const uid of userIds) {
        payloads.push({
        userId: uid,
        projectId: projectId || null,
        contactPageId: contactPageId || null,
        shiftDate: d,
        shiftStart,
        shiftEnd,
        role: role || null,
        notes: notes || null,
        siteAddress: siteAddress?.trim() || null,
        materialsEnabled: !!materialsEnabled,
        status: 'scheduled',
        seriesId,
      });
      }
    }
    return payloads;
  }

  // Single (one day or a range)
  const effectiveEndDate = shiftEndDate || shiftDate;
  const dates = expandRangeShiftDates(shiftDate, effectiveEndDate, includeWeekends);
  const isMultiDay = shiftDate !== effectiveEndDate;
  // WO-2 / CreateShiftForm.tsx:520:
  // "shifts created TOGETHER — several days and/or several crew — share one seriesId; one person on one day is a work order on its own."
  const seriesId = (isMultiDay || userIds.length > 1) ? seriesIdGenerator() : undefined;

  const payloads: CreateShiftPayload[] = [];
  for (const d of dates) {
    for (const uid of userIds) {
      payloads.push({
        userId: uid,
        projectId: projectId || null,
        contactPageId: contactPageId || null,
        shiftDate: d,
        shiftStart,
        shiftEnd,
        role: role || null,
        notes: notes || null,
        siteAddress: siteAddress?.trim() || null,
        materialsEnabled: !!materialsEnabled,
        status: 'scheduled',
        seriesId,
      });
    }
  }

  return payloads;
}

/**
 * Builds the update payload for `onUpdateShift(shiftId, payload, scope)`.
 * Strictly camelCase.
 */
export function buildUpdateShiftPayload(
  input: ShiftEditorFormInput,
  seriesId?: string | null
): UpdateShiftPayload {
  const {
    userIds,
    projectId,
    contactPageId,
    shiftDate,
    shiftStart,
    shiftEnd,
    role,
    notes,
    siteAddress,
    materialsEnabled,
  } = input;

  return {
    userId: userIds[0],
    projectId: projectId || null,
    contactPageId: contactPageId || null,
    shiftDate,
    shiftStart,
    shiftEnd,
    role: role || null,
    notes: notes || null,
    siteAddress: siteAddress?.trim() || null,
    materialsEnabled: !!materialsEnabled,
    ...(seriesId ? { seriesId } : {}),
  };
}

/**
 * When converting an existing single shift to recurring in EditShiftDialog:
 * generates payloads for the ADDITIONAL dates (skipping the original date, which is updated).
 */
export function buildRecurringExpansionFromExisting(
  input: ShiftEditorFormInput,
  existingShiftDate: string,
  seriesId: string
): CreateShiftPayload[] {
  const {
    userIds,
    projectId,
    contactPageId,
    shiftDate,
    shiftStart,
    shiftEnd,
    role,
    notes,
    siteAddress,
    materialsEnabled,
    recurringWeeks = 1,
    selectedDays = [],
  } = input;

  const dates = expandRecurringShiftDates(shiftDate, recurringWeeks, selectedDays);
  const payloads: CreateShiftPayload[] = [];
  const uid = userIds[0];

  for (const d of dates) {
    if (d === existingShiftDate) continue; // Skip existing occurrence (EditShiftDialog.tsx:337)
    payloads.push({
      userId: uid,
      projectId: projectId || null,
      contactPageId: contactPageId || null,
      shiftDate: d,
      shiftStart,
      shiftEnd,
      role: role || null,
      notes: notes || null,
      siteAddress: siteAddress?.trim() || null,
      materialsEnabled: !!materialsEnabled,
      status: 'scheduled',
      seriesId,
    });
  }

  return payloads;
}

/**
 * Evaluates whether a shift is locked based strictly on audit logs.
 * A shift is locked ONLY when an audit log row with action === 'sign' exists for it (C4).
 */
export function evaluateShiftLockState(
  auditLogs?: ShiftAuditLogEntry[] | null
): ShiftLockState {
  if (!auditLogs || !Array.isArray(auditLogs)) {
    return { locked: false };
  }

  const signEntry = auditLogs.find(log => log && log.action === 'sign');
  if (!signEntry) {
    return { locked: false };
  }

  const after = signEntry.after as { number?: string; signerName?: string } | undefined;
  return {
    locked: true,
    reason: 'client signature',
    signedNumber: after?.number,
    signedBy: after?.signerName,
    signedAt: signEntry.createdAt,
  };
}

/** Moved to the shared formatters (lib/format/date) — re-exported for the editor's existing imports. */
export { formatCalendarDay } from '@/lib/format/date';


/** A leave written from the scheduler — a TimeOffRequest (kernel/absence.ts), approved by its author (the server stamps who). */
export interface LeaveRequestPayload {
  userId: string;
  startDate: string;   // 'YYYY-MM-DD'
  endDate: string;     // 'YYYY-MM-DD'
  requestType: string;
  notes: string | null;
  status: 'approved';
}

/**
 * LEAVE-1 (Florin 2026-10-08: "leave should not be treated as a shift"). The leave form → ONE request per worker
 * per run of consecutive days (weekends left out split the range into week runs) — never one row per day, never a
 * shift. Calendar math through kernel strings only.
 */
export function buildLeaveRequests(input: ShiftEditorFormInput): LeaveRequestPayload[] {
  if (input.scheduleType !== 'leave' || input.userIds.length === 0) return [];
  const days = expandRangeShiftDates(input.shiftDate, input.shiftEndDate || input.shiftDate, input.includeWeekends ?? true);
  const runs: Array<[string, string]> = [];
  for (const d of days) {
    const last = runs[runs.length - 1];
    if (last && addDaysYmd(last[1], 1) === d) last[1] = d;
    else runs.push([d, d]);
  }
  const requestType = (input.leaveReason || '').trim() || 'vacation';
  const notes = (input.notes || '').trim() || null;
  return input.userIds.flatMap(userId => runs.map(([startDate, endDate]) => ({ userId, startDate, endDate, requestType, notes, status: 'approved' as const })));
}
