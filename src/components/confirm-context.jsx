import { createContext, useContext } from 'react';

export const ConfirmCtx = createContext(() => Promise.resolve(true));
export const useConfirm = () => useContext(ConfirmCtx);
