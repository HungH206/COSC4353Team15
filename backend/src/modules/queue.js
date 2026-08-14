import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { Router } from 'express';
import { calculateWaitTime, calculateSmartWaitTime } from './time_estimation.js';

const ACTIVE_ENTRY_STATUSES = ['waiting'];

class FileQueueStore {
  constructor(file) {
    this.file = file;
    this.writeQueue = Promise.resolve();
  }

  async initialize() {
    await fs.mkdir(path.dirname(this.file), { recursive: true });
    try {
      await fs.access(this.file);
    } catch {
      await this.write({});
    }
  }

  async read() {
    return JSON.parse(await fs.readFile(this.file, 'utf8'));
  }

  async write(data) {
    const operation = this.writeQueue.then(async () => {
      const temporaryFile = `${this.file}.tmp`;
      await fs.writeFile(temporaryFile, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
      await fs.rename(temporaryFile, this.file);
    });
    this.writeQueue = operation.catch(() => {});
    return operation;
  }

  async joinQueue(serviceId, user) {
    const allQueues = await this.read();
    if (!allQueues[serviceId]) allQueues[serviceId] = [];

    if (allQueues[serviceId].some((entry) => entry.userId === user.id)) {
      throw new Error('You are already in this queue.');
    }
    //SMART FEATURE: Calculate estimated wait time based on position in queue and expected duration
    const entry = {
      id: randomUUID(),
      userId: user.id,
      name: user.name,
      joinedAt: new Date().toLocaleTimeString(),
      joinedAtIso: new Date().toISOString(),
      status: 'waiting',
      position: allQueues[serviceId].length + 1,
    };

    allQueues[serviceId].push(entry);
    await this.write(allQueues);
    return entry;
  }

  async leaveQueue(serviceId, userId) {
    const allQueues = await this.read();
    const serviceQueue = allQueues[serviceId] || [];
    const index = serviceQueue.findIndex((entry) => entry.userId === userId);
    if (index === -1) throw new Error('Not in queue.');

    serviceQueue.splice(index, 1);
    serviceQueue.forEach((entry, positionIndex) => {
      entry.position = positionIndex + 1;
    });
    allQueues[serviceId] = serviceQueue;
    await this.write(allQueues);
    return index;
  }

  async serveNext(serviceId) {
    const allQueues = await this.read();
    const serviceQueue = allQueues[serviceId] || [];
    if (serviceQueue.length === 0) throw new Error('Queue is empty.');

    const servedUser = serviceQueue.shift();
    serviceQueue.forEach((entry, index) => {
      entry.position = index + 1;
      entry.status = index === 0 ? 'almost_ready' : entry.status;
    });
    allQueues[serviceId] = serviceQueue;
    await this.write(allQueues);

    return {
      servedUser,
      nextUser: serviceQueue.length > 0 ? serviceQueue[0] : null,
    };
  }
}

// Database queue store implementation
class DatabaseQueueStore {
  constructor(db) {
    this.db = db;
  }

  async initialize() {
    return Promise.resolve();
  }

  async _getOpenQueue(serviceId) {
    const { data: existingQueue, error: findError } = await this.db
      .from('queue')
      .select('*')
      .eq('serviceid', serviceId)
      .eq('status', 'open')
      .maybeSingle();

    if (findError) throw new Error(`DB Error (Find Queue): ${findError.message}`);

    let queue = existingQueue;
    if (!queue) {
      const { data: newQueue, error } = await this.db.from('queue').insert({
        id: randomUUID(),
        serviceid: serviceId,
        status: 'open',
        createdat: new Date().toISOString(),
      }).select().single();
      
      if (error) throw new Error(`DB Error (Create Queue): ${error.message}`);
      queue = newQueue;
    }
    return queue;
  }

  // Get all entries for a specific queue, ordered by position
  async _getQueueEntries(queueId) {
    const { data: entries, error } = await this.db
      .from('queueentry')
      .select('id, queueid, userid, position, jointime, status')
      .eq('queueid', queueId)
      .in('status', ACTIVE_ENTRY_STATUSES)
      .order('position', { ascending: true });
      
    if (error) throw new Error(`DB Error (Get Entries): ${error.message}`);

    return Promise.all(entries.map(async (e) => {
      const { data: profile } = await this.db
        .from('userprofile')
        .select('name')
        .eq('userid', e.userid)
        .maybeSingle();

      return {
        id: e.id,
        userId: e.userid,
        name: profile?.name || 'Unknown User',
        joinedAt: new Date(e.jointime).toLocaleTimeString(),
        joinedAtIso: e.jointime,
        status: e.position === 1 ? 'almost_ready' : e.status,
        position: e.position
      };
    }));
  }

