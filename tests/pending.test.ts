import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { pendingFinish, pendingWorkout } from '../src/lib/pending';

// A phone's storage and network, enough for the queue.
const store = new Map<string, string>();
(globalThis as any).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => { store.set(k, String(v)); },
  removeItem: (k: string) => { store.delete(k); },
};
let calls: { method: string; body: any }[] = [];
let answer: (n: number) => Response | Promise<Response> = () => Response.json({ id: 'row-1' });
(globalThis as any).fetch = async (_url: string, init: RequestInit) => {
  calls.push({ method: init.method!, body: JSON.parse(String(init.body)) });
  return answer(calls.length);
};

beforeEach(() => { store.clear(); calls = []; answer = () => Response.json({ id: 'row-1' }); });

test('a kept finish is sent once and then gone', async () => {
  const id = pendingWorkout.stash({ title: 'A', client_id: 'c1' }, 'u1');
  assert.equal(pendingWorkout.has(id), true);
  assert.deepEqual(await pendingWorkout.flush('u1'), { saved: true, settled: true });
  assert.equal(calls.length, 1);
  assert.equal(pendingWorkout.any(), false);
  assert.deepEqual(pendingWorkout.result(id), { ok: true, id: 'row-1' });
});

test('one account’s finish waits for them, not the next to sign in', async () => {
  pendingWorkout.stash({ title: 'A' }, 'u1');
  assert.deepEqual(await pendingWorkout.flush('u2'), { saved: false, settled: false });
  assert.equal(calls.length, 0);
  assert.equal(pendingWorkout.peek('u2'), false);
  assert.equal(pendingWorkout.peek('u1'), true);
});

test('no signal leaves it waiting', async () => {
  answer = () => { throw new TypeError('Failed to fetch'); };
  const id = pendingWorkout.stash({ title: 'A' }, 'u1');
  assert.deepEqual(await pendingWorkout.flush('u1'), { saved: false, settled: false });
  assert.equal(pendingWorkout.has(id), true);
});

test('a server error leaves it waiting; a refusal settles it as not saved', async () => {
  answer = () => new Response('', { status: 503 });
  const id = pendingWorkout.stash({ title: 'A' }, 'u1');
  await pendingWorkout.flush('u1');
  assert.equal(pendingWorkout.has(id), true);
  answer = () => new Response('', { status: 400 });
  assert.deepEqual(await pendingWorkout.flush('u1'), { saved: false, settled: true });
  assert.equal(pendingWorkout.has(id), false);
  assert.deepEqual(pendingWorkout.result(id), { ok: false, id: undefined });
});

// The runner keeps a finish before sending it, then takes it out itself.
test('drop takes one out; reown says whose it is', async () => {
  const a = pendingWorkout.stash({ title: 'A' }, null);
  const b = pendingWorkout.stash({ title: 'B' }, null);
  pendingWorkout.drop(a);
  assert.equal(pendingWorkout.has(a), false);
  assert.equal(pendingWorkout.has(b), true);
  pendingWorkout.reown(b, 'u1');
  assert.equal(pendingWorkout.peek('u2'), false);
  assert.equal(pendingWorkout.peek('u1'), true);
});

test('a saved-for-later session deleted since is sent whole', async () => {
  answer = (n) => (n === 1 ? new Response('', { status: 404 }) : Response.json({ id: 'row-2' }));
  pendingFinish.stash({ id: 'w1', actual_minutes: 10, fallback: { title: 'A', client_id: 'c1' }, feel: 'hard' }, 'u1');
  assert.deepEqual(await pendingFinish.flush('u1'), { saved: true, settled: true });
  assert.deepEqual(calls.map((c) => c.method), ['PATCH', 'POST']);
  assert.deepEqual(calls[1].body, { title: 'A', client_id: 'c1', feel: 'hard' });
});

// Kept before 13 Nov as one object, not a list. It got a new id on every
// read, so it never matched the one just sent and was sent again.
test('a finish kept in the old format is sent once', async () => {
  store.set('forge.pendingWorkout', JSON.stringify({ at: Date.now(), payload: { title: 'Old' } }));
  await pendingWorkout.flush('u1');
  await pendingWorkout.flush('u1');
  assert.equal(calls.length, 1);
  assert.equal(pendingWorkout.any(), false);
});
