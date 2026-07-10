// ADMIN SERVICES MANAGER PAGE
// Created by: Hung Hoang, 7/9/2026

import { useState } from 'react';
import Button from '../components/Button.jsx';
import Badge from '../components/Badge.jsx';
import { Plus, X, Edit2, Trash2 } from 'lucide-react';

const blankService = { name: '', description: '', expectedDuration: 10, priority: 'medium', isOpen: true };

export default function AdminServices({ services, onUpdateServices }) {
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(blankService);
  const [formOpen, setFormOpen] = useState(false);
  const [errors, setErrors] = useState({});

  const openForm = (service) => {
    if (!service) {
      setEditing(null);
      setForm(blankService);
    } else {
      setEditing(service);
      setForm({ name: service.name, description: service.description, expectedDuration: service.expectedDuration, priority: service.priority, isOpen: service.isOpen });
    }
    setErrors({});
    setFormOpen(true);
  };

  const closeForm = () => {
    setEditing(null);
    setForm(blankService);
    setErrors({});
    setFormOpen(false);
  };

  const validate = () => {
    const next = {};
    if (!form.name.trim()) next.name = 'Service name is required.';
    if (form.name.length > 100) next.name = 'Maximum 100 characters.';
    if (!form.description.trim()) next.description = 'Description is required.';
    if (!form.expectedDuration || form.expectedDuration < 1) next.duration = 'Enter a positive duration.';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSave = () => {
    if (!validate()) return;
    if (editing) {
      onUpdateServices(services.map((svc) => (svc.id === editing.id ? { ...svc, ...form } : svc)));
    } else {
      onUpdateServices([...services, { id: `s_${Date.now()}`, ...form }]);
    }
    closeForm();
  };

  const toggleOpen = (serviceId) => {
    onUpdateServices(services.map((svc) => svc.id === serviceId ? { ...svc, isOpen: !svc.isOpen } : svc));
  };

  return (
    <div className="page-grid max-w-5xl">
      <div className="page-header space-between">
        <div>
          <h2>Service Management</h2>
          <p className="subtitle">Create, edit, and manage services.</p>
        </div>
        <Button onClick={() => openForm(null)}>
          <Plus size={14} /> New Service
        </Button>
      </div>
      {formOpen && (
        <div className="panel-card">
          <div className="panel-header">
            <div>
              <strong>{editing ? `Edit ${editing.name}` : 'Create New Service'}</strong>
            </div>
            <button type="button" className="icon-btn" onClick={closeForm}><X size={16} /></button>
          </div>
          <div className="grid-2">
            <div className="field-group">
              <label className="field-label">Service Name</label>
              <input type="text" value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} className={`field-input ${errors.name ? 'field-error' : ''}`} placeholder="General Inquiry" />
              {errors.name && <p className="field-help field-help-error">{errors.name}</p>}
            </div>
            <div className="field-group">
              <label className="field-label">Priority</label>
              <select value={form.priority} onChange={(e) => setForm((prev) => ({ ...prev, priority: e.target.value }))} className="field-input">
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
          </div>
          <div className="field-group">
            <label className="field-label">Description</label>
            <textarea value={form.description} onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))} className={`field-input textarea ${errors.description ? 'field-error' : ''}`} rows={3} placeholder="Brief description..." />
            {errors.description && <p className="field-help field-help-error">{errors.description}</p>}
          </div>
          <div className="grid-2 gap-sm">
            <div className="field-group">
              <label className="field-label">Expected Duration</label>
              <input type="number" min="1" max="999" value={form.expectedDuration} onChange={(e) => setForm((prev) => ({ ...prev, expectedDuration: parseInt(e.target.value, 10) || 0 }))} className={`field-input ${errors.duration ? 'field-error' : ''}`} />
              {errors.duration && <p className="field-help field-help-error">{errors.duration}</p>}
            </div>
            <div className="field-group">
              <label className="field-label">Queue Open</label>
              <div className="toggle-row">
                <label className="toggle-switch">
                  <input type="checkbox" checked={form.isOpen} onChange={(e) => setForm((prev) => ({ ...prev, isOpen: e.target.checked }))} />
                  <span className="toggle-slider" />
                </label>
                <span>{form.isOpen ? 'Open' : 'Closed'}</span>
              </div>
            </div>
          </div>
          <div className="button-row">
            <Button variant="primary" onClick={handleSave}>Save Service</Button>
            <Button variant="secondary" onClick={() => openForm(null)}>Cancel</Button>
          </div>
        </div>
      )}
      <div className="block-card">
        <div className="block-card-header"><p className="subtitle uppercase">All Services</p></div>
        <div className="service-list-table">
          <div className="service-list-header">
            <span>Service</span>
            <span>Duration</span>
            <span>Priority</span>
            <span>Status</span>
            <span>Actions</span>
          </div>
          {services.map((svc) => (
            <div key={svc.id} className="service-list-row">
              <div>
                <strong>{svc.name}</strong>
                <p className="text-muted">{svc.description}</p>
              </div>
              <div>{svc.expectedDuration}m</div>
              <div>
                <Badge text={svc.priority} className={svc.priority === 'high' ? 'badge-danger' : svc.priority === 'medium' ? 'badge-warning' : 'badge-success'} />
              </div>
              <div>
                <Button variant="ghost" size="sm" onClick={() => toggleOpen(svc.id)}>{svc.isOpen ? 'Open' : 'Closed'}</Button>
              </div>
              <div className="action-buttons">
                <button type="button" className="icon-btn" onClick={() => openForm(svc)}><Edit2 size={16} /></button>
                <button type="button" className="icon-btn" onClick={() => onUpdateServices(services.filter((item) => item.id !== svc.id))}><Trash2 size={16} /></button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
