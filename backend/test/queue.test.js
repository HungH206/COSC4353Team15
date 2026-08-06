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

// --- IN-MEMORY MOCK DATABASE SETUP ---
const mockTables = {
  services: [],
  queue: [],
  queueentry: [],
  userprofile: []
};

function createMockDb() {
  return {
    from: (tableName) => {
      if (!mockTables[tableName]) {
        mockTables[tableName] = [];
      }

      const filters = [];
      let sortCol = null;
      let sortAsc = true;

      const builder = {
        select: () => builder,
        eq: (col, val) => {
          filters.push((row) => row[col] === val);
          return builder;
        },
        in: (col, valArray) => {
          filters.push((row) => valArray.includes(row[col]));
          return builder;
        },
        order: (col, { ascending = true } = {}) => {
          sortCol = col;
          sortAsc = ascending;
          return builder;
        },
        insert: (data) => {
          const items = Array.isArray(data) ? data : [data];
          mockTables[tableName].push(...items);
          const inserted = Array.isArray(data) ? items : items[0];
          return {
            select: () => ({
              single: async () => ({ data: inserted, error: null }),
              maybeSingle: async () => ({ data: inserted, error: null })
            }),
            then: (resolve) => resolve({ data: inserted, error: null })
          };
        },
        update: (updateData) => {
          return {
            eq: (col, val) => {
              filters.push((row) => row[col] === val);
              const targetRows = mockTables[tableName].filter((row) =>
                filters.every((f) => f(row))
              );
              targetRows.forEach((row) => Object.assign(row, updateData));
              return {
                select: () => ({
                  maybeSingle: async () => ({
                    data: targetRows[0] || null,
                    error: null
                  }),
                  single: async () => ({ data: targetRows[0] || null, error: null })
                }),
                then: (resolve) => resolve({ data: targetRows, error: null })
              };
            }
          };
        },
        delete: () => ({
          eq: async (col, val) => {
            mockTables[tableName] = mockTables[tableName].filter(
              (row) => row[col] !== val
            );
            return { error: null };
          }
        }),
        maybeSingle: async () => {
          const filtered = mockTables[tableName].filter((row) =>
            filters.every((f) => f(row))
          );
          let result = filtered[0] || null;
          if (!result && tableName === 'userprofile') {
            result = { name: 'User' };
          }
          return { data: result, error: null };
        },
        single: async () => {
          const filtered = mockTables[tableName].filter((row) =>
            filters.every((f) => f(row))
          );
          let result = filtered[0] || null;
          if (!result && tableName === 'userprofile') {
            result = { name: 'User' };
          }
          return { data: result, error: null };
        },
        then: (resolve) => {
          const filtered = mockTables[tableName].filter((row) =>
            filters.every((f) => f(row))
          );
          if (sortCol) {
            filtered.sort((a, b) => {
              if (a[sortCol] < b[sortCol]) return sortAsc ? -1 : 1;
              if (a[sortCol] > b[sortCol]) return sortAsc ? 1 : -1;
              return 0;
            });
          }
          resolve({ data: filtered, error: null });
        }
      };

      return builder;
    }
  };
}

const mockDb = createMockDb();

before(async () => {
  temporaryDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'queuesmart-queue-'));
  
  const app = await createApp({
    jwtSecret: 'test-secret-that-is-at-least-32-characters',
    tokenTtlSeconds: 3600,
    supabaseUrl: 'https://fake-project.supabase.co',
    supabaseKey: 'fake-test-key-12345',
    dataFile: path.join(temporaryDirectory, 'users.json'),
    servicesFile: path.join(temporaryDirectory, 'services.json'),
    queuesFile: path.join(temporaryDirectory, 'queues.json'),
    historyFile: path.join(temporaryDirectory, 'history.json'),
    notificationsFile: path.join(temporaryDirectory, 'notifications.json'),
    db: mockDb,
    admin: { name: 'Admin', email: 'admin@example.com', password: 'admin-password' },
    demoUser: { name: 'User', email: 'user@example.com', password: 'user-password' },
  });
  
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;

  // authenticate as Admin
  const adminRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'admin@example.com', password: 'admin-password' })
  });
  adminToken = (await adminRes.json()).token;

  // authenticate as User
  const userRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'user@example.com', password: 'user-password' })
  });
  userToken = (await userRes.json()).token;

  // create a test service for the queue
  const svcRes = await fetch(`${baseUrl}/api/services`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ name: 'Queue Test Service', description: 'Test', expectedDuration: 10, priority: 'medium' })
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

test('wait-time rule multiplies people ahead by expected duration', () => {
  assert.equal(calculateWaitTime(1, 10), 0);
  assert.equal(calculateWaitTime(3, 10), 20);
  assert.equal(calculateWaitTime(5, 15), 60);
});

test('user can join a queue and receives correct wait time', async () => {
  const payload = JSON.stringify({ serviceId });
  const res = await request('/api/queue/join', { method: 'POST', body: payload }, userToken);
  
  assert.equal(res.status, 200);
  assert.equal(res.body.position, 1);
  assert.equal(res.body.estWait, 0); // 0 people ahead * 10 min
  assert.equal(res.body.entry.name, 'User');
});

test('returns the authenticated user wait estimate from the dedicated endpoint', async () => {
  const res = await request(`/api/time-estimation/${serviceId}`, { method: 'GET' }, userToken);
  assert.equal(res.status, 200);
  assert.equal(res.body.estimate.position, 1);
  assert.equal(res.body.estimate.peopleAhead, 0);
  assert.equal(res.body.estimate.expectedDuration, 10);
  assert.equal(res.body.estimate.estimatedWait, 0);
  assert.equal(res.body.estimate.inQueue, true);
});

test('user can restore their queue membership and view queue counts', async () => {
  const mine = await request('/api/queue/mine', { method: 'GET' }, userToken);
  assert.equal(mine.status, 200);
  assert.equal(mine.body.queues.length, 1);
  assert.equal(mine.body.queues[0].serviceId, serviceId);
  assert.equal(mine.body.queues[0].position, 1);

  const summary = await request('/api/queue/summary', { method: 'GET' }, userToken);
  assert.equal(summary.status, 200);
  assert.equal(summary.body.counts[serviceId], 1);
});

test('user cannot join the exact same queue twice', async () => {
  const payload = JSON.stringify({ serviceId });
  const res = await request('/api/queue/join', { method: 'POST', body: payload }, userToken);
  
  assert.equal(res.status, 400);
  assert.equal(res.body.error, 'You are already in this queue.');
});

test('user can leave a queue', async () => {
  const payload = JSON.stringify({ serviceId });
  const res = await request('/api/queue/leave', { method: 'POST', body: payload }, userToken);
  
  assert.equal(res.status, 200);
  assert.equal(res.body.message, 'Left queue successfully.');
});

test('admin can serve the next user', async () => {
  // user needs to join the queue again
  await request('/api/queue/join', { method: 'POST', body: JSON.stringify({ serviceId }) }, userToken);

  // admin serves the user
  const res = await request(`/api/queue/${serviceId}/serve`, { method: 'POST' }, adminToken);
  
  assert.equal(res.status, 200);
  assert.equal(res.body.served.name, 'User');
});

test('admin cannot serve from an empty queue', async () => {
  const res = await request(`/api/queue/${serviceId}/serve`, { method: 'POST' }, adminToken);
  
  assert.equal(res.status, 400);
  assert.equal(res.body.error, 'Queue is empty.');
});