import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { Router } from 'express';

class NotificationStore {
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

  //notifications[0] is newest
  async forUser(userId) {
    const notifications = await this.all();
    return notifications
      .filter((notification) => notification.userId === userId)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  async create(notification) {
    const operation = this.writeQueue.then(async () => {
      const notifications = await this.all();
      notifications.push(notification);
      await this.write(notifications);
      return notification;
    });
    this.writeQueue = operation.catch(() => {});
    return operation;
  }

  async markRead(id, userId) {
    const operation = this.writeQueue.then(async () => {
      const notifications = await this.all();
      const notification = notifications.find((item) => item.id === id && item.userId === userId);
      if (!notification) return null;
      notification.read = true;
      await this.write(notifications);
      return notification;
    });
    this.writeQueue = operation.catch(() => {});
    return operation;
  }

  async write(notifications) {
    const temporaryFile = `${this.file}.tmp`;
    await fs.writeFile(temporaryFile, `${JSON.stringify(notifications, null, 2)}\n`, 'utf8');
    await fs.rename(temporaryFile, this.file);
  }
}

// Database notification mapping and store implementation

function mapDatabaseNotification(notification) {
  if (!notification) return null;
  return {
    id: notification.id,
    userId: notification.userid,
    message: notification.message,
    read: notification.status === 'viewed',
    createdAt: notification.createdat,
  };
}

class DatabaseNotificationStore {
  constructor(db) {
    this.db = db;
  }

  async initialize() {
    return Promise.resolve();
  }

  async forUser(userId) {
    const { data, error } = await this.db
      .from('history')
      .select('*')
      .eq('userid', userId)
      .order('createdat', { ascending: false });

    if (error) throw new Error(`Database error: ${error.message}`);
    return data
      .filter((notification) => !notification.outcome)
      .map(mapDatabaseNotification);
  }

  async create(notification) {
    const insertData = {
      id: notification.id,
      userid: notification.userId,
      message: notification.message,
      status: notification.read ? 'viewed' : 'sent',
      createdat: notification.createdAt,
      outcome: null,
    };

    const { data, error } = await this.db
      .from('history')
      .insert(insertData)
      .select()
      .single();

    if (error) throw new Error(`Database error: ${error.message}`);
    return mapDatabaseNotification(data);
  }

  async markRead(id, userId) {
    const { data, error } = await this.db
      .from('history')
      .update({ status: 'viewed' })
      .eq('id', id)
      .eq('userid', userId)
      .select()
      .maybeSingle();

    if (error) throw new Error(`Database error: ${error.message}`);
    return mapDatabaseNotification(data);
  }
}

function createStore(config) {
  if (config.useDatabase && config.db) return new DatabaseNotificationStore(config.db);
  return new NotificationStore(config.notificationsFile);
} // end of database notification store

// Create the notification module with router and store
export async function createNotificationModule(config, auth) {
  const store = createStore(config);
  await store.initialize();

  //passed into queue.js as `notifier`
  const notify = async (userId, message) => {
    return store.create({
      id: randomUUID(),
      userId,
      message,
      read: false,
      createdAt: new Date().toISOString(),
    });
  };

  const router = Router();

  //user can only see their own notifications
  router.get('/', auth.authenticate, async (request, response, next) => {
    try {
      const notifications = await store.forUser(request.user.id);
      response.json({ notifications });
    } catch (error) {
      next(error);
    }
  });

  router.patch('/:id/read', auth.authenticate, async (request, response, next) => {
    try {
      const notification = await store.markRead(request.params.id, request.user.id);
      if (!notification) return response.status(404).json({ error: 'Notification not found.' });
      response.json({ notification });
    } catch (error) {
      next(error);
    }
  });

  return { router, store, notify };
}
