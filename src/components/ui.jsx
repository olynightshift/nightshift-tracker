import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';
import { ToastCtx } from './toast-context';

const TOAST_STYLES = {
  success: { icon: CheckCircle2, cls: 'border-emerald-200 bg-emerald-50 text-emerald-800', iconCls: 'text-emerald-500' },
  error: { icon: AlertCircle, cls: 'border-red-200 bg-red-50 text-red-800', iconCls: 'text-red-500' },
  info: { icon: Info, cls: 'border-blue-200 bg-blue-50 text-blue-800', iconCls: 'text-blue-500' },
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const dismiss = useCallback(id => setToasts(t => t.filter(x => x.id !== id)), []);
  const push = useCallback((message, type = 'info') => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts(t => [...t.slice(-3), { id, message, type }]);
    setTimeout(() => dismiss(id), 4500);
  }, [dismiss]);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 w-80 max-w-[calc(100vw-2rem)]">
        {toasts.map(t => {
          const s = TOAST_STYLES[t.type] || TOAST_STYLES.info;
          const Icon = s.icon;
          return (
            <div key={t.id} className={`flex items-start gap-2 border rounded-lg shadow-lg px-3 py-2.5 text-sm ${s.cls}`}>
              <Icon size={16} className={`mt-0.5 shrink-0 ${s.iconCls}`} />
              <div className="flex-1">{t.message}</div>
              <button onClick={() => dismiss(t.id)} className="opacity-50 hover:opacity-100 shrink-0"><X size={14} /></button>
            </div>
          );
        })}
      </div>
    </ToastCtx.Provider>
  );
}

// ---------------- Modal ----------------
export function Modal({ onClose, children, maxWidth = 'max-w-lg' }) {
  useEffect(() => {
    const handler = e => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className={`bg-white rounded-xl shadow-sm border border-slate-200-lg w-full max-h-full overflow-y-auto ${maxWidth}`} onClick={e => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}
