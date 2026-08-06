import { createClient } from '@supabase/supabase-js';

let supabaseInstance = null;

export function getDbClient(config) {
  if (!supabaseInstance) {
    supabaseInstance = createClient(config.supabaseUrl, config.supabaseKey, {
      auth: {
        persistSession: false // We handle our own JWT authentication in this backend
      }
    });
  }
  return supabaseInstance;
}