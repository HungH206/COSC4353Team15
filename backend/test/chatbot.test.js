import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { after, before, test } from 'node:test';
import { createApp } from '../src/app.js';

let server;
let baseUrl;
let temporaryDirectory;
let adminToken;
let userToken;
let serviceId;

before(async () => {
  temporaryDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'queuesmart-chatbot-'));

  const app = await createApp({
    jwtSecret: 'test-secret-that-is-at-least-32-characters',
    tokenTtlSeconds: 3600,
    dataFile: path.join(temporaryDirectory, 'users.json'),
    servicesFile: path.join(temporaryDirectory, 'services.json'),
    queuesFile: path.join(temporaryDirectory, 'queues.json'),
    historyFile: path.join(temporaryDirectory, 'history.json'),
    notificationsFile: path.join(temporaryDirectory, 'notifications.json'),
    admin: { name: 'Admin', email: 'admin@example.com', password: 'admin-password' },
    demoUser: { name: 'User', email: 'user@example.com', password: 'user-password' },
  });

  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;

  adminToken = await login('admin@example.com', 'admin-password');
  userToken = await login('user@example.com', 'user-password');

  const service = await request('/api/services', {
    method: 'POST',
    body: JSON.stringify({
      name: 'AI Help Desk',
      description: 'Service used to test assistant queue answers',
      expectedDuration: 10,
      priority: 'medium',
      isOpen: true,
    }),
  }, adminToken);
  serviceId = service.body.service.id;

  const firstToken = await registerAndLogin('First User', 'first@example.com', 'first-password');
  const secondToken = await registerAndLogin('Second User', 'second@example.com', 'second-password');

  await join(serviceId, firstToken);
  await join(serviceId, secondToken);
  await join(serviceId, userToken);
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  await fs.rm(temporaryDirectory, { recursive: true, force: true });
});

async function request(route, options = {}, token = null) {
  const headers = { 'content-type': 'application/json', ...options.headers };
  if (token) headers.authorization = `Bearer ${token}`;

  const response = await fetch(`${baseUrl}${route}`, { ...options, headers });
  const body = response.status === 204 ? null : await response.json();
  return { status: response.status, body };
}

async function login(email, password) {
  const response = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  assert.equal(response.status, 200);
  return response.body.token;
}

async function registerAndLogin(name, email, password) {
  const registration = await request('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ name, email, password }),
  });
  assert.equal(registration.status, 201);
  return login(email, password);
}

async function join(targetServiceId, token) {
  const response = await request('/api/queue/join', {
    method: 'POST',
    body: JSON.stringify({ serviceId: targetServiceId }),
  }, token);
  assert.equal(response.status, 200);
}

test('answers queue status questions from live QueueSmart data', async () => {
  const response = await request('/api/chatbot', {
    method: 'POST',
    body: JSON.stringify({ message: 'How long is my wait?' }),
  }, userToken);

  assert.equal(response.status, 200);
  assert.equal(response.body.source, 'queuesmart-fallback');
  assert.equal(response.body.smartFeature.groundedInLiveQueueData, true);
  assert.equal(response.body.smartFeature.readOnly, true);
  assert.match(response.body.answer, /#3/);
  assert.match(response.body.answer, /AI Help Desk/);
  assert.match(response.body.answer, /20 minutes/);
});

test('answers admin operations questions from live QueueSmart data', async () => {
  const response = await request('/api/chatbot', {
    method: 'POST',
    body: JSON.stringify({ message: 'Which queue needs attention?' }),
  }, adminToken);

  assert.equal(response.status, 200);
  assert.equal(response.body.source, 'queuesmart-fallback');
  assert.equal(response.body.smartFeature.groundedInLiveQueueData, true);
  assert.equal(response.body.smartFeature.readOnly, true);
  assert.equal(response.body.smartFeature.adminOperations, true);
  assert.match(response.body.answer, /AI Help Desk/);
  assert.match(response.body.answer, /3 waiting users|3 users/);
});

test('requires a non-empty chatbot message', async () => {
  const response = await request('/api/chatbot', {
    method: 'POST',
    body: JSON.stringify({ message: '   ' }),
  }, userToken);

  assert.equal(response.status, 400);
  assert.equal(response.body.error, 'message is required.');
});

test('requires authentication for chatbot answers', async () => {
  const response = await request('/api/chatbot', {
    method: 'POST',
    body: JSON.stringify({ message: 'Am I next?' }),
  });

  assert.equal(response.status, 401);
});
