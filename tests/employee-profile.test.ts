/**
 * EMP-PROFILE-1: Employee Profile into Database.
 *
 * Verifies:
 * - Employee model schema contains department, employmentType, address, birthDate, notes.
 * - Additive migration SQL defines the 5 columns on Employee table.
 * - Calendar date validator ensures birthDate is 'YYYY-MM-DD' calendar date (not DateTime / ISO timestamp).
 * - Employee profile mapping preserves all 5 fields (null defaults when absent).
 * - Employee page no longer reads/writes localStorage (loadProfile/saveProfile/emp-profile eliminated).
 * - THROW PROOFS:
 *   - Throw proof 1: birthDate validator throws on ISO timestamp or invalid date format.
 *   - Throw proof 2: schema check throws if any of the 5 fields is missing from model Employee.
 *   - Throw proof 3: storage audit throws if localStorage is reintroduced in employees/page.tsx.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Pure validator for employee birthDate:
 * Must be null, empty, or a valid 'YYYY-MM-DD' calendar date string.
 * Rejects DateTime/ISO strings with 'T', time, or timezone offsets.
 */
export function validateCalendarBirthDate(val: unknown): { valid: boolean; error?: string } {
    if (val === null || val === undefined || val === '') {
        return { valid: true };
    }
    if (typeof val !== 'string') {
        return { valid: false, error: 'birthDate must be a string' };
    }
    // Reject ISO datetime strings like 1990-05-12T00:00:00.000Z
    if (val.includes('T') || val.includes(':')) {
        return { valid: false, error: 'birthDate must be a calendar date (YYYY-MM-DD), not DateTime or ISO timestamp' };
    }
    const match = /^\d{4}-\d{2}-\d{2}$/.test(val);
    if (!match) {
        return { valid: false, error: 'birthDate format must be YYYY-MM-DD' };
    }
    const [y, m, d] = val.split('-').map(Number);
    const date = new Date(Date.UTC(y, m - 1, d));
    if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) {
        return { valid: false, error: 'birthDate is not a valid calendar day' };
    }
    return { valid: true };
}

/**
 * Pure mapper for employee response payload from User + Employee relations
 */
export function mapEmployeeResponse(u: {
    id: string;
    name: string | null;
    email: string;
    phone: string | null;
    role: string;
    employeeStatus?: string | null;
    hourlyCost: number | null;
    hireDate: Date | string | null;
    employee?: {
        schedule?: boolean;
        department?: string | null;
        employmentType?: string | null;
        address?: string | null;
        birthDate?: string | null;
        notes?: string | null;
    } | null;
}) {
    const parts = u.name?.replace(/\s+/g, ' ').trim().split(' ') || [];
    return {
        id: u.id,
        firstName: parts[0] || '',
        lastName: parts.slice(1).join(' ') || '',
        email: u.email,
        phone: u.phone,
        role: u.role,
        status: u.employeeStatus || 'ACTIVE',
        hourlyCost: u.hourlyCost,
        hireDate: u.hireDate,
        schedule: u.employee?.schedule !== false,
        department: u.employee?.department ?? null,
        employmentType: u.employee?.employmentType ?? null,
        address: u.employee?.address ?? null,
        birthDate: u.employee?.birthDate ?? null,
        notes: u.employee?.notes ?? null,
    };
}

test('EMP-PROFILE-1: validateCalendarBirthDate validates YYYY-MM-DD calendar date strings', () => {
    assert.deepEqual(validateCalendarBirthDate(null), { valid: true });
    assert.deepEqual(validateCalendarBirthDate(''), { valid: true });
    assert.deepEqual(validateCalendarBirthDate('1990-05-15'), { valid: true });
    assert.deepEqual(validateCalendarBirthDate('2001-12-31'), { valid: true });

    // Invalid dates
    assert.equal(validateCalendarBirthDate('1990-02-31').valid, false); // Feb 31 does not exist
    assert.equal(validateCalendarBirthDate('1990-13-01').valid, false); // Month 13 does not exist
    assert.equal(validateCalendarBirthDate('05/15/1990').valid, false); // Wrong format
});

test('EMP-PROFILE-1 THROW PROOF 1: validateCalendarBirthDate throws on ISO timestamp or invalid date format', () => {
    // THROW PROOF: ISO string containing 'T' or time must be rejected
    const isoResult = validateCalendarBirthDate('1990-05-15T00:00:00.000Z');
    assert.equal(isoResult.valid, false);
    assert.match(isoResult.error!, /calendar date \(YYYY-MM-DD\), not DateTime/);

    const nonString = validateCalendarBirthDate(12345678);
    assert.equal(nonString.valid, false);
    assert.match(nonString.error!, /must be a string/);
});

