import { useState, useEffect, useCallback } from 'react';
import { Voucher, Outlet, Stats, VoucherType } from '../types';
import { getTodayDateString } from '../services/util';
import { MOCK_VOUCHERS } from '../services/mockdb';

// Constants for voucher totals
const TOTAL_DIGITAL_VOUCHERS = 900;
const TOTAL_PHYSICAL_VOUCHERS = 2100;

export interface UseVoucherStoreReturn {
  vouchers: Voucher[];
  loading: boolean;
  error: string | null;
  stats: Stats;
  claimVoucher: (data: Omit<Voucher, 'id' | 'voucherCode' | 'claimDate' | 'isRedeemed' | 'type'>) => Promise<Voucher>;
  redeemVoucher: (voucherIdentifier: string) => Promise<Voucher>;
  recordPhysicalVoucher: (data: Omit<Voucher, 'id' | 'claimDate' | 'isRedeemed' | 'type' >) => Promise<Voucher>;
  loadCodes: (codes: string[], type: VoucherType) => void;
  getVouchers: () => Voucher[];
  resetData: () => void;
}

// Using a Map for faster lookups for code validation
const initialCodePool = {
    DIGITAL: new Map<string, boolean>(), // code -> isUsed
    PHYSICAL: new Map<string, boolean>()
};

