// ─── App-wide constants ───────────────────────────────────────────────────────
// Cloudflare HTTPS tunnel to local FastAPI backend on port 8000:
export const API_BASE_URL = 'https://dealer-requirements-spider-magnetic.trycloudflare.com';
export const API_V1 = `${API_BASE_URL}/api/v1`;

// ─── Supabase (direct client, used only for Auth + user_stash) ────────────────
// This is the anon/publishable key (matches backend/.env's SUPABASE_KEY) — safe
// to embed in the client bundle by design; every request it makes is still
// gated by Postgres RLS. NEVER put a service-role/secret key here — that key
// (used only by ml_pipeline/, server-side) bypasses RLS entirely.
export const SUPABASE_URL = 'https://kwsahtflzaynbxlavfiv.supabase.co';
export const SUPABASE_ANON_KEY = 'sb_publishable_wk8nv7gjIO1MQri-Uc7ihA_Iwgrxb9S';

