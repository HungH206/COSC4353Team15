import { Router } from 'express';
import { calculateSmartWaitTime, calculateWaitTime } from './time_estimation.js';

const MAX_MESSAGE_LENGTH = 500;

function normalizeMessage(value) {
  return typeof value === 'string' ? value.trim().slice(0, MAX_MESSAGE_LENGTH) : '';
}

// Build estimates for all services, including queue length, position, and estimated wait time
async function buildEstimates(config, services, queues, userId) {
  return Promise.all(services.map(async (service) => {
    const serviceQueue = queues[service.id] ?? [];
    const userIndex = serviceQueue.findIndex((entry) => entry.userId === userId);
    const inQueue = userIndex >= 0;
    const position = inQueue ? userIndex + 1 : serviceQueue.length + 1;
    const estimatedWait = config.useDatabase && config.db
      ? await calculateSmartWaitTime(config.db, service.name, position, service.expectedDuration)
      : calculateWaitTime(position, service.expectedDuration);

    return {
      serviceId: service.id,
      serviceName: service.name,
      isOpen: service.isOpen,
      expectedDuration: service.expectedDuration,
      queueLength: serviceQueue.length,
      inQueue,
      position,
      peopleAhead: position - 1,
      estimatedWait,
    };
  }));
}

function findActiveEstimate(estimates) {
  return estimates.find((estimate) => estimate.inQueue) ?? null;
}

function findShortestOpenEstimate(estimates) {
  return estimates
    .filter((estimate) => estimate.isOpen)
    .sort((first, second) => first.estimatedWait - second.estimatedWait)[0] ?? null;
}

function formatServiceHealth(service, estimate) {
  return {
    serviceId: service.id,
    serviceName: service.name,
    isOpen: service.isOpen,
    priority: service.priority,
    expectedDuration: service.expectedDuration,
    currentWaiting: estimate.queueLength,
    estimatedWaitForNewArrival: estimate.estimatedWait,
    waitLoadMinutes: estimate.queueLength * service.expectedDuration,
  };
}

function buildAdminOperations(services, estimates) {
  const estimatesByServiceId = new Map(estimates.map((estimate) => [estimate.serviceId, estimate]));
  const serviceHealth = services.map((service) => formatServiceHealth(
    service,
    estimatesByServiceId.get(service.id) ?? {
      serviceId: service.id,
      serviceName: service.name,
      isOpen: service.isOpen,
      queueLength: 0,
      estimatedWait: 0,
    },
  ));

  const openServices = serviceHealth.filter((service) => service.isOpen);
  const closedServices = serviceHealth.filter((service) => !service.isOpen);
  const busiestService = [...serviceHealth].sort((first, second) => second.currentWaiting - first.currentWaiting)[0] ?? null;
  const highestWaitLoadService = [...serviceHealth].sort((first, second) => second.waitLoadMinutes - first.waitLoadMinutes)[0] ?? null;
  const highestNewArrivalWaitService = [...serviceHealth].sort((first, second) => second.estimatedWaitForNewArrival - first.estimatedWaitForNewArrival)[0] ?? null;
  const totalWaiting = serviceHealth.reduce((sum, service) => sum + service.currentWaiting, 0);
  const totalWaitLoadMinutes = serviceHealth.reduce((sum, service) => sum + service.waitLoadMinutes, 0);

  return {
    totalServices: serviceHealth.length,
    openServices: openServices.length,
    closedServices: closedServices.length,
    totalWaiting,
    totalWaitLoadMinutes,
    busiestService,
    highestWaitLoadService,
    highestNewArrivalWaitService,
    services: serviceHealth,
  };
}

