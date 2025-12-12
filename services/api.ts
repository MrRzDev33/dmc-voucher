import { Voucher, VoucherType, User } from '../types';
import { supabase } from './supabaseClient';
import mockApi from './mockdb';
import { generateVoucherCode } from './util';

// ============================================================================
// KONFIGURASI KONEKSI DATABASE
// ============================================================================

// Jika supabase belum dikonfigurasi di supabaseClient.ts, gunakan MOCK DATA.
const USE_MOCK = !supabase;

// ============================================================================

const supabaseApi = {
    async login(username: string, password: string): Promise<User | null> {
        if (!supabase) return mockApi.login(username, password);
        
        try {
            // MENGGUNAKAN TABEL 'app_users'
            const { data, error } = await supabase
                .from('app_users')
                .select('*')
                .eq('username', username)
                .single();

            if (error) throw error;
            if (!data) return null;

            // Validasi password sederhana
            if (data.password === password) {
                return {
                    id: data.id,
                    username: data.username,
                    role: data.role,
                    outlet: data.outlet
                };
            }
            return null;
        } catch (err: any) {
            console.warn("Supabase login failed (likely network), using mock fallback.", err);
            return mockApi.login(username, password);
        }
    },

    async getSettings(key: string): Promise<{ setting_value: string }> {
        if (!supabase) return { setting_value: 'true' };
        
        try {
            const { data, error } = await supabase
                .from('app_settings')
                .select('value')
                .eq('key', key)
                .single();
                
            const defaultValue = key === 'daily_limit' ? '1000' : 'true';
            
            if (error) throw error;
            if (!data) return { setting_value: defaultValue };
            
            return { setting_value: data.value };
        } catch (e) {
            console.warn(`Error fetching setting ${key}, using fallback/mock.`, e);
            // Fallback to mock settings if DB fails
            return mockApi.getSettings(key);
        }
    },

    async updateSetting(key: string, value: string): Promise<{ success: boolean }> {
        if (!supabase) return mockApi.updateSetting(key, value);
        
        try {
            // Cara Aman: Cek dulu apakah row ada, baru Update atau Insert.
            const { data: existing, error: checkError } = await supabase
                .from('app_settings')
                .select('id')
                .eq('key', key)
                .maybeSingle();

            if (checkError) throw checkError;

            if (existing) {
                const { error } = await supabase
                    .from('app_settings')
                    .update({ value: value })
                    .eq('key', key);
                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('app_settings')
                    .insert({ key: key, value: value });
                if (error) throw error;
            }
            
            return { success: true };
        } catch (err: any) {
            console.warn("Update setting failed, using mock fallback.", err);
            return mockApi.updateSetting(key, value);
        }
    },

    async getVouchers(): Promise<any[]> {
        if (!supabase) return mockApi.getVouchers();
        
        // PERBAIKAN: Menggunakan Loop Pagination untuk memastikan SEMUA data terambil
        // Supabase memiliki limit default 1000 row per request.
        let allVouchers: any[] = [];
        const pageSize = 1000;
        let from = 0;
        let more = true;

        try {
            while (more) {
                const { data, error } = await supabase
                    .from('vouchers')
                    .select('*')
                    .order('claim_date', { ascending: false })
                    .range(from, from + pageSize - 1);

                if (error) throw error;

                if (data && data.length > 0) {
                    allVouchers = [...allVouchers, ...data];
                    
                    // Jika data yang diterima kurang dari pageSize, berarti ini halaman terakhir
                    if (data.length < pageSize) {
                        more = false;
                    } else {
                        from += pageSize;
                    }
                } else {
                    more = false;
                }
                
                // Safety break untuk mencegah infinite loop jika data sangat besar
                if (from > 50000) more = false; 
            }
            
            return allVouchers;
        } catch (err: any) {
            console.warn("Get vouchers failed, using mock fallback.", err);
            return mockApi.getVouchers();
        }
    },

    async getPoolStats(type: VoucherType): Promise<{ count: number }> {
        if (!supabase) return mockApi.getPoolStats(type);
        
        try {
            const { count, error } = await supabase
                .from('voucher_pool')
                .select('*', { count: 'exact', head: true })
                .eq('type', type);

            if (error) throw error;
            return { count: count || 0 };
        } catch (error) {
            console.warn("Get pool stats failed, using mock fallback.", error);
            return mockApi.getPoolStats(type);
        }
    },

    async getDashboardStats(): Promise<{ claimedDigital: number, redeemedDigital: number, redeemedPhysical: number }> {
        if (!supabase) return mockApi.getDashboardStats();
        
        try {
            const [claimedDig, redeemedDig, redeemedPhys] = await Promise.all([
                supabase.from('vouchers').select('*', { count: 'exact', head: true }).eq('type', 'DIGITAL'),
                supabase.from('vouchers').select('*', { count: 'exact', head: true }).eq('type', 'DIGITAL').eq('is_redeemed', true),
                supabase.from('vouchers').select('*', { count: 'exact', head: true }).eq('type', 'PHYSICAL').eq('is_redeemed', true)
            ]);

            return {
                claimedDigital: claimedDig.count || 0,
                redeemedDigital: redeemedDig.count || 0,
                redeemedPhysical: redeemedPhys.count || 0
            };
        } catch (err) {
            console.error("Error getting dashboard stats", err);
            // Return 0 if fails, UI will show 0 or loading
            return { claimedDigital: 0, redeemedDigital: 0, redeemedPhysical: 0 };
        }
    },

    async claimVoucher(data: any): Promise<Voucher> {
        if (!supabase) return mockApi.claimVoucher(data);

        // 0. CEK LIMIT HARIAN
        let dailyLimit = 1000;
        try {
            const { data: limitData } = await supabase
                .from('app_settings')
                .select('value')
                .eq('key', 'daily_limit')
                .maybeSingle();
            
            if (limitData && limitData.value) {
                dailyLimit = parseInt(limitData.value);
            }
        } catch (err) {
            console.warn("Gagal membaca daily_limit, lanjut dengan default.", err);
        }

        try {
            // Hitung klaim hari ini
            const todayStr = new Date().toISOString().split('T')[0];
            const { count: claimsToday, error: countError } = await supabase
                .from('vouchers')
                .select('*', { count: 'exact', head: true })
                .gte('claim_date', `${todayStr}T00:00:00`)
                .lte('claim_date', `${todayStr}T23:59:59`)
                .eq('type', 'DIGITAL'); 

            if (countError) throw countError;

            if (typeof claimsToday === 'number') {
                if (claimsToday >= dailyLimit) {
                    throw new Error(`Mohon maaf, kuota voucher harian (${dailyLimit}) sudah habis.`);
                }
            }

            // 1. Cek Duplikat Nomor WA
            const { data: existing, error: dupError } = await supabase
                .from('vouchers')
                .select('id')
                .eq('whatsapp_number', data.whatsapp_number)
                .maybeSingle();

            if (dupError) throw dupError;

            if (existing) {
                throw new Error("Nomor WhatsApp ini sudah pernah mengklaim voucher.");
            }

            // 2. Ambil Kode Voucher yang tersedia
            let voucherCode = '';
            let discount = 10000;
            let poolId = null;

            const { data: codeData } = await supabase
                .from('voucher_pool')
                .select('*')
                .eq('is_used', false)
                .eq('type', 'DIGITAL')
                .limit(1)
                .maybeSingle();

            if (codeData) {
                voucherCode = codeData.code;
                discount = codeData.discount_amount;
                poolId = codeData.id;

                const { error: updateError } = await supabase
                    .from('voucher_pool')
                    .update({ is_used: true })
                    .eq('id', poolId);

                if (updateError) {
                    console.warn("Concurrency issue on voucher pool, falling back to generated code.");
                    voucherCode = generateVoucherCode();
                    discount = 10000;
                }
            } else {
                voucherCode = generateVoucherCode();
                discount = 10000;
            }

            // 3. Masukkan data Klaim Voucher
            const { data: newVoucher, error: insertError } = await supabase
                .from('vouchers')
                .insert({
                    full_name: data.full_name,
                    birth_year: data.birth_year,
                    whatsapp_number: data.whatsapp_number,
                    outlet: data.outlet,
                    voucher_code: voucherCode,
                    type: 'DIGITAL',
                    discount_amount: discount,
                    claim_date: new Date().toISOString(),
                    is_redeemed: false
                })
                .select()
                .single();

            if (insertError) throw insertError;
            
            return newVoucher;

        } catch (err: any) {
            // Jika error adalah Fetch/Network, fallback ke Mock agar user tetap bisa "mencoba" app
            if (err.message === 'Failed to fetch' || err.message === 'NetworkError' || err.name === 'TypeError') {
                console.warn("Supabase claim failed (Network), using Mock fallback.", err);
                return mockApi.claimVoucher(data);
            }
            // Jika error logic (kuota habis/duplikat), throw error asli
            throw new Error(err.message || "Gagal klaim voucher.");
        }
    },

    async redeemVoucher(identifier: string, outlet: string): Promise<Voucher> {
        if (!supabase) return mockApi.redeemVoucher(identifier, outlet);

        try {
            // PERBAIKAN: Ambil semua yang cocok, jangan pakai maybeSingle.
            // Ini untuk menangani kasus jika ada data duplikat atau history lama.
            const { data: candidates, error: fetchError } = await supabase
                .from('vouchers')
                .select('*')
                .or(`voucher_code.eq.${identifier},whatsapp_number.eq.${identifier}`)
                .eq('type', 'DIGITAL');

            if (fetchError) throw fetchError;
            
            if (!candidates || candidates.length === 0) {
                throw new Error("Voucher tidak ditemukan. Pastikan kode atau nomor WhatsApp benar.");
            }

            // Cari voucher yang BELUM diredeem
            let targetVoucher = candidates.find(v => !v.is_redeemed);

            // Jika semua sudah diredeem, ambil yang pertama untuk menampilkan pesan error yang informatif
            if (!targetVoucher) {
                 targetVoucher = candidates[0];
                 if (targetVoucher.is_redeemed) {
                     const tgl = targetVoucher.redeemed_date ? new Date(targetVoucher.redeemed_date).toLocaleDateString('id-ID') : '-';
                     const out = targetVoucher.redeemed_outlet || '-';
                     throw new Error(`Voucher atas nama ${targetVoucher.full_name} sudah ditukarkan pada ${tgl} di ${out}.`);
                 }
            }

            const { data: updatedVoucher, error: updateError } = await supabase
                .from('vouchers')
                .update({ 
                    is_redeemed: true, 
                    redeemed_date: new Date().toISOString(),
                    redeemed_outlet: outlet
                })
                .eq('id', targetVoucher.id) // Update spesifik ID
                .select()
                .single();

            if (updateError) throw updateError;
            return updatedVoucher;
        } catch (err: any) {
             if (err.message === 'Failed to fetch' || err.name === 'TypeError') {
                 console.warn("Redeem failed (Network), using Mock.", err);
                 return mockApi.redeemVoucher(identifier, outlet);
             }
             throw new Error(err.message);
        }
    },

    async recordPhysical(data: any): Promise<Voucher> {
        if (!supabase) return mockApi.recordPhysical(data);

        try {
            const { data: newVoucher, error } = await supabase
                .from('vouchers')
                .insert({
                    gender: data.gender,
                    whatsapp_number: data.whatsapp_number,
                    outlet: data.outlet,
                    voucher_code: data.voucher_code,
                    type: 'PHYSICAL',
                    claim_date: new Date().toISOString(),
                    is_redeemed: true, 
                    redeemed_date: new Date().toISOString(),
                    redeemed_outlet: data.outlet
                })
                .select()
                .single();

            if (error) throw error;
            return newVoucher;
        } catch (err: any) {
             if (err.message === 'Failed to fetch' || err.name === 'TypeError') {
                 console.warn("Record physical failed (Network), using Mock.", err);
                 return mockApi.recordPhysical(data);
             }
             throw new Error(err.message);
        }
    },

    async uploadCodes(codes: string[], type: VoucherType, discountAmount?: number): Promise<{ success: boolean, count: number }> {
        if (!supabase) return mockApi.uploadCodes(codes, type, discountAmount);
        
        try {
            const rows = codes.map(code => ({
                code: code.trim(),
                type,
                discount_amount: discountAmount || 10000,
                is_used: false
            }));

            const { error } = await supabase
                .from('voucher_pool')
                .insert(rows);

            if (error) throw error;
            return { success: true, count: codes.length };
        } catch (err: any) {
            console.warn("Upload codes failed (Network), using Mock.", err);
            return mockApi.uploadCodes(codes, type, discountAmount);
        }
    },

    async resetData(): Promise<{ success: boolean }> {
        if (!supabase) return mockApi.resetData();

        try {
            await supabase.from('vouchers').delete().neq('id', 0);
            await supabase.from('voucher_pool').update({ is_used: false }).neq('id', 0);
            return { success: true };
        } catch (err) {
             console.warn("Reset failed (Network), using Mock.", err);
             return mockApi.resetData();
        }
    }
};

// Gunakan Mock API jika Supabase belum disetting, gunakan Real API jika sudah.
export const api = USE_MOCK ? mockApi : supabaseApi;
