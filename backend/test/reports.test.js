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

before(async () => {
  temporaryDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'queuesmart-reports-'));

  const app = await createApp({
    jwtSecret: 'test-secret-that-is-at-least-32-characters',
    tokenTtlSeconds: 3600,
    dataFile: path.join(temporaryDirectory, 'users.json'),
    servicesFile: path.join(temporaryDirectory, 'services.json'),
    queuesFile: path.join(temporaryDirectory, 'queues.json'),
    historyFile: path.join(temporaryDirectory, 'history.json'),
    notificationsFile: path.join(temporaryDirectory, 'notifications.json'),
    admin: {
      name: 'Reports Admin',
      email: 'admin@example.com',
      password: 'admin-password',
    },
    demoUser: {
      name: 'Reports User',
      email: 'user@example.com',
      password: 'user-password',
    },
  });

  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;

  adminToken = await login('admin@example.com', 'admin-password');
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
  assert.equal(response.status, 200);
  return response.body.token;
}

async function registerAndLogin(name, email, password) {
  await request('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ name, email, password }),
  });
  return login(email, password);
}

async function createService(name, expectedDuration) {
  const response = await request('/api/services', {
    method: 'POST',
    body: JSON.stringify({
      name,
      description: `${name} report test service`,
      expectedDuration,
      priority: 'medium',
    }),
  }, adminToken);
  return response.body.service.id;
}

test('admin can fetch user report stats and include emails', async () => {
  const serviceId = await createService('Academic Advising', 15);
  const aliceToken = await registerAndLogin('Alice', 'alice-report@example.com', 'alice-password');

  await request('/api/queue/join', { method: 'POST', body: JSON.stringify({ serviceId }) }, aliceToken);
  const served = await request(`/api/queue/${serviceId}/serve`, { method: 'POST' }, adminToken);
  assert.equal(served.status, 200);

  const response = await request('/api/reports/user-stats', { method: 'GET' }, adminToken);
  assert.equal(response.status, 200);
  assert.ok(Array.isArray(response.body.userStats));

  const alice = response.body.userStats.find((row) => row.name === 'Alice');
  assert.ok(alice);
  assert.equal(alice.email, 'alice-report@example.com');
  assert.equal(alice.serviceName, 'Academic Advising');
  assert.equal(alice.outcome, 'served');
});

test('admin can fetch queue report stats for each service', async () => {
  //different names from previous test for the right counts
  const advisingId = await createService('Advising Stats Service', 15);
  const aidId = await createService('Aid Stats Service', 20);

  const aliceToken = await registerAndLogin('Stats Alice', 'stats-alice@example.com', 'stats-password');
  const bobToken = await registerAndLogin('Stats Bob', 'stats-bob@example.com', 'stats-password');

  // Advising: one served, one left, nobody left waiting.
  await request('/api/queue/join', { method: 'POST', body: JSON.stringify({ serviceId: advisingId }) }, aliceToken);
  await request(`/api/queue/${advisingId}/serve`, { method: 'POST' }, adminToken);
  await request('/api/queue/join', { method: 'POST', body: JSON.stringify({ serviceId: advisingId }) }, bobToken);
  await request('/api/queue/leave', { method: 'POST', body: JSON.stringify({ serviceId: advisingId }) }, bobToken);

  // Aid: one served, nobody left.
  await request('/api/queue/join', { method: 'POST', body: JSON.stringify({ serviceId: aidId }) }, aliceToken);
  await request(`/api/queue/${aidId}/serve`, { method: 'POST' }, adminToken);

  const response = await request('/api/reports/queue-stats', { method: 'GET' }, adminToken);
  assert.equal(response.status, 200);
  assert.ok(Array.isArray(response.body.queueStats));

  const advising = response.body.queueStats.find((row) => row.id === advisingId);
  const aid = response.body.queueStats.find((row) => row.id === aidId);

  assert.ok(advising);
  assert.equal(advising.joined, 2);
  assert.equal(advising.served, 1);
  assert.equal(advising.left, 1);

  assert.ok(aid);
  assert.equal(aid.served, 1);
  assert.equal(aid.left, 0);
  assert.equal(typeof aid.avgWaitMinutes, 'number');
  assert.ok(aid.avgWaitMinutes >= 0);
});

test('non-admin users cannot access report endpoints', async () => {
  const plainUserToken = await registerAndLogin('Plain User', 'plain-user@example.com', 'plain-password');

  const userHistory = await request('/api/reports/user-stats', { method: 'GET' }, plainUserToken);
  const userQueueStats = await request('/api/reports/queue-stats', { method: 'GET' }, plainUserToken);

  assert.equal(userHistory.status, 403);
  assert.equal(userQueueStats.status, 403);
});