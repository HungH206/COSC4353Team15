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
  temporaryDirectory = await fs.mkdtemp(
    path.join(os.tmpdir(), 'queuesmart-history-'),
  );

  const app = await createApp({
    jwtSecret: 'test-secret-that-is-at-least-32-characters',
    tokenTtlSeconds: 3600,

    dataFile: path.join(temporaryDirectory, 'users.json'),
    servicesFile: path.join(
      temporaryDirectory,
      'services.json',
    ),
    queuesFile: path.join(
      temporaryDirectory,
      'queues.json',
    ),
    historyFile: path.join(
      temporaryDirectory,
      'history.json',
    ),
    notificationsFile: path.join(
      temporaryDirectory,
      'notifications.json',
    ),

    admin: {
      name: 'Test Admin',
      email: 'admin@example.com',
      password: 'admin-password',
    },

    demoUser: {
      name: 'Test User',
      email: 'user@example.com',
      password: 'user-password',
    },
  });

  server = app.listen(0);

  await new Promise((resolve) => {
    server.once('listening', resolve);
  });

  baseUrl = `http://127.0.0.1:${server.address().port}`;

  adminToken = await login(
    'admin@example.com',
    'admin-password',
  );

  userToken = await login(
    'user@example.com',
    'user-password',
  );

  const serviceResponse = await request(
    '/api/services',
    {
      method: 'POST',
      body: JSON.stringify({
        name: 'History Test Service',
        description: 'Service used for history tests',
        expectedDuration: 10,
        priority: 'medium',
        isOpen: true,
      }),
    },
    adminToken,
  );

  serviceId = serviceResponse.body.service.id;
});

after(async () => {
  await new Promise((resolve) => {
    server.close(resolve);
  });

  await fs.rm(temporaryDirectory, {
    recursive: true,
    force: true,
  });
});

async function request(route, options = {}, token = null) {
  const headers = {
    'content-type': 'application/json',
    ...options.headers,
  };

  if (token) {
    headers.authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${baseUrl}${route}`, {
    ...options,
    headers,
  });

  const body =
    response.status === 204
      ? null
      : await response.json();

  return {
    status: response.status,
    body,
  };
}

async function login(email, password) {
  const response = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });

  assert.equal(response.status, 200);
  return response.body.token;
}

async function registerAndLogin(
  name,
  email,
  password,
) {
  const registration = await request(
    '/api/auth/register',
    {
      method: 'POST',
      body: JSON.stringify({
        name,
        email,
        password,
      }),
    },
  );

  assert.equal(registration.status, 201);
  return login(email, password);
}

test('records history when a user leaves a queue', async () => {
  const joined = await request(
    '/api/queue/join',
    {
      method: 'POST',
      body: JSON.stringify({ serviceId }),
    },
    userToken,
  );

  assert.equal(joined.status, 200);

  const left = await request(
    '/api/queue/leave',
    {
      method: 'POST',
      body: JSON.stringify({ serviceId }),
    },
    userToken,
  );

  assert.equal(left.status, 200);

  const historyResponse = await request(
    '/api/history',
    { method: 'GET' },
    userToken,
  );

  assert.equal(historyResponse.status, 200);
  assert.equal(historyResponse.body.history.length, 1);

  const record = historyResponse.body.history[0];

  assert.equal(record.serviceName, 'History Test Service');
  assert.equal(record.outcome, 'left');
  assert.equal(record.waitMinutes, 0);
  assert.ok(record.createdAt);
});

test('records history when an administrator serves a user', async () => {
  const joined = await request(
    '/api/queue/join',
    {
      method: 'POST',
      body: JSON.stringify({ serviceId }),
    },
    userToken,
  );

  assert.equal(joined.status, 200);

  const served = await request(
    `/api/queue/${serviceId}/serve`,
    { method: 'POST' },
    adminToken,
  );

  assert.equal(served.status, 200);

  const historyResponse = await request(
    '/api/history',
    { method: 'GET' },
    userToken,
  );

  assert.equal(historyResponse.status, 200);
  assert.equal(historyResponse.body.history.length, 2);

  const servedRecord =
    historyResponse.body.history.find(
      (record) => record.outcome === 'served',
    );

  assert.ok(servedRecord);
  assert.equal(
    servedRecord.serviceName,
    'History Test Service',
  );
  assert.equal(servedRecord.waitMinutes, 10);
});

test('users cannot view another user history', async () => {
  const otherUserToken = await registerAndLogin(
    'Other User',
    'other@example.com',
    'other-password',
  );

  const otherHistory = await request(
    '/api/history',
    { method: 'GET' },
    otherUserToken,
  );

  assert.equal(otherHistory.status, 200);
  assert.deepEqual(otherHistory.body.history, []);
});

test('history endpoint requires authentication', async () => {
  const noToken = await request(
    '/api/history',
    { method: 'GET' },
  );

  assert.equal(noToken.status, 401);

  const invalidToken = await request(
    '/api/history',
    { method: 'GET' },
    'invalid-token',
  );

  assert.equal(invalidToken.status, 401);
});