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
  temporaryDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'queuesmart-notifications-'));

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
  serviceId = await createService('Notification Test Service');
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  await fs.rm(temporaryDirectory, { recursive: true, force: true });
});

async function request(route, options = {}, token = null) {
  const headers = { 'content-type': 'application/json', ...options.headers };
  if (token) headers.authorization = `Bearer ${token}`;

  const response = await fetch(`${baseUrl}${route}`, { ...options, headers });
  const body = response.status !== 204 ? await response.json() : null;
  return { status: response.status, body };
}

async function login(email, password) {
  const response = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  return response.body.token;
}

async function registerAndLogin(name, email, password) {
  await request('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ name, email, password }),
  });
  return login(email, password);
}

async function createService(name) {
  const response = await request('/api/services', {
    method: 'POST',
    body: JSON.stringify({
      name,
      description: 'Notification integration test service',
      expectedDuration: 10,
      priority: 'medium',
    }),
  }, adminToken);
  return response.body.service.id;
}

test('user receives a notification when joining the queue', async () => {
  const joined = await request('/api/queue/join', {
    method: 'POST',
    body: JSON.stringify({ serviceId }),
  }, userToken);
  assert.equal(joined.status, 200);

  const result = await request('/api/notifications', { method: 'GET' }, userToken);
  assert.equal(result.status, 200);
  assert.equal(result.body.notifications.length, 1);
  assert.match(result.body.notifications[0].message, /joined the queue/i);
});

test('user can mark their own notification as read', async () => {
  const result = await request('/api/notifications', { method: 'GET' }, userToken);
  const notification = result.body.notifications[0];

  const marked = await request(
    `/api/notifications/${notification.id}/read`,
    { method: 'PATCH' },
    userToken,
  );
  assert.equal(marked.status, 200);
  assert.equal(marked.body.notification.read, true);

  const otherUserAttempt = await request(
    `/api/notifications/${notification.id}/read`,
    { method: 'PATCH' },
    adminToken,
  );
  assert.equal(otherUserAttempt.status, 404);
});

test('next user receives a notification when the current user is served', async () => {
  const isolatedServiceId = await createService('Serve Notification Service');
  const firstToken = await registerAndLogin(
    'First In Line',
    'first-in-line@example.com',
    'first-password',
  );
  const secondToken = await registerAndLogin(
    'Second In Line',
    'second-in-line@example.com',
    'second-password',
  );

  await request('/api/queue/join', {
    method: 'POST',
    body: JSON.stringify({ serviceId: isolatedServiceId }),
  }, firstToken);
  await request('/api/queue/join', {
    method: 'POST',
    body: JSON.stringify({ serviceId: isolatedServiceId }),
  }, secondToken);

  const served = await request(
    `/api/queue/${isolatedServiceId}/serve`,
    { method: 'POST' },
    adminToken,
  );
  assert.equal(served.status, 200);

  const result = await request('/api/notifications', { method: 'GET' }, secondToken);
  assert.equal(result.status, 200);
  assert.match(result.body.notifications[0].message, /next/i);
});

test('rejects requests for notifications without a valid token', async () => {
  const noToken = await request('/api/notifications', { method: 'GET' });
  assert.equal(noToken.status, 401);

  const badToken = await request('/api/notifications', { method: 'GET' }, 'not-a-real-token');
  assert.equal(badToken.status, 401);
});

test('returns an empty list for a user with no notification history', async () => {
  const freshToken = await registerAndLogin(
    'Fresh User',
    'fresh-user@example.com',
    'fresh-password',
  );

  const result = await request('/api/notifications', { method: 'GET' }, freshToken);
  assert.equal(result.status, 200);
  assert.deepEqual(result.body.notifications, []);
});

test('does not leak one user notification to another user', async () => {
  const isolatedServiceId = await createService('Isolation Test Service');
  const activeToken = await registerAndLogin(
    'Active User',
    'active-user@example.com',
    'active-password',
  );
  const bystanderToken = await registerAndLogin(
    'Bystander User',
    'bystander-user@example.com',
    'bystander-password',
  );

  await request('/api/queue/join', {
    method: 'POST',
    body: JSON.stringify({ serviceId: isolatedServiceId }),
  }, activeToken);

  const active = await request('/api/notifications', { method: 'GET' }, activeToken);
  assert.equal(active.body.notifications.length, 1);

  const bystander = await request('/api/notifications', { method: 'GET' }, bystanderToken);
  assert.equal(bystander.status, 200);
  assert.deepEqual(bystander.body.notifications, []);
});
