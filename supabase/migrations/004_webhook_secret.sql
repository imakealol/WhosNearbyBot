-- 004_webhook_secret.sql
-- Telegram webhook secret verification for the payment webhook.
--
-- No schema change is required. The worker now checks the
-- X-Telegram-Bot-Api-Secret-Token header against the
-- TELEGRAM_WEBHOOK_SECRET secret on every /api/webhook call, so forged
-- update payloads can no longer grant paid entitlements.
--
-- Deployment steps (already performed when this migration ships):
--   1. Worker secret set: TELEGRAM_WEBHOOK_SECRET (same value both sides).
--   2. Telegram setWebhook re-registered with secret_token=<same value>,
--      so Telegram stamps every update with that header.

-- Optional: record the migration for audit. Safe to re-run.
create table if not exists public.schema_migrations (
  version text primary key,
  name text not null,
  applied_at timestamp with time zone not null default now()
);

insert into public.schema_migrations (version, name)
values ('004', 'webhook_secret')
on conflict (version) do nothing;
