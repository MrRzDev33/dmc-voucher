import { useState, useEffect, useCallback } from 'react';
import { Voucher, Outlet, Stats, VoucherType, UseVoucherStoreReturn } from '../types';
import { getTodayDateString } from '../services/util';
import { api } from '../services/api';

export const useVoucherStore = (): UseVoucherStoreReturn => {
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  // State baru untuk Dashboard
  const [isClaimEnabled, setIsClaimEnabled] = useState<boolean>(true); 
  const [dailyLimit, setDailyLimit] = useState<number>(1000);
  
  // State untuk menyimpan statistik REAL dari server (bukan dari array vouchers)
  const [serverStats, setServerStats] = useState({
    claimedDigital: 0,
    redeemedDigital: 0,
    redeemedPhysical: 0,
    todayClaimedDigital: 0, // NEW: Specific for limit check
    poolDigital: 0,
    poolPhysical: 0
  });

  const [stats, setStats] = useState<Stats>({
      totalClaims: 0,
      totalRedeemed: 0,
      claimsToday: 0,
      claimsByOutlet: {},
      claimsPerDay: [],
      totalDigitalVouchers: 0,
      claimedDigitalVouchers: 0,
      totalPhysicalVouchers: 0,
      redeemedPhysicalVouchers: 0,
      todayClaimedDigital: 0, // NEW
  });

  const mapDbToVoucher = (data: any): Voucher => ({
      id: data.id,
      fullName: data.full_name,
      birthYear: data.birth_year,
      gender: data.gender,
      whatsappNumber: data.whatsapp_number,
      outlet: data.outlet,
      voucherCode: data.voucher_code,
      claimDate: data.claim_date,
      isRedeemed: Boolean(data.is_redeemed), // Pastikan boolean
      redeemedDate: data.redeemed_date,
      redeemedOutlet: data.redeemed_outlet,
      type: data.type,
      discountAmount: Number(data.discount_amount),
      notes: data.notes
  });

  const fetchData = useCallback(async (isPolling = false) => {
      if (!isPolling) setLoading(true);
      try {
          // 1. Ambil Setting ON/OFF
          const settingData = await api.getSettings('claim_enabled');
          if (settingData) {
              setIsClaimEnabled(settingData.setting_value === 'true');
          }

          // 2. Ambil Setting Limit Harian
          const limitData = await api.getSettings('daily_limit');
          if (limitData) {
              setDailyLimit(parseInt(limitData.setting_value) || 1000);
          }

          // 3. Ambil Data Voucher (Tabel)
          const voucherData = await api.getVouchers();
          const mappedVouchers = (voucherData || []).map(mapDbToVoucher);
          setVouchers(mappedVouchers);

          // 4. Ambil Statistik Dashboard (Count Exact) - PENTING AGAR DATA TIDAK BERKURANG
          // Mengembalikan { claimedDigital, redeemedDigital, redeemedPhysical, todayClaimedDigital }
          const dashboardStats = await api.getDashboardStats();

          // 5. Ambil Statistik Pool (Stock)
          const digitalPool = await api.getPoolStats('DIGITAL');
          const physicalPool = await api.getPoolStats('PHYSICAL');
              
          setServerStats({
              claimedDigital: dashboardStats.claimedDigital,
              redeemedDigital: dashboardStats.redeemedDigital,
              redeemedPhysical: dashboardStats.redeemedPhysical,
              todayClaimedDigital: dashboardStats.todayClaimedDigital || 0, // Store specific metric
              poolDigital: digitalPool.count || 0,
              poolPhysical: physicalPool.count || 0
          });
          
          if (!isPolling) setError(null);

      } catch (err: any) {
          console.error("Error fetching data:", err);
          if (!isPolling) setError(err.message || "Gagal memuat data dari server.");
      } finally {
          if (!isPolling) setLoading(false);
      }
  }, []);

  useEffect(() => {
    fetchData();
    // Polling setiap 10 detik
    const intervalId = setInterval(() => {
        fetchData(true);
    }, 10000);
    return () => clearInterval(intervalId);
  }, [fetchData]);

  useEffect(() => {
    if (!loading) {
        const today = getTodayDateString();
        const claimsByOutlet: { [key in Outlet]?: number } = {};
        const claimsPerDayMap = new Map<string, number>();
    
        vouchers.forEach(v => {
          claimsByOutlet[v.outlet] = (claimsByOutlet[v.outlet] || 0) + 1;
          const date = v.claimDate.split('T')[0];
          claimsPerDayMap.set(date, (claimsPerDayMap.get(date) || 0) + 1);
        });
    
        const claimsPerDay = Array.from(claimsPerDayMap.entries())
          .map(([date, count]) => ({ date, count }))
          .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
        setStats({
          totalClaims: vouchers.length,
          totalRedeemed: vouchers.filter(v => v.isRedeemed).length,
          claimsToday: vouchers.filter(v => v.claimDate.startsWith(today)).length,
          claimsByOutlet,
          claimsPerDay,
          
          // Data Statistik Utama dari Server Count (Fix issue data berkurang)
          totalDigitalVouchers: serverStats.poolDigital, 
          claimedDigitalVouchers: serverStats.claimedDigital, 
          
          totalPhysicalVouchers: serverStats.poolPhysical,
          redeemedPhysicalVouchers: serverStats.redeemedPhysical, 
          
          // Use specific server statistic for the daily limit
          todayClaimedDigital: serverStats.todayClaimedDigital
        });
    }
  }, [vouchers, loading, serverStats]);


  const loadCodes = async (codes: string[], type: VoucherType, discountAmount?: number) => {
    setError(null);
    try {
        const result = await api.uploadCodes(codes, type, discountAmount);
        alert(`${result.count} kode untuk voucher ${type === 'DIGITAL' ? 'Digital' : 'Fisik'} berhasil diunggah!`);
        fetchData(); 
    } catch (err: any) {
        console.error("Upload error:", err);
        alert(`Gagal mengunggah kode: ${err.message}`);
    }
  }

  const toggleClaimStatus = async (status: boolean) => {
      try {
          // Kirim ke API
          await api.updateSetting('claim_enabled', String(status));
          
          // Jika sukses, update state lokal
          setIsClaimEnabled(status);
          
          // Reload data untuk memastikan sinkron
          setTimeout(() => fetchData(true), 500);
      } catch (err: any) {
          console.error("Gagal mengubah status klaim:", err);
          alert(`Gagal menyimpan status ke database: ${err.message}. Pastikan koneksi lancar.`);
          // Jangan ubah state lokal jika gagal
      }
  }

  const updateDailyLimit = async (limit: number) => {
      try {
          await api.updateSetting('daily_limit', String(limit));
          setDailyLimit(limit);
          alert(`Batas harian berhasil diubah menjadi ${limit}`);
          setTimeout(() => fetchData(true), 500);
      } catch (err: any) {
          console.error("Gagal mengubah limit:", err);
          alert("Gagal mengubah limit harian: " + err.message);
      }
  }

  const claimVoucher = async (data: Omit<Voucher, 'id' | 'voucherCode' | 'claimDate' | 'isRedeemed' | 'type' | 'redeemedDate' | 'redeemedOutlet' | 'discountAmount'>): Promise<Voucher> => {
    setError(null);

    // Cek State Lokal
    if (!isClaimEnabled) {
        throw new Error("Mohon maaf, periode klaim voucher belum dibuka atau sudah ditutup.");
    }

    try {
        const payload = {
            full_name: data.fullName,
            birth_year: data.birthYear,
            whatsapp_number: data.whatsappNumber,
            outlet: data.outlet
        };

        const result = await api.claimVoucher(payload);
        const mappedVoucher = mapDbToVoucher(result);
        setVouchers(prev => [mappedVoucher, ...prev]);
        
        // Optimistic Update
        setServerStats(prev => ({
            ...prev,
            claimedDigital: prev.claimedDigital + 1,
            todayClaimedDigital: prev.todayClaimedDigital + 1
        }));
        
        return mappedVoucher;

    } catch (err: any) {
        setError(err.message);
        throw err;
    }
  };

  const redeemVoucher = async (voucherIdentifier: string, redeemedOutlet: Outlet): Promise<Voucher> => {
    setError(null);
    try {
        const result = await api.redeemVoucher(voucherIdentifier, redeemedOutlet);
        const mapped = mapDbToVoucher(result);
        setVouchers(prev => prev.map(v => v.id === mapped.id ? mapped : v));
        
        setServerStats(prev => ({
            ...prev,
            redeemedDigital: prev.redeemedDigital + 1
        }));

        return mapped;
    } catch (err: any) {
        setError(err.message);
        throw err;
    }
  };
  
  const recordPhysicalVoucher = async (data: Omit<Voucher, 'id' | 'claimDate' | 'isRedeemed' | 'type' | 'redeemedDate' | 'redeemedOutlet' | 'discountAmount'>): Promise<Voucher> => {
      setError(null);
      try {
        const payload = {
            gender: data.gender,
            whatsapp_number: data.whatsappNumber,
            outlet: data.outlet,
            voucher_code: data.voucherCode
        };

        const result = await api.recordPhysical(payload);
        const mapped = mapDbToVoucher(result);
        setVouchers(prev => [mapped, ...prev]);
        
        setServerStats(prev => ({
            ...prev,
            redeemedPhysical: prev.redeemedPhysical + 1
        }));

        return mapped;

      } catch (err: any) {
          setError(err.message);
          throw err;
      }
  }

  const resetData = async () => {
    if (window.confirm('PERINGATAN: Ini akan MENGHAPUS SEMUA data. Lanjutkan?')) {
        try {
            await api.resetData();
            alert('Database berhasil di-reset.');
            fetchData();
        } catch (e: any) {
            console.error("Failed to reset:", e);
            alert("Gagal reset data: " + e.message);
        }
    }
  };

  const getVouchers = () => {
    return vouchers;
  };

  return { vouchers, loading, error, stats, isClaimEnabled, dailyLimit, toggleClaimStatus, updateDailyLimit, claimVoucher, redeemVoucher, recordPhysicalVoucher, loadCodes, getVouchers, resetData };
};
