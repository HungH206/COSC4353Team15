import { randomBytes, randomUUID, scrypt as scryptCallback, createHmac, timingSafeEqual } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { Router } from 'express';

const scrypt = promisify(scryptCallback);
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const KEY_LENGTH = 64;
const USER_CREDENTIALS_TABLE = 'usercredentials';
const USER_PROFILE_TABLE = 'userprofile';

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt,
  };
}

async function hashPassword(password) {
  const salt = randomBytes(16);
  const key = await scrypt(password, salt, KEY_LENGTH);
  return `scrypt:${salt.toString('hex')}:${key.toString('hex')}`;
}

async function passwordMatches(password, storedHash) {
  const [algorithm, saltHex, hashHex] = storedHash.split(':');
  if (algorithm !== 'scrypt' || !saltHex || !hashHex) return false;

  const expected = Buffer.from(hashHex, 'hex');
  const actual = await scrypt(password, Buffer.from(saltHex, 'hex'), expected.length);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function signToken(user, config) {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    sub: user.id,
    role: user.role,
    iat: now,
    exp: now + config.tokenTtlSeconds,
  })).toString('base64url');
  const unsigned = `${header}.${payload}`;
  const signature = createHmac('sha256', config.jwtSecret).update(unsigned).digest('base64url');
  return `${unsigned}.${signature}`;
}

function verifyToken(token, secret) {
  const [header, payload, suppliedSignature] = token.split('.');
  if (!header || !payload || !suppliedSignature) throw new Error('Invalid token');

  const unsigned = `${header}.${payload}`;
  const expected = Buffer.from(createHmac('sha256', secret).update(unsigned).digest('base64url'));
  const supplied = Buffer.from(suppliedSignature);
  if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) {
    throw new Error('Invalid token');
  }

  const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  if (!claims.exp || claims.exp <= Math.floor(Date.now() / 1000)) throw new Error('Expired token');
  return claims;
}

function validate(body = {}, registration = false) {
  const values = {
    name: typeof body.name === 'string' ? body.name.trim() : '',
    email: typeof body.email === 'string' ? body.email.trim().toLowerCase() : '',
    password: typeof body.password === 'string' ? body.password : '',
  };
  const fields = {};

  if (registration && (values.name.length < 2 || values.name.length > 100)) {
    fields.name = 'Name must be between 2 and 100 characters.';
  }
  if (!EMAIL_PATTERN.test(values.email) || values.email.length > 254) {
    fields.email = 'Enter a valid email address.';
  }
  if (registration && (values.password.length < 8 || values.password.length > 128)) {
    fields.password = 'Password must be between 8 and 128 characters.';
  } else if (!registration && !values.password) {
    fields.password = 'Password is required.';
  }

  return { values, fields, valid: Object.keys(fields).length === 0 };
}

class UserStore {
  constructor(file) {
    this.file = file;
    this.writeQueue = Promise.resolve();
  }

  async initialize() {
    await fs.mkdir(path.dirname(this.file), { recursive: true });
    try {
      await fs.access(this.file);
    } catch {
      await this.write([]);
    }
  }

  async all() {
    return JSON.parse(await fs.readFile(this.file, 'utf8'));
  }

  async find(field, value) {
    return (await this.all()).find((user) => user[field] === value) ?? null;
  }

  async create(user) {
    const operation = this.writeQueue.then(async () => {
      const users = await this.all();
      if (users.some((item) => item.email === user.email)) {
        const error = new Error('An account with this email already exists.');
        error.code = 'EMAIL_EXISTS';
        throw error;
      }
      users.push(user);
      await this.write(users);
      return user;
    });
    this.writeQueue = operation.catch(() => {});
    return operation;
  }

  async write(users) {
    const temporaryFile = `${this.file}.tmp`;
    await fs.writeFile(temporaryFile, `${JSON.stringify(users, null, 2)}\n`, 'utf8');
    await fs.rename(temporaryFile, this.file);
  }
}

function mapDatabaseUser(credentials, profile = {}) {
  if (!credentials) return null;
  return {
    id: credentials.id,
    name: profile.name ?? '',
    email: credentials.email,
    passwordHash: credentials.passwordhash,
    role: credentials.role,
    createdAt: credentials.createdat,
  };
}

class DatabaseUserStore {
  constructor(db) {
    this.db = db;
  }

  async initialize() {
    return Promise.resolve();
  }

