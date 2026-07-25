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

  async write(notifications) {
    const temporaryFile = `${this.file}.tmp`;
    await fs.writeFile(temporaryFile, `${JSON.stringify(notifications, null, 2)}\n`, 'utf8');
    await fs.rename(temporaryFile, this.file);
  }
}

export async function createNotificationModule(config, auth) {
  const store = new NotificationStore(config.notificationsFile);
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

  return { router, store, notify };
}