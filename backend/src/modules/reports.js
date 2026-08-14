import { Router } from 'express';
import fs from 'node:fs/promises';

function parseServiceNameFromHistory(message, outcome) {
  const prefix = outcome === 'served' ? 'Served by ' : 'Left ';
  return message?.startsWith(prefix)
    ? message.slice(prefix.length).replace(/\.$/, '')
    : null;
}

function emptyCounts() {
  return { joined: 0, served: 0, canceled: 0, waiting: 0 };
}

function latestIso(...values) {
  const latest = values
    .filter(Boolean)
    .map((value) => new Date(value).getTime())
    .filter((value) => Number.isFinite(value))
    .sort((a, b) => b - a)[0];
  return latest ? new Date(latest).toISOString() : null;
}

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

    //one service at a time per user, grouping queueentry rows by status+user+service
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

  async queueStats() {
    const { data: serviceRows, error: serviceError } = await this.db
      .from('service')
      .select('id, name, description, priority, isopen, expectedduration, createdat');
    if (serviceError) throw new Error(`Database error: ${serviceError.message}`);
    const serviceIdByName = new Map(serviceRows.map((s) => [s.name, s.id]));
    const serviceNameById = new Map(serviceRows.map((s) => [s.id, s.name]));

    const { data: queueRows, error: queueError } = await this.db
      .from('queue')
      .select('id, serviceid');
    if (queueError) throw new Error(`Database error: ${queueError.message}`);
    const serviceIdByQueueId = new Map(queueRows.map((q) => [q.id, q.serviceid]));

    const { data: entries, error: entryError } = await this.db
      .from('queueentry')
      .select('id, userid, queueid, jointime, status');
    if (entryError) throw new Error(`Database error: ${entryError.message}`);

    //wait time only for served customers
    const { data: historyRows, error: historyError } = await this.db
      .from('history')
      .select('userid, message, outcome, createdat')
      .in('outcome', ['served', 'left']);
    if (historyError) throw new Error(`Database error: ${historyError.message}`);

    //"Served by X." timestamps to served
    //queueentry rows by (userid, serviceName)
    const servedTimesByKey = new Map();
    const lastHistoryByServiceName = new Map();
    for (const row of historyRows) {
      const serviceName = parseServiceNameFromHistory(row.message, row.outcome);
      if (!serviceName) continue;
      lastHistoryByServiceName.set(
        serviceName,
        latestIso(lastHistoryByServiceName.get(serviceName), row.createdat),
      );
      if (row.outcome !== 'served') continue;
      const key = `${row.userid}::${serviceName}`;
      if (!servedTimesByKey.has(key)) servedTimesByKey.set(key, []);
      servedTimesByKey.get(key).push(new Date(row.createdat).getTime());
    }
    for (const times of servedTimesByKey.values()) times.sort((a, b) => a - b);

    const servedEntriesByKey = new Map();
    const countsByServiceId = new Map();
    for (const entry of entries) {
      const serviceId = serviceIdByQueueId.get(entry.queueid);
      if (!serviceId) continue;

      if (!countsByServiceId.has(serviceId)) countsByServiceId.set(serviceId, emptyCounts());
      const counts = countsByServiceId.get(serviceId);
      counts.joined += 1;
      if (entry.status === 'served') counts.served += 1;
      else if (entry.status === 'canceled') counts.canceled += 1;
      else if (entry.status === 'waiting') counts.waiting += 1;
      counts.lastEntryAt = latestIso(counts.lastEntryAt, entry.jointime);

      if (entry.status !== 'served') continue;
      const serviceName = serviceNameById.get(serviceId);
      if (!serviceName) continue;
      const key = `${entry.userid}::${serviceName}`;
      if (!servedEntriesByKey.has(key)) servedEntriesByKey.set(key, []);
      servedEntriesByKey.get(key).push(entry);
    }

    const waitSumByServiceId = new Map();
    const waitCountByServiceId = new Map();
    for (const [key, keyEntries] of servedEntriesByKey) {
      const serviceName = key.slice(key.indexOf('::') + 2);
      const serviceId = serviceIdByName.get(serviceName);
      if (!serviceId) continue;
      const historyTimes = servedTimesByKey.get(key) || [];

      keyEntries.sort((a, b) => new Date(a.jointime) - new Date(b.jointime));
      keyEntries.forEach((entry, index) => {
        const servedAt = historyTimes[index];
        if (servedAt == null) return;
        const waitMs = servedAt - new Date(entry.jointime).getTime();
        if (waitMs < 0) return;
        waitSumByServiceId.set(serviceId, (waitSumByServiceId.get(serviceId) || 0) + waitMs);
        waitCountByServiceId.set(serviceId, (waitCountByServiceId.get(serviceId) || 0) + 1);
      });
    }

    const rows = serviceRows.map((service) => {
      const counts = countsByServiceId.get(service.id) || emptyCounts();
      const resolved = counts.served + counts.canceled;

      const waitSum = waitSumByServiceId.get(service.id) || 0;
      const waitCount = waitCountByServiceId.get(service.id) || 0;
      const avgWaitMinutes = waitCount > 0 ? waitSum / waitCount / 60000 : null;

      //+ undershot, - overshot
      const estimatedWaitMinutes = service.expectedduration ?? null;
      const errorMinutes =
        avgWaitMinutes != null && estimatedWaitMinutes != null ? avgWaitMinutes - estimatedWaitMinutes : null;

      const leavePercent = resolved > 0 ? Math.round((counts.canceled / resolved) * 100) : null;

      return {
        id: service.id,
        name: service.name,
        description: service.description,
        priority: service.priority,
        isOpen: service.isopen,
        createdAt: service.createdat,
        expectedDuration: service.expectedduration,
        currentWaiting: counts.waiting,
        currentWaitLoadMinutes: counts.waiting * (service.expectedduration ?? 0),
        joined: counts.joined,
        served: counts.served,
        left: counts.canceled,
        totalInteractions: counts.joined,
        lastActivityAt: latestIso(counts.lastEntryAt, lastHistoryByServiceName.get(service.name)),
        leavePercent,
        avgWaitMinutes,
        errorMinutes,
      };
    });

    rows.sort((a, b) => a.name.localeCompare(b.name));
    return rows;
  }
}

