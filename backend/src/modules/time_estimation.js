import { Router } from 'express';

export function calculateWaitTime(position, expectedDuration) {
  const safePosition = Math.max(1, Number.parseInt(position, 10) || 1);
  const safeDuration = Math.max(0, Number.parseInt(expectedDuration, 10) || 0);
  return (safePosition - 1) * safeDuration;
}

export async function calculateSmartWaitTime(db, serviceName, position, fallbackDuration) {
  const safePosition = Math.max(1, Number.parseInt(position, 10) || 1);
  const peopleAhead = safePosition - 1;
  
  if (peopleAhead === 0) return 0;

  if (!db || typeof db.from !== 'function') {
    return peopleAhead * fallbackDuration;
  }

  try {
    const { data: recentHistory, error } = await db
      .from('history')
      .select('outcome') 
      .like('message', `%${serviceName}%`)
      .eq('status', 'served')
      .order('createdat', { ascending: false })
      .limit(10);

    if (error || !recentHistory || recentHistory.length === 0) {
      return peopleAhead * fallbackDuration;
    }

    const totalMinutes = recentHistory.reduce((sum, record) => {
      const minutes = parseInt(record.outcome, 10);
      return sum + (isNaN(minutes) ? fallbackDuration : minutes);
    }, 0);

    const averageWait = Math.round(totalMinutes / recentHistory.length);
    return peopleAhead * averageWait;

  } catch (error) {
    console.error("Smart estimation failed, falling back to default:", error.message);
    return peopleAhead * fallbackDuration;
  }
}

async function buildEstimate(db, service, serviceQueue, userId) {
  
  const queueArray = Array.isArray(serviceQueue) ? serviceQueue : [];
  
  const userIndex = queueArray.findIndex((entry) => entry.userId === userId);
  const inQueue = userIndex >= 0;
  const position = inQueue ? userIndex + 1 : queueArray.length + 1;

  const estimatedWait = await calculateSmartWaitTime(db, service.name, position, service.expectedDuration);

  return {
    serviceId: service.id,
    serviceName: service.name,
    expectedDuration: service.expectedDuration,
    queueLength: queueArray.length,
    inQueue,
    position,
    peopleAhead: position - 1,
    estimatedWait, 
  };
}

export function createTimeEstimationModule(auth, serviceStore, queueStore, db) {
  const router = Router();

  router.get('/', auth.authenticate, async (request, response) => {
    const [services, queues] = await Promise.all([serviceStore.all(), queueStore.read()]);
    
    const estimatesArray = await Promise.all(
      services.map(async (service) => {
        const estimate = await buildEstimate(db, service, queues[service.id] ?? [], request.user.id);
        return [service.id, estimate];
      })
    );
    
    const estimates = Object.fromEntries(estimatesArray);
    response.json({ estimates });
  });

  router.get('/:serviceId', auth.authenticate, async (request, response) => {
    const service = await serviceStore.find(request.params.serviceId);
    if (!service) return response.status(404).json({ error: 'Service not found.' });

    const queues = await queueStore.read();
    const estimate = await buildEstimate(db, service, queues[service.id] ?? [], request.user.id);
    
    response.json({ estimate });
  });

  return { router, calculateWaitTime, calculateSmartWaitTime };
}