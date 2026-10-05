import { test } from 'node:test';
import assert from 'node:assert/strict';
import { urlFieldHref } from '../src/lib/files.ts';

test('a stored file opens through the file route; a web address as is; a bare domain gets https (throw proof: the old prefix-everything rule)', () => {
    assert.equal(urlFieldHref('t_cmneyas2b0000veqvkgl2luz1/receipt/a97/Factuur.pdf'), '/api/files/t_cmneyas2b0000veqvkgl2luz1/receipt/a97/Factuur.pdf');
    assert.equal(urlFieldHref('/api/files/t_x/a.pdf'), '/api/files/t_x/a.pdf');
    assert.equal(urlFieldHref('https://coral-group.be'), 'https://coral-group.be');
    assert.equal(urlFieldHref('coral-group.be'), 'https://coral-group.be');
    assert.equal(urlFieldHref(''), '');
    assert.equal(urlFieldHref(null), '');
});
