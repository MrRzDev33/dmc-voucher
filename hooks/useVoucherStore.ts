
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
  claimVoucher: (data: Omit<Voucher, 'id' | 'voucherCode' | 'claimDate' | 'isRedeemed' | 'type' | 'redeemedDate' | 'redeemedOutlet'>) => Promise<Voucher>;
  redeemVoucher: (voucherIdentifier: string, redeemedOutlet: Outlet) => Promise<Voucher>;
  recordPhysicalVoucher: (data: Omit<Voucher, 'id' | 'claimDate' | 'isRedeemed' | 'type' | 'redeemedDate' | 'redeemedOutlet'>) => Promise<Voucher>;
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
      setError('Gagal memuat data dari penyimpanan.');
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
        setError("Tidak dapat menyimpan perubahan. Penyimpanan Anda mungkin penuh.");
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
    alert(`${codes.length} kode untuk voucher ${type === 'DIGITAL' ? 'Digital' : 'Fisik'} berhasil dimuat!`);
  }

  const claimVoucher = async (data: Omit<Voucher, 'id' | 'voucherCode' | 'claimDate' | 'isRedeemed' | 'type' | 'redeemedDate' | 'redeemedOutlet'>): Promise<Voucher> => {
    setError(null);

    return new Promise((resolve, reject) => {
      setTimeout(() => {
        if (vouchers.some(v => v.whatsappNumber === data.whatsappNumber)) {
            const err = 'Nomor WhatsApp ini sudah pernah mengklaim voucher.';
            setError(err);
            return reject(new Error(err));
        }

        let voucherCode: string | undefined;
        for (const [code, isUsed] of codePool.DIGITAL.entries()) {
            if (!isUsed) {
                voucherCode = code;
                break;
            }
        }

        if (!voucherCode) {
            const err = 'Maaf, semua voucher digital sudah habis diklaim.';
            setError(err);
            return reject(new Error(err));
        }
        
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

  const redeemVoucher = async (voucherIdentifier: string, redeemedOutlet: Outlet): Promise<Voucher> => {
    setError(null);
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            const voucherIndex = vouchers.findIndex(v => v.type === 'DIGITAL' && (v.voucherCode.toLowerCase() === voucherIdentifier.toLowerCase() || v.whatsappNumber === voucherIdentifier));
            
            if (voucherIndex === -1) {
                const err = 'Voucher digital tidak ditemukan.';
                setError(err);
                return reject(new Error(err));
            }

            const voucher = vouchers[voucherIndex];
            if (voucher.isRedeemed) {
                const err = 'Voucher ini sudah pernah ditukarkan sebelumnya.';
                setError(err);
                return reject(new Error(err));
            }

            const updatedVoucher: Voucher = { 
                ...voucher, 
                isRedeemed: true, 
                redeemedDate: new Date().toISOString(),
                redeemedOutlet: redeemedOutlet 
            };
            const updatedVouchers = [...vouchers];
            updatedVouchers[voucherIndex] = updatedVoucher;

            setVouchers(updatedVouchers);
            updateLocalStorage(updatedVouchers, codePool); // codePool doesn't change here
            resolve(updatedVoucher);
        }, 500);
    });
  };
  
  const recordPhysicalVoucher = async (data: Omit<Voucher, 'id' | 'claimDate' | 'isRedeemed' | 'type' | 'redeemedDate' | 'redeemedOutlet'>): Promise<Voucher> => {
      setError(null);
      return new Promise((resolve, reject) => {
          setTimeout(() => {
              const code = data.voucherCode.trim();
              if (!codePool.PHYSICAL.has(code)) {
                  const err = 'Kode voucher fisik tidak valid (tidak ditemukan di database).';
                  setError(err);
                  return reject(new Error(err));
              }

              if (codePool.PHYSICAL.get(code) === true) {
                  const err = 'Voucher fisik ini sudah pernah tercatat.';
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
    if (window.confirm('Apakah Anda yakin ingin menghapus semua data voucher secara permanen? Ini mencakup semua klaim, penukaran, dan kode yang diunggah. Tindakan ini tidak dapat dibatalkan.')) {
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

            alert('Semua data aplikasi berhasil diatur ulang.');
            // No reload needed, state update will refresh the view.
        } catch (e) {
            console.error("Failed to reset data in local storage", e);
            alert("Terjadi kesalahan saat mencoba mengatur ulang data.");
        }
    }
  };

  const getVouchers = () => {
    return vouchers;
  };

  return { vouchers, loading, error, stats, claimVoucher, redeemVoucher, recordPhysicalVoucher, loadCodes, getVouchers, resetData };
};