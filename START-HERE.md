# Start here — Windows, VS Code, Neon and Vercel

This is the complete source package. You must connect **your own Neon database** and **your own Razorpay merchant account** to store real registrations and receive money. No account keys are included.

## 1. Extract and open the correct folder

1. Install Node.js **22.x LTS** on Windows.
2. Extract the ZIP. Open the `tournament-zone` folder in VS Code.
3. In VS Code, choose Terminal → New Terminal.
4. Confirm the terminal is in the folder containing `package.json`, `schema.sql` and `vercel.json`. Do not run `cd source`; there is no source subfolder.
5. Run:

```powershell
node -v
npm install
npm run setup
```

If PowerShell blocks npm.ps1, use `npm.cmd` instead of `npm`, or select Command Prompt as the VS Code terminal. You do not need to weaken Windows execution policy.

Setup asks for an admin password. **Press Enter to use the password you requested in chat.** Its salted hash is already included in the setup script; the plaintext is not stored in public code. Alternatively, type a new password with at least 12 characters. Typed text is visible in the local terminal.

Setup creates `.env.local` and prints a private authenticator secret. It will not overwrite an existing `.env.local`.

## 2. Set up your authenticator

1. Open Google Authenticator, Microsoft Authenticator or another TOTP-compatible app on your phone.
2. Add an account manually using a setup key.
3. Account name: `Tournament Zone Admin`.
4. Secret: use the secret printed by `npm run setup` or the value of `ADMIN_TOTP_SECRET` in `.env.local`.
5. Type: **Time based**. The app generates a six-digit code every 30 seconds.
6. Keep a private backup of the secret. Never commit `.env.local` to GitHub or share this key.

Both your password and the current authenticator code are required. Keep your phone clock automatic. There is no insecure password-only fallback.

## 3. Connect Neon Postgres

