// Sign IN PAGE
// Created by: Hung Hoang, 7/9/2026, with logics from index.html by Sean Dang
import { useState } from 'react';
import Field from '../components/Field.jsx';
import Button from '../components/Button.jsx';
import { Hash } from 'lucide-react';

export default function Login({ onLogin, onGoRegister, credentials }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});

  const validate = () => {
    const next = {};
    if (!email.trim()) next.email = 'Email is required.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) next.email = 'Enter a valid email address.';
    if (!password) next.password = 'Password is required.';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!validate()) return;
    const user = credentials.find((item) => item.email === email && item.password === password);
    if (!user) {
      setErrors({ general: 'Invalid email or password. Check the demo credentials below.' });
      return;
    }
    onLogin(user);
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
          <Button type="submit" variant="primary" size="lg" className="w-full">Sign In</Button>
        </form>
        <div className="auth-switch">
          <span>Don't have an account?</span>
          <button type="button" className="link-button" onClick={onGoRegister}>Register</button>
        </div>
        <div className="demo-credentials">
          <strong>Demo credentials</strong>
          <div><span>User:</span><code>user@demo.com / password123</code></div>
          <div><span>Admin:</span><code>admin@demo.com / password123</code></div>
        </div>
      </div>
    </div>
  );
}
