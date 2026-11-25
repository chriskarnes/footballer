import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BUSY_NETWORK, JUST_SENT, TOO_MANY, emailsPaused, limitMessage } from '../src/lib/sign-in-errors';

test('limitMessage tells the three sign-in limits apart', () => {
  // This address, under a minute ago (Supabase's per-address wait).
  assert.equal(limitMessage({ status: 429, code: 'over_email_send_rate_limit', message: 'For security purposes, you can only request this after 42 seconds.' }), JUST_SENT);
  // The app's emails for the hour, for everyone.
  assert.equal(limitMessage({ status: 429, code: 'over_email_send_rate_limit', message: 'Email rate limit exceeded' }), emailsPaused(null));
  assert.equal(limitMessage({ status: 429, message: 'email rate limit exceeded' }), emailsPaused(null));
  assert.match(limitMessage({ status: 429, code: 'over_email_send_rate_limit', message: 'Email rate limit exceeded' }, 'support@example.com')!, /write to support@example\.com\.$/);
  // This network (a team on one Wi-Fi).
  assert.equal(limitMessage({ status: 429, code: 'over_request_rate_limit', message: 'Request rate limit reached' }), BUSY_NETWORK);
  // A 429 with nothing else to go on.
  assert.equal(limitMessage({ status: 429, message: 'Too many requests' }), TOO_MANY);
  assert.equal(limitMessage({ status: 429, message: 'only request this once every 60 seconds' }), JUST_SENT);
  // Not a limit at all.
  assert.equal(limitMessage({ status: 400, code: 'email_address_invalid', message: 'Email address is invalid' }), null);
  assert.equal(limitMessage({ status: 403, code: 'otp_expired', message: 'Token has expired or is invalid' }), null);
});
