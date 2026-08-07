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

const tables = {
  usercredentials: [],
  userprofile: [],
  service: [],
  queue: [],
  queueentry: [],
  history: [],
};

function rowsFor(tableName, filters, orderBy) {
  const rows = tables[tableName].filter((row) => filters.every((filter) => filter(row)));
  if (orderBy) {
    rows.sort((left, right) => {
      if (left[orderBy.column] < right[orderBy.column]) return orderBy.ascending ? -1 : 1;
      if (left[orderBy.column] > right[orderBy.column]) return orderBy.ascending ? 1 : -1;
      return 0;
    });
  }
  return rows;
}

function createMockDb() {
  return {
    from(tableName) {
      if (!tables[tableName]) throw new Error(`Unknown table ${tableName}`);

      const filters = [];
      let orderBy = null;

      const builder = {
        select: () => builder,
        eq: (column, value) => {
          filters.push((row) => row[column] === value);
          return builder;
        },
        in: (column, values) => {
          filters.push((row) => values.includes(row[column]));
          return builder;
        },
        order: (column, { ascending = true } = {}) => {
          orderBy = { column, ascending };
          return builder;
        },
        maybeSingle: async () => ({ data: rowsFor(tableName, filters, orderBy)[0] ?? null, error: null }),
        single: async () => ({ data: rowsFor(tableName, filters, orderBy)[0] ?? null, error: null }),
        insert: (data) => {
          const items = Array.isArray(data) ? data : [data];
          if (tableName === 'usercredentials') {
            const duplicate = items.find((item) => tables.usercredentials.some((row) => row.email === item.email));
            if (duplicate) {
              return {
                then: (resolve) => resolve({ data: null, error: { code: '23505', message: 'duplicate key value' } }),
                select: () => ({ single: async () => ({ data: null, error: { code: '23505', message: 'duplicate key value' } }) }),
              };
            }
          }
          tables[tableName].push(...items);
          const inserted = Array.isArray(data) ? items : items[0];
          return {
            then: (resolve) => resolve({ data: inserted, error: null }),
            select: () => ({
              single: async () => ({ data: inserted, error: null }),
              maybeSingle: async () => ({ data: inserted, error: null }),
            }),
          };
        },
        update: (updates) => {
          const updateBuilder = {
            eq: (column, value) => {
              filters.push((row) => row[column] === value);
              return updateBuilder;
            },
            select: () => ({
              maybeSingle: async () => {
                const matches = rowsFor(tableName, filters, orderBy);
                matches.forEach((row) => Object.assign(row, updates));
                return { data: matches[0] ?? null, error: null };
              },
              single: async () => {
                const matches = rowsFor(tableName, filters, orderBy);
                matches.forEach((row) => Object.assign(row, updates));
                return { data: matches[0] ?? null, error: null };
              },
            }),
            then: (resolve) => {
              const matches = rowsFor(tableName, filters, orderBy);
              matches.forEach((row) => Object.assign(row, updates));
              resolve({ data: matches, error: null });
            },
          };
          return updateBuilder;
        },
        delete: () => {
          const deleteBuilder = {
            eq: (column, value) => {
              filters.push((row) => row[column] === value);
              return deleteBuilder;
            },
            then: (resolve) => {
              const remaining = tables[tableName].filter((row) => !filters.every((filter) => filter(row)));
              tables[tableName].splice(0, tables[tableName].length, ...remaining);
              resolve({ error: null });
            },
          };
          return deleteBuilder;
        },
        then: (resolve) => resolve({ data: rowsFor(tableName, filters, orderBy), error: null }),
      };

      return builder;
    },
  };
}

before(async () => {
  temporaryDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'queuesmart-db-'));
  const app = await createApp({
    jwtSecret: 'test-secret-that-is-at-least-32-characters',
    tokenTtlSeconds: 3600,
    useDatabase: true,
    db: createMockDb(),
    dataFile: path.join(temporaryDirectory, 'users.json'),
    servicesFile: path.join(temporaryDirectory, 'services.json'),
    queuesFile: path.join(temporaryDirectory, 'queues.json'),
    historyFile: path.join(temporaryDirectory, 'history.json'),
    notificationsFile: path.join(temporaryDirectory, 'notifications.json'),
    admin: { name: 'Admin User', email: 'admin@example.com', password: 'admin-password' },
    demoUser: { name: 'Demo User', email: 'user@example.com', password: 'user-password' },
  });

  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;

  const adminLogin = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'admin@example.com', password: 'admin-password' }),
  });
  adminToken = adminLogin.body.token;

  const userLogin = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'user@example.com', password: 'user-password' }),
  });
  userToken = userLogin.body.token;
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

test('database mode stores credentials and profiles in Supabase tables', async () => {
  assert.equal(tables.usercredentials.length, 2);
  assert.equal(tables.userprofile.length, 2);
  assert.equal(tables.usercredentials.some((user) => user.passwordhash?.startsWith('scrypt:')), true);
  assert.equal(tables.usercredentials.some((user) => 'password' in user), false);
});

test('database mode persists services through the Service table', async () => {
  const response = await request('/api/services', {
    method: 'POST',
    body: JSON.stringify({
      name: 'Academic Advising',
      description: 'Course planning and registration support',
      expectedDuration: 15,
      priority: 'high',
    }),
  }, adminToken);

  assert.equal(response.status, 201);
  serviceId = response.body.service.id;
  assert.equal(tables.service.length, 1);
  assert.equal(tables.service[0].expectedduration, 15);
  assert.equal(tables.service[0].isopen, true);

  const closed = await request(`/api/services/${serviceId}`, {
    method: 'PUT',
    body: JSON.stringify({
      name: 'Academic Advising',
      description: 'Course planning and registration support',
      expectedDuration: 15,
      priority: 'high',
      isOpen: false,
    }),
  }, adminToken);

  assert.equal(closed.status, 200);
  assert.equal(tables.service[0].isopen, false);

  const listedClosed = await request('/api/services', {}, userToken);
  assert.equal(listedClosed.status, 200);
  assert.equal(listedClosed.body.services.find((service) => service.id === serviceId).isOpen, false);

  const reopened = await request(`/api/services/${serviceId}`, {
    method: 'PUT',
    body: JSON.stringify({
      name: 'Academic Advising',
      description: 'Course planning and registration support',
      expectedDuration: 15,
      priority: 'high',
      isOpen: true,
    }),
  }, adminToken);

  assert.equal(reopened.status, 200);
  assert.equal(tables.service[0].isopen, true);
});

test('database mode persists queues, entries, notifications, and history', async () => {
  const join = await request('/api/queue/join', {
    method: 'POST',
    body: JSON.stringify({ serviceId }),
  }, userToken);

  assert.equal(join.status, 200);
  assert.equal(tables.queue.length, 1);
  assert.equal(tables.queue[0].serviceid, serviceId);
  assert.equal(tables.queueentry.length, 1);
  assert.equal(tables.queueentry[0].status, 'waiting');
  assert.equal(tables.history.length, 1);
  assert.equal(tables.history[0].status, 'sent');
  assert.equal(tables.history[0].outcome, null);

  const leave = await request('/api/queue/leave', {
    method: 'POST',
    body: JSON.stringify({ serviceId }),
  }, userToken);

  assert.equal(leave.status, 200);
  assert.equal(tables.queueentry[0].status, 'canceled');
  assert.equal(tables.history.length, 2);
  assert.equal(tables.history[1].outcome, 'left');
  assert.equal(tables.history[1].status, 'viewed');
});
