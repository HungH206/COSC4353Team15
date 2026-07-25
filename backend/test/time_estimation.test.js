import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { after, before, test } from 'node:test';
import { createApp } from '../src/app.js';
import { calculateWaitTime } from '../src/modules/time_estimation.js';

let server;
let baseUrl;
let temporaryDirectory;
let adminToken;
let userToken;
let serviceId;

before(async () => {
  temporaryDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'queuesmart-estimation-'));

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
      name: 'Estimation Test Service',
      description: 'Service used to test estimated wait times',
      expectedDuration: 12,
      priority: 'medium',
      isOpen: true,
    }),
  }, adminToken);
  serviceId = service.body.service.id;

  const firstToken = await registerAndLogin('First User', 'first@example.com', 'first-password');
  const secondToken = await registerAndLogin('Second User', 'second@example.com', 'second-password');

  await join(serviceId, firstToken);
  await join(serviceId, secondToken);
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
  return request('/api/queue/join', {
    method: 'POST',
    body: JSON.stringify({ serviceId: targetServiceId }),
  }, token);
}

test('calculates wait as people ahead times expected duration', () => {
  assert.equal(calculateWaitTime(1, 12), 0);
  assert.equal(calculateWaitTime(2, 12), 12);
  assert.equal(calculateWaitTime(3, 12), 24);
  assert.equal(calculateWaitTime(5, 15), 60);
});

test('handles invalid calculation values safely', () => {
  assert.equal(calculateWaitTime(0, 10), 0);
  assert.equal(calculateWaitTime(-2, 10), 0);
  assert.equal(calculateWaitTime(3, -10), 0);
  assert.equal(calculateWaitTime('invalid', 'invalid'), 0);
});

test('returns a prospective estimate before the user joins', async () => {
  const response = await request(
    `/api/time-estimation/${serviceId}`,
    { method: 'GET' },
    userToken,
  );

  assert.equal(response.status, 200);
  assert.deepEqual(response.body.estimate, {
    serviceId,
    serviceName: 'Estimation Test Service',
    expectedDuration: 12,
    queueLength: 2,
    inQueue: false,
    position: 3,
    peopleAhead: 2,
    estimatedWait: 24,
  });
});

test('queue join response uses the same estimation rule', async () => {
  const response = await join(serviceId, userToken);

  assert.equal(response.status, 200);
  assert.equal(response.body.position, 3);
  assert.equal(response.body.estWait, 24);
});

test('returns the current estimate after the user joins', async () => {
  const response = await request(
    `/api/time-estimation/${serviceId}`,
    { method: 'GET' },
    userToken,
  );

  assert.equal(response.status, 200);
  assert.equal(response.body.estimate.inQueue, true);
  assert.equal(response.body.estimate.position, 3);
  assert.equal(response.body.estimate.peopleAhead, 2);
  assert.equal(response.body.estimate.estimatedWait, 24);
  assert.equal(response.body.estimate.queueLength, 3);
});

test('returns estimates for every service', async () => {
  const response = await request('/api/time-estimation', { method: 'GET' }, userToken);

  assert.equal(response.status, 200);
  assert.ok(response.body.estimates[serviceId]);
  assert.equal(response.body.estimates[serviceId].estimatedWait, 24);
});

test('returns 404 for an unknown service', async () => {
  const response = await request(
    '/api/time-estimation/missing-service',
    { method: 'GET' },
    userToken,
  );

  assert.equal(response.status, 404);
  assert.equal(response.body.error, 'Service not found.');
});

test('requires authentication for wait-time estimates', async () => {
  const noToken = await request('/api/time-estimation', { method: 'GET' });
  assert.equal(noToken.status, 401);

  const badToken = await request(
    `/api/time-estimation/${serviceId}`,
    { method: 'GET' },
    'invalid-token',
  );
  assert.equal(badToken.status, 401);
});