  async read() {
    const { data: queues, error } = await this.db.from('queue').select('*').eq('status', 'open');
    if (error) throw new Error(`DB Error (Read Queues): ${error.message}`);

    const allQueues = {};
    for (const q of queues) {
      allQueues[q.serviceid] = await this._getQueueEntries(q.id);
    }
    return allQueues;
  }

  async joinQueue(serviceId, user) {
    const queue = await this._getOpenQueue(serviceId);
    const entries = await this._getQueueEntries(queue.id);

    if (entries.some(e => e.userId === user.id)) {
      throw new Error('You are already in this queue.');
    }

    const position = entries.length + 1;
    const insertData = {
      id: randomUUID(),
      queueid: queue.id,
      userid: user.id,
      position: position,
      jointime: new Date().toISOString(),
      status: 'waiting'
    };

    const { data, error } = await this.db.from('queueentry').insert(insertData).select().single();
    if (error) throw new Error(`DB Error (Join): ${error.message}`);

    return {
      id: data.id,
      userId: data.userid,
      name: user.name,
      joinedAt: new Date(data.jointime).toLocaleTimeString(),
      joinedAtIso: data.jointime,
      status: data.status,
      position: data.position
    };
  }

  async leaveQueue(serviceId, userId) {
    const queue = await this._getOpenQueue(serviceId);
    const entries = await this._getQueueEntries(queue.id);

    const entryIndex = entries.findIndex(e => e.userId === userId);
    if (entryIndex === -1) throw new Error('Not in queue.');

    const entryToCancel = entries[entryIndex];

    // Mark the leaving user as canceled
    await this.db.from('queueentry').update({ status: 'canceled' }).eq('id', entryToCancel.id);

    // Shift the positions of everyone who was behind them up by 1
    const entriesToShift = entries.slice(entryIndex + 1);
    for (const e of entriesToShift) {
      await this.db.from('queueentry').update({ position: e.position - 1 }).eq('id', e.id);
    }

    return entryIndex; // Returning the old index so the router can calculate wait time
  }

