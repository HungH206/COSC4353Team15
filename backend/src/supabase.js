let supabaseInstance = null;

export async function createSupabaseClient(config) {
  if (!config.supabaseUrl || !config.supabaseKey) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required to connect to Supabase.');
  }

  const { createClient } = await import('@supabase/supabase-js').catch(() => {
    throw new Error('Install @supabase/supabase-js before enabling Supabase database storage.');
  });

  return createClient(config.supabaseUrl, config.supabaseKey, {
    auth: {
      persistSession: false,
    },
  });
}

export async function getSupabaseClient(config) {
  if (!supabaseInstance) {
    supabaseInstance = await createSupabaseClient(config);
  }
  return supabaseInstance;
}

export function resetSupabaseClientForTests() {
  supabaseInstance = null;
}
