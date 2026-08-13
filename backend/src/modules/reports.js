import { Router } from 'express';

class DatabaseReportsStore {
  constructor(db) {
    this.db = db;
  }

  async initialize() {
    return Promise.resolve();
  }

  async userStats() {
    //users only, not admins
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
    const userProfiles = profiles.filter((profile) => userIds.has(profile.userid));

    const { data: historyRows, error: historyError } = await this.db
      .from('history')
      .select('userid, message, outcome, createdat');
    if (historyError) throw new Error(`Database error: ${historyError.message}`);

    //`queueentry` (jointime) to its matching served `history` (createdat)
    // join through service name:
    //still assumes service names are unique like
    //mapDatabaseHistory() with history.message, not urgent fix
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

    const { data: servedEntries, error: entryError } = await this.db
      .from('queueentry')
      .select('userid, queueid, jointime')
      .eq('status', 'served');
    if (entryError) throw new Error(`Database error: ${entryError.message}`);

    //only one queue active at a time for user
    const joinTimesByUserService = new Map();
    for (const entry of servedEntries) {
      if (!userIds.has(entry.userid)) continue;
      const serviceName = serviceNameById.get(serviceIdByQueueId.get(entry.queueid));
      if (!serviceName) continue;
      const key = `${entry.userid}::${serviceName}`;
      if (!joinTimesByUserService.has(key)) joinTimesByUserService.set(key, []);
      joinTimesByUserService.get(key).push(new Date(entry.jointime).getTime());
    }
    for (const times of joinTimesByUserService.values()) times.sort((a, b) => a - b);

    const servedAtTimesByUserService = new Map();
    for (const row of historyRows) {
      if (!userIds.has(row.userid) || row.outcome !== 'served') continue;
      const serviceName = row.message?.replace(/^Served by /, '').replace(/\.$/, '');
      if (!serviceName) continue;
      const key = `${row.userid}::${serviceName}`;
      if (!servedAtTimesByUserService.has(key)) servedAtTimesByUserService.set(key, []);
      servedAtTimesByUserService.get(key).push(new Date(row.createdat).getTime());
    }
    for (const times of servedAtTimesByUserService.values()) times.sort((a, b) => a - b);

    const statsByUser = new Map();
    const getStats = (userId) => {
      if (!statsByUser.has(userId)) {
        statsByUser.set(userId, { queuesJoined: 0, served: 0, left: 0, waitDurationsMs: [] });
      }
      return statsByUser.get(userId);
    };

    for (const [key, servedAtTimes] of servedAtTimesByUserService) {
      const [userId] = key.split('::');
      const joinTimes = joinTimesByUserService.get(key) || [];
      const stats = getStats(userId);
      servedAtTimes.forEach((servedAt, index) => {
        const joinedAt = joinTimes[index];
        if (joinedAt == null || servedAt < joinedAt) return;
        stats.waitDurationsMs.push(servedAt - joinedAt);
      });
    }

    for (const row of historyRows) {
      if (!userIds.has(row.userid)) continue;
      const stats = getStats(row.userid);
      if (row.outcome === 'served') {
        stats.served += 1;
      } else if (row.outcome === 'left') {
        stats.left += 1;
      } else if (row.outcome === null && row.message?.includes('joined the queue')) {
        stats.queuesJoined += 1;
      }
    }

    return userProfiles.map((profile) => {
      const stats = getStats(profile.userid);
      const avgWaitMinutes = stats.waitDurationsMs.length
        ? Math.round(
            stats.waitDurationsMs.reduce((sum, ms) => sum + ms, 0) / stats.waitDurationsMs.length / 60000,
          )
        : null;
      return {
        id: profile.userid,
        name: profile.name,
        email: emailById.get(profile.userid) ?? null,
        queuesJoined: stats.queuesJoined,
        served: stats.served,
        left: stats.left,
        avgWaitMinutes,
      };
    });
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