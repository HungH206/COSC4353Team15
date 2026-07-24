// Sign IN PAGE
// Created by: Hung Hoang, 7/9/2026, with logics from index.html by Sean Dang
import { useState } from 'react';
import Field from '../components/Field.jsx';
import Button from '../components/Button.jsx';
import { Hash } from 'lucide-react';
import { login } from '../api/auth.js';

export default function Login({ onLogin, onGoRegister }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const validate = () => {
    const next = {};
    if (!email.trim()) next.email = 'Email is required.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) next.email = 'Enter a valid email address.';
    if (!password) next.password = 'Password is required.';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    try {
      const session = await login(email.trim(), password);
      onLogin(session);
    } catch (error) {
      setErrors({
        ...error.fields,
        general: error.message === 'Failed to fetch'
          ? 'Cannot reach the authentication server. Make sure the backend is running.'
          : error.message,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div className="auth-brand">
          <div className="auth-brand-icon"><Hash size={20} /></div>
          <h1>QueueSmart</h1>
          <p className="subtitle">Sign in to your account</p>
        </div>
        <form onSubmit={handleSubmit} className="auth-form">
          {errors.general && <div className="alert alert-error">{errors.general}</div>}
          <Field id="login-email" label="Email address" type="email" value={email} onChange={(e) => setEmail(e.target.value)} error={errors.email} placeholder="you@example.com" />
          <div className="field-group">
            <label htmlFor="login-password" className="field-label">Password</label>
            <div className="password-field">
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                className={`field-input ${errors.password ? 'field-error' : ''}`}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
              />
              <button type="button" className="password-toggle" onClick={() => setShowPassword((value) => !value)}>
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
            {errors.password && <p className="field-help field-help-error">{errors.password}</p>}
          </div>
          <Button type="submit" variant="primary" size="lg" className="w-full" disabled={submitting}>
            {submitting ? 'Signing In...' : 'Sign In'}
          </Button>
        </form>
        <div className="auth-switch">
          <span>Don't have an account?</span>
          <button type="button" className="link-button" onClick={onGoRegister}>Register</button>
        </div>
        <div className="demo-credentials">
          <strong>Demo account</strong>
          <div><span>User:</span><code>user1@example.com / password123</code></div>
        </div>
      </div>
    </div>
  );
}
