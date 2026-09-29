import test from 'node:test';
import assert from 'node:assert/strict';
import { describeError } from '../src/lib/describe-error.ts';

test('ERR-1: new TypeError("x") -> "TypeError: x"', () => {
  assert.equal(describeError(new TypeError('x')), 'TypeError: x');
});

test('ERR-1: new Error("") with cause: new Error("root") -> "Error: root"', () => {
  assert.equal(describeError(new Error('', { cause: new Error('root') })), 'Error: root');
});

test('ERR-1: { message: "m" } (plain object) -> "Error: m"', () => {
  assert.equal(describeError({ message: 'm' }), 'Error: m');
});

test('ERR-1: { code: "P2022" } -> "Error: {\\"code\\":\\"P2022\\"}"', () => {
  assert.equal(describeError({ code: 'P2022' }), 'Error: {"code":"P2022"}');
});

test('ERR-1: "plain string" -> "plain string"', () => {
  assert.equal(describeError('plain string'), 'plain string');
});

test('ERR-1: null, undefined -> "Error: (no detail)"', () => {
  assert.equal(describeError(null), 'Error: (no detail)');
  assert.equal(describeError(undefined), 'Error: (no detail)');
});

test('ERR-1: an object whose message getter throws does not throw', () => {
  const throwingObj = {
    get message() {
      throw new Error('boom');
    },
  };
  assert.doesNotThrow(() => {
    const res = describeError(throwingObj);
    assert.match(res, /^Error:/);
  });
});

test('ERR-1: a circular object does not throw', () => {
  const circular: Record<string, unknown> = {};
  circular.self = circular;
  assert.doesNotThrow(() => {
    const res = describeError(circular);
    assert.match(res, /^Error:/);
  });
});

test('ERR-1: throwing Proxy does not throw', () => {
  const proxy = new Proxy({}, {
    get() {
      throw new Error('proxy trap error');
    }
  });
  assert.doesNotThrow(() => {
    const res = describeError(proxy);
    assert.match(res, /^Error:/);
  });
});
