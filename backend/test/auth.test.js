import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { after, before, test } from 'node:test';
import { createApp } from '../src/app.js';

let server;
let baseUrl;
let temporaryDirectory;

before(async () => {
  temporaryDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'queuesmart-auth-'));
  const app = await createApp({
    jwtSecret: 'test-secret-that-is-at-least-32-characters',
    tokenTtlSeconds: 3600,
    dataFile: path.join(temporaryDirectory, 'users.json'),
    admin: {
      name: 'Test Admin',
      email: 'admin@example.com',
      password: 'admin-password',
    },
    demoUser: {
      name: 'Demo User',
      email: 'user1@example.com',
      password: 'password123',
    },
  });
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  await fs.rm(temporaryDirectory, { recursive: true, force: true });
});

async function request(route, options = {}) {
  const response = await fetch(`${baseUrl}${route}`, {
    ...options,
    headers: { 'content-type': 'application/json', ...options.headers },
  });
  return { status: response.status, body: await response.json() };
}

test('registers a user and rejects duplicate email', async () => {
  const payload = JSON.stringify({
    name: 'Alex Chen',
    email: 'Alex@example.com',
    password: 'password123',
    role: 'admin',
  });
  const created = await request('/api/auth/register', { method: 'POST', body: payload });
  assert.equal(created.status, 201);
  assert.equal(created.body.user.email, 'alex@example.com');
  assert.equal(created.body.user.role, 'user');
  assert.equal('passwordHash' in created.body.user, false);

  const duplicate = await request('/api/auth/register', { method: 'POST', body: payload });
  assert.equal(duplicate.status, 409);
});

test('validates registration input', async () => {
  const result = await request('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ name: '', email: 'bad-email', password: 'short' }),
  });
  assert.equal(result.status, 400);
  assert.deepEqual(Object.keys(result.body.fields).sort(), ['email', 'name', 'password']);
});

test('logs in and exposes the authenticated user', async () => {
  const login = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'alex@example.com', password: 'password123' }),
  });
  assert.equal(login.status, 200);
  assert.ok(login.body.token);

  const me = await request('/api/auth/me', {
    headers: { authorization: `Bearer ${login.body.token}` },
  });
  assert.equal(me.status, 200);
  assert.equal(me.body.user.email, 'alex@example.com');
});

test('seeds the frontend demonstration user with backend authentication', async () => {
  const login = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'user1@example.com', password: 'password123' }),
  });
  assert.equal(login.status, 200);
  assert.equal(login.body.user.name, 'Demo User');
  assert.equal(login.body.user.role, 'user');
  assert.ok(login.body.token);
});

test('enforces administrator role', async () => {
  const userLogin = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'alex@example.com', password: 'password123' }),
  });
  const forbidden = await request('/api/auth/admin-check', {
    headers: { authorization: `Bearer ${userLogin.body.token}` },
  });
  assert.equal(forbidden.status, 403);

  const adminLogin = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'admin@example.com', password: 'admin-password' }),
  });
  const allowed = await request('/api/auth/admin-check', {
    headers: { authorization: `Bearer ${adminLogin.body.token}` },
  });
  assert.equal(allowed.status, 200);
});

test('rejects bad credentials and missing tokens', async () => {
  const login = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'alex@example.com', password: 'wrong-password' }),
  });
  assert.equal(login.status, 401);

  const me = await request('/api/auth/me');
  assert.equal(me.status, 401);
});
