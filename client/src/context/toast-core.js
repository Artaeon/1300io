import { createContext } from 'react';

// Split from ToastContext.jsx so that file only exports a component.
// react-refresh requires single-concern files for Fast Refresh to
// hot-swap the provider without a full reload.
export const ToastContext = createContext(null);
