CREATE TABLE IF NOT EXISTS tournament_settings (
 id integer PRIMARY KEY CHECK(id=1), title text NOT NULL DEFAULT 'Indore Campus Chess Open',
 fee_paise integer NOT NULL DEFAULT 5000 CHECK(fee_paise BETWEEN 100 AND 100000),
 starts_at timestamptz, status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','open','closed','cancelled','completed')),
 contact_email text NOT NULL DEFAULT '', organiser_name text NOT NULL DEFAULT '', chess_url text NOT NULL DEFAULT '',
 format text NOT NULL DEFAULT 'Format and time control to be announced', updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO tournament_settings(id) VALUES(1) ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS registrations (
 id uuid PRIMARY KEY, reference text UNIQUE NOT NULL, access_hash text NOT NULL,
 name text NOT NULL, email text NOT NULL, phone text NOT NULL, college text NOT NULL, year text NOT NULL, chess_username text NOT NULL,
 amount integer NOT NULL CHECK(amount>0), currency text NOT NULL DEFAULT 'INR',
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','paid','refund_pending','refunded')),
 order_id text UNIQUE, payment_id text UNIQUE, refund_id text UNIQUE,
 consent_version text NOT NULL DEFAULT '2026-09-17', created_at timestamptz NOT NULL DEFAULT now(), paid_at timestamptz,
 deleted_at timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS registration_active_email ON registrations(lower(email)) WHERE deleted_at IS NULL AND status IN ('pending','paid','refund_pending');
CREATE UNIQUE INDEX IF NOT EXISTS registration_active_chess ON registrations(lower(chess_username)) WHERE deleted_at IS NULL AND status IN ('pending','paid','refund_pending');
CREATE TABLE IF NOT EXISTS admin_sessions(token_hash text PRIMARY KEY, csrf text NOT NULL, expires_at timestamptz NOT NULL);
CREATE TABLE IF NOT EXISTS rate_limits(key text PRIMARY KEY, count integer NOT NULL, expires_at timestamptz NOT NULL);
CREATE TABLE IF NOT EXISTS totp_used(code_hash text PRIMARY KEY, expires_at timestamptz NOT NULL);
CREATE TABLE IF NOT EXISTS audit_log(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, action text NOT NULL, target text, created_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS order_lock timestamptz;
