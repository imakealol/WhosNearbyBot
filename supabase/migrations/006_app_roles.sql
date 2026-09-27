-- Managed admin / VIP list.
-- Entitlements survive across sessions and are shared across all clients.
-- role: 'admin' (all admin powers) | 'vip' (all paid functions unlocked indefinitely).
-- The owner (mileschan852) is always admin in application code and is never
-- stored/removable here.

CREATE TABLE IF NOT EXISTS app_roles (
  username   text PRIMARY KEY,
  role       text NOT NULL CHECK (role IN ('admin', 'vip')),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Store usernames normalized (lowercase, no leading @). App code already
-- lowercases, this guards direct inserts.
CREATE OR REPLACE FUNCTION app_roles_normalize_username()
RETURNS trigger AS $$
BEGIN
  NEW.username := lower(ltrim(NEW.username, '@'));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_app_roles_normalize ON app_roles;
CREATE TRIGGER trg_app_roles_normalize
  BEFORE INSERT OR UPDATE ON app_roles
  FOR EACH ROW EXECUTE FUNCTION app_roles_normalize_username();

-- RLS: readable by everyone (clients derive their own entitlements from it);
-- writes go through the worker's service-role key only (bypasses RLS), matching
-- migration 004's hardening where the anon key is read-only.
ALTER TABLE app_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "app_roles_read" ON app_roles;
CREATE POLICY "app_roles_read" ON app_roles FOR SELECT USING (true);
