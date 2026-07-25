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

test('user receives a notification when joining the queue', async () => {
  const res = await request('/api/queue/join', { method: 'POST', body: JSON.stringify({ serviceId }) }, userToken);

  assert.equal(res.status, 200);

  const notificationsRes = await request('/api/notifications', { method: 'GET' }, userToken);
  assert.equal(notificationsRes.status, 200);
  assert.equal(notificationsRes.body.notifications.length > 0, true);
  assert.match(notificationsRes.body.notifications[0].message, /joined the queue/i);
});

test('user can mark only their own notification as read', async () => {
  const notificationsRes = await request('/api/notifications', { method: 'GET' }, userToken);
  const notification = notificationsRes.body.notifications[0];
  const readRes = await request(
    `/api/notifications/${notification.id}/read`,
    { method: 'PATCH' },
    userToken,
  );
  assert.equal(readRes.status, 200);
  assert.equal(readRes.body.notification.read, true);
});

test('next user receives a notification when the current user is served', async () => {
  await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'Second User', email: 'second@example.com', password: 'second-password' }),
  });
  const secondUserLogin = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'second@example.com', password: 'second-password' }),
  });
  const secondUserToken = (await secondUserLogin.json()).token;

  await request('/api/queue/join', { method: 'POST', body: JSON.stringify({ serviceId }) }, secondUserToken);
  const serveRes = await request(`/api/queue/${serviceId}/serve`, { method: 'POST' }, adminToken);

  assert.equal(serveRes.status, 200);

  const notificationsRes = await request('/api/notifications', { method: 'GET' }, secondUserToken);
  assert.equal(notificationsRes.status, 200);
  assert.match(notificationsRes.body.notifications[0].message, /next/i);
});
