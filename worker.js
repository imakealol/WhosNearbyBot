// WhosNearbyBot worker — API-only, RLS-hardened version.
// Secrets (env): TELEGRAM_BOT_TOKEN, SUPABASE_URL, SUPABASE_ANON_KEY,
//                SUPABASE_SERVICE_ROLE_KEY, TELEGRAM_WEBHOOK_SECRET
// TELEGRAM_WEBHOOK_SECRET set => /telegram-webhook requires the
// X-Telegram-Bot-Api-Secret-Token header to match (setWebhook secret_token).
// Writes go through the service-role key when bound (bypasses RLS);
// anon key is read-only fallback. Migration 004 makes anon read-only.

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "access-control-allow-origin": "*" },
  });
}

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

// Telegram id of the sole admin allowed to force-reset any profile.
const ADMIN_ID = 1231127407;

// Age from full month/day math so a 17-year-old never rounds up to 18.
function computeAge(dob) {
  if (!dob) return null;
  const b = new Date(dob);
  if (isNaN(b.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age--;
  return age;
}

// Usernames that are always admin regardless of the managed list. The owner
// (mileschan852) can never be demoted.
const OWNER_USERNAME = "mileschan852";
const ALWAYS_ADMIN = [OWNER_USERNAME, "hkmembersonly"];

// True when the verified Telegram user is an admin: the hard-coded owner id,
// an always-admin username, or a username stored as role=admin in app_roles.
async function isAdminCaller(env, authUser) {
  if (Number(authUser?.id) === ADMIN_ID) return true;
  const uname = (authUser?.username || "").toLowerCase();
  if (!uname) return false;
  if (ALWAYS_ADMIN.includes(uname)) return true;
  const rows = await sbGet(env, `rest/v1/app_roles?select=role&username=eq.${encodeURIComponent(uname)}`);
  const role = (Array.isArray(rows) ? rows[0] : rows)?.role;
  return role === "admin";
}

function sbHeaders(env, write = false) {
  const key = write && env.SUPABASE_SERVICE_ROLE_KEY ? env.SUPABASE_SERVICE_ROLE_KEY : env.SUPABASE_ANON_KEY;
  return {
    "Content-Type": "application/json",
    "apikey": key,
    "Authorization": `Bearer ${key}`,
  };
}

async function sbGet(env, path) {
  const res = await fetch(`${env.SUPABASE_URL}/${path}`, { headers: sbHeaders(env) });
  if (!res.ok) return null;
  return res.json();
}

async function sbPost(env, path, body) {
  const res = await fetch(`${env.SUPABASE_URL}/${path}`, {
    method: "POST",
    headers: { ...sbHeaders(env, true), "Prefer": "return=representation" },
    body: JSON.stringify(body),
  });
  if (!res.ok) return null;
  return res.json();
}

async function sbPatch(env, path, body) {
  const res = await fetch(`${env.SUPABASE_URL}/${path}`, {
    method: "PATCH",
    headers: { ...sbHeaders(env, true), "Prefer": "return=minimal" },
    body: JSON.stringify(body),
  });
  return res.ok;
}

// ---- Auth helpers -----------------------------------------------------------

// Verify Telegram's X-Telegram-Bot-Api-Secret-Token webhook header (constant-time).
function timingSafeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// Validate Telegram WebApp initData HMAC per
// https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
async function verifyInitData(env, initData) {
  if (!env.TELEGRAM_BOT_TOKEN) return false; // cannot validate without the token
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) return false;
  // Reject stale/replayed initData: Telegram recommends a max age (24h here).
  const authDate = parseInt(params.get("auth_date") || "0", 10);
  if (!authDate || Date.now() / 1000 - authDate > 86400) return false;
  params.delete("hash");
  params.delete("signature");
  const dataCheckString = [...params.entries()]
    .map(([k, v]) => `${k}=${v}`)
    .sort()
    .join("\n");
  const enc = new TextEncoder();
  const secretKey = await crypto.subtle.importKey(
    "raw", enc.encode("WebAppData"), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const secret = await crypto.subtle.sign("HMAC", secretKey, enc.encode(env.TELEGRAM_BOT_TOKEN));
  const signKey = await crypto.subtle.importKey(
    "raw", secret, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", signKey, enc.encode(dataCheckString));
  const hex = [...new Uint8Array(signature)].map(b => b.toString(16).padStart(2, "0")).join("");
  return timingSafeEqual(hex, hash);
}

const ALLOWED_TYPES = {
  hide_age:          { title: 'Hide Age (30 Days)',        description: 'Hide your age on your profile for 30 days.',        amount: 1000 },
  invisible:         { title: 'Invisible Mode (30 Days)',  description: 'Browse and go invisible on the grid for 30 days.', amount: 3000 },
  edit_profile:      { title: 'Edit Profile Pass',        description: 'Unlock profile editing permissions.',               amount: 1000 },
  change_filter:     { title: 'Filter Subscription (30 Days)', description: 'Custom filter override for 30 days.',            amount: 1000 },
  change_preference: { title: 'Change Profile & Preferences', description: 'One-time unlock to edit profile and preferences.', amount: 1000 },
  extra_row:         { title: 'Extra Row',                 description: 'Unlock an extra row of nearby users.',               amount: 1000 },
  unlock_profile:    { title: 'Unlock Profile',            description: 'Unlock your profile for editing.',                   amount: 1000 },
  raffle_ticket:     { title: 'Raffle Ticket',             description: 'Buy a raffle ticket.',                               amount: 100 },
};

// Shared Telegram payment handling for both webhook routes. Callers MUST
// verify the secret-token header before invoking this.
async function handlePaymentUpdate(env, update) {
  if (update.pre_checkout_query) {
    await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/answerPreCheckoutQuery`, {
      method: "POST", body: JSON.stringify({ pre_checkout_query_id: update.pre_checkout_query.id, ok: true }),
      headers: { "Content-Type": "application/json" },
    });
    return new Response("OK");
  }
  if (update.message?.successful_payment) {
    const payload = JSON.parse(update.message.successful_payment.invoice_payload);
    const expiry = new Date(Date.now() + 30 * 86400000).toISOString();
    const txResult = await sbPost(env, "rest/v1/transactions", {
      user_id: payload.tg_id, type: payload.type, amount: payload.finalAmount, currency: "XTR",
      provider_payment_charge_id: update.message.successful_payment.provider_payment_charge_id || null,
      telegram_payment_charge_id: update.message.successful_payment.telegram_payment_charge_id || null,
    });
    if (!txResult) return new Response("Duplicate or invalid transaction", { status: 400 });
    const profileId = `tg_${payload.tg_id}`;
    if (payload.type === "hide_age") await sbPatch(env, `rest/v1/profiles?id=eq.${encodeURIComponent(profileId)}`, { hide_age: true, hide_age_expiry: expiry });
    else if (payload.type === "invisible") await sbPatch(env, `rest/v1/profiles?id=eq.${encodeURIComponent(profileId)}`, { grid_visible: false, invisible_expiry: expiry });
    else if (payload.type === "change_preference" || payload.type === "edit_profile") await sbPatch(env, `rest/v1/profiles?id=eq.${encodeURIComponent(profileId)}`, { edit_profile_pass: true, edit_profile_expiry: expiry });
    else if (payload.type === "change_filter") {
      const existing = await sbGet(env, `rest/v1/profiles?select=filter_sub_expiry&id=eq.${encodeURIComponent(profileId)}`);
      const prev = (Array.isArray(existing) ? existing[0] : existing)?.filter_sub_expiry;
      const base = prev && new Date(prev).getTime() > Date.now() ? new Date(prev).getTime() : Date.now();
      await sbPatch(env, `rest/v1/profiles?id=eq.${encodeURIComponent(profileId)}`, { filter_sub_expiry: new Date(base + 30 * 86400000).toISOString() });
    }
  }
  return new Response("OK");
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type" },
      });
    }

    // POST /api/auth
    if (path === "/api/auth" && request.method === "POST") {
      try {
        const { initData } = await request.json();
        if (!initData) return json({ error: "Missing initData" }, 400);
        // Reject forged initData: HMAC must validate against the bot token.
        if (!(await verifyInitData(env, initData))) return json({ error: "Invalid initData signature" }, 401);
        const params = new URLSearchParams(initData);
        const userStr = params.get("user");
        if (!userStr) return json({ error: "No user data" }, 400);
        const tgUser = JSON.parse(userStr);
        const tgId = `tg_${tgUser.id}`;
        const profileData = { id: tgId, name: tgUser.first_name || "", username: tgUser.username || null, avatar: tgUser.photo_url || null, last_seen: new Date().toISOString() };
        const created = await sbPost(env, "rest/v1/profiles", profileData);
        if (!created) await sbPatch(env, `rest/v1/profiles?id=eq.${encodeURIComponent(tgId)}`, profileData);
        const user = await sbGet(env, `rest/v1/profiles?id=eq.${encodeURIComponent(tgId)}`);
        return json(Array.isArray(user) ? user[0] : user);
      } catch (e) { console.error("[worker]", e && e.message); return json({ error: "Internal error" }, 500); }
    }

    // GET /api/nearby
    if (path === "/api/nearby" && request.method === "GET") {
      try {
        const tgId = url.searchParams.get("tg_id") || "0";
        const lat = parseFloat(url.searchParams.get("lat") || "0");
        const lng = parseFloat(url.searchParams.get("lng") || "0");
        const profileId = `tg_${tgId}`;
        // Clamp radius (max 100km) so a caller can't request the whole dataset.
        const radius = Math.min(Math.max(parseInt(url.searchParams.get("radius") || "50000", 10) || 50000, 0), 100000);
        // Only return rows the caller is entitled to see: visible on the grid
        // OR opted into the map. Enforces paid Invisible Mode server-side so a
        // direct API call can't leak a hidden user's location.
        const users = await sbGet(env, `rest/v1/profiles?select=*&id=neq.${encodeURIComponent(profileId)}&lat=not.is.null&lng=not.is.null&is_underage=is.false&or=(grid_visible.is.true,map_visible.is.true)&order=last_seen.desc`);
        if (!users) return json([]);
        const result = (Array.isArray(users) ? users : [])
          .map(u => { const dist = haversineKm(lat, lng, u.lat, u.lng); return { ...u, distance_km: Math.round(dist * 10) / 10, age: computeAge(u.dob) }; })
          .filter(u => u.distance_km <= radius / 1000)
          .sort((a, b) => a.distance_km - b.distance_km)
          // Never leak raw date of birth; only the derived age leaves the API.
          .map(u => { const { dob, ...safe } = u; return { ...safe, dob: undefined }; });
        return json(result);
      } catch (e) { console.error("[worker]", e && e.message); return json({ error: "Internal error" }, 500); }
    }

    // GET /api/profile
    if (path === "/api/profile" && request.method === "GET") {
      try {
        const tgId = url.searchParams.get("tg_id") || "0";
        const user = await sbGet(env, `rest/v1/profiles?id=eq.${encodeURIComponent(`tg_${tgId}`)}`);
        const u = Array.isArray(user) ? user[0] : user;
        if (!u) return json({ error: "Not found" }, 404);
        return json(u);
      } catch (e) { console.error("[worker]", e && e.message); return json({ error: "Internal error" }, 500); }
    }

    // POST /api/profile
    if (path === "/api/profile" && request.method === "POST") {
      try {
        const body = await request.json();
        const { tg_id, dob, gender_identity, seeking_gender, lat, lng, name, username, avatar, height, weight, role_pref, safety_pref, playstyle_pref, where_pref, how_many_pref, hide_age, grid_visible, map_visible, initData } = body;
        if (!tg_id) return json({ error: "Missing tg_id" }, 400);
        // Profile writes are authenticated: client must send the initData it
        // was launched with, and the tg_id inside it must match the write.
        if (!(await verifyInitData(env, initData || ""))) return json({ error: "Unauthorized" }, 401);
        const params = new URLSearchParams(initData);
        const authUser = JSON.parse(params.get("user") || "{}");
        if (`tg_${authUser.id}` !== `tg_${tg_id}`) return json({ error: "Forbidden" }, 403);
        const profileId = `tg_${tg_id}`;
        const updates = { last_seen: new Date().toISOString() };
        if (dob !== undefined) updates.dob = dob;
        if (gender_identity !== undefined) updates.gender = gender_identity;
        if (seeking_gender !== undefined) updates.seeking = seeking_gender;
        if (lat !== undefined) updates.lat = lat;
        if (lng !== undefined) updates.lng = lng;
        if (name !== undefined) updates.name = name;
        if (username !== undefined) updates.username = username;
        if (avatar !== undefined) updates.avatar = avatar;
        if (height !== undefined) updates.height = height;
        if (weight !== undefined) updates.weight = weight;
        if (role_pref !== undefined) updates.role_pref = role_pref;
        if (safety_pref !== undefined) updates.safety_pref = safety_pref;
        if (playstyle_pref !== undefined) updates.playstyle_pref = playstyle_pref;
        if (where_pref !== undefined) updates.where_pref = where_pref;
        if (how_many_pref !== undefined) updates.how_many_pref = how_many_pref;
        if (hide_age !== undefined) updates.hide_age = hide_age;
        if (grid_visible !== undefined) updates.grid_visible = grid_visible;
        if (map_visible !== undefined) updates.map_visible = map_visible;
        await sbPatch(env, `rest/v1/profiles?id=eq.${encodeURIComponent(profileId)}`, updates);
        return json({ updated: true });
      } catch (e) { console.error("[worker]", e && e.message); return json({ error: "Internal error" }, 500); }
    }

    // POST /api/invoice  (alias: /create-invoice)
    if ((path === "/api/invoice" || path === "/create-invoice") && request.method === "POST") {
      try {
        const body = await request.json();
        const tg_id = body.tg_id ?? body.userId;
        const type = body.type;
        const cfg = ALLOWED_TYPES[type];
        if (!tg_id) return json({ error: "Missing tg_id/userId" }, 400);
        if (!cfg) return json({ error: "Invalid type" }, 400);
        const finalAmount = cfg.amount;
        const res = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/createInvoiceLink`, {
          method: "POST",
          body: JSON.stringify({ title: cfg.title, description: cfg.description, payload: JSON.stringify({ tg_id, type, finalAmount }), provider_token: "", currency: "XTR", prices: [{ label: cfg.title, amount: finalAmount }] }),
          headers: { "Content-Type": "application/json" },
        });
        const data = await res.json();
        if (!data.ok) return json({ error: data.description || "Telegram error" }, 500);
        return json({ invoiceLink: data.result });
      } catch (e) { console.error("[worker]", e && e.message); return json({ error: "Internal error" }, 500); }
    }

    // POST /api/webhook — verify Telegram's secret-token header first so
    // forged updates can't grant paid entitlements. TELEGRAM_WEBHOOK_SECRET
    // must match the secret_token passed to setWebhook.
    if (path === "/api/webhook" && request.method === "POST") {
      // Telegram sends this secret token with every webhook call; reject anything else.
      const secretHeader = request.headers.get("X-Telegram-Bot-Api-Secret-Token") || "";
      if (!env.TELEGRAM_WEBHOOK_SECRET || !timingSafeEqual(secretHeader, env.TELEGRAM_WEBHOOK_SECRET)) {
        return new Response("Forbidden", { status: 403 });
      }
      try {
        return await handlePaymentUpdate(env, await request.json());
      } catch { return new Response("OK"); }
    }

    // POST /telegram-webhook — bot updates, secret-token protected. Fails
    // closed: without TELEGRAM_WEBHOOK_SECRET no update is accepted, so a
    // forged successful_payment can never grant a paid entitlement for free.
    if (path === "/telegram-webhook" && request.method === "POST") {
      const secretHeader = request.headers.get("x-telegram-bot-api-secret-token") || "";
      if (!env.TELEGRAM_WEBHOOK_SECRET || !timingSafeEqual(secretHeader, env.TELEGRAM_WEBHOOK_SECRET)) {
        return new Response("Forbidden", { status: 403 });
      }
      try {
        return await handlePaymentUpdate(env, await request.json());
      } catch { return new Response("OK"); }
    }

    // GET/POST /api/messages
    if (path === "/api/messages" && request.method === "GET") {
      try {
        const limit = parseInt(url.searchParams.get("limit") || "10");
        return json(await sbGet(env, `rest/v1/flying_messages?order=created_at.desc&limit=${limit}`) || []);
      } catch (e) { console.error("[worker]", e && e.message); return json({ error: "Internal error" }, 500); }
    }
    if (path === "/api/messages" && request.method === "POST") {
      try {
        const { text, initData } = await request.json();
        // Authenticate: the sender identity comes from verified initData, not
        // client-supplied fields, so no one can post as another name/id.
        if (!(await verifyInitData(env, initData || ""))) return json({ error: "Unauthorized" }, 401);
        if (!text || !text.trim()) return json({ error: "Missing text" }, 400);
        const authUser = JSON.parse(new URLSearchParams(initData).get("user") || "{}");
        await sbPost(env, "rest/v1/flying_messages", { id: crypto.randomUUID(), tg_id: authUser.id || 0, text: text.trim().slice(0, 200), from_name: (authUser.first_name || "Anonymous").slice(0, 60) });
        return json({ ok: true });
      } catch (e) { console.error("[worker]", e && e.message); return json({ error: "Internal error" }, 500); }
    }

    // GET /api/raffle
    if (path === "/api/raffle" && request.method === "GET") {
      const state = await sbGet(env, "rest/v1/raffle_state?id=eq.1");
      return json(Array.isArray(state) ? state[0] : state || { prize_name: "Ultimate Bundle", tickets_sold: 0 });
    }

    // POST /api/reset-profile — admin-only force reset of a single profile.
    // Authorization comes from verified initData (HMAC + freshness), and the
    // decoded Telegram id must equal ADMIN_ID. A client-supplied caller_id is
    // never trusted. Also clears the target's underage flag.
    if (path === "/api/reset-profile" && request.method === "POST") {
      try {
        const { target_id, initData } = await request.json();
        if (!target_id) return json({ error: "Missing params" }, 400);
        if (!(await verifyInitData(env, initData || ""))) return json({ error: "Unauthorized" }, 401);
        const authUser = JSON.parse(new URLSearchParams(initData).get("user") || "{}");
        if (Number(authUser.id) !== ADMIN_ID) return json({ error: "Forbidden" }, 403);
        await sbPatch(env, `rest/v1/profiles?id=eq.${encodeURIComponent(`tg_${target_id}`)}`, {
          name: null, username: null, avatar: null, dob: null, height: null, weight: null,
          gender: "Male", seeking: "Male", role_pref: null, safety_pref: null, playstyle_pref: null,
          where_pref: null, how_many_pref: null, hide_age: false, grid_visible: true, map_visible: false,
          is_underage: false, hide_age_expiry: null, invisible_expiry: null,
        });
        return json({ reset: true });
      } catch (e) { console.error("[worker]", e && e.message); return json({ error: "Internal error" }, 500); }
    }

    // GET /api/roles — list managed admin/VIP entries (public read).
    if (path === "/api/roles" && request.method === "GET") {
      try {
        const rows = await sbGet(env, "rest/v1/app_roles?select=username,role,created_at&order=created_at.asc");
        return json(Array.isArray(rows) ? rows : []);
      } catch (e) { console.error("[worker]", e && e.message); return json({ error: "Internal error" }, 500); }
    }

    // POST /api/roles — admin-only add/remove of admin/VIP entries.
    // Authorization comes from verified initData; the caller must be an admin.
    // The owner (mileschan852) role can never be added or removed here.
    if (path === "/api/roles" && request.method === "POST") {
      try {
        const { action, username, role, initData } = await request.json();
        if (!(await verifyInitData(env, initData || ""))) return json({ error: "Unauthorized" }, 401);
        const authUser = JSON.parse(new URLSearchParams(initData).get("user") || "{}");
        if (!(await isAdminCaller(env, authUser))) return json({ error: "Forbidden" }, 403);
        const uname = String(username || "").trim().toLowerCase().replace(/^@/, "");
        if (!uname) return json({ error: "Missing username" }, 400);
        if (uname === OWNER_USERNAME) return json({ error: "Owner role is immutable" }, 403);
        if (action === "add") {
          if (role !== "admin" && role !== "vip") return json({ error: "Invalid role" }, 400);
          await sbPost(env, "rest/v1/app_roles", { username: uname, role });
          await sbPatch(env, `rest/v1/app_roles?username=eq.${encodeURIComponent(uname)}`, { role });
          return json({ ok: true });
        }
        if (action === "remove") {
          const res = await fetch(`${env.SUPABASE_URL}/rest/v1/app_roles?username=eq.${encodeURIComponent(uname)}`, {
            method: "DELETE", headers: sbHeaders(env, true),
          });
          return json({ ok: res.ok });
        }
        return json({ error: "Invalid action" }, 400);
      } catch (e) { console.error("[worker]", e && e.message); return json({ error: "Internal error" }, 500); }
    }

    // GET /api/health
    if (path === "/api/health" || path === "/health") return json({ ok: true, version: "rls-hardened-1.2" });

    return json({ error: "Not found" }, 404);
  },
};
