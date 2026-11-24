/* PSYCH0 — Supabase server client.
 * The app is Supabase-ready: the moment SUPABASE_URL + SUPABASE_SECRET_KEY
 * (or SUPABASE_SERVICE_ROLE_KEY) exist in env, all repo reads/writes go to
 * Postgres. Without them the app runs in LOCAL MODE (seed content,
 * client-side localStorage edits).
 *
 * There are NO keys in this repo on purpose — copy `.env.example` to `.env`
 * (local) or set the env vars in Vercel → Settings → Environment Variables
 * (production). Get both values from Supabase → Settings → API:
 *   SUPABASE_URL       the project URL, https://<ref>.supabase.co
 *   SUPABASE_SECRET_KEY  the sb_secret_… key (bypasses RLS — server only!) */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const PROJECT_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const PROJECT_KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || '';

let cached: SupabaseClient | null = null;
let cachedUrl: string | null = null;

export function supabaseEnv(): { url: string; key: string } | null {
  const url = PROJECT_URL;
  const key = PROJECT_KEY;
  if (!url || !key || !/^https?:\/\//.test(url)) return null;
  return { url, key };
}

export function isSupabaseConfigured(): boolean {
  return supabaseEnv() !== null;
}

/** writes need the service key (sb_secret_… / service_role JWT); the
 * publishable/anon key can only read what RLS exposes to the public */
export function canWriteSupabase(): boolean {
  return !!(process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || PROJECT_KEY.startsWith('sb_secret_'));
}

export function supabaseStatus(): 'supabase' | 'local' {
  return isSupabaseConfigured() ? 'supabase' : 'local';
}

export function supabase(): SupabaseClient | null {
  const env = supabaseEnv();
  if (!env) return null;
  if (!cached || cachedUrl !== env.url) {
    cached = createClient(env.url, env.key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    cachedUrl = env.url;
  }
  return cached;
}
