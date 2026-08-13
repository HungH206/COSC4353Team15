import { Router } from 'express';

class DatabaseReportsStore {
  constructor(db) {
    this.db = db;
  }

  async initialize() {
    return Promise.resolve();
  }

  async userStats() {
    // Users only, not admins.
    const { data: credentials, error: credentialsError } = await this.db
      .from('usercredentials')
      .select('id, email')
      .eq('role', 'user');
    if (credentialsError) throw new Error(`Database error: ${credentialsError.message}`);
    const userIds = new Set(credentials.map((credential) => credential.id));
    const emailById = new Map(credentials.map((credential) => [credential.id, credential.email]));

    const { data: profiles, error: profileError } = await this.db
      .from('userprofile')
      .select('userid, name');
    if (profileError) throw new Error(`Database error: ${profileError.message}`);
    const nameById = new Map(profiles.map((profile) => [profile.userid, profile.name]));

    const { data: queueRows, error: queueError } = await this.db
      .from('queue')
      .select('id, serviceid');
    if (queueError) throw new Error(`Database error: ${queueError.message}`);
    const serviceIdByQueueId = new Map(queueRows.map((q) => [q.id, q.serviceid]));

    const { data: serviceRows, error: serviceError } = await this.db
      .from('service')
      .select('id, name');
    if (serviceError) throw new Error(`Database error: ${serviceError.message}`);
    const serviceNameById = new Map(serviceRows.map((s) => [s.id, s.name]));

    // Only resolved entries.
    const { data: entries, error: entryError } = await this.db
      .from('queueentry')
      .select('id, userid, queueid, jointime, status')
      .in('status', ['served', 'canceled']);
    if (entryError) throw new Error(`Database error: ${entryError.message}`);

    const { data: historyRows, error: historyError } = await this.db
      .from('history')
      .select('userid, message, outcome, createdat')
      .in('outcome', ['served', 'left']);
    if (historyError) throw new Error(`Database error: ${historyError.message}`);

    const groupSortedTimes = (rows, prefix) => {
      const byKey = new Map();
      for (const row of rows) {
        if (!userIds.has(row.userid)) continue;
        const serviceName = row.message?.startsWith(prefix)
          ? row.message.slice(prefix.length).replace(/\.$/, '')
          : null;
        if (!serviceName) continue;
        const key = `${row.userid}::${serviceName}`;
        if (!byKey.has(key)) byKey.set(key, []);
        byKey.get(key).push(new Date(row.createdat).getTime());
      }
      for (const times of byKey.values()) times.sort((a, b) => a - b);
      return byKey;
    };
    const servedTimesByKey = groupSortedTimes(historyRows.filter((r) => r.outcome === 'served'), 'Served by ');
    const leftTimesByKey = groupSortedTimes(historyRows.filter((r) => r.outcome === 'left'), 'Left ');

    // A user can only have one active entry per service at a time (joinQueue
    // rejects a second join), so grouping queueentry rows by status+user+service
    const entriesByStatusKey = new Map();
    for (const entry of entries) {
      if (!userIds.has(entry.userid)) continue;
      const serviceName = serviceNameById.get(serviceIdByQueueId.get(entry.queueid)) ?? null;
      const key = `${entry.status}::${entry.userid}::${serviceName ?? 'unknown'}`;
      if (!entriesByStatusKey.has(key)) entriesByStatusKey.set(key, []);
      entriesByStatusKey.get(key).push({ ...entry, serviceName });
    }

    const rows = [];
    for (const [statusKey, keyEntries] of entriesByStatusKey) {
      const status = statusKey.startsWith('served::') ? 'served' : 'canceled';
      const matchKey = statusKey.slice(status.length + 2);
      const historyTimes = (status === 'served' ? servedTimesByKey : leftTimesByKey).get(matchKey) || [];

      keyEntries.sort((a, b) => new Date(a.jointime) - new Date(b.jointime));
      keyEntries.forEach((entry, index) => {
        const outcomeAt = historyTimes[index] != null ? new Date(historyTimes[index]).toISOString() : null;
        rows.push({
          id: entry.id,
          name: nameById.get(entry.userid) ?? 'Unknown',
          email: emailById.get(entry.userid) ?? null,
          serviceName: entry.serviceName ?? 'Unknown service',
          joinedAt: entry.jointime,
          outcome: status === 'served' ? 'served' : 'left',
          outcomeAt,
        });
      });
    }

    rows.sort((a, b) => new Date(b.joinedAt) - new Date(a.joinedAt));
    return rows;
  }
}

function createStore(config) {
  if (!(config.useDatabase && config.db)) {
    throw new Error('Reports module currently requires database mode (config.useDatabase && config.db).');
  }
  return new DatabaseReportsStore(config.db);
}

export async function createReportsModule(config, auth) {
  const store = createStore(config);
  await store.initialize();

  const router = Router();

  // Only admins can view reports.
  router.get(
    '/user-stats',
    auth.authenticate,
    auth.requireAdmin,
    async (request, response, next) => {
      try {
        const userStats = await store.userStats();
        response.json({ userStats });
      } catch (error) {
        next(error);
      }
    },
  );

  return { router, store };
}