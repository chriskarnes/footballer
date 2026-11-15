import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newId } from '../src/lib/new-id';

test('a save’s id is a uuid the server will take, and never the same twice', () => {
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const a = newId(), b = newId();
  assert.match(a, UUID);
  assert.notEqual(a, b);
  // Where randomUUID isn't there (plain http on a local address).
  const real = crypto.randomUUID;
  (crypto as { randomUUID?: unknown }).randomUUID = undefined;
  try { assert.match(newId(), UUID); } finally { crypto.randomUUID = real; }
});
