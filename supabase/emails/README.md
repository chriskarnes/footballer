# Auth emails

The five emails Supabase sends, branded. Supabase has no API for these in the
dashboard project, so they are pasted in by hand: Authentication, then Emails,
then Templates.

| Template in Supabase | File | Subject |
| --- | --- | --- |
| Magic Link | `magic-link.html` | Your sign-in link |
| Confirm signup | `confirm-signup.html` | Welcome! Tap to start training |
| Invite user | `invite.html` | You're invited to train |
| Reset Password | `reset-password.html` | Get back into your account |
| Change Email Address | `change-email.html` | Confirm your new email |

The app signs players in with an emailed link only, so Magic Link and Confirm
signup (a first sign-in) are the two a player actually receives.

Every link is `{{ .ConfirmationURL }}`, which is what `/auth/callback` expects.
They are the platform's emails, in Train.futbol's colours: Supabase sends one
set for every academy, so they can't carry an academy's own brand.

## Still to do, in your own accounts

1. Pick the sending domain. The app runs on `train.futbol`.
2. Create a sender (Resend, for example) and verify the domain with the SPF,
   DKIM and DMARC records it gives you.
3. In Supabase: Authentication, then Emails, then SMTP Settings. Turn on custom
   SMTP and enter the provider's host, port, username and password, with the
   sender name `Train.futbol` and an address on that domain.
4. Paste each template and subject above, and send yourself a sign-in link.
