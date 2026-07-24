import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { Router } from 'express';

class QueueStore {
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
}

export async function createQueueModule(config, auth, serviceStore, historyLogger, notifier) {
  const queues = new QueueStore(config.queuesFile);
  await queues.initialize();

  const router = Router();

  // get all queues - admin overview
  router.get('/', auth.authenticate, auth.requireAdmin, async (request, response) => {
    response.json({ queues: await queues.read() });
  });

  // join a queue
  router.post('/join', auth.authenticate, async (request, response) => {
    const { serviceId } = request.body;
    if (!serviceId) return response.status(400).json({ error: 'serviceId is required.' });

    const service = await serviceStore.find(serviceId);
    if (!service || !service.isOpen) {
      return response.status(400).json({ error: 'Service is unavailable or closed.' });
    }

    const allQueues = await queues.read();
    if (!allQueues[serviceId]) allQueues[serviceId] = [];

    // check if user is already in this queue
    if (allQueues[serviceId].some((entry) => entry.userId === request.user.id)) {
      return response.status(400).json({ error: 'You are already in this queue.' });
    }

    const entry = {
      id: randomUUID(),
      userId: request.user.id,
      name: request.user.name,
      joinedAt: new Date().toLocaleTimeString(),
      status: 'waiting'
    };

    allQueues[serviceId].push(entry);
    await queues.write(allQueues);
    
    // trigger notification
    await notifier(request.user.id, `You successfully joined the queue for ${service.name}.`);

    //calculate pisition and estimated wait time
    const position = allQueues[serviceId].length;
    const estWait = (position - 1) * service.expectedDuration;

    response.status(200).json({ position, estWait, entry });
  });

  // leave a queue
  router.post('/leave', auth.authenticate, async (request, response) => {
    const { serviceId } = request.body;
    const allQueues = await queues.read();
    const serviceQueue = allQueues[serviceId] || [];

    const index = serviceQueue.findIndex(e => e.userId === request.user.id);
    if (index === -1) return response.status(400).json({ error: 'Not in queue.' });

    serviceQueue.splice(index, 1);
    allQueues[serviceId] = serviceQueue;
    await queues.write(allQueues);

    const service = await serviceStore.find(serviceId);
    if (service) {
      const waitMinutes = index * service.expectedDuration;
      // Trigger history log 
      await historyLogger(request.user.id, service.name, waitMinutes, 'left');
    }

    response.status(200).json({ message: 'Left queue successfully.' });
  });

  // admin serves the next person
  router.post('/:serviceId/serve', auth.authenticate, auth.requireAdmin, async (request, response) => {
    const { serviceId } = request.params;
    const allQueues = await queues.read();
    const serviceQueue = allQueues[serviceId] || [];

    if (serviceQueue.length === 0) {
      return response.status(400).json({ error: 'Queue is empty.' });
    }

    const servedUser = serviceQueue.shift(); // Remove first person
    allQueues[serviceId] = serviceQueue;
    await queues.write(allQueues);

    const service = await serviceStore.find(serviceId);
    if (service) {
      // Trigger history log 
      await historyLogger(servedUser.userId, service.name, service.expectedDuration, 'served');
    }

    // Notify the next person that they are almost ready
    if (serviceQueue.length > 0) {
      const nextUser = serviceQueue[0];
      nextUser.status = 'almost_ready';
      await queues.write(allQueues);
      
      // Trigger notification
      await notifier(nextUser.userId, `You are next for ${service.name}! Please head to the counter.`);
    }

    response.status(200).json({ served: servedUser });
  });

  return { router, store: queues };
}