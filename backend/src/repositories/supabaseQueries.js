export async function listServices(db) {
  const { data, error } = await db
    .from('service')
    .select('*')
    .order('name', { ascending: true });

  if (error) throw new Error(`Database error: ${error.message}`);
  return data;
}

export async function listAvailableServices(db) {
  const services = await listServices(db);
  return services.filter((service) => service.isopen ?? true);
}

export async function listOpenQueues(db) {
  const { data, error } = await db
    .from('queue')
    .select('id, serviceid, status, createdat')
    .eq('status', 'open')
    .order('createdat', { ascending: true });

  if (error) throw new Error(`Database error: ${error.message}`);
  return data;
}