  async find(field, value) {
    const { data: credentials, error } = await this.db
      .from(USER_CREDENTIALS_TABLE)
      .select('*')
      .eq(field, value)
      .maybeSingle();

    if (error) throw new Error(`Database error: ${error.message}`);
    if (!credentials) return null;

    const { data: profile, error: profileError } = await this.db
      .from(USER_PROFILE_TABLE)
      .select('*')
      .eq('userid', credentials.id)
      .maybeSingle();

    if (profileError) throw new Error(`Database error: ${profileError.message}`);
    return mapDatabaseUser(credentials, profile);
  }

  async create(user) {
    const credentials = {
      id: user.id,
      email: user.email,
      passwordhash: user.passwordHash,
      role: user.role,
      createdat: user.createdAt,
    };
    const profile = {
      id: user.id,
      userid: user.id,
      name: user.name,
      contactinfo: null,
      createdat: user.createdAt,
    };

    const { error } = await this.db.from(USER_CREDENTIALS_TABLE).insert(credentials);
    if (error) {
      if (error.code === '23505') {
        const duplicate = new Error('An account with this email already exists.');
        duplicate.code = 'EMAIL_EXISTS';
        throw duplicate;
      }
      throw new Error(`Database error: ${error.message}`);
    }

    const { error: profileError } = await this.db.from(USER_PROFILE_TABLE).insert(profile);
    if (profileError) {
      await this.db.from(USER_CREDENTIALS_TABLE).delete().eq('id', user.id);
      throw new Error(`Database error: ${profileError.message}`);
    }

    return user;
  }
}

function createUserStore(config) {
  if (config.useDatabase && config.db) return new DatabaseUserStore(config.db);
  return new UserStore(config.dataFile);
}

export async function createAuthModule(config) {
  const store = createUserStore(config);
  await store.initialize();

  async function createUser({ name, email, password }, role = 'user') {
    return store.create({
      id: randomUUID(),
      name,
      email,
      passwordHash: await hashPassword(password),
      role,
      createdAt: new Date().toISOString(),
    });
  }

  async function seedUser(account, role) {
    if (!account?.email || !account?.password) return;
    const email = account.email.trim().toLowerCase();
    if (!(await store.find('email', email))) {
      await createUser({
        name: account.name?.trim() || (role === 'admin' ? 'Administrator' : 'Demo User'),
        email,
        password: account.password,
      }, role);
    }
  }

  await seedUser(config.admin, 'admin');
  await seedUser(config.demoUser, 'user');

  const authenticate = async (request, response, next) => {
    const [scheme, token] = (request.headers.authorization ?? '').split(' ');
    if (scheme !== 'Bearer' || !token) {
      return response.status(401).json({ error: 'Authentication required.' });
    }
    try {
      const claims = verifyToken(token, config.jwtSecret);
      request.user = await store.find('id', claims.sub);
      if (!request.user) throw new Error('Unknown user');
      next();
    } catch {
      response.status(401).json({ error: 'Invalid or expired authentication token.' });
    }
  };

  const requireAdmin = (request, response, next) => {
    if (request.user?.role !== 'admin') {
      return response.status(403).json({ error: 'Administrator access required.' });
    }
    next();
  };

  const router = Router();

  router.post('/register', async (request, response, next) => {
    const input = validate(request.body, true);
    if (!input.valid) return response.status(400).json({ error: 'Validation failed.', fields: input.fields });
    try {
      // Public registration is always a regular user, regardless of supplied role.
      const user = await createUser(input.values);
      response.status(201).json({ user: publicUser(user) });
    } catch (error) {
      if (error.code === 'EMAIL_EXISTS') return response.status(409).json({ error: error.message });
      next(error);
    }
  });

  router.post('/login', async (request, response, next) => {
    const input = validate(request.body);
    if (!input.valid) return response.status(400).json({ error: 'Validation failed.', fields: input.fields });
    try {
      const user = await store.find('email', input.values.email);
      if (!user || !(await passwordMatches(input.values.password, user.passwordHash))) {
        return response.status(401).json({ error: 'Invalid email or password.' });
      }
      response.json({ token: signToken(user, config), user: publicUser(user) });
    } catch (error) {
      next(error);
    }
  });

  router.get('/me', authenticate, (request, response) => {
    response.json({ user: publicUser(request.user) });
  });

  router.get('/admin-check', authenticate, requireAdmin, (_request, response) => {
    response.json({ message: 'Administrator access granted.' });
  });

  return { router, authenticate, requireAdmin };
}
