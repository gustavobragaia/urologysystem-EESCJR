import { createClient } from '@supabase/supabase-js';
import { env } from './env';

// Client admin — usa SERVICE_ROLE_KEY, bypassa RLS
// Usar APENAS no backend, nunca expor ao frontend
export const supabaseAdmin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Client público — usa ANON_KEY, responde a RLS
export const supabasePublic = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY);
