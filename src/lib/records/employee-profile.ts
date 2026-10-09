/**
 * CORE · EMPLOYEE PROFILE
 *
 * Pure helpers for extended employee profile fields (department, employmentType, address, birthDate, notes).
 * Imports only from lib/kernel.
 */

import { isCalendarDay } from '@/lib/kernel/shift-time';

export const EMPLOYEE_PROFILE_FIELDS = ['department', 'employmentType', 'address', 'birthDate', 'notes'] as const;

export type EmployeeProfileField = (typeof EMPLOYEE_PROFILE_FIELDS)[number];

export function profileOf(
    employee: Partial<Record<EmployeeProfileField, string | null>> | null | undefined,
): Record<EmployeeProfileField, string | null> {
    return {
        department: employee?.department ?? null,
        employmentType: employee?.employmentType ?? null,
        address: employee?.address ?? null,
        birthDate: employee?.birthDate ?? null,
        notes: employee?.notes ?? null,
    };
}

export function profileInput(
    body: Record<string, unknown>,
): { ok: true; data: Partial<Record<EmployeeProfileField, string | null>> } | { ok: false; error: 'INVALID_BIRTH_DATE' } {
    const data: Partial<Record<EmployeeProfileField, string | null>> = {};

    if ('birthDate' in body) {
        const raw = body.birthDate;
        if (raw === null || raw === undefined || raw === '') {
            data.birthDate = null;
        } else if (typeof raw === 'string') {
            const trimmed = raw.trim();
            if (trimmed === '') {
                data.birthDate = null;
            } else if (isCalendarDay(trimmed)) {
                data.birthDate = trimmed;
            } else {
                return { ok: false, error: 'INVALID_BIRTH_DATE' };
            }
        } else {
            return { ok: false, error: 'INVALID_BIRTH_DATE' };
        }
    }

    const textFields: Array<Exclude<EmployeeProfileField, 'birthDate'>> = [
        'department',
        'employmentType',
        'address',
        'notes',
    ];

    for (const field of textFields) {
        if (field in body) {
            const val = body[field];
            if (val === null || val === undefined || val === '') {
                data[field] = null;
            } else if (typeof val === 'string') {
                const trimmed = val.trim();
                data[field] = trimmed === '' ? null : trimmed;
            } else {
                data[field] = String(val).trim() || null;
            }
        }
    }

    return { ok: true, data };
}
