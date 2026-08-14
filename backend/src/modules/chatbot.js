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

function buildPrompt(user, message, estimates) {
  return [
    {
      role: 'system',
      content: [
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
      ].join(' '),
    },
    {
      role: 'user',
      content: JSON.stringify({
        user: { id: user.id, name: user.name, role: user.role },
        question: message,
        queueStatus: estimates,
      }),
    },
  ];
}

async function callAiApi(config, user, message, estimates) {
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
        messages: buildPrompt(user, message, estimates),
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
      const aiResult = await callAiApi(config, request.user, message, estimates);
      const answer = aiResult.answer ?? formatFallbackAnswer(message, estimates);

      response.json({
        answer,
        source: aiResult.answer ? 'ai-api' : 'queuesmart-fallback',
        fallbackReason: aiResult.answer ? null : aiResult.error,
        smartFeature: {
          groundedInLiveQueueData: true,
          readOnly: true,
          apiBased: Boolean(config.aiApiKey && config.aiChatModel),
        },
      });
    } catch (error) {
      next(error);
    }
  });

  return { router, buildEstimates, formatFallbackAnswer };
}
