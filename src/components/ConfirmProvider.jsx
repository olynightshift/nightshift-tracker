import { useCallback, useRef, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Modal } from './ui';
import { ConfirmCtx } from './confirm-context';

// ============================================================
// ConfirmProvider — styled replacement for window.confirm.
//
// const confirm = useConfirm();
// if (await confirm('Delete this entry?')) { ... }
// ============================================================
export function ConfirmProvider({ children }) {
  const [state, setState] = useState(null); // { message }
  const resolver = useRef(null);

  const confirm = useCallback((message) => {
    setState({ message });
    return new Promise(resolve => { resolver.current = resolve; });
  }, []);

  function answer(val) {
    resolver.current?.(val);
    resolver.current = null;
    setState(null);
  }

  return (
    <ConfirmCtx.Provider value={confirm}>
      {children}
      {state && (
        <Modal onClose={() => answer(false)} maxWidth="max-w-sm">
          <div className="p-5">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                <AlertTriangle size={18} className="text-red-600" />
              </div>
              <div className="text-sm text-slate-300 pt-1.5">{state.message}</div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => answer(false)} className="px-4 py-1.5 rounded border bg-slate-900 text-sm">Cancel</button>
              <button onClick={() => answer(true)} autoFocus className="px-4 py-1.5 rounded bg-red-600 text-white text-sm font-medium">Delete</button>
            </div>
          </div>
        </Modal>
      )}
    </ConfirmCtx.Provider>
  );
}
