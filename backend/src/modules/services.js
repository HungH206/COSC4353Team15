import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { Router } from 'express';

class ServiceStore {
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

  async find(id) {
    return (await this.all()).find((svc) => svc.id === id) ?? null;
  }

  async create(service) {
    const operation = this.writeQueue.then(async () => {
      const services = await this.all();
      services.push(service);
      await this.write(services);
      return service;
    });
    this.writeQueue = operation.catch(() => {});
    return operation;
  }

  async update(id, updates) {
    const operation = this.writeQueue.then(async () => {
      const services = await this.all();
      const index = services.findIndex((s) => s.id === id);
      if (index === -1) return null;
      services[index] = { ...services[index], ...updates };
      await this.write(services);
      return services[index];
    });
    this.writeQueue = operation.catch(() => {});
    return operation;
  }

  async delete(id) {
    const operation = this.writeQueue.then(async () => {
      let services = await this.all();
      services = services.filter((s) => s.id !== id);
      await this.write(services);
    });
    this.writeQueue = operation.catch(() => {});
    return operation;
  }

  async write(services) {
    const temporaryFile = `${this.file}.tmp`;
    await fs.writeFile(temporaryFile, `${JSON.stringify(services, null, 2)}\n`, 'utf8');
    await fs.rename(temporaryFile, this.file);
  }
}

function validateService(body = {}) {
  const values = {
    name: typeof body.name === 'string' ? body.name.trim() : '',
    description: typeof body.description === 'string' ? body.description.trim() : '',
    expectedDuration: Number.parseInt(body.expectedDuration, 10),
    priority: typeof body.priority === 'string' ? body.priority.trim().toLowerCase() : 'medium',
    isOpen: typeof body.isOpen === 'boolean' ? body.isOpen : true,
  };
  const fields = {};

  if (values.name.length < 2 || values.name.length > 100) {
    fields.name = 'Service name must be between 2 and 100 characters.';
  }
  if (values.description.length < 2 || values.description.length > 500) {
    fields.description = 'Description must be between 2 and 500 characters.';
  }
  if (Number.isNaN(values.expectedDuration) || values.expectedDuration < 1) {
    fields.expectedDuration = 'Expected duration must be a positive integer.';
  }
  if (!['low', 'medium', 'high'].includes(values.priority)) {
    fields.priority = 'Priority must be low, medium, or high.';
  }

  return { values, fields, valid: Object.keys(fields).length === 0 };
}

export async function createServiceModule(config, auth) {
  const store = new ServiceStore(config.servicesFile);
  await store.initialize();

  const router = Router();

  // Any authenticated user can view services
  router.get('/', auth.authenticate, async (_request, response) => {
    const services = await store.all();
    response.json({ services });
  });

  // Only admins can create a service
  router.post('/', auth.authenticate, auth.requireAdmin, async (request, response, next) => {
    const input = validateService(request.body);
    if (!input.valid) return response.status(400).json({ error: 'Validation failed.', fields: input.fields });
    
    try {
      const service = await store.create({
        id: randomUUID(),
        ...input.values,
        createdAt: new Date().toISOString(),
      });
      response.status(201).json({ service });
    } catch (error) {
      next(error);
    }
  });

  // Only admins can update a service
  router.put('/:id', auth.authenticate, auth.requireAdmin, async (request, response, next) => {
    const input = validateService(request.body);
    if (!input.valid) return response.status(400).json({ error: 'Validation failed.', fields: input.fields });

    try {
      const updated = await store.update(request.params.id, input.values);
      if (!updated) return response.status(404).json({ error: 'Service not found.' });
      response.json({ service: updated });
    } catch (error) {
      next(error);
    }
  });

  // Only admins can delete a service
  router.delete('/:id', auth.authenticate, auth.requireAdmin, async (request, response, next) => {
    try {
      await store.delete(request.params.id);
      response.status(204).end();
    } catch (error) {
      next(error);
    }
  });

  return { router, store };
}