  async serveNext(serviceId) {
    const queue = await this._getOpenQueue(serviceId);
    const entries = await this._getQueueEntries(queue.id);

    if (entries.length === 0) throw new Error('Queue is empty.');

    const servedUser = entries[0];

    // Mark the first person in line as served
    await this.db.from('queueentry').update({ status: 'served' }).eq('id', servedUser.id);

    // Shift everyone else up by 1
    const remaining = entries.slice(1);
    for (let i = 0; i < remaining.length; i++) {
      const newPos = remaining[i].position - 1;
      await this.db.from('queueentry')
        .update({ position: newPos })
        .eq('id', remaining[i].id);
        
      remaining[i].position = newPos;
      remaining[i].status = newPos === 1 ? 'almost_ready' : remaining[i].status;
    }

    return { 
      servedUser, 
      nextUser: remaining.length > 0 ? remaining[0] : null 
    };
  }
}


// Create the queue module with router and store
function createQueueStore(config) {
  if (config.useDatabase && config.db) return new DatabaseQueueStore(config.db);
  return new FileQueueStore(config.queuesFile);
}

function validateServiceId(serviceId) {
  return typeof serviceId === 'string' && serviceId.trim().length > 0 && serviceId.trim().length <= 64;
}

async function runSideEffect(operation, label) {
  try {
    await operation();
  } catch (error) {
    console.error(`${label} failed:`, error.message);
  }
}

export async function createQueueModule(config, auth, serviceStore, historyLogger, notifier) {
  const queues = createQueueStore(config);
  await queues.initialize();

  const router = Router();

  // get all queues - admin overview
  router.get('/', auth.authenticate, auth.requireAdmin, async (request, response) => {
    response.json({ queues: await queues.read() });
  });

  // get the authenticated user's current queue memberships
  router.get('/mine', auth.authenticate, async (request, response) => {
    const allQueues = await queues.read();
    const memberships = [];

    for (const [serviceId, serviceQueue] of Object.entries(allQueues)) {
      const index = serviceQueue.findIndex((entry) => entry.userId === request.user.id);
      if (index === -1) continue;
      const service = await serviceStore.find(serviceId);
      const estWait = config.useDatabase && config.db
        ? await calculateSmartWaitTime(config.db, service?.name, index + 1, service?.expectedDuration)
        : calculateWaitTime(index + 1, service?.expectedDuration);
      memberships.push({
        serviceId,
        serviceName: service?.name ?? 'Unknown service',
        position: index + 1,
        estWait,
        entry: serviceQueue[index],
        queue: serviceQueue,
      });
    }

    response.json({ queues: memberships });
  });

  // get queue counts
  router.get('/summary', auth.authenticate, async (_request, response) => {
    const allQueues = await queues.read();
    response.json({
      counts: Object.fromEntries(
        Object.entries(allQueues).map(([serviceId, serviceQueue]) => [serviceId, serviceQueue.length]),
      ),
    });
  });

  // join a queue
  router.post('/join', auth.authenticate, async (request, response) => {
    const serviceId = typeof request.body.serviceId === 'string' ? request.body.serviceId.trim() : '';
    if (!validateServiceId(serviceId)) return response.status(400).json({ error: 'serviceId is required.' });

    const service = await serviceStore.find(serviceId);
    if (!service || !service.isOpen) {
      return response.status(400).json({ error: 'Service is unavailable or closed.' });
    }

    try {
      const entry = await queues.joinQueue(serviceId, request.user);

      //SMART FEARTURE CACULATION LOGIC
      let estWait;
      if (config.useDatabase && config.db) {
        estWait = await calculateSmartWaitTime(config.db, service.name, entry.position, service.expectedDuration);
      } else {
        estWait = calculateWaitTime(entry.position, service.expectedDuration);
      }

      await runSideEffect(
        () => notifier(request.user.id, `You successfully joined the queue for ${service.name}.`),
        'Queue join notification',
      );
      response.status(200).json({ position: entry.position, estWait, entry });
    } catch (error) {
      response.status(400).json({ error: error.message });
    }
  });

  // leave a queue
  router.post('/leave', auth.authenticate, async (request, response) => {
    const serviceId = typeof request.body.serviceId === 'string' ? request.body.serviceId.trim() : '';
    if (!validateServiceId(serviceId)) return response.status(400).json({ error: 'serviceId is required.' });

    try {
      const oldIndex = await queues.leaveQueue(serviceId, request.user.id);
      
      const service = await serviceStore.find(serviceId);
      if (service) {
        const waitMinutes = calculateWaitTime(oldIndex + 1, service.expectedDuration);
        await runSideEffect(
          () => historyLogger(request.user.id, service.name, waitMinutes, 'left'),
          'Queue leave history',
        );
      }
      response.status(200).json({ message: 'Left queue successfully.' });
    } catch (error) {
      response.status(400).json({ error: error.message });
    }
  });

  // admin serves the next person
  router.post('/:serviceId/serve', auth.authenticate, auth.requireAdmin, async (request, response) => {
    const { serviceId } = request.params;
    
    try {
      const { servedUser, nextUser } = await queues.serveNext(serviceId);
      
      const service = await serviceStore.find(serviceId);
      if (service) {

        //SMART FEATURE ACTUAL TIME CALCULATION
        let actualWaitMinutes = service.expectedDuration;

        const joinedAt = servedUser.joinedAtIso ?? servedUser.jointime;
        if (joinedAt) {
          const joinDate = new Date(joinedAt);
          if (!isNaN(joinDate.getTime())) {
            const serveTime = Date.now();
            // Calculate the actual elapsed time in minutes
            actualWaitMinutes = Math.max(1, Math.round((serveTime - joinDate.getTime()) / 60000));
          }
        }

        await runSideEffect(
          () => historyLogger(servedUser.userId, service.name, actualWaitMinutes, 'served'),
          'Queue serve history',
        );
        await runSideEffect(
          () => notifier(servedUser.userId, `It's your turn for ${service.name}! Please head to the counter.`),
          'Queue served-user notification',
        );
      }

      if (nextUser) {
        await runSideEffect(
          () => notifier(nextUser.userId, `You are next for ${service?.name || 'the service'}! Please head to the counter.`),
          'Queue next-user notification',
        );
      }

      response.status(200).json({ served: servedUser });
    } catch (error) {
      response.status(400).json({ error: error.message });
    }
  });

  return { router, store: queues };
}
