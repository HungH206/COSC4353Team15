import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { Router } from 'express';

class HistoryStore {
  constructor(file) {
    this.file = file;
    this.writeQueue = Promise.resolve();
  }

  async initialize() {
    await fs.mkdir(path.dirname(this.file), { recursive: true });

    try {
      await fs.access(this.file);
    } catch {
      await this.write([]);
    }
  }

  async all() {
    return JSON.parse(await fs.readFile(this.file, 'utf8'));
  }

  async forUser(userId) {
    const records = await this.all();

    return records
      .filter((record) => record.userId === userId)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  async create(record) {
    const operation = this.writeQueue.then(async () => {
      const records = await this.all();
      records.push(record);
      await this.write(records);
      return record;
    });

    this.writeQueue = operation.catch(() => {});
    return operation;
  }

  async write(records) {
    const temporaryFile = `${this.file}.tmp`;

    await fs.writeFile(
      temporaryFile,
      `${JSON.stringify(records, null, 2)}\n`,
      'utf8',
    );

    await fs.rename(temporaryFile, this.file);
  }
}

function mapDatabaseHistory(record) {
  if (!record) return null;
  return {
    id: record.id,
    userId: record.userid,
    serviceName: record.service_name ?? record.message?.replace(/^(Served by|Left) /, '').replace(/\.$/, ''),
    waitMinutes: record.wait_minutes ?? 0,
    outcome: record.outcome,
    createdAt: record.createdat,
  };
}

class DatabaseHistoryStore {
  constructor(db) {
    this.db = db;
  }

  async initialize() {
    return Promise.resolve();
  }

  async forUser(userId) {
    const { data, error } = await this.db
      .from('history')
      .select('*')
      .eq('userid', userId)
      .order('createdat', { ascending: false });

    if (error) throw new Error(`Database error: ${error.message}`);
    return data
      .filter((record) => ['served', 'left'].includes(record.outcome))
      .map(mapDatabaseHistory);
  }

  async create(record) {
    const insertData = {
      id: record.id,
      userid: record.userId,
      message: `${record.outcome === 'served' ? 'Served by' : 'Left'} ${record.serviceName}.`,
      status: 'viewed',
      outcome: record.outcome,
      createdat: record.createdAt,
    };

    const { data, error } = await this.db
      .from('history')
      .insert(insertData)
      .select()
      .single();

    if (error) throw new Error(`Database error: ${error.message}`);
    return mapDatabaseHistory(data);
  }
}

function createStore(config) {
  if (config.useDatabase && config.db) return new DatabaseHistoryStore(config.db);
  return new HistoryStore(config.historyFile);
}

export async function createHistoryModule(config, auth) {
  const store = createStore(config);
  await store.initialize();

  /*
   * Passed into queue.js as historyLogger.
   *
   * Expected arguments:
   *   userId
   *   serviceName
   *   waitMinutes
   *   outcome: "served" or "left"
   */
  const log = async (
    userId,
    serviceName,
    waitMinutes,
    outcome,
  ) => {
    if (!userId) {
      throw new Error('userId is required for a history record.');
    }

    if (!serviceName) {
      throw new Error('serviceName is required for a history record.');
    }

    if (!['served', 'left'].includes(outcome)) {
      throw new Error('History outcome must be served or left.');
    }

    const safeWaitMinutes = Math.max(
      0,
      Number.parseInt(waitMinutes, 10) || 0,
    );

    return store.create({
      id: randomUUID(),
      userId,
      serviceName,
      waitMinutes: safeWaitMinutes,
      outcome,
      createdAt: new Date().toISOString(),
    });
  };

  const router = Router();

  // Users can only retrieve their own queue history.
  router.get(
    '/',
    auth.authenticate,
    async (request, response, next) => {
      try {
        const history = await store.forUser(request.user.id);
        response.json({ history });
      } catch (error) {
        next(error);
      }
    },
  );

  return {
    router,
    store,
    log,
  };
}
