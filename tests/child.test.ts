import { test } from 'node:test';
import assert from 'node:assert/strict';
import { consentNeed, isSampleEmail, isUnder13, looksLikeEmail, requestsToday, shortName } from '../src/lib/child';
import { confirmEmail, requestEmail } from '../src/lib/consent-email';

test('a full name is kept as a first name and last initial', () => {
  assert.equal(shortName('Jack Morris'), 'Jack M.');
  assert.equal(shortName('  jack   morris '), 'jack M.');
  assert.equal(shortName('Mary Ann Smith'), 'Mary S.');
  assert.equal(shortName('Jean-Luc O’Neil'), 'Jean-Luc O.');
  assert.equal(shortName('Zoë Ångström'), 'Zoë Å.');
});

test('a name that is already short stays as it is', () => {
  assert.equal(shortName('Sam'), 'Sam');
  assert.equal(shortName('Jack M.'), 'Jack M.');
  assert.equal(shortName('Jack M'), 'Jack M.');
  assert.equal(shortName(''), '');
  assert.equal(shortName(null), '');
  assert.equal(shortName('Jack -'), 'Jack');
});

test('under 13 is the two youngest ranges', () => {
  assert.equal(isUnder13('u10'), true);
  assert.equal(isUnder13('10_12'), true);
  assert.equal(isUnder13('13_15'), false);
  assert.equal(isUnder13('18_plus'), false);
  assert.equal(isUnder13(null), false);
});

test('the seed scripts’ sample players are recognised by their address', () => {
  assert.equal(isSampleEmail('kestrel-mia-alvarez@train.futbol'), true);
  assert.equal(isSampleEmail('Demo-Noah-Kim@Train.Futbol'), true);
  assert.equal(isSampleEmail('someone+kestrel@gmail.com'), false);
  assert.equal(isSampleEmail('a@train.futbol.example.com'), false);
  assert.equal(isSampleEmail(null), false);
});

const base = { ageBand: '10_12', email: 'kid@example.com', staffHere: false, parentHeld: false, agreed: false, canEmail: true };

test('a player under 13 with no agreement is asked: by email, or here when it is the parent’s account', () => {
  assert.deepEqual(consentNeed(base), { how: 'email' });
  assert.deepEqual(consentNeed({ ...base, parentHeld: true }), { how: 'here' });
  assert.deepEqual(consentNeed({ ...base, parentHeld: true, canEmail: false }), { how: 'here' });
});

test('nobody is asked who doesn’t need to be', () => {
  assert.equal(consentNeed({ ...base, agreed: true }), null);
  assert.equal(consentNeed({ ...base, ageBand: '13_15' }), null);
  assert.equal(consentNeed({ ...base, ageBand: null }), null);
  assert.equal(consentNeed({ ...base, staffHere: true }), null);
  assert.equal(consentNeed({ ...base, email: 'kestrel-leo-marsh@train.futbol' }), null);
});

test('with no way to send email, a player’s own account isn’t asked yet', () => {
  assert.equal(consentNeed({ ...base, canEmail: false }), null);
});

test('email addresses are checked loosely before anything is sent', () => {
  assert.equal(looksLikeEmail('parent@example.com'), true);
  assert.equal(looksLikeEmail('parent@example'), false);
  assert.equal(looksLikeEmail('two words@example.com'), false);
});

test('the request says what’s kept, how to say no, and that it’s deleted in 30 days', () => {
  const m = requestEmail({ to: 'p@example.com', player: 'Sam', academies: ['Kestrel Soccer Training'], link: 'https://kestrel.train.futbol/consent/abc', privacy: 'https://train.futbol/privacy', contact: 'support@train.futbol' });
  assert.equal(m.subject, 'Can Sam train on Train.futbol?');
  assert.match(m.text, /Kestrel Soccer Training/);
  assert.match(m.text, /first name and last initial/);
  assert.match(m.text, /https:\/\/kestrel\.train\.futbol\/consent\/abc/);
  assert.match(m.text, /within 30 days/);
  assert.match(m.text, /support@train\.futbol/);
  assert.match(m.html, /href="https:\/\/kestrel\.train\.futbol\/consent\/abc"/);
});

test('names are escaped in the email’s HTML', () => {
  const m = requestEmail({ to: 'p@example.com', player: '<b>Sam</b>', academies: ['A & B'], link: 'https://x/consent/t', privacy: 'https://x/privacy', contact: null });
  assert.doesNotMatch(m.html, /<b>Sam<\/b>/);
  assert.match(m.html, /&lt;b&gt;Sam&lt;\/b&gt;/);
  assert.match(m.html, /A &amp; B/);
});

test('the confirmation says when they agreed and how to change their mind', () => {
  const m = confirmEmail({ to: 'p@example.com', player: 'Sam', agreedOn: 'November 22, 2026', accountEmail: 'sam@example.com', privacy: 'https://train.futbol/privacy', contact: 'support@train.futbol' });
  assert.match(m.text, /on November 22, 2026 you agreed/);
  assert.match(m.text, /Delete account/);
  assert.match(m.text, /sam@example\.com/);
  assert.match(m.text, /didn’t agree/);
});

test('request emails are counted from the first of the day, and start again a day later', () => {
  const now = Date.parse('2026-11-23T12:00:00Z');
  assert.deepEqual(requestsToday(null, now), { fresh: true, sent: 0 });
  assert.deepEqual(requestsToday({ requests_sent: 0, requests_since: null }, now), { fresh: true, sent: 0 });
  assert.deepEqual(requestsToday({ requests_sent: 2, requests_since: '2026-11-23T08:00:00Z' }, now), { fresh: false, sent: 2 });
  assert.deepEqual(requestsToday({ requests_sent: 3, requests_since: '2026-11-22T11:59:00Z' }, now), { fresh: true, sent: 0 });
  assert.deepEqual(requestsToday({ requests_sent: null, requests_since: '2026-11-23T11:00:00Z' }, now), { fresh: false, sent: 0 });
});
