// WhosNearbyBot — Canonical Cloudflare Worker (API-only, < 1MB)
// Static assets are served by Cloudflare Pages / KV Asset Binding.
// Supabase is the backend database.
//
// Secrets (wrangler secret put / env vars):
//   TELEGRAM_BOT_TOKEN     — bot token for @WhosNearbyBot
//   SUPABASE_URL           — https://<ref>.supabase.co
//   SUPABASE_ANON_KEY      — anon key for Supabase REST

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

function sbHeaders(env) {
  return {
    "Content-Type": "application/json",
    "apikey": env.SUPABASE_ANON_KEY,
    "Authorization": `Bearer ${env.SUPABASE_ANON_KEY}`,
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
    headers: { ...sbHeaders(env), "Prefer": "return=representation" },
    body: JSON.stringify(body),
  });
  if (!res.ok) return null;
  return res.json();
}

async function sbPatch(env, path, body) {
  const res = await fetch(`${env.SUPABASE_URL}/${path}`, {
    method: "PATCH",
    headers: { ...sbHeaders(env), "Prefer": "return=minimal" },
    body: JSON.stringify(body),
  });
  return res.ok;
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
      } catch (e) { return json({ error: e.message }, 500); }
    }

    // GET /api/nearby
    if (path === "/api/nearby" && request.method === "GET") {
      try {
        const tgId = url.searchParams.get("tg_id") || "0";
        const lat = parseFloat(url.searchParams.get("lat") || "0");
        const lng = parseFloat(url.searchParams.get("lng") || "0");
        const profileId = `tg_${tgId}`;
        const radius = parseInt(url.searchParams.get("radius") || "50000");
        const users = await sbGet(env, `rest/v1/profiles?select=*&id=neq.${encodeURIComponent(profileId)}&lat=not.is.null&lng=not.is.null&is_underage=is.false&order=last_seen.desc`);
        if (!users) return json([]);
        const result = (Array.isArray(users) ? users : [])
          .map(u => { const dist = haversineKm(lat, lng, u.lat, u.lng); let age = null; if (u.dob) { const b = new Date(u.dob); age = new Date().getFullYear() - b.getFullYear(); } return { ...u, distance_km: Math.round(dist * 10) / 10, age }; })
          .filter(u => u.distance_km <= radius / 1000)
          .sort((a, b) => a.distance_km - b.distance_km);
        return json(result);
      } catch (e) { return json({ error: e.message }, 500); }
    }

    // GET /api/profile
    if (path === "/api/profile" && request.method === "GET") {
      try {
        const tgId = url.searchParams.get("tg_id") || "0";
        const user = await sbGet(env, `rest/v1/profiles?id=eq.${encodeURIComponent(`tg_${tgId}`)}`);
        const u = Array.isArray(user) ? user[0] : user;
        if (!u) return json({ error: "Not found" }, 404);
        return json(u);
      } catch (e) { return json({ error: e.message }, 500); }
    }

    // POST /api/profile
    if (path === "/api/profile" && request.method === "POST") {
      try {
        const body = await request.json();
        const { tg_id, dob, gender_identity, seeking_gender, lat, lng, name, username, avatar, height, weight, role_pref, safety_pref, playstyle_pref, where_pref, how_many_pref, hide_age, grid_visible, map_visible } = body;
        if (!tg_id) return json({ error: "Missing tg_id" }, 400);
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
      } catch (e) { return json({ error: e.message }, 500); }
    }

    // POST /api/invoice  (alias: /create-invoice, matches the frontend calls)
    if ((path === "/api/invoice" || path === "/create-invoice") && request.method === "POST") {
      try {
        // Frontend sends { userId, type, bot }; accept both key styles.
        const body = await request.json();
        const tg_id = body.tg_id ?? body.userId;
        const type = body.type;
        const cfg = ALLOWED_TYPES[type];
        if (!tg_id) return json({ error: "Missing tg_id/userId" }, 400);
        if (!cfg) return json({ error: "Invalid type" }, 400);
        // Server-side price only: never trust a client-supplied amount.
        const finalAmount = cfg.amount;
        const res = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/createInvoiceLink`, {
          method: "POST",
          body: JSON.stringify({ title: cfg.title, description: cfg.description, payload: JSON.stringify({ tg_id, type, finalAmount }), provider_token: "", currency: "XTR", prices: [{ label: cfg.title, amount: finalAmount }] }),
          headers: { "Content-Type": "application/json" },
        });
        const data = await res.json();
        if (!data.ok) return json({ error: data.description || "Telegram error" }, 500);
        return json({ invoiceLink: data.result });
      } catch (e) { return json({ error: e.message }, 500); }
    }

    // POST /api/webhook
    if (path === "/api/webhook" && request.method === "POST") {
      try {
        const update = await request.json();
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
          // Await transaction insert so replay attacks (duplicate charge IDs) are blocked.
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
      } catch { return new Response("OK"); }
    }

    // GET/POST /api/messages
    if (path === "/api/messages" && request.method === "GET") {
      try {
        const limit = parseInt(url.searchParams.get("limit") || "10");
        return json(await sbGet(env, `rest/v1/flying_messages?order=created_at.desc&limit=${limit}`) || []);
      } catch (e) { return json({ error: e.message }, 500); }
    }
    if (path === "/api/messages" && request.method === "POST") {
      try {
        const { tg_id, text, from_name } = await request.json();
        if (!text || !text.trim()) return json({ error: "Missing text" }, 400);
        await sbPost(env, "rest/v1/flying_messages", { id: crypto.randomUUID(), tg_id: tg_id || 0, text: text.trim().slice(0, 200), from_name: from_name || "Anonymous" });
        return json({ ok: true });
      } catch (e) { return json({ error: e.message }, 500); }
    }

    // GET /api/raffle
    if (path === "/api/raffle" && request.method === "GET") {
      const state = await sbGet(env, "rest/v1/raffle_state?id=eq.1");
      return json(Array.isArray(state) ? state[0] : state || { prize_name: "Ultimate Bundle", tickets_sold: 0 });
    }

    // Private notes are NOT stored in Supabase. They live only in the user's
    // Telegram WebApp CloudStorage (per-user, device-independent, bot-scoped),
    // keyed whos_nearby_private_note_<viewer>_<target>, 100 char max.
    // Expiry is driven by the existing profiles.filter_sub_expiry column.

    // POST /api/reset-profile
    if (path === "/api/reset-profile" && request.method === "POST") {
      const { caller_id, target_id } = await request.json();
      if (!caller_id || !target_id) return json({ error: "Missing params" }, 400);
      if (caller_id !== 1231127407) return json({ error: "Forbidden" }, 403);
      await sbPatch(env, `rest/v1/profiles?id=eq.${encodeURIComponent(`tg_${target_id}`)}`, {
        name: null, username: null, avatar: null, dob: null, height: null, weight: null,
        gender: "Male", seeking: "Male", role_pref: null, safety_pref: null, playstyle_pref: null,
        where_pref: null, how_many_pref: null, hide_age: false, grid_visible: true, map_visible: false,
        is_underage: false, hide_age_expiry: null, invisible_expiry: null,
      });
      return json({ reset: true });
    }

    // POST /api/reset-all-underage (admin only)
    if (path === "/api/reset-all-underage" && request.method === "POST") {
      const { caller_id } = await request.json();
      if (caller_id !== 1231127407) return json({ error: "Forbidden" }, 403);
      await sbPatch(env, "rest/v1/profiles?is_underage=eq.true", {
        name: null, username: null, avatar: null, dob: null, height: null, weight: null,
        gender: "Male", seeking: "Male", role_pref: null, safety_pref: null, playstyle_pref: null,
        where_pref: null, how_many_pref: null, hide_age: false, grid_visible: true, map_visible: false,
        is_underage: false, hide_age_expiry: null, invisible_expiry: null,
      });
      return json({ reset: true });
    }

    // GET /api/health
    if (path === "/api/health" || path === "/health") return json({ ok: true, version: "monolithic-1.0" });

    return json({ error: "Not found" }, 404);
  },
};