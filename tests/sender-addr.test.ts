import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addrKey } from '../src/lib/sender-addr';

test('an IPv4 address is one sender', () => {
  assert.equal(addrKey(' 203.0.113.7 '), '203.0.113.7');
  assert.equal(addrKey('::ffff:203.0.113.7'), '203.0.113.7');
});

// One home or phone has a whole /64 to send from: the limit is on that.
test('every address in an IPv6 /64 is the same sender', () => {
  const a = addrKey('2001:db8:12:3400:1111:2222:3333:4444');
  assert.equal(a, '2001:db8:12:3400::/64');
  assert.equal(addrKey('2001:0DB8:0012:3400::1'), a);
  assert.equal(addrKey('[2001:db8:12:3400:ffff:ffff:ffff:ffff]'), a);
  assert.notEqual(addrKey('2001:db8:12:3401::1'), a);
  assert.equal(addrKey('::1'), '0:0:0:0::/64');
});

test('something unreadable still counts against itself', () => {
  assert.equal(addrKey('not:an:address'), 'not:an:address');
  assert.equal(addrKey('unknown'), 'unknown');
});
