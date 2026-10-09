/**
 * EMP-PROFILE-1: Employee Profile into Database.
 *
 * Exercises the REAL code in:
 * - src/lib/kernel/shift-time.ts (isCalendarDay)
 * - src/lib/records/employee-profile.ts (profileOf, profileInput, EMPLOYEE_PROFILE_FIELDS)
 * - prisma/schema.prisma & migration.sql
 * - src/app/[locale]/admin/hr/employees/page.tsx
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { isCalendarDay } from '../src/lib/kernel/shift-time.ts';
import {
    profileOf,
    profileInput,
    EMPLOYEE_PROFILE_FIELDS,
} from '../src/lib/records/employee-profile.ts';

test('EMP-PROFILE-1: isCalendarDay validates real calendar days without timezone shifts', () => {
    // Valid days
    assert.equal(isCalendarDay('2026-02-28'), true);
    assert.equal(isCalendarDay('2028-02-29'), true); // Leap year

    // Invalid days
    assert.equal(isCalendarDay('2026-02-29'), false); // 2026 is not leap
    assert.equal(isCalendarDay('2026-13-01'), false); // Month 13
    assert.equal(isCalendarDay('1990-05-12T00:00:00.000Z'), false); // ISO timestamp
    assert.equal(isCalendarDay('banana'), false);
    assert.equal(isCalendarDay(''), false);
    assert.equal(isCalendarDay(null), false);
    assert.equal(isCalendarDay(undefined), false);
    assert.equal(isCalendarDay(12345678), false);
});

test('EMP-PROFILE-1: profileInput parses body fields, normalises empty to null, preserves absent', () => {
    // Normalising empty to null, trimming text
    const parsed = profileInput({
        department: '  Construction  ',
        employmentType: 'Full-time',
        address: '',
        birthDate: '1988-04-12',
        notes: null,
    });
    assert.equal(parsed.ok, true);
    if (parsed.ok) {
        assert.equal(parsed.data.department, 'Construction');
        assert.equal(parsed.data.employmentType, 'Full-time');
        assert.equal(parsed.data.address, null);
        assert.equal(parsed.data.birthDate, '1988-04-12');
        assert.equal(parsed.data.notes, null);
    }

    // Absent fields are untouched (not present in data)
    const partial = profileInput({ department: 'Sales' });
    assert.equal(partial.ok, true);
    if (partial.ok) {
        assert.equal(partial.data.department, 'Sales');
        assert.equal('employmentType' in partial.data, false);
        assert.equal('address' in partial.data, false);
        assert.equal('birthDate' in partial.data, false);
        assert.equal('notes' in partial.data, false);
    }

    // Empty birthDate becomes null
    const emptyBirth = profileInput({ birthDate: '' });
    assert.equal(emptyBirth.ok, true);
    if (emptyBirth.ok) {
        assert.equal(emptyBirth.data.birthDate, null);
    }

    // Invalid birthDate fails with INVALID_BIRTH_DATE
    const badDate = profileInput({ birthDate: '2026-02-29' });
    assert.deepEqual(badDate, { ok: false, error: 'INVALID_BIRTH_DATE' });

    const isoDate = profileInput({ birthDate: '1990-05-12T00:00:00.000Z' });
    assert.deepEqual(isoDate, { ok: false, error: 'INVALID_BIRTH_DATE' });

    const bananaDate = profileInput({ birthDate: 'banana' });
    assert.deepEqual(bananaDate, { ok: false, error: 'INVALID_BIRTH_DATE' });
});

test('EMP-PROFILE-1: profileOf maps all 5 profile fields with null defaults', () => {
    const full = profileOf({
        department: 'Architecture',
        employmentType: 'Freelance',
        address: 'Rue de la Loi 16, Bruxelles',
        birthDate: '1992-11-05',
        notes: 'Senior Architect',
    });
    assert.deepEqual(full, {
        department: 'Architecture',
        employmentType: 'Freelance',
        address: 'Rue de la Loi 16, Bruxelles',
        birthDate: '1992-11-05',
        notes: 'Senior Architect',
    });

    const empty = profileOf(null);
    assert.deepEqual(empty, {
        department: null,
        employmentType: null,
        address: null,
        birthDate: null,
        notes: null,
    });
});

test('EMP-PROFILE-1: Prisma schema and migration define all 5 additive fields on Employee', () => {
    const schemaPath = path.resolve('prisma/schema.prisma');
    const schema = fs.readFileSync(schemaPath, 'utf8');

    // Extract Employee model definition
    const employeeModelMatch = schema.match(/model Employee\s*\{([\s\S]*?)\n\}/);
    assert.ok(employeeModelMatch, 'model Employee must exist in prisma/schema.prisma');
    const employeeModel = employeeModelMatch[1];

    for (const field of EMPLOYEE_PROFILE_FIELDS) {
        const fieldRegex = new RegExp(`^\\s*${field}\\s+String\\?`, 'm');
        assert.match(
            employeeModel,
            fieldRegex,
            `Employee model must define optional String field: ${field}`
        );
    }

    // Verify migration SQL file exists and adds all 5 columns
    const migrationPath = path.resolve('prisma/migrations/20261009090000_employee_profile_fields/migration.sql');
    assert.ok(fs.existsSync(migrationPath), 'Migration SQL file must exist');
    const migrationSql = fs.readFileSync(migrationPath, 'utf8');

    for (const field of EMPLOYEE_PROFILE_FIELDS) {
        const colRegex = new RegExp(`ALTER\\s+TABLE\\s+"Employee"\\s+ADD\\s+COLUMN\\s+"${field}"\\s+TEXT;`, 'i');
        assert.match(
            migrationSql,
            colRegex,
            `Migration SQL must ALTER TABLE "Employee" ADD COLUMN "${field}" TEXT;`
        );
    }
});

test('EMP-PROFILE-1: Employees page does not use localStorage for profiles', () => {
    const pagePath = path.resolve('src/app/[locale]/admin/hr/employees/page.tsx');
    const pageSource = fs.readFileSync(pagePath, 'utf8');

    assert.equal(
        pageSource.includes('loadProfile'),
        false,
        'page.tsx must not contain loadProfile'
    );
    assert.equal(
        pageSource.includes('saveProfile'),
        false,
        'page.tsx must not contain saveProfile'
    );
    assert.equal(
        pageSource.includes('emp-profile-'),
        false,
        'page.tsx must not contain localStorage prefix emp-profile-'
    );
});
