// Register PAGE
// Created by: Hung Hoang, 7/9/2026, with logics from index.html by Sean Dang

import { useState } from 'react';
import Field from '../components/Field.jsx';
import Button from '../components/Button.jsx';
import { Hash } from 'lucide-react';

export default function Register({ onRegister, onGoLogin }) {
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});

  const update = (field) => (event) => {
    setForm((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const validate = () => {
    const next = {};
    if (!form.name.trim()) next.name = 'Full name is required.';
    if (!form.email.trim()) next.email = 'Email is required.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) next.email = 'Enter a valid email address.';
    if (!form.password) next.password = 'Password is required.';
    else if (form.password.length < 8) next.password = 'Minimum 8 characters required.';
    if (form.confirm !== form.password) next.confirm = 'Passwords do not match.';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!validate()) return;
    onRegister({ id: `u_${Date.now()}`, name: form.name, email: form.email, role: 'user' });
  };

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div className="auth-brand">
          <div className="auth-brand-icon"><Hash size={20} /></div>
          <h1>Create Account</h1>
          <p className="subtitle">Join QueueSmart today</p>
        </div>
        <form onSubmit={handleSubmit} className="auth-form">
          <Field id="register-name" label="Full Name" type="text" value={form.name} onChange={update('name')} error={errors.name} placeholder="Alex Chen" />
          <Field id="register-email" label="Email address" type="email" value={form.email} onChange={update('email')} error={errors.email} placeholder="you@example.com" />
          <div className="field-group">
            <label htmlFor="register-password" className="field-label">Password <span className="text-muted">(min 8 characters)</span></label>
            <div className="password-field">
              <input
                id="register-password"
                type={showPassword ? 'text' : 'password'}
                className={`field-input ${errors.password ? 'field-error' : ''}`}
                value={form.password}
                onChange={update('password')}
                placeholder="••••••••"
                autoComplete="new-password"
              />
              <button type="button" className="password-toggle" onClick={() => setShowPassword((value) => !value)}>
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
            {errors.password && <p className="field-help field-help-error">{errors.password}</p>}
          </div>
          <Field id="register-confirm" label="Confirm Password" type="password" value={form.confirm} onChange={update('confirm')} error={errors.confirm} placeholder="••••••••" />
          <Button type="submit" variant="primary" size="lg" className="w-full">Create Account</Button>
        </form>
        <div className="auth-switch">
          <span>Already have an account?</span>
          <button type="button" className="link-button" onClick={onGoLogin}>Sign in</button>
        </div>
      </div>
    </div>
  );
}
