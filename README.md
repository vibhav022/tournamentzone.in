# Tournament Zone — complete Vercel + Neon source

A responsive Indore college chess tournament website with a real server-side registration/payment implementation. Entry fee starts at ₹50; prizes are ₹500, ₹250 and ₹100. The schedule starts as “To be announced”. Games take place on Chess.com.

**Start with [START-HERE.md](START-HERE.md).** It has the Windows, Neon, Razorpay and Vercel setup steps in order.

## Included

- Responsive public page, registration, 120+ Indore-area college/department suggestions, custom college entry, study year and Chess.com username.
- Razorpay orders, server-side checkout signature verification, captured-payment/amount/currency/order checks, signed webhooks and payment reconciliation.
- Neon Postgres persistence using Neon's HTTPS SQL endpoint. Every user value is passed as a SQL parameter.
- Reference number, private lookup token, payment status and downloadable text receipt. No public registration list or PII lookup.
- Admin password + mandatory TOTP authenticator, expiring database-backed sessions, HTTP-only cookies, CSRF/origin protection, persistent login throttling and audit history.
- Registration search/filter, CSV export, deletion, full refunds and payment sync.
- Editable fee, date/time, registration state, organiser identity/contact and Chess.com tournament link.
- Privacy policy, terms, cancellation/full-refund policy and 404 page.
- Database migration, environment checker, Vercel config and automated tests.

## Stack

Native HTML/CSS/JavaScript frontend and Node.js Vercel functions, with Neon Postgres and Razorpay. Vercel Node helpers are disabled with `NODEJS_HELPERS=0` in `vercel.json` so webhook signatures use the untouched request bytes, following [Vercel’s Node configuration guidance](https://vercel.com/docs/functions/runtimes/node-js/advanced-node-configuration). No React/Next.js, Cloudflare runtime, paid map API, third-party frontend CDN, build-time font download or npm runtime dependencies are required. `npm install` creates a consistent project installation; `npm run build` copies the public assets for Vercel. Node 22.x is the target runtime.

## Commands

```
npm install
npm run setup
npm run db:setup
npm run check
npm run dev
npm test
npm run build
```

## Project map

- `public/`: browser UI, responsive CSS, college suggestions and policies.
- `views/`: admin login/dashboard templates, served by the backend. Not copied to public assets.
- `api/index.js`: Vercel Node API and admin page gate.
- `lib/db.mjs`: parameterised Neon HTTPS database adapter.
- `lib/security.mjs`: password hashing, TOTP, sessions, origin checks, rate limits.
- `lib/payments.mjs`: Razorpay API, HMAC verification and captured-payment checks.
- `schema.sql`: idempotent schema setup.
- `scripts/`: local development, build, setup and diagnostics.
- `tests/`: security/payment tests with mocked Neon and Razorpay responses.
- `vercel.json`: serverless routes, output config, security headers and CSP.

## Important implementation details

Registration is **closed by default**. Real registration opens after Neon, admin authentication, payment credentials, webhook secret, organiser details and APP_URL are configured, and the organiser selects Open in admin.

A reference is created before checkout; it is a pending registration until payment is captured and verified. The browser saves only the reference, access token, minimal receipt data and status for return visits. Players should download the receipt, particularly on shared devices or when local storage is disabled.

The fee is read from the database when the registration is created. An admin price change does not change existing pending orders. Duplicate email/Chess.com entries are rejected by partial unique indexes. An interrupted checkout can be resumed with the reference and private access code.

The database order claim prevents concurrent checkout creation. Unexposed orphan orders may exist at the provider after a network failure but are not shown to the player. Use provider reconciliation for unexpected payments. Captured webhooks and client verification are safe to repeat and do not downgrade refunded registrations.

Deleting an unpaid entry with no order permanently removes it. Deleting an entry that has an order or payment archives it from the active list, preserving financial reconciliation and refund eligibility. Admin can find it using Deleted entries. Deleting does not refund. A reference confirmation is required for deletions/refunds.

Refund requests atomically move Paid to Refund pending before contacting Razorpay. If the request times out or fails, the record deliberately remains Refund pending; use Sync and the Razorpay dashboard to establish whether a refund exists before trying another one. Do not blindly reset it or issue duplicate refunds. A failed refund requires manual provider investigation. Refund webhook processing only accepts a matching full refund amount.

Cancellation changes the event state; it **does not automatically refund every player**. The organiser must use the per-player Refund action or reconcile full refunds made through the Razorpay dashboard. This is stated in admin.

The dashboard displays the latest 2,000 records, and CSV exports the currently filtered records within that limit. Use Neon for a complete export if the tournament grows beyond that size. Summary cards describe the loaded records. Audit history shows the latest 50 actions.

This is a single-admin, single-tournament application. There is no automatic email/SMS service, automatic Chess.com tournament creation, match scheduling, automated prize payout, public leaderboard or automated eligibility verification. The organiser creates the Chess.com event and communicates joining instructions using the submitted details.

College suggestions are a broad convenience list, including departments/institutes and nearby Indore institutions, not a verified exhaustive or accreditation directory. Students can submit any missing college name. Review `public/colleges.js` against your eligibility rules before launch.

Policies are practical organiser-facing terms, not a certification of legal compliance. Review the identity, support contact, refund timing and retention practices before opening registration. Confirm your payment provider permits your event and use an activated merchant account.

## Validation performed

- Production asset build passed.
- 27 automated tests passed: password/TOTP, session/CSRF/origin enforcement, throttling, registration validation, server-authoritative pricing, parameterised SQL, checkout HMAC verification, captured-payment checks, signed webhooks, private lookup, duplicate-refund prevention and payment-record preservation.
- Desktop and 390px/320px mobile-width rendering inspected in a browser; narrow mobile body overflow checked.
- Public registration lookup and protected admin entry checked in the local browser preview.
- Tests use mock database/provider responses. A real Neon database, live Razorpay payment/refund and deployed Vercel execution were **not tested** because account credentials were not supplied. Complete the test-mode launch checks in START-HERE.md before accepting money.

No software can promise zero future errors or absolute security. This package includes defensive controls and diagnostics; keep account credentials private, monitor errors and test your exact deployment.
