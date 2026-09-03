import React, { useState } from 'react';
import { useToast, removeToast } from '../../hooks/useToast';

const ICONS = {
  success: '✓',
  error:   '✕',
  info:    'ℹ',
  warning: '⚠',
};

const TITLES = {
  success: 'Success',
  error:   'Error',
  info:    'Info',
  warning: 'Warning',
};

const ToastItem = ({ toast }) => {
  const [exiting, setExiting] = useState(false);

  const handleClose = () => {
    setExiting(true);
    setTimeout(() => removeToast(toast.id), 280);
  };

  return (
    <div
      className={`toast ${toast.type}${exiting ? ' exiting' : ''}`}
      role="alert"
      aria-live="polite"
    >
      <div className="toast-icon" aria-hidden="true">
        {ICONS[toast.type]}
      </div>
      <div className="toast-body">
        <div className="toast-title">{toast.title || TITLES[toast.type]}</div>
        {toast.message && <div className="toast-msg">{toast.message}</div>}
      </div>
      <button
        className="toast-close"
        onClick={handleClose}
        aria-label="Dismiss notification"
      >
        ✕
      </button>
      {toast.duration > 0 && (
        <div
          className="toast-progress"
          style={{ animationDuration: `${toast.duration}ms` }}
          aria-hidden="true"
        />
      )}
    </div>
  );
};

const ToastContainer = () => {
  const toasts = useToast();

  return (
    <div className="toast-container" role="region" aria-label="Notifications">
      {toasts.map(t => (
        <ToastItem key={t.id} toast={t} />
      ))}
    </div>
  );
};

export default ToastContainer;