function formatFallbackAnswer(message, estimates) {
  const active = findActiveEstimate(estimates);
  const shortest = findShortestOpenEstimate(estimates);
  const lowered = message.toLowerCase();

  if (!active) {
    if (shortest) {
      return `You are not currently in a queue. The shortest open queue is ${shortest.serviceName}, with ${shortest.queueLength} people waiting and an estimated wait of about ${shortest.estimatedWait} minutes if you join now.`;
    }
    return 'You are not currently in a queue, and there are no open services available right now.';
  }

  if (lowered.includes('short') || lowered.includes('fast') || lowered.includes('best') || lowered.includes('join')) {
    const comparison = shortest && shortest.serviceId !== active.serviceId
      ? ` For comparison, ${shortest.serviceName} currently has an estimated wait of about ${shortest.estimatedWait} minutes.`
      : '';
    return `You are currently in the ${active.serviceName} queue at position #${active.position}. Your estimated wait is about ${active.estimatedWait} minutes.${comparison}`;
  }

  if (lowered.includes('next') || lowered.includes('almost')) {
    return active.peopleAhead === 0
      ? `Yes. You are next for ${active.serviceName}. Please be ready.`
      : `Not yet. You have ${active.peopleAhead} ${active.peopleAhead === 1 ? 'person' : 'people'} ahead of you in the ${active.serviceName} queue.`;
  }

  if (lowered.includes('leave') || lowered.includes('cancel')) {
    return `You can leave the ${active.serviceName} queue from this page using the Leave Queue button. If you stay, your current position is #${active.position} with about ${active.estimatedWait} minutes estimated wait.`;
  }

  return `You are #${active.position} in line for ${active.serviceName}. There ${active.peopleAhead === 1 ? 'is' : 'are'} ${active.peopleAhead} ${active.peopleAhead === 1 ? 'person' : 'people'} ahead of you, and your estimated wait is about ${active.estimatedWait} minutes.`;
}

function formatAdminFallbackAnswer(message, operations) {
  const lowered = message.toLowerCase();
  const busiest = operations.busiestService;
  const waitLoad = operations.highestWaitLoadService;
  const newArrivalWait = operations.highestNewArrivalWaitService;

  if (operations.totalServices === 0) {
    return 'There are no services configured yet, so there is no queue activity to summarize.';
  }

  if (operations.totalWaiting === 0) {
    return `All queues are currently clear. ${operations.openServices} services are open and ${operations.closedServices} are closed.`;
  }

  if (lowered.includes('staff') || lowered.includes('focus') || lowered.includes('attention') || lowered.includes('priority')) {
    return `Focus on ${waitLoad.serviceName} first. It has ${waitLoad.currentWaiting} waiting ${waitLoad.currentWaiting === 1 ? 'user' : 'users'} and about ${waitLoad.waitLoadMinutes} minutes of current wait load.`;
  }

  if (lowered.includes('busy') || lowered.includes('busiest') || lowered.includes('load')) {
    return `${busiest.serviceName} is the busiest queue with ${busiest.currentWaiting} waiting ${busiest.currentWaiting === 1 ? 'user' : 'users'}. The highest wait load is ${waitLoad.serviceName} at about ${waitLoad.waitLoadMinutes} minutes.`;
  }

  if (lowered.includes('wait') || lowered.includes('long')) {
    return `${newArrivalWait.serviceName} has the longest estimated wait for a new arrival at about ${newArrivalWait.estimatedWaitForNewArrival} minutes. Across all services, ${operations.totalWaiting} users are waiting.`;
  }

  if (lowered.includes('what are you')) {
    return 'I am the QueueSmart Admin AI Assistant. I summarize queue load, flag bottlenecks, and suggest where admins should focus next without changing queue records.';
  }

  return `There are ${operations.totalWaiting} users waiting across ${operations.openServices} open services. The main queue to watch is ${waitLoad.serviceName}, with ${waitLoad.currentWaiting} waiting and about ${waitLoad.waitLoadMinutes} minutes of wait load.`;
}
function buildPrompt(user, message, estimates, operations = null) {
  const isAdmin = user.role === 'admin';
  return [
    {
      role: 'system',
      content: (isAdmin ? [
        'You are QueueSmart Admin AI Assistant.',
        'Answer admin queue operations questions using only the provided QueueSmart data.',
        'Help admins understand queue load, bottlenecks, service status, wait-load risk, and where staff should focus next.',
        'You are read-only: do not claim that you served users, changed services, deleted queues, opened queues, or closed queues.',
        'Give direct operational recommendations, but frame them as suggestions for the admin to review.',
        'Keep answers concise: 2-4 short sentences unless the admin asks for a list.',
        'Do not mention raw JSON or internal field names unless the admin asks for technical detail.',
        'For "what are you", briefly say you are the QueueSmart Admin AI Assistant and mention operations summaries and bottleneck detection.',
      ] : [
        'You are QueueSmart AI Queue Assistant.',
        'Answer queue status questions using only the provided QueueSmart data.',
        'Do not invent queue positions, times, services, policies, or user actions.',
        'You are read-only: do not claim that you joined, left, served, or changed a queue.',
        'Write like a helpful campus service assistant, not like a database report.',
        'Keep answers to 1-3 short sentences unless the user asks for a list or comparison.',
        'Do not mention raw field names such as expectedDuration, peopleAhead, estimatedWait, queueLength, serviceId, inQueue, or JSON.',
        'Prefer natural phrases like "you are first in line", "no one is ahead of you", and "about 10 minutes".',
        'For "what are you", briefly say you are the QueueSmart AI Assistant and mention one or two things you can help with.',
        'For advice questions, give a direct recommendation first, then one short reason.',
      ]).join(' '),
    },
    {
      role: 'user',
      content: JSON.stringify({
        user: { id: user.id, name: user.name, role: user.role },
        question: message,
        queueStatus: estimates,
        adminOperations: operations,
      }),
    },
  ];
}

