import { requireSupabase } from '../utils/supabase.js';

function mapService(row) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    expectedDuration: row.expectedduration,
    priority: row.priority,
    isOpen: row.isopen ?? true,
    createdAt: row.createdat,
  };
}

export async function listServicesFromSupabase() {
  const { data, error } = await requireSupabase()
    .from('service')
    .select('*')
    .order('name', { ascending: true });

  if (error) throw new Error(error.message);
  return data.map(mapService);
}
