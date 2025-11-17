
import React, { createContext, useContext, ReactNode } from 'react';
import { useVoucherStore, UseVoucherStoreReturn } from '../hooks/useVoucherStore';

const VoucherContext = createContext<UseVoucherStoreReturn | undefined>(undefined);

export const VoucherProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const voucherStore = useVoucherStore();
  return (
    <VoucherContext.Provider value={voucherStore}>
      {children}
    </VoucherContext.Provider>
  );
};

export const useVouchers = (): UseVoucherStoreReturn => {
  const context = useContext(VoucherContext);
  if (context === undefined) {
    throw new Error('useVouchers must be used within a VoucherProvider');
  }
  return context;
};
