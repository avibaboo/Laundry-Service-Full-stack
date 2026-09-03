import React, { useState, useCallback } from 'react';

// Toast state is module-level so it can be triggered from anywhere
let _setToasts = null;

export const useToast = () => {
  const [toasts, setToasts] = useState([]);
  _setToasts = setToasts;
  return toasts;
};

const addToast = (type, title, message, duration = 4000) => {
  if (!_setToasts) return;
  const id = Date.now() + Math.random();
  _setToasts(prev => [...prev, { id, type, title, message, duration }]);
  if (duration > 0) {
    setTimeout(() => removeToast(id), duration);
  }
};

export const removeToast = (id) => {
  if (!_setToasts) return;
  _setToasts(prev => prev.filter(t => t.id !== id));
};

export const toast = {
  success: (title, message, duration) => addToast('success', title, message, duration),
  error:   (title, message, duration) => addToast('error',   title, message, duration),
  info:    (title, message, duration) => addToast('info',    title, message, duration),
  warning: (title, message, duration) => addToast('warning', title, message, duration),
};

export default toast;
