import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ownerOf, readSession } from '../src/lib/phone-session';

test('a session is signed in', () => {
  assert.deepEqual(readSession({ data: { session: { user: { id: 'u1' } } }, error: null }), { state: 'in', uid: 'u1' });
});

test('no session and no error is signed out', () => {
  assert.deepEqual(readSession({ data: { session: null }, error: null }), { state: 'out' });
});

// What the auth client hands back with no signal and a sign-in due for
// renewal. Read as signed out, it emptied the offline cache and the player's
// unsent Speed results.
test('no session with an error is not a sign-out', () => {
  assert.deepEqual(readSession({ data: { session: null }, error: new Error('Failed to fetch') }), { state: 'unknown' });
  assert.deepEqual(readSession(null), { state: 'unknown' });
});

test('work that can’t be sent belongs to the phone’s sign-in, then the page’s player', () => {
  assert.equal(ownerOf({ state: 'in', uid: 'u1' }, 'u2', 'u3'), 'u1');
  assert.equal(ownerOf({ state: 'out' }, 'u2', 'u3'), 'u2');
  assert.equal(ownerOf({ state: 'unknown' }, 'u2', 'u3'), 'u2');
});

test('the last account here stands in only while the sign-in is out of reach', () => {
  assert.equal(ownerOf({ state: 'unknown' }, null, 'u3'), 'u3');
  // Signed out for real: a sibling's finish mustn't go to the last account.
  assert.equal(ownerOf({ state: 'out' }, null, 'u3'), null);
});