async function callAiApi(config, user, message, estimates, operations = null) {
  if (!config.aiApiKey || !config.aiChatModel) {
    return { answer: null, error: 'AI_API_KEY and AI_CHAT_MODEL must both be set.' };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.aiTimeoutMs ?? 8000);

  try {
    const response = await fetch(`${config.aiApiBaseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${config.aiApiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: config.aiChatModel,
        messages: buildPrompt(user, message, estimates, operations),
        max_completion_tokens: 300,
        reasoning_effort: 'minimal',
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      console.error('AI chatbot request failed:', response.status, errorBody.slice(0, 500));
      return { answer: null, error: `OpenAI request failed with status ${response.status}.` };
    }
    const data = await response.json();
    const answer = data?.choices?.[0]?.message?.content?.trim() || null;
    if (!answer) {
      console.error('AI chatbot returned no visible content:', JSON.stringify({
        finishReason: data?.choices?.[0]?.finish_reason,
        usage: data?.usage,
      }));
    }
    return {
      answer,
      error: answer ? null : 'OpenAI returned an empty assistant message.',
    };
  } catch (error) {
    console.error('AI chatbot request failed:', error.message);
    return { answer: null, error: error.message };
  } finally {
    clearTimeout(timeout);
  }
}

export function createChatbotModule(config, auth, serviceStore, queueStore) {
  const router = Router();

  router.post('/', auth.authenticate, async (request, response, next) => {
    try {
      const message = normalizeMessage(request.body?.message);
      if (!message) {
        return response.status(400).json({ error: 'message is required.' });
      }

      const [services, queues] = await Promise.all([serviceStore.all(), queueStore.read()]);
      const estimates = await buildEstimates(config, services, queues, request.user.id);
      const operations = request.user.role === 'admin'
        ? buildAdminOperations(services, estimates)
        : null;
      const aiResult = await callAiApi(config, request.user, message, estimates, operations);
      const answer = aiResult.answer ?? (
        request.user.role === 'admin'
          ? formatAdminFallbackAnswer(message, operations)
          : formatFallbackAnswer(message, estimates)
      );

      response.json({
        answer,
        source: aiResult.answer ? 'ai-api' : 'queuesmart-fallback',
        fallbackReason: aiResult.answer ? null : aiResult.error,
        smartFeature: {
          groundedInLiveQueueData: true,
          readOnly: true,
          apiBased: Boolean(config.aiApiKey && config.aiChatModel),
          adminOperations: request.user.role === 'admin',
        },
      });
    } catch (error) {
      next(error);
    }
  });

  return { router, buildEstimates, buildAdminOperations, formatFallbackAnswer, formatAdminFallbackAnswer };
}