1. Open [Neon](https://console.neon.tech/) and create a project/database. Choose a region suitable for your users.
2. Use Neon’s Connect dialog to copy the Postgres connection string. The pooled connection string is supported.
3. Open `.env.local` in VS Code and put the full connection string after `DATABASE_URL=`. Keep its query string, including `sslmode=require`.
4. Do not put database credentials into any file under `public/`.
5. Run:

```powershell
npm run db:setup
```

Expected: `Neon database tables are ready. You can now sign in to /admin.`

Alternative: paste the complete contents of `schema.sql` into Neon’s SQL Editor and run it on the same database/branch as DATABASE_URL. Running the migration again does not delete registrations.

The Neon HTTPS SQL API is used directly from the server with parameterised queries. A standard non-Neon Postgres connection string is not supported by this adapter.

## 4. Configure Razorpay in test mode first

1. Sign in to your [Razorpay dashboard](https://dashboard.razorpay.com/).
2. Use Test Mode and generate test API keys.
3. Add the values to `.env.local`:

```dotenv
RAZORPAY_KEY_ID=your_test_key_id
RAZORPAY_KEY_SECRET=your_test_key_secret
```

4. Generate a separate long, random webhook secret:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

5. Save that private value as `RAZORPAY_WEBHOOK_SECRET` in `.env.local`. You will use exactly the same value in Razorpay’s webhook settings after deployment.
6. In Razorpay, enable **automatic capture**. Authorised-but-not-captured payments do not confirm a registration.

The website uses Razorpay standard checkout. Available payment methods depend on Razorpay, your account and the current checkout environment. Your visitors pay your merchant account; no money is routed to the website developer.

## 5. Run locally

Keep `APP_URL=http://localhost:3000` in your local `.env.local`, then run:

```powershell
npm run check
npm run dev
```

Open:

- Website: `http://localhost:3000`
- Admin: `http://localhost:3000/admin`

`/admin` and `/admin/login` both show the login form when you are signed out. An authenticated visitor sees the dashboard. Every admin API request independently checks authentication; hiding the page is not the security boundary.

Log in with your chosen password and a current authenticator code. In Tournament settings:

- Confirm the title and ₹50 fee.
- Keep the date blank for “To be announced”, or enter the date/time in **IST**.
- Add your organiser name and real support email.
- Add the format/time control when decided.
- Add a Chess.com tournament link when you have created the event there.
- Select Open and save once payment settings are ready for testing.

A localhost site cannot receive public Razorpay webhooks. Client verification/status reconciliation can be tested locally; verify webhooks on your deployed test-mode website.

## 6. Build before deployment

Stop the local terminal server with Ctrl+C if needed, then run:

```powershell
npm test
npm run build
```

Expected: 27 passing tests and a successful production asset build. Test execution uses mocked payment/database responses; it does not charge anyone.

## 7. Deploy the source to Vercel

1. Create a private GitHub repository and upload/commit the contents of `tournament-zone`. Keep `package.json` at the repository root, or set Vercel’s Root Directory to the containing `tournament-zone` folder.
2. **Do not upload `.env.local`**. The included `.gitignore` excludes secrets.
3. In [Vercel](https://vercel.com/), select Add New → Project, then import the repository.
4. Use these project settings:

| Setting | Value |
| --- | --- |
| Framework preset | Other |
| Node.js version | 22.x |
| Install command | `npm install` |
| Build command | `npm run build` |
| Output directory | `dist` |
| Root directory | The folder that contains `package.json` |

5. Add every variable from `.env.local` to Vercel → Project Settings → Environment Variables:

| Variable | What to put there |
| --- | --- |
| `DATABASE_URL` | Full Neon connection string for the migrated database |
| `APP_URL` | Your exact production origin, e.g. `https://your-project.vercel.app` |
| `ADMIN_PASSWORD_HASH` | Entire generated value, including the colon |
| `ADMIN_TOTP_SECRET` | Generated authenticator secret |
| `SESSION_SECRET` | Generated random session secret |
| `RAZORPAY_KEY_ID` | Test key initially; live key only after testing |
| `RAZORPAY_KEY_SECRET` | Matching test/live secret |
| `RAZORPAY_WEBHOOK_SECRET` | Your separate webhook signing secret |

Do not prefix these with `NEXT_PUBLIC_` or `VITE_`. Only the Razorpay key ID is returned to checkout; database credentials and signing secrets stay server-side.

6. Deploy. If the exact Vercel domain was not known earlier, set APP_URL after the first deployment and redeploy. Use the canonical production domain when registering/logging in.
7. Keep APP_URL on your local machine as `http://localhost:3000`; its Vercel value is separate.
8. Environment variable changes need a redeploy. Do not deploy only the `dist` folder: Vercel also needs `api/`, `lib/`, `views/` and `vercel.json` from the source repository.

`vercel.json` also sets the non-secret `NODEJS_HELPERS=0` flag, so webhook signatures are checked against the raw request body. Keep this setting. See [Vercel’s official Node configuration documentation](https://vercel.com/docs/functions/runtimes/node-js/advanced-node-configuration).

The configuration includes admin rewrites and a Node serverless API. Nothing depends on Cloudflare D1 or an in-memory database.

## 8. Connect the production webhook

In Razorpay Test Mode, create a webhook with:

- URL: `https://YOUR-VERCEL-DOMAIN/api/webhook`
- Secret: exactly the `RAZORPAY_WEBHOOK_SECRET` configured in Vercel
- Events: `payment.captured`, `order.paid`, `refund.processed`

Replace YOUR-VERCEL-DOMAIN with your actual deployed hostname. The webhook must be publicly reachable. If Vercel deployment protection blocks it, use the accessible production deployment for the public tournament/webhook; keep dashboard authentication enabled in the application.

Do not paste a webhook signing secret or API secret into the public website.

## 9. Complete a test-mode registration

1. Open the deployed website using the exact APP_URL origin.
2. Register with your own test contact details and a valid-format Chess.com username.
3. Save the generated reference and access code, then continue to payment.
4. Complete Razorpay’s Test Mode checkout using provider-supplied test instruments.
5. Confirm that the receipt says Paid and the admin list shows the same reference and amount.
6. Close/reopen the page and use Check registration to confirm persistence.
7. Test cancelling checkout and returning using the receipt credentials.
8. Send/retry a test webhook in Razorpay and verify it does not duplicate the entry.
9. Issue a test-mode refund from admin. Confirm status through Sync/webhook.
10. Delete an unpaid test record; delete/archive a paid test record and verify it is available under Deleted entries for payment reconciliation.
11. Check the form, college dropdown, policies and receipt on a real phone and laptop.

Use a separate Neon branch/database for testing if possible. Do not mix test payments with your live event records.

## 10. Go live

1. Complete Razorpay merchant activation and confirm the provider permits this tournament use case.
2. Switch to live API credentials in Vercel.
3. Configure the corresponding Live Mode webhook and matching secret.
4. Use a clean live Neon database/branch and run `schema.sql` against it.
5. Redeploy with the updated values.
6. Sign in, review organiser contact and policies, then open registration.
7. Check a real low-value payment/refund yourself before sharing the tournament widely.

The website is not published or connected to your merchant/database accounts by this ZIP. Actual deployment and live end-to-end testing require those accounts.

## Daily admin tasks

**Delete wrong entries:** Registrations → Delete → type the displayed reference. A record without a payment order is permanently removed; financial records are archived under Deleted entries. Deletion does not issue a refund.

**Cancel the tournament:** Settings → Cancelled → Save. Then refund each paid entry using Refund. Monitor Refund pending and use Sync; reconcile outstanding items in Razorpay. Cancellation is not an automatic bulk refund command.

**Wrong payment status:** Use Sync in admin or Check registration as the player. Do not manually mark a pending record paid just because someone sends a screenshot.

**Send joining instructions:** Use the registered contact details/CSV. Sending emails or SMS is a manual organiser task; no messaging provider is included.

**Forgotten player access code:** It is hashed in the database and cannot be recovered. The organiser can verify the participant using their contact and provider payment details, report status privately, and resolve issues. Do not publish registration data or issue a new charge blindly.

## Troubleshooting

| Problem | Fix |
| --- | --- |
| Registration opens soon | Complete setup and select Open in admin. |
| Service temporarily unavailable | Run `npm run check`; inspect Vercel Function Logs; verify Neon URL, branch and schema. No database secrets are displayed in public errors. |
| Request origin not allowed | Set APP_URL to the exact domain being used; redeploy. Preview domains are separate and intentionally do not bypass origin checks. |
| Admin setup incomplete | Add generated password hash, TOTP secret and session secret to Vercel; redeploy. |
| Invalid authenticator code | Use the matching setup secret, automatic phone time and a fresh six-digit code. Already-used codes cannot be reused for 90 seconds. |
| Too many login attempts | Wait 15 minutes. The rate limit is stored in Neon and survives serverless restarts. |
| Payment processing | Ensure automatic capture is enabled; refresh status before paying again. |
| Refund pending after an error | Check Razorpay and click Sync. A network timeout can occur after the provider accepted the refund; avoid duplicate refund requests. |
| Webhooks do not arrive | Check the exact public /api/webhook URL, webhook events, signing secret, matching test/live mode and deployment protection. |
| Admin page is 404 | Deploy the whole source with vercel.json, not only static dist files. |
| Duplicate email/username | Resume the original reference, or ask the admin to verify/correct the earlier entry. |
| New environment values have no effect | Redeploy after changing environment variables. |

To revoke all admin sessions, generate a new SESSION_SECRET and redeploy. To change the admin password, generate a fresh scrypt hash locally using `passwordHash()` from `lib/security.mjs`, replace ADMIN_PASSWORD_HASH, and rotate SESSION_SECRET. To replace a lost authenticator, generate a new setup in a separate empty local folder and update ADMIN_TOTP_SECRET plus SESSION_SECRET in Vercel. Never create a public reset endpoint.
