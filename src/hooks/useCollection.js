import { useState, useEffect } from 'react';
import { supabase } from '../lib/core';
import { useToast } from '../components/toast-context';

export function useCollection(loader) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const toast = useToast();
  useEffect(() => {
    let active = true;
    if (!supabase) { setLoading(false); return; }
    (async () => {
      try {
        const data = await loader();
        if (active) setRows(data);
      } catch (err) {
        console.error('Load error:', err.message || err);
        if (active) toast('Load failed: ' + (err.message || err), 'error');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return [rows, setRows, loading];
}
