import { test } from 'node:test';
import assert from 'node:assert/strict';
import { putName } from '../src/lib/ai-name';

// The AI never gets the player's name: it writes {name}, and we fill it in.
test('the name goes in where the AI left room for it', () => {
  assert.equal(putName('{name}, wall passes go up to 60 each foot.', 'Sam'), 'Sam, wall passes go up to 60 each foot.');
  assert.equal(putName('Nice work this week, {name}.', ' Sam '), 'Nice work this week, Sam.');
});

test('with no name known, the slot comes out cleanly', () => {
  assert.equal(putName('{name}, wall passes go up to 60 each foot.', ''), 'Wall passes go up to 60 each foot.');
  assert.equal(putName('Nice work this week, {name}.', null), 'Nice work this week.');
  assert.equal(putName('A lighter week.', 'Sam'), 'A lighter week.');
});
