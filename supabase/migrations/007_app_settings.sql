-- Global app settings (key/value).
-- Used for admin-wide toggles that apply to every client:
--   global_vip_until  : epoch-ms string; while > now(), ALL users get every
--                       paid function unlocked (a time-boxed VIP for everyone).
--   force_reset_after : epoch-ms string; bookkeeping for the last "force reset
--                       all users" action (the actual reset clears profiles).
-- Reads are public (clients derive entitlements); writes go through the
-- worker's service-role key only, matching migration 004/006 hardening.

CREATE TABLE IF NOT EXISTS app_settings (
  key        text PRIMARY KEY,
  value      text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "app_settings_read" ON app_settings;
CREATE POLICY "app_settings_read" ON app_settings FOR SELECT USING (true);
