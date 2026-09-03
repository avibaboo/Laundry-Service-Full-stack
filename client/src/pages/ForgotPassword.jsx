import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import DarkModeToggle from '../components/shared/DarkModeToggle';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setMessage('');
    setError('');

    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1'}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      if (res.ok) {
        setMessage(data.message || 'Check your console for the reset token/link (Dev Mode).');
        if (data._mockToken) {
          const frontendUrl = import.meta.env.VITE_SOCKET_URL?.replace('/api/v1', '') || 'http://localhost:5173';
          console.log(`[DEV MODE] Reset Link: ${frontendUrl}/reset-password/${data._mockToken}`);
        }
      } else {
        setError(data.message || 'Something went wrong.');
      }
    } catch (err) {
      setError('Network error. Please try again later.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="auth-layout">
      <div className="auth-nav">
        <div className="cp-logo">
          <div className="cp-logo-mark">🌊</div>
          <span className="cp-logo-text">FreshWave</span>
        </div>
        <DarkModeToggle />
      </div>

      <div className="auth-container">
        <div className="auth-card">
          <div className="auth-header">
            <h1 className="auth-title">Forgot Password</h1>
            <p className="auth-sub">Enter your email and we will send you a reset link.</p>
          </div>

          <form onSubmit={handleSubmit} className="auth-form">
            {message && <div style={{ color: 'var(--success)', fontSize: '0.9rem', marginBottom: '10px' }}>{message}</div>}
            {error && <div style={{ color: 'var(--danger)', fontSize: '0.9rem', marginBottom: '10px' }}>{error}</div>}

            <div className="form-group">
              <label className="form-label" htmlFor="email">Email Address</label>
              <input
                id="email"
                type="email"
                className="form-control"
                placeholder="you@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-full"
              disabled={isSubmitting}
              style={{ marginTop: 8 }}
            >
              {isSubmitting ? 'Sending...' : 'Send Reset Link'}
            </button>
          </form>

          <div className="auth-footer">
            Remembered your password? <Link to="/login">Sign in here</Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