export const useVoucherStore = (): UseVoucherStoreReturn => {
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [codePool, setCodePool] = useState(initialCodePool);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<Stats>({
      totalClaims: 0,
      totalRedeemed: 0,
      claimsToday: 0,
      claimsByOutlet: {},
      claimsPerDay: [],
      totalDigitalVouchers: TOTAL_DIGITAL_VOUCHERS,
      claimedDigitalVouchers: 0,
      totalPhysicalVouchers: TOTAL_PHYSICAL_VOUCHERS,
      redeemedPhysicalVouchers: 0,
  });

  // Load initial data and codes from localStorage
  useEffect(() => {
    try {
      const storedVouchers = localStorage.getItem('vouchers');
      const loadedVouchers = storedVouchers ? JSON.parse(storedVouchers) : MOCK_VOUCHERS;
      setVouchers(loadedVouchers);

      const storedCodes = localStorage.getItem('voucherCodes');
      const loadedCodes = storedCodes ? JSON.parse(storedCodes) : initialCodePool;

      // Re-populate used status from vouchers
      // FIX: Add explicit generic types to the Map constructor. When loading from localStorage,
      // `loadedCodes` is of type `any`, causing `new Map()` to be inferred as `Map<unknown, unknown>`.
      // Specifying `<string, boolean>` ensures the correct type and resolves the assignment error.
      const newCodePool = {
          DIGITAL: new Map<string, boolean>(loadedCodes.DIGITAL || []),
          PHYSICAL: new Map<string, boolean>(loadedCodes.PHYSICAL || [])
      };
      loadedVouchers.forEach((v: Voucher) => {
          if (newCodePool[v.type]?.has(v.voucherCode)) {
              newCodePool[v.type].set(v.voucherCode, true);
          }
      });
      setCodePool(newCodePool);

    } catch (e) {
      setError('Failed to load data from storage.');
      setVouchers(MOCK_VOUCHERS); // Fallback
    } finally {
      setLoading(false);
    }
  }, []);
  
  const updateLocalStorage = useCallback((newVouchers: Voucher[], newCodePool: typeof initialCodePool) => {
      try {
        localStorage.setItem('vouchers', JSON.stringify(newVouchers));
        // Map needs to be converted to array of arrays for JSON.stringify
        localStorage.setItem('voucherCodes', JSON.stringify({
            DIGITAL: Array.from(newCodePool.DIGITAL.entries()),
            PHYSICAL: Array.from(newCodePool.PHYSICAL.entries())
        }));
      } catch (e) {
        console.error("Failed to save data to local storage", e);
        setError("Could not save changes. Your storage might be full.");
      }
  }, []);

  const calculateStats = useCallback((currentVouchers: Voucher[], currentCodePool: typeof initialCodePool) => {
    const today = getTodayDateString();
    const claimsByOutlet: { [key in Outlet]?: number } = {};
    const claimsPerDayMap = new Map<string, number>();

    currentVouchers.forEach(v => {
      claimsByOutlet[v.outlet] = (claimsByOutlet[v.outlet] || 0) + 1;
      const date = v.claimDate.split('T')[0];
      claimsPerDayMap.set(date, (claimsPerDayMap.get(date) || 0) + 1);
    });

    const claimsPerDay = Array.from(claimsPerDayMap.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const claimedDigital = currentVouchers.filter(v => v.type === 'DIGITAL').length;
    const redeemedPhysical = currentVouchers.filter(v => v.type === 'PHYSICAL').length;

    setStats({
      totalClaims: currentVouchers.length,
      totalRedeemed: currentVouchers.filter(v => v.isRedeemed).length,
      claimsToday: currentVouchers.filter(v => v.claimDate.startsWith(today)).length,
      claimsByOutlet,
      claimsPerDay,
      totalDigitalVouchers: TOTAL_DIGITAL_VOUCHERS,
      claimedDigitalVouchers: claimedDigital,
      totalPhysicalVouchers: TOTAL_PHYSICAL_VOUCHERS,
      redeemedPhysicalVouchers: redeemedPhysical,
    });
  }, []);

  useEffect(() => {
    if (!loading) {
      calculateStats(vouchers, codePool);
    }
  }, [vouchers, codePool, loading, calculateStats]);


  const loadCodes = (codes: string[], type: VoucherType) => {
    setError(null);
    const newCodePool = { ...codePool };
    const codeMap = new Map<string, boolean>();
    codes.forEach(code => codeMap.set(code.trim(), false));
    newCodePool[type] = codeMap;
    
    // Re-check for used codes from existing vouchers
    vouchers.forEach(v => {
        if(v.type === type && codeMap.has(v.voucherCode)) {
            codeMap.set(v.voucherCode, true);
        }
    });

    setCodePool(newCodePool);
    updateLocalStorage(vouchers, newCodePool);
    alert(`${codes.length} codes for ${type} vouchers loaded successfully!`);
  }

  const claimVoucher = async (data: Omit<Voucher, 'id' | 'voucherCode' | 'claimDate' | 'isRedeemed' | 'type'>): Promise<Voucher> => {
    setError(null);

    return new Promise((resolve, reject) => {
      setTimeout(() => {
        if (vouchers.some(v => v.whatsappNumber === data.whatsappNumber)) {
            const err = 'This WhatsApp number has already claimed a voucher.';
            setError(err);
            return reject(new Error(err));
        }

        const availableCode = Array.from(codePool.DIGITAL.entries()).find(([_, isUsed]) => !isUsed);
        if (!availableCode) {
            const err = 'Sorry, all digital vouchers have been claimed.';
            setError(err);
            return reject(new Error(err));
        }
        
        const [voucherCode] = availableCode;

        const newVoucher: Voucher = {
          ...data,
          id: crypto.randomUUID(),
          voucherCode,
          claimDate: new Date().toISOString(),
          isRedeemed: false,
          type: 'DIGITAL',
        };
        
        const updatedCodePool = { ...codePool };
        updatedCodePool.DIGITAL.set(voucherCode, true);
        setCodePool(updatedCodePool);
        
        const updatedVouchers = [...vouchers, newVoucher];
        setVouchers(updatedVouchers);

        updateLocalStorage(updatedVouchers, updatedCodePool);
        resolve(newVoucher);
      }, 500);
    });
  };

  const redeemVoucher = async (voucherIdentifier: string): Promise<Voucher> => {
    setError(null);
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            const voucherIndex = vouchers.findIndex(v => v.type === 'DIGITAL' && (v.voucherCode.toLowerCase() === voucherIdentifier.toLowerCase() || v.whatsappNumber === voucherIdentifier));
            
            if (voucherIndex === -1) {
                const err = 'Digital voucher not found.';
                setError(err);
                return reject(new Error(err));
            }

            const voucher = vouchers[voucherIndex];
            if (voucher.isRedeemed) {
                const err = 'This voucher has already been redeemed.';
                setError(err);
                return reject(new Error(err));
            }

            const updatedVoucher = { ...voucher, isRedeemed: true, redeemedDate: new Date().toISOString() };
            const updatedVouchers = [...vouchers];
            updatedVouchers[voucherIndex] = updatedVoucher;

            setVouchers(updatedVouchers);
            updateLocalStorage(updatedVouchers, codePool); // codePool doesn't change here
            resolve(updatedVoucher);
        }, 500);
    });
  };
  
  const recordPhysicalVoucher = async (data: Omit<Voucher, 'id' | 'claimDate' | 'isRedeemed' | 'type' >): Promise<Voucher> => {
      setError(null);
      return new Promise((resolve, reject) => {
          setTimeout(() => {
              const code = data.voucherCode.trim();
              if (!codePool.PHYSICAL.has(code)) {
                  const err = 'Invalid physical voucher code.';
                  setError(err);
                  return reject(new Error(err));
              }

              if (codePool.PHYSICAL.get(code) === true) {
                  const err = 'This physical voucher has already been recorded.';
                  setError(err);
                  return reject(new Error(err));
              }
              
              const newVoucher: Voucher = {
                  ...data,
                  id: crypto.randomUUID(),
                  claimDate: new Date().toISOString(),
                  redeemedDate: new Date().toISOString(),
                  isRedeemed: true,
                  type: 'PHYSICAL',
              };

              const updatedCodePool = { ...codePool };
              updatedCodePool.PHYSICAL.set(code, true);
              setCodePool(updatedCodePool);

              const updatedVouchers = [...vouchers, newVoucher];
              setVouchers(updatedVouchers);
              
              updateLocalStorage(updatedVouchers, updatedCodePool);
              resolve(newVoucher);

          }, 500);
      });
  }

  const resetData = () => {
    if (window.confirm('Are you sure you want to permanently delete all voucher data? This includes all claims, redemptions, and uploaded codes. This action cannot be undone.')) {
        try {
            // Clear storage for the next session
            localStorage.setItem('vouchers', '[]');
            localStorage.setItem('voucherCodes', JSON.stringify({
                DIGITAL: [],
                PHYSICAL: []
            }));
            
            // Clear current state in memory for immediate feedback on the UI
            setVouchers([]);
            setCodePool(initialCodePool);

            alert('All application data has been reset successfully.');
            // No reload needed, state update will refresh the view.
        } catch (e) {
            console.error("Failed to reset data in local storage", e);
            alert("An error occurred while trying to reset the data.");
        }
    }
  };

  const getVouchers = () => {
    return vouchers;
  };

  return { vouchers, loading, error, stats, claimVoucher, redeemVoucher, recordPhysicalVoucher, loadCodes, getVouchers, resetData };
};