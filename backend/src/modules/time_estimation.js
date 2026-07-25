import { Router } from 'express';

export function calculateWaitTime(position, expectedDuration) {
  const safePosition = Math.max(1, Number.parseInt(position, 10) || 1);
  const safeDuration = Math.max(0, Number.parseInt(expectedDuration, 10) || 0);
  return (safePosition - 1) * safeDuration;
}

function buildEstimate(service, serviceQueue, userId) {
  const userIndex = serviceQueue.findIndex((entry) => entry.userId === userId);
  const inQueue = userIndex >= 0;
  const position = inQueue ? userIndex + 1 : serviceQueue.length + 1;

  return {
    serviceId: service.id,
    serviceName: service.name,
    expectedDuration: service.expectedDuration,
    queueLength: serviceQueue.length,
    inQueue,
    position,
    peopleAhead: position - 1,
    estimatedWait: calculateWaitTime(position, service.expectedDuration),
  };
}

export function createTimeEstimationModule(auth, serviceStore, queueStore) {
  const router = Router();

  router.get('/', auth.authenticate, async (request, response) => {
    const [services, queues] = await Promise.all([serviceStore.all(), queueStore.read()]);
    const estimates = Object.fromEntries(
      services.map((service) => [
        service.id,
        buildEstimate(service, queues[service.id] ?? [], request.user.id),
      ]),
    );
    response.json({ estimates });
  });

  router.get('/:serviceId', auth.authenticate, async (request, response) => {
    const service = await serviceStore.find(request.params.serviceId);
    if (!service) return response.status(404).json({ error: 'Service not found.' });

    const queues = await queueStore.read();
    response.json({
      estimate: buildEstimate(service, queues[service.id] ?? [], request.user.id),
    });
  });

  return { router, calculateWaitTime };
}
