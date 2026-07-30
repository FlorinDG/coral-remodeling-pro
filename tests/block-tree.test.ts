/**
 * INVARIANT TESTS — block tree flatten/build  (src/lib/block-tree-dnd.ts)
 *
 * These guard the drag-and-drop engine rebuild. A quote/invoice document is a
 * nested block tree; every drag flattens it, re-orders, and rebuilds it. If that
 * round-trip is lossy, billable lines disappear from a client document silently.
 *
 * Most tests here pin CURRENT behaviour. The round-trip tests assert a PROPERTY
 * that must hold regardless of implementation: rebuilding a flattened tree must
 * return the same tree.
 */
import { test, describe } from 'node:test';
import { strict as assert } from 'node:assert';
import {
    countBlocks,
    assertTreeInvariants,
    flattenBlocks,
    buildBlocks,
    isContainer,
    canNest,
} from '../src/lib/block-tree-dnd.ts';

const b = (id: string, type: string, children?: unknown[], extra: Record<string, unknown> = {}) =>
    ({ id, type, ...(children ? { children } : {}), ...extra }) as never;

// section > [ subsection > [ post > [line, line] ], line ]
const tree = () => [
    b('sec1', 'section', [
        b('sub1', 'subsection', [
            b('post1', 'post', [b('l1', 'line'), b('l2', 'line')]),
        ]),
        b('l3', 'line'),
    ]),
    b('l4', 'line'),
];

describe('countBlocks', () => {
    test('counts every node at every depth', () => {
        assert.equal(countBlocks(tree() as never), 7);
    });
    test('empty tree is 0', () => {
        assert.equal(countBlocks([]), 0);
    });
    test('children arrays that are undefined do not throw', () => {
        assert.equal(countBlocks([b('x', 'line')] as never), 1);
    });
});

describe('flattenBlocks — descends ONLY into containers', () => {
    test('flattens the full container hierarchy', () => {
        const flat = flattenBlocks(tree() as never);
        assert.deepEqual(flat.map(f => f.id), ['sec1', 'sub1', 'post1', 'l1', 'l2', 'l3', 'l4']);
    });

    test('depths are correct', () => {
        const flat = flattenBlocks(tree() as never);
        const byId = Object.fromEntries(flat.map(f => [f.id, f.depth]));
        assert.deepEqual(byId, { sec1: 0, sub1: 1, post1: 2, l1: 3, l2: 3, l3: 1, l4: 0 });
    });

    test('parentIds are correct', () => {
        const flat = flattenBlocks(tree() as never);
        const byId = Object.fromEntries(flat.map(f => [f.id, f.parentId]));
        assert.deepEqual(byId, {
            sec1: null, sub1: 'sec1', post1: 'sub1', l1: 'post1', l2: 'post1', l3: 'sec1', l4: null,
        });
    });

    test('does NOT descend into a leaf line that has children (subcomponents stay inline)', () => {
        const withSub = [b('line1', 'line', [b('sub-a', 'line'), b('sub-b', 'line')])];
        const flat = flattenBlocks(withSub as never);
        assert.deepEqual(flat.map(f => f.id), ['line1'], 'subcomponents must not become top-level rows');
    });
});

describe('ROUND-TRIP INVARIANT — flatten → build must be lossless', () => {
    test('container hierarchy survives the round trip', () => {
        const before = tree();
        const after = buildBlocks(flattenBlocks(before as never));
        assert.equal(countBlocks(after), countBlocks(before as never));
        assert.ok(assertTreeInvariants(before as never, after));
    });

    test('structure (not just count) is preserved', () => {
        const before = tree();
        const after = buildBlocks(flattenBlocks(before as never)) as never as ReturnType<typeof tree>;
        const shape = (nodes: never[]): unknown =>
            (nodes || []).map((n: never) => ({ id: (n as never as { id: string }).id, children: shape((n as never as { children: never[] }).children || []) }));
        assert.deepEqual(shape(after as never[]), shape(before as never[]));
    });

    // ⚠️ Guards a real data-loss path: a leaf block that carries children
    // (line subcomponents / variants) is NOT flattened, so its children must be
    // carried through untouched by buildBlocks.
    test('a leaf line KEEPS its subcomponents through the round trip', () => {
        const before = [
            b('sec1', 'section', [
                b('line1', 'line', [b('sub-a', 'line'), b('sub-b', 'line')]),
            ]),
        ];
        const after = buildBlocks(flattenBlocks(before as never));
        assert.equal(
            countBlocks(after),
            countBlocks(before as never),
            'subcomponents were dropped by the flatten/build round trip — billable detail lost',
        );
    });
});

describe('assertTreeInvariants — the drop guard', () => {
    test('passes for an identical tree', () => {
        assert.equal(assertTreeInvariants(tree() as never, tree() as never), true);
    });

    test('fails when a block is lost', () => {
        const after = tree();
        (after[0] as never as { children: unknown[] }).children.pop();
        assert.equal(assertTreeInvariants(tree() as never, after as never), false);
    });

    test('fails when an id changes even if the count matches', () => {
        const after = tree();
        (after[1] as never as { id: string }).id = 'different';
        assert.equal(assertTreeInvariants(tree() as never, after as never), false);
    });

    test('passes for a pure reorder (same ids, different order)', () => {
        const after = [tree()[1], tree()[0]];
        assert.equal(assertTreeInvariants(tree() as never, after as never), true);
    });
});

describe('nesting rules', () => {
    test('containers are section/subsection/post', () => {
        assert.equal(isContainer('section'), true);
        assert.equal(isContainer('subsection'), true);
        assert.equal(isContainer('post'), true);
        assert.equal(isContainer('line'), false);
        assert.equal(isContainer('text'), false);
    });

    test('anything may sit at root', () => {
        assert.equal(canNest('section', 'root'), true);
        assert.equal(canNest('line', 'root'), true);
    });

    test('a container may not be nested inside a line', () => {
        assert.equal(canNest('section', 'line'), false);
        assert.equal(canNest('post', 'line'), false);
    });

    test('any block may nest inside a container', () => {
        assert.equal(canNest('line', 'section'), true);
        assert.equal(canNest('subsection', 'section'), true);
    });
});