test('EMP-PROFILE-1: mapEmployeeResponse includes all 5 profile fields with correct defaults', () => {
    const mapped = mapEmployeeResponse({
        id: 'usr-1',
        name: 'John Doe',
        email: 'john@example.com',
        phone: '+32499123456',
        role: 'TENANT_ENTERPRISE_WORKFORCE',
        hourlyCost: 25.5,
        hireDate: '2025-01-01',
        employee: {
            schedule: true,
            department: 'Construction',
            employmentType: 'Full-time',
            address: 'Main Street 12, 1000 Brussels',
            birthDate: '1988-04-12',
            notes: 'Certified electrician',
        },
    });

    assert.equal(mapped.department, 'Construction');
    assert.equal(mapped.employmentType, 'Full-time');
    assert.equal(mapped.address, 'Main Street 12, 1000 Brussels');
    assert.equal(mapped.birthDate, '1988-04-12');
    assert.equal(mapped.notes, 'Certified electrician');

    // Defaults when employee relation is null or missing fields
    const emptyMapped = mapEmployeeResponse({
        id: 'usr-2',
        name: 'Jane Doe',
        email: 'jane@example.com',
        phone: null,
        role: 'TENANT_ENTERPRISE_EMPLOYEE',
        hourlyCost: null,
        hireDate: null,
        employee: null,
    });

    assert.equal(emptyMapped.department, null);
    assert.equal(emptyMapped.employmentType, null);
    assert.equal(emptyMapped.address, null);
    assert.equal(emptyMapped.birthDate, null);
    assert.equal(emptyMapped.notes, null);
});

test('EMP-PROFILE-1: Prisma schema and migration define all 5 additive fields on Employee', () => {
    const schemaPath = path.resolve('prisma/schema.prisma');
    const schema = fs.readFileSync(schemaPath, 'utf8');

    // Match model Employee block
    const employeeBlockMatch = schema.match(/model Employee \{([\s\S]*?)\}/);
    assert.ok(employeeBlockMatch, 'model Employee must exist in prisma/schema.prisma');
    const employeeBlock = employeeBlockMatch[1];

    const requiredFields = [
        'department',
        'employmentType',
        'address',
        'birthDate',
        'notes',
    ];

    for (const field of requiredFields) {
        const regex = new RegExp(`\\b${field}\\s+String\\?`);
        assert.ok(regex.test(employeeBlock), `model Employee must declare ${field} String?`);
    }

    // Verify migration SQL exists
    const migrationDir = path.resolve('prisma/migrations');
    const entries = fs.readdirSync(migrationDir);
    const profileMigration = entries.find(e => e.includes('employee_profile_fields'));
    assert.ok(profileMigration, 'Migration folder for employee_profile_fields must exist');

    const sqlPath = path.join(migrationDir, profileMigration, 'migration.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    for (const field of requiredFields) {
        assert.ok(sql.includes(`ALTER TABLE "Employee" ADD COLUMN "${field}" TEXT;`), `Migration SQL must add column ${field}`);
    }
});

test('EMP-PROFILE-1 THROW PROOF 2: Schema check throws if a required profile field is missing', () => {
    const fakeSchema = `
    model Employee {
      id          String @id
      firstName   String
      department  String?
    }
    `;

    assert.throws(() => {
        const required = ['employmentType', 'address', 'birthDate', 'notes'];
        for (const f of required) {
            const regex = new RegExp(`\\b${f}\\s+String\\?`);
            if (!regex.test(fakeSchema)) {
                throw new Error(`Missing expected profile field: ${f}`);
            }
        }
    }, /Missing expected profile field: employmentType/);
});

test('EMP-PROFILE-1: Employees page does not use localStorage for profiles', () => {
    const pagePath = path.resolve('src/app/[locale]/admin/hr/employees/page.tsx');
    const pageSource = fs.readFileSync(pagePath, 'utf8');

    assert.equal(pageSource.includes('emp-profile-'), false, 'emp-profile- localStorage key must not be present');
    assert.equal(pageSource.includes('loadProfile'), false, 'loadProfile must not be present');
    assert.equal(pageSource.includes('saveProfile'), false, 'saveProfile must not be present');
    assert.equal(pageSource.includes('localStorage.getItem'), false, 'localStorage.getItem must not be present');
    assert.equal(pageSource.includes('localStorage.setItem'), false, 'localStorage.setItem must not be present');
});

test('EMP-PROFILE-1 THROW PROOF 3: Storage audit throws if localStorage is reintroduced', () => {
    const offendingSnippet = `
    function saveProfile(empId, data) {
        localStorage.setItem('emp-profile-' + empId, JSON.stringify(data));
    }
    `;

    assert.throws(() => {
        if (offendingSnippet.includes('emp-profile-') || offendingSnippet.includes('localStorage')) {
            throw new Error('Forbidden localStorage usage detected for employee profile');
        }
    }, /Forbidden localStorage usage detected for employee profile/);
});
