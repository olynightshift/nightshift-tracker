import { useCallback, useEffect, useState } from 'react';
import { Undo2, Redo2 } from 'lucide-react';
import { useToast } from './toast-context';
import { UndoCtx, useUndo } from './undo-context';

// ============================================================
// UndoProvider — global action history.
//
// Wrap any data mutation in runAction({ label, doFn, undoFn }):
//   doFn    performs the action (API call + local state update)
//   undoFn  reverses it (API call + local state update)
// The provider executes doFn, records the pair, and exposes
// undo/redo buttons + Ctrl/Cmd+Z / Ctrl/Cmd+Shift+Z shortcuts.
// ============================================================
export function UndoProvider({ children }) {
  const [undoStack, setUndoStack] = useState([]);
  const [redoStack, setRedoStack] = useState([]);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  const runAction = useCallback(async ({ label, doFn, undoFn }) => {
    try {
      await doFn();
    } catch (err) {
      toast(`${label} failed: ` + (err?.message || err), 'error');
      return false;
    }
    setUndoStack(s => [...s.slice(-29), { label, undoFn, redoFn: doFn }]);
    setRedoStack([]);
    return true;
  }, [toast]);

  const undo = useCallback(async () => {
    if (busy || undoStack.length === 0) return;
    const action = undoStack[undoStack.length - 1];
    setBusy(true);
    try {
      await action.undoFn();
      setUndoStack(s => s.slice(0, -1));
      setRedoStack(r => [...r, action]);
      toast(`Undid: ${action.label}`, 'info');
    } catch (err) {
      toast('Undo failed: ' + (err?.message || err), 'error');
    }
    setBusy(false);
  }, [busy, undoStack, toast]);

  const redo = useCallback(async () => {
    if (busy || redoStack.length === 0) return;
    const action = redoStack[redoStack.length - 1];
    setBusy(true);
    try {
      await action.redoFn();
      setRedoStack(r => r.slice(0, -1));
      setUndoStack(s => [...s, action]);
      toast(`Redid: ${action.label}`, 'info');
    } catch (err) {
      toast('Redo failed: ' + (err?.message || err), 'error');
    }
    setBusy(false);
  }, [busy, redoStack, toast]);

  // Keyboard shortcuts (skip when typing in a field)
  useEffect(() => {
    const handler = e => {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== 'z') return;
      const t = e.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
      e.preventDefault();
      if (e.shiftKey) redo(); else undo();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [undo, redo]);

  const value = {
    runAction,
    undo,
    redo,
    busy,
    canUndo: undoStack.length > 0,
    canRedo: redoStack.length > 0,
    undoLabel: undoStack.length > 0 ? undoStack[undoStack.length - 1].label : null,
    redoLabel: redoStack.length > 0 ? redoStack[redoStack.length - 1].label : null,
  };

  return <UndoCtx.Provider value={value}>{children}</UndoCtx.Provider>;
}

// ============================================================
// UndoRedoControls — button pair (drop into any toolbar)
// ============================================================
export function UndoRedoControls({ compact = false }) {
  const { canUndo, canRedo, undo, redo, undoLabel, redoLabel, busy } = useUndo();
  const base = compact
    ? 'flex items-center gap-1 px-2 py-1.5 rounded text-xs font-medium'
    : 'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium flex-1 justify-center';
  const on = 'bg-blue-900 text-blue-100 hover:bg-blue-800 hover:text-white';
  const off = 'text-blue-800 cursor-not-allowed';
  return (
    <>
      <button onClick={undo} disabled={!canUndo || busy} title={undoLabel ? `Undo: ${undoLabel}` : 'Nothing to undo'} className={`${base} ${canUndo && !busy ? on : off}`}>
        <Undo2 size={compact ? 12 : 14} /> Undo
      </button>
      <button onClick={redo} disabled={!canRedo || busy} title={redoLabel ? `Redo: ${redoLabel}` : 'Nothing to redo'} className={`${base} ${canRedo && !busy ? on : off}`}>
        <Redo2 size={compact ? 12 : 14} /> Redo
      </button>
    </>
  );
}