class FileReportsStore {
  constructor(config) {
    this.config = config;
  }

  async initialize() {
    return Promise.resolve();
  }

  async readJson(file, fallback) {
    try {
      return JSON.parse(await fs.readFile(file, 'utf8'));
    } catch {
      return fallback;
    }
  }

  async userStats() {
    const [users, history] = await Promise.all([
      this.readJson(this.config.dataFile, []),
      this.readJson(this.config.historyFile, []),
    ]);
    const userById = new Map(users.map((user) => [user.id, user]));

    return history
      .filter((record) => ['served', 'left'].includes(record.outcome))
      .map((record) => {
        const user = userById.get(record.userId);
        return {
          id: record.id,
          name: user?.name ?? 'Unknown',
          email: user?.email ?? null,
          serviceName: record.serviceName ?? 'Unknown service',
          joinedAt: record.createdAt,
          outcome: record.outcome,
          outcomeAt: record.createdAt,
        };
      })
      .sort((a, b) => new Date(b.joinedAt) - new Date(a.joinedAt));
  }

  async queueStats() {
    const [services, queues, history] = await Promise.all([
      this.readJson(this.config.servicesFile, []),
      this.readJson(this.config.queuesFile, {}),
      this.readJson(this.config.historyFile, []),
    ]);

    const historyCountsByService = new Map();
    for (const record of history) {
      if (!record.serviceName) continue;
      if (!historyCountsByService.has(record.serviceName)) {
        historyCountsByService.set(record.serviceName, {
          served: 0,
          left: 0,
          waitSum: 0,
          waitCount: 0,
          lastActivityAt: null,
        });
      }
      const counts = historyCountsByService.get(record.serviceName);
      if (record.outcome === 'served') {
        counts.served += 1;
        counts.waitSum += Number(record.waitMinutes) || 0;
        counts.waitCount += 1;
      } else if (record.outcome === 'left') {
        counts.left += 1;
      }
      counts.lastActivityAt = latestIso(counts.lastActivityAt, record.createdAt);
    }

    return services
      .map((service) => {
        const currentWaiting = queues[service.id]?.length ?? 0;
        const historyCounts = historyCountsByService.get(service.name) ?? {
          served: 0,
          left: 0,
          waitSum: 0,
          waitCount: 0,
          lastActivityAt: null,
        };
        const joined = currentWaiting + historyCounts.served + historyCounts.left;
        const resolved = historyCounts.served + historyCounts.left;
        const avgWaitMinutes = historyCounts.waitCount > 0
          ? historyCounts.waitSum / historyCounts.waitCount
          : null;
        const leavePercent = resolved > 0 ? Math.round((historyCounts.left / resolved) * 100) : null;

        return {
          id: service.id,
          name: service.name,
          description: service.description,
          priority: service.priority,
          isOpen: service.isOpen,
          createdAt: service.createdAt,
          expectedDuration: service.expectedDuration,
          currentWaiting,
          currentWaitLoadMinutes: currentWaiting * (service.expectedDuration ?? 0),
          joined,
          served: historyCounts.served,
          left: historyCounts.left,
          totalInteractions: joined,
          lastActivityAt: historyCounts.lastActivityAt,
          leavePercent,
          avgWaitMinutes,
          errorMinutes: avgWaitMinutes == null ? null : avgWaitMinutes - service.expectedDuration,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }
}

function createStore(config) {
  if (config.useDatabase && config.db) return new DatabaseReportsStore(config.db);
  return new FileReportsStore(config);
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

  router.get(
    '/queue-stats',
    auth.authenticate,
    auth.requireAdmin,
    async (request, response, next) => {
      try {
        const queueStats = await store.queueStats();
        response.json({ queueStats });
      } catch (error) {
        next(error);
      }
    },
  );

  return { router, store };
}
