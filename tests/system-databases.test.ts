/**
 * KERN-5 pass 1 — System Database Vocabulary Invariant Tests
 *
 * Verifies:
 * 1. SYSTEM_DATABASE_ROLES contains exactly 16 roles.
 * 2. SYSTEM_DATABASE_NAMES has a non-empty string display name for every role in SYSTEM_DATABASE_ROLES.
 * 3. Exactly 16 names exist (no orphan entries in names dictionary).
 * 4. Specific roles match requirements (Projects, Tasks, CRM, Bobex, Material Articles, Bestek Templates, General Journal, HR).
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
    SYSTEM_DATABASE_ROLES,
    SYSTEM_DATABASE_NAMES,
} from '../src/lib/kernel/system-databases.ts';
import type { SystemDatabaseRole } from '../src/lib/kernel/system-databases.ts';

describe('KERN-5 — System Database Vocabulary (L0 Kernel)', () => {
    test('SYSTEM_DATABASE_ROLES has exactly 16 roles', () => {
        assert.equal(SYSTEM_DATABASE_ROLES.length, 16, 'Must contain exactly 16 system database roles');
    });

    test('SYSTEM_DATABASE_ROLES contains no duplicates', () => {
        const unique = new Set(SYSTEM_DATABASE_ROLES);
        assert.equal(unique.size, 16, 'All 16 roles must be distinct');
    });

    test('SYSTEM_DATABASE_NAMES has an entry for every role in SYSTEM_DATABASE_ROLES', () => {
        for (const role of SYSTEM_DATABASE_ROLES) {
            const name = SYSTEM_DATABASE_NAMES[role];
            assert.ok(typeof name === 'string' && name.trim().length > 0, `Role "${role}" must have a non-empty name`);
        }
    });

    test('SYSTEM_DATABASE_NAMES contains exactly the 16 roles and no extras', () => {
        const nameKeys = Object.keys(SYSTEM_DATABASE_NAMES);
        assert.equal(nameKeys.length, 16, 'Names dictionary must have exactly 16 entries');
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
