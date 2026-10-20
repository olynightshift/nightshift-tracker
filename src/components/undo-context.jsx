import { createContext, useContext } from 'react';

export const UndoCtx = createContext(null);
export const useUndo = () => useContext(UndoCtx);
