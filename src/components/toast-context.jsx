import { createContext, useContext } from 'react';

export const ToastCtx = createContext((msg, type) => { console[type === 'error' ? 'error' : 'log'](msg); });
export const useToast = () => useContext(ToastCtx);
