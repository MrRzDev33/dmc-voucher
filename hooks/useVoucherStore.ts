
import { useState, useEffect, useCallback } from 'react';
import { Voucher, Outlet, Stats, VoucherType, UseVoucherStoreReturn } from '../types';
import { getTodayDateString } from '../services/util';
import { supabase } from '../services/supabaseClient';

export const useVoucherStore = (): UseVoucherStoreReturn => {
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isClaimEnabled, setIsClaimEnabled] = useState<boolean>(true); 
  
  const [poolStats, setPoolStats] = useState({
    digitalTotal: 0,
    physicalTotal: 0
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
      isRedeemed: data.is_redeemed,
      redeemedDate: data.redeemed_date,
      redeemedOutlet: data.redeemed_outlet,
      type: data.type,
      discountAmount: data.discount_amount, // Map discount amount
      notes: data.notes
  });

  const fetchData = useCallback(async () => {
      setLoading(true);
      try {
          const { data: settingData, error: settingError } = await supabase
            .from('app_settings')
            .select('value')
            .eq('key', 'claim_enabled')
            .maybeSingle();

          if (!settingError && settingData) {
              setIsClaimEnabled(settingData.value === 'true');
          }

          const { data: voucherData, error: voucherError } = await supabase
              .from('vouchers')
              .select('*')
              .order('claim_date', { ascending: false });
          
          if (voucherError) throw voucherError;

          const mappedVouchers = (voucherData || []).map(mapDbToVoucher);
          setVouchers(mappedVouchers);

          const { count: digitalCount } = await supabase
             .from('voucher_pool')
             .select('*', { count: 'exact', head: true })
             .eq('type', 'DIGITAL');
          
          const { count: physicalCount } = await supabase
             .from('voucher_pool')
             .select('*', { count: 'exact', head: true })
             .eq('type', 'PHYSICAL');

          setPoolStats({
              digitalTotal: digitalCount || 0,
              physicalTotal: physicalCount || 0
          });

      } catch (err: any) {
          console.error("Error fetching data:", err);
          setError("Gagal memuat data dari server.");
      } finally {
          setLoading(false);
      }
  }, []);

  useEffect(() => {
    fetchData();
    
    const channelVoucher = supabase
    .channel('public:vouchers')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'vouchers' }, () => {
        fetchData(); 
    })
    .subscribe();

    const channelSettings = supabase
    .channel('public:app_settings')
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'app_settings' }, (payload) => {
        if (payload.new && payload.new.key === 'claim_enabled') {
            const isEnabled = payload.new.value === 'true';
            setIsClaimEnabled(isEnabled);
        }
    })
    .subscribe();

    return () => { 
        supabase.removeChannel(channelVoucher); 
        supabase.removeChannel(channelSettings);
    };
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
    
        const claimedDigital = vouchers.filter(v => v.type === 'DIGITAL').length;
        const redeemedPhysical = vouchers.filter(v => v.type === 'PHYSICAL').length;
    
        setStats({
          totalClaims: vouchers.length,
          totalRedeemed: vouchers.filter(v => v.isRedeemed).length,
          claimsToday: vouchers.filter(v => v.claimDate.startsWith(today)).length,
          claimsByOutlet,
          claimsPerDay,
          totalDigitalVouchers: poolStats.digitalTotal, 
          claimedDigitalVouchers: claimedDigital,
          totalPhysicalVouchers: poolStats.physicalTotal,
          redeemedPhysicalVouchers: redeemedPhysical,
        });
    }
  }, [vouchers, loading, poolStats]);


  const loadCodes = async (codes: string[], type: VoucherType, discountAmount?: number) => {
    setError(null);
    try {
        const payload = codes.map(code => ({
            code: code.trim(),
            type: type,
            is_used: false,
            discount_amount: type === 'DIGITAL' ? (discountAmount || 10000) : null
        }));

        const { error } = await supabase
            .from('voucher_pool')
            .upsert(payload, { onConflict: 'code', ignoreDuplicates: true });

        if (error) throw error;

        alert(`${codes.length} kode untuk voucher ${type === 'DIGITAL' ? 'Digital' : 'Fisik'} berhasil diunggah!`);
        fetchData(); 

    } catch (err: any) {
        console.error("Upload error:", err);
        setError(`Gagal mengunggah kode: ${err.message}`);
    }
  }

  const toggleClaimStatus = async (status: boolean) => {
      try {
          const { error } = await supabase
            .from('app_settings')
            .upsert({ key: 'claim_enabled', value: String(status) });
          
          if (error) throw error;
          
          setIsClaimEnabled(status);
      } catch (err: any) {
          console.error("Gagal mengubah status klaim:", err);
          alert("Gagal mengubah status klaim.");
      }
  }

  const claimVoucher = async (data: Omit<Voucher, 'id' | 'voucherCode' | 'claimDate' | 'isRedeemed' | 'type' | 'redeemedDate' | 'redeemedOutlet' | 'discountAmount'>): Promise<Voucher> => {
    setError(null);

    // Cek State Lokal
    if (!isClaimEnabled) {
        throw new Error("Mohon maaf, periode klaim voucher belum dibuka atau sudah ditutup.");
    }

    try {
        // Double Check Server Side (Untuk menangani kondisi user belum refresh / realtime delay)
        const { data: settingData } = await supabase
            .from('app_settings')
            .select('value')
            .eq('key', 'claim_enabled')
            .maybeSingle();
        
        if (settingData && settingData.value !== 'true') {
            setIsClaimEnabled(false); // Paksa update state lokal
            throw new Error("Mohon maaf, periode klaim voucher sudah ditutup.");
        }

        const { data: existingUser } = await supabase
            .from('vouchers')
            .select('id')
            .eq('whatsapp_number', data.whatsappNumber)
            .limit(1);
            
        if (existingUser && existingUser.length > 0) {
             throw new Error('Nomor WhatsApp ini sudah pernah mengklaim voucher.');
        }

        // --- LOGIKA GACHA / RANDOM PICK ---
        // 1. Hitung jumlah kode yang tersedia
        const { count, error: countError } = await supabase
            .from('voucher_pool')
            .select('*', { count: 'exact', head: true })
            .eq('type', 'DIGITAL')
            .eq('is_used', false);
        
        if (countError) throw countError;
        if (count === null || count === 0) {
            throw new Error('Maaf, semua voucher digital sudah habis diklaim.');
        }

        // 2. Generate random offset
        const randomOffset = Math.floor(Math.random() * count);

        // 3. Ambil 1 kode di posisi random tersebut
        const { data: freeCode, error: codeError } = await supabase
            .from('voucher_pool')
            .select('id, code, discount_amount')
            .eq('type', 'DIGITAL')
            .eq('is_used', false)
            .range(randomOffset, randomOffset)
            .maybeSingle(); 

        if (codeError) throw codeError;
        if (!freeCode) {
            // Fallback jika terjadi race condition saat pengambilan random
            throw new Error('Gagal mengambil kode voucher. Silakan coba lagi.');
        }

        const { error: updateError } = await supabase
            .from('voucher_pool')
            .update({ is_used: true })
            .eq('id', freeCode.id);
        
        if (updateError) throw new Error("Terjadi kesalahan saat mengambil kode.");

        const newVoucherPayload = {
            full_name: data.fullName,
            birth_year: data.birthYear,
            whatsapp_number: data.whatsappNumber,
            outlet: data.outlet,
            voucher_code: freeCode.code,
            discount_amount: freeCode.discount_amount || 10000,
            claim_date: new Date().toISOString(),
            is_redeemed: false,
            type: 'DIGITAL'
        };

        const { data: insertedVoucher, error: insertError } = await supabase
            .from('vouchers')
            .insert(newVoucherPayload)
            .select()
            .single();

        if (insertError) {
             if (insertError.code === '23505') {
                 throw new Error('Nomor WhatsApp ini sudah pernah mengklaim voucher.');
             }
             throw insertError;
        }

        const mappedVoucher = mapDbToVoucher(insertedVoucher);
        setVouchers(prev => [mappedVoucher, ...prev]);
        
        return mappedVoucher;

    } catch (err: any) {
        setError(err.message);
        throw err;
    }
  };

  const redeemVoucher = async (voucherIdentifier: string, redeemedOutlet: Outlet): Promise<Voucher> => {
    setError(null);
    const cleanIdentifier = voucherIdentifier.trim();

    try {
        const { data: foundVoucher, error: findError } = await supabase
            .from('vouchers')
            .select('*')
            .eq('type', 'DIGITAL')
            .or(`voucher_code.eq.${cleanIdentifier},whatsapp_number.eq.${cleanIdentifier}`)
            .limit(1)
            .maybeSingle();

        if (findError) throw findError;

        if (!foundVoucher) {
            throw new Error('Voucher digital tidak ditemukan. Pastikan Kode Voucher atau Nomor WhatsApp sudah benar.');
        }

        if (foundVoucher.is_redeemed) {
            throw new Error('Voucher ini sudah pernah ditukarkan sebelumnya.');
        }

        const { data: updatedData, error: updateError } = await supabase
            .from('vouchers')
            .update({
                is_redeemed: true,
                redeemed_date: new Date().toISOString(),
                redeemed_outlet: redeemedOutlet
            })
            .eq('id', foundVoucher.id)
            .select()
            .single();

        if (updateError) throw updateError;

        const mapped = mapDbToVoucher(updatedData);
        setVouchers(prev => prev.map(v => v.id === mapped.id ? mapped : v));
        return mapped;

    } catch (err: any) {
        setError(err.message);
        throw err;
    }
  };
  
  const recordPhysicalVoucher = async (data: Omit<Voucher, 'id' | 'claimDate' | 'isRedeemed' | 'type' | 'redeemedDate' | 'redeemedOutlet' | 'discountAmount'>): Promise<Voucher> => {
      setError(null);
      const code = data.voucherCode.trim();

      try {
        const { data: poolCode, error: poolError } = await supabase
            .from('voucher_pool')
            .select('*')
            .eq('type', 'PHYSICAL')
            .eq('code', code)
            .maybeSingle();
        
        if (poolError) throw poolError;
        
        if (!poolCode) {
            throw new Error('Kode voucher fisik tidak valid (tidak ditemukan di database).');
        }

        if (poolCode.is_used) {
            throw new Error('Voucher fisik ini sudah pernah tercatat/digunakan.');
        }

        await supabase.from('voucher_pool').update({ is_used: true }).eq('id', poolCode.id);

        const payload = {
            gender: data.gender,
            whatsapp_number: data.whatsappNumber,
            outlet: data.outlet,
            voucher_code: code,
            claim_date: new Date().toISOString(),
            redeemed_date: new Date().toISOString(), 
            is_redeemed: true,
            redeemed_outlet: data.outlet,
            type: 'PHYSICAL'
        };

        const { data: inserted, error: insertError } = await supabase
            .from('vouchers')
            .insert(payload)
            .select()
            .single();

        if (insertError) throw insertError;

        const mapped = mapDbToVoucher(inserted);
        setVouchers(prev => [mapped, ...prev]);
        return mapped;

      } catch (err: any) {
          setError(err.message);
          throw err;
      }
  }

  const resetData = async () => {
    if (window.confirm('PERINGATAN: Ini akan MENGHAPUS SEMUA data. Lanjutkan?')) {
        try {
            const { error: err1 } = await supabase.from('vouchers').delete().neq('id', '00000000-0000-0000-0000-000000000000'); 
            const { error: err2 } = await supabase.from('voucher_pool').delete().neq('id', '00000000-0000-0000-0000-000000000000');
            if (err1 || err2) throw new Error("Gagal menghapus data.");
            alert('Database berhasil di-reset.');
            fetchData();
        } catch (e: any) {
            console.error("Failed to reset:", e);
        }
    }
  };

  const getVouchers = () => {
    return vouchers;
  };

  return { vouchers, loading, error, stats, isClaimEnabled, toggleClaimStatus, claimVoucher, redeemVoucher, recordPhysicalVoucher, loadCodes, getVouchers, resetData };
};
