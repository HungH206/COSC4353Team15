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

const mockServicesTable = [];

const mockDb = {
  from: (table) => ({
    select: (columns) => {
      return {
        // Handles: await db.from('services').select('*').eq('id', id).maybeSingle()
        eq: (col, val) => ({
          maybeSingle: async () => {
            const found = mockServicesTable.find(row => row[col] === val);
            return { data: found || null, error: null };
          }
        }),
        // Handles: await db.from('services').select('*')
        then: (resolve) => resolve({ data: mockServicesTable, error: null })
      };
    },
    insert: (data) => ({
      // Handles: await db.from('services').insert(data).select().single()
      select: () => ({
        single: async () => {
          mockServicesTable.push(data);
          return { data: data, error: null };
        }
      })
    }),
    update: (data) => ({
      // Handles: await db.from('services').update(data).eq('id', id).select().maybeSingle()
      eq: (col, val) => ({
        select: () => ({
          maybeSingle: async () => {
            const index = mockServicesTable.findIndex(row => row[col] === val);
            if (index > -1) {
              mockServicesTable[index] = { ...mockServicesTable[index], ...data };
              return { data: mockServicesTable[index], error: null };
            }
            return { data: null, error: null };
          }
        })
      })
    }),
    delete: () => ({
      // Handles: await db.from('services').delete().eq('id', id)
      eq: async (col, val) => {
        const index = mockServicesTable.findIndex(row => row[col] === val);
        if (index > -1) mockServicesTable.splice(index, 1);
        return { error: null };
      }
    })
  })
};

before(async () => {
  temporaryDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'queuesmart-services-'));

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
    
    admin: { 
      name: 'Admin', 
      email: 'admin@example.com', 
      password: 'admin-password' 
    },
    demoUser: { 
      name: 'User', 
      email: 'user@example.com', 
      password: 'user-password' 
    },
  });
  
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;

  // Authenticate to get tokens for testing
  const adminRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'admin@example.com', password: 'admin-password' })
  });
  adminToken = (await adminRes.json()).token;

  const userRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'user@example.com', password: 'user-password' })
  });
  userToken = (await userRes.json()).token;
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

test('allows admin to create a service', async () => {
  const payload = JSON.stringify({
    name: 'Academic Advising',
    description: 'Course registration help',
    expectedDuration: 15,
    priority: 'high'
  });
  
  const res = await request('/api/services', { method: 'POST', body: payload }, adminToken);
  assert.equal(res.status, 201);
  assert.equal(res.body.service.name, 'Academic Advising');
  assert.equal(res.body.service.isOpen, true);
});

test('prevents standard user from creating a service', async () => {
  const payload = JSON.stringify({
    name: 'Financial Aid',
    description: 'Help with loans',
    expectedDuration: 20,
    priority: 'medium'
  });
  
  const res = await request('/api/services', { method: 'POST', body: payload }, userToken);
  assert.equal(res.status, 403);
});

test('validates service input correctly', async () => {
  const payload = JSON.stringify({
    name: '',
    description: 'A',
    expectedDuration: -5,
    priority: 'super-high'
  });
  
  const res = await request('/api/services', { method: 'POST', body: payload }, adminToken);
  assert.equal(res.status, 400);
  assert.deepEqual(Object.keys(res.body.fields).sort(), ['description', 'expectedDuration', 'name', 'priority']);
});

test('allows anyone authenticated to list services', async () => {
  const res = await request('/api/services', { method: 'GET' }, userToken);
  assert.equal(res.status, 200);
  assert.ok(Array.isArray(res.body.services));
  assert.equal(res.body.services.length > 0, true);
});