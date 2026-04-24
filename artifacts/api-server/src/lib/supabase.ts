// TASK 1 — Supabase client (service key — backend only, never exposed to frontend)
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env['SUPABASE_URL'];

// Accept both the legacy name used in this project and the standard Supabase dashboard name
const supabaseServiceKey =
  process.env['SUPABASE_SERVICE_KEY'] ??
  process.env['SUPABASE_SERVICE_ROLE_KEY'];

if (!supabaseUrl) {
  throw new Error(
    'Missing SUPABASE_URL environment variable. ' +
    'Set it in Railway to your Supabase project URL (e.g. https://xxxx.supabase.co).',
  );
}

if (!supabaseServiceKey) {
  throw new Error(
    'Missing service key environment variable. ' +
    'Set either SUPABASE_SERVICE_KEY or SUPABASE_SERVICE_ROLE_KEY in Railway ' +
    'to the service_role key from your Supabase project settings → API.',
  );
}

export const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});
