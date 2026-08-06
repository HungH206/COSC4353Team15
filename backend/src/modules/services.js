import { randomUUID } from 'node:crypto';
import { Router } from 'express';

function mapToCamelCase(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    expectedDuration: row.expectedduration, 
    priority: row.priority,
    createdAt: row.createdat,             
    isOpen: true 
  };
}

class ServiceStore {
  constructor(db) {
    this.db = db;
  }

  async initialize() {
    return Promise.resolve();
  }

  async all() {
    const { data, error } = await this.db.from('services').select('*');
    if (error) throw new Error(`Database error: ${error.message}`);
    return data.map(mapToCamelCase);
  }

  async find(id) {
    const { data, error } = await this.db
      .from('services')
      .select('*')
      .eq('id', id)
      .maybeSingle(); 
    
    if (error) throw new Error(`Database error: ${error.message}`);
    return mapToCamelCase(data);
  }

  async create(service) {
    const insertData = {
      id: service.id,
      name: service.name,
      description: service.description,
      expectedduration: service.expectedDuration,
      priority: service.priority,
      createdat: service.createdAt
    };

    const { data, error } = await this.db
      .from('services')
      .insert(insertData)
      .select()
      .single();

    if (error) throw new Error(`Database error: ${error.message}`);
    return mapToCamelCase(data);
  }

  async update(id, updates) {
    const updateData = {};
    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.description !== undefined) updateData.description = updates.description;
    if (updates.expectedDuration !== undefined) updateData.expectedduration = updates.expectedDuration;
    if (updates.priority !== undefined) updateData.priority = updates.priority;

    const { data, error } = await this.db
      .from('services')
      .update(updateData)
      .eq('id', id)
      .select()
      .maybeSingle();

    if (error) throw new Error(`Database error: ${error.message}`);
    return mapToCamelCase(data);
  }

  async delete(id) {
    const { error } = await this.db
      .from('services')
      .delete()
      .eq('id', id);
      
    if (error) throw new Error(`Database error: ${error.message}`);
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
  const store = new ServiceStore(config.db);
  await store.initialize();

  const router = Router();

  // Any authenticated user can view services
  router.get('/', auth.authenticate, async (_request, response, next) => {
    try {
      const services = await store.all();
      response.json({ services });
    } catch (error) {
      next(error);
    }
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