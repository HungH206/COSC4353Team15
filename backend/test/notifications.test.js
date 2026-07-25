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

  const adminRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'admin@example.com', password: 'admin-password' }),
  });
  adminToken = (await adminRes.json()).token;

  const userRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'user@example.com', password: 'user-password' }),
  });
  userToken = (await userRes.json()).token;

  const svcRes = await fetch(`${baseUrl}/api/services`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ name: 'Notification Test Service', description: 'Test', expectedDuration: 10, priority: 'medium' }),
  });
  serviceId = (await svcRes.json()).service.id;
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

// /api/auth/register does not log the user in, so tests that need a fresh
// authenticated user have to register then log in separately.
async function registerAndLogin(name, email, password) {
  await request('/api/auth/register', { method: 'POST', body: JSON.stringify({ name, email, password }) });
  const login = await request('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
  return login.body.token;
}


test('user receives a notification when joining the queue', async () => {
  const res = await request('/api/queue/join', { method: 'POST', body: JSON.stringify({ serviceId }) }, userToken);

  assert.equal(res.status, 200);

  const notificationsRes = await request('/api/notifications', { method: 'GET' }, userToken);
  assert.equal(notificationsRes.status, 200);
  assert.equal(notificationsRes.body.notifications.length > 0, true);
  assert.match(notificationsRes.body.notifications[0].message, /joined the queue/i);
});

test('next user receives a notification when the current user is served', async () => {
  // isolated service + fresh users so this test doesn't depend on queue state left behind by other tests
  const isolatedServiceId = await createService('Serve Notification Service');
  const firstToken = await registerAndLogin('First In Line', 'first-in-line@example.com', 'first-password');
  const secondToken = await registerAndLogin('Second In Line', 'second-in-line@example.com', 'second-password');

  await request('/api/queue/join', { method: 'POST', body: JSON.stringify({ serviceId: isolatedServiceId }) }, firstToken);
  await request('/api/queue/join', { method: 'POST', body: JSON.stringify({ serviceId: isolatedServiceId }) }, secondToken);

  const serveRes = await request(`/api/queue/${isolatedServiceId}/serve`, { method: 'POST' }, adminToken);
  assert.equal(serveRes.status, 200);

  //#1 user was served and removed; #2 user is at the front is notified
  const notificationsRes = await request('/api/notifications', { method: 'GET' }, secondToken);
  assert.equal(notificationsRes.status, 200);
  assert.match(notificationsRes.body.notifications[0].message, /next/i);
});

test('rejects requests for notifications without a valid token', async () => {
  const noToken = await request('/api/notifications', { method: 'GET' });
  assert.equal(noToken.status, 401);

  const badToken = await request('/api/notifications', { method: 'GET' }, 'not-a-real-token');
  assert.equal(badToken.status, 401);
});

test('returns an empty list for a user with no notification history', async () => {
  const freshToken = await registerAndLogin('Fresh User', 'fresh-user@example.com', 'fresh-password');

  const notificationsRes = await request('/api/notifications', { method: 'GET' }, freshToken);
  assert.equal(notificationsRes.status, 200);
  assert.deepEqual(notificationsRes.body.notifications, []);
});

test('does not leak one user\'s notifications to another user', async () => {
  const isolatedServiceId = await createService('Isolation Test Service');
  const activeToken = await registerAndLogin('Active User', 'active-user@example.com', 'active-password');
  const bystanderToken = await registerAndLogin('Bystander User', 'bystander-user@example.com', 'bystander-password');

  await request('/api/queue/join', { method: 'POST', body: JSON.stringify({ serviceId: isolatedServiceId }) }, activeToken);

  const activeNotifications = await request('/api/notifications', { method: 'GET' }, activeToken);
  assert.equal(activeNotifications.body.notifications.length, 1);

  const bystanderNotifications = await request('/api/notifications', { method: 'GET' }, bystanderToken);
  assert.equal(bystanderNotifications.status, 200);
  assert.deepEqual(bystanderNotifications.body.notifications, []);
});
