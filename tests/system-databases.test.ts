/**
 * KERN-5 / KERN-6 — System Database Vocabulary & Specification Invariant Tests
 *
 * Verifies:
 * 1. SYSTEM_DATABASE_ROLES contains exactly 17 roles with no duplicates.
 * 2. SYSTEM_DATABASES specification table has a complete spec for every role with no undefined fields.
 * 3. No duplicate legacyBase across all specs.
 * 4. Every role has an explicit module property (string or explicit null).
 * 5. All four derived lists (BASE_TO_KEY, SYSTEM_DB_PREFIXES, SERVER_PROVISIONED_BASES, DB_ID_MODULE_MAP) have length 17.
 * 6. Live defect fix: isSystemDatabase('db-hr') and isSystemDatabase('db-journal-general') are true.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
    SYSTEM_DATABASE_ROLES,
    SYSTEM_DATABASE_NAMES,
    SYSTEM_DATABASES,
    BASE_TO_KEY,
    SYSTEM_DB_PREFIXES,
    SERVER_PROVISIONED_BASES,
    DB_ID_MODULE_MAP,
} from '../src/lib/kernel/system-databases.ts';
import type { SystemDatabaseRole } from '../src/lib/kernel/system-databases.ts';
import { isSystemDatabase, getBaseDbId } from '../src/lib/systemDatabases.ts';

describe('KERN-5 — System Database Vocabulary (L0 Kernel)', () => {
    test('SYSTEM_DATABASE_ROLES has exactly 17 roles', () => {
        assert.equal(SYSTEM_DATABASE_ROLES.length, 17, 'Must contain exactly 17 system database roles');
    });

    test('SYSTEM_DATABASE_ROLES contains no duplicates', () => {
        const unique = new Set(SYSTEM_DATABASE_ROLES);
        assert.equal(unique.size, 17, 'All 17 roles must be distinct');
    });

    test('SYSTEM_DATABASE_NAMES has an entry for every role in SYSTEM_DATABASE_ROLES', () => {
        for (const role of SYSTEM_DATABASE_ROLES) {
            const name = SYSTEM_DATABASE_NAMES[role];
            assert.ok(typeof name === 'string' && name.trim().length > 0, `Role "${role}" must have a non-empty name`);
        }
    });

    test('SYSTEM_DATABASE_NAMES contains exactly the 17 roles and no extras', () => {
        const nameKeys = Object.keys(SYSTEM_DATABASE_NAMES);
        assert.equal(nameKeys.length, 17, 'Names dictionary must have exactly 17 entries');
        for (const key of nameKeys) {
            assert.ok(
                SYSTEM_DATABASE_ROLES.includes(key as SystemDatabaseRole),
                `Key "${key}" in SYSTEM_DATABASE_NAMES must be in SYSTEM_DATABASE_ROLES`
            );
        }
    });

    test('Names match canonical specifications', () => {
        // Pre-existing 8
        assert.equal(SYSTEM_DATABASE_NAMES['invoices'], 'Sales Invoices');
        assert.equal(SYSTEM_DATABASE_NAMES['clients'], 'Contacts');
        assert.equal(SYSTEM_DATABASE_NAMES['suppliers'], 'Suppliers');
        assert.equal(SYSTEM_DATABASE_NAMES['expenses'], 'Purchase Invoices');
        assert.equal(SYSTEM_DATABASE_NAMES['tickets'], 'Expense Tickets');
        assert.equal(SYSTEM_DATABASE_NAMES['quotations'], 'Quotations');
        assert.equal(SYSTEM_DATABASE_NAMES['payments-in'], 'Received Payments');
        assert.equal(SYSTEM_DATABASE_NAMES['payments-out'], 'Paid Payments');

        // Newly provisioned 8
        assert.equal(SYSTEM_DATABASE_NAMES['projects'], 'Projects');
        assert.equal(SYSTEM_DATABASE_NAMES['tasks'], 'Tasks');
        assert.equal(SYSTEM_DATABASE_NAMES['articles'], 'Material Articles');
        assert.equal(SYSTEM_DATABASE_NAMES['crm'], 'CRM');
        assert.equal(SYSTEM_DATABASE_NAMES['bobex'], 'Bobex');
        assert.equal(SYSTEM_DATABASE_NAMES['bestek'], 'Bestek Templates');
        assert.equal(SYSTEM_DATABASE_NAMES['journal-general'], 'General Journal');
        assert.equal(SYSTEM_DATABASE_NAMES['hr'], 'HR');
    });
});

describe('KERN-6 / Pass 3a — SYSTEM_DATABASES Table and Derived Lists', () => {
    test('every role has a complete spec with no undefined fields', () => {
        for (const role of SYSTEM_DATABASE_ROLES) {
            const spec = SYSTEM_DATABASES[role];
            assert.ok(spec, `Role "${role}" must have an entry in SYSTEM_DATABASES`);
            assert.equal(spec.role, role, `spec.role must match "${role}"`);
            assert.ok(typeof spec.legacyBase === 'string' && spec.legacyBase.length > 0, `spec.legacyBase must be non-empty string for "${role}"`);
            assert.ok(typeof spec.displayName === 'string' && spec.displayName.length > 0, `spec.displayName must be non-empty string for "${role}"`);
            assert.ok(spec.module === null || (typeof spec.module === 'string' && spec.module.length > 0), `spec.module must be explicit null or non-empty string for "${role}"`);
            assert.notEqual(spec.module, undefined, `spec.module must not be undefined for "${role}"`);
        }
    });

    test('no duplicate legacyBase across specifications', () => {
        const legacyBases = SYSTEM_DATABASE_ROLES.map(role => SYSTEM_DATABASES[role].legacyBase);
        const uniqueBases = new Set(legacyBases);
        assert.equal(uniqueBases.size, 17, 'All 17 legacyBase values must be unique');
    });

    test('explicit module property (possibly null) present for all 17 roles', () => {
        for (const role of SYSTEM_DATABASE_ROLES) {
            const spec = SYSTEM_DATABASES[role];
            assert.ok('module' in spec, `spec for "${role}" must have module property`);
            assert.ok(spec.module === null || typeof spec.module === 'string', `spec.module for "${role}" must be string or null`);
        }
    });

    test('all four derived lists have length 17 (census: 17 / 17 / 17 / 17)', () => {
        assert.equal(Object.keys(BASE_TO_KEY).length, 17, 'Object.keys(BASE_TO_KEY).length must be 17');
        assert.equal(SERVER_PROVISIONED_BASES.size, 17, 'SERVER_PROVISIONED_BASES.size must be 17');
        assert.equal(SYSTEM_DB_PREFIXES.length, 17, 'SYSTEM_DB_PREFIXES.length must be 17');
        assert.equal(DB_ID_MODULE_MAP.length, 17, 'DB_ID_MODULE_MAP.length must be 17');
    });

    test('live defect resolved: isSystemDatabase recognises db-hr and db-journal-general', () => {
        // Bare legacy IDs
        assert.equal(isSystemDatabase('db-hr'), true, 'isSystemDatabase("db-hr") must be true');
        assert.equal(isSystemDatabase('db-journal-general'), true, 'isSystemDatabase("db-journal-general") must be true');

        // Tenant-scoped IDs
        assert.equal(isSystemDatabase('db-hr-cmneyas2'), true, 'isSystemDatabase("db-hr-cmneyas2") must be true');
        assert.equal(isSystemDatabase('db-journal-general-cmneyas2'), true, 'isSystemDatabase("db-journal-general-cmneyas2") must be true');

        // getBaseDbId
        assert.equal(getBaseDbId('db-hr'), 'db-hr', 'getBaseDbId("db-hr") must return "db-hr"');
        assert.equal(getBaseDbId('db-hr-cmneyas2'), 'db-hr', 'getBaseDbId("db-hr-cmneyas2") must return "db-hr"');
        assert.equal(getBaseDbId('db-journal-general'), 'db-journal-general', 'getBaseDbId("db-journal-general") must return "db-journal-general"');
        assert.equal(getBaseDbId('db-journal-general-cmneyas2'), 'db-journal-general', 'getBaseDbId("db-journal-general-cmneyas2") must return "db-journal-general"');
    });
});
