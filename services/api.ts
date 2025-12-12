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
            console.log("Attempting login via Supabase...");
            const { data, error } = await supabase
                .from('app_users')
                .select('*')
                .eq('username', username)
                .single();

            if (error && error.code === 'PGRST116') {
                console.warn("User not found in database.");
                return null;
            }

            if (error) throw error;
            if (!data) return null;

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
            console.error("Database Login Error:", err);
            // Jangan fallback ke mock untuk login agar keamanan terjaga
            return null;
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
            
            if (error && error.code === 'PGRST116') {
                 return { setting_value: defaultValue };
            }

            if (error) throw error;
            if (!data) return { setting_value: defaultValue };
            
            return { setting_value: data.value };
        } catch (e) {
            console.warn(`Error fetching setting ${key}`, e);
            return { setting_value: key === 'daily_limit' ? '1000' : 'true' };
        }
    },

    async updateSetting(key: string, value: string): Promise<{ success: boolean }> {
        if (!supabase) return mockApi.updateSetting(key, value);
        
        try {
            const { data: existing, error: checkError } = await supabase
                .from('app_settings')
                .select('key')
                .eq('key', key)
                .maybeSingle();

            if (checkError) throw checkError;

            let operationError;

            if (existing) {
                const { error } = await supabase
                    .from('app_settings')
                    .update({ value: value })
                    .eq('key', key);
                operationError = error;
            } else {
                const { error } = await supabase
                    .from('app_settings')
                    .insert({ key: key, value: value });
                operationError = error;
            }

            if (operationError) throw operationError;
            return { success: true };

        } catch (err: any) {
            console.error("Update setting failed:", err);
            throw new Error(err.message || "Gagal update database.");
        }
    },

    async getVouchers(): Promise<any[]> {
        if (!supabase) return mockApi.getVouchers();
        
        let allVouchers: any[] = [];
        const pageSize = 1000;
        let from = 0;
        let more = true;

        try {
            // Kita loop untuk mengambil semua data jika lebih dari 1000
            while (more) {
                const { data, error } = await supabase
                    .from('vouchers')
                    .select('*')
                    .order('claim_date', { ascending: false })
                    .range(from, from + pageSize - 1);

                if (error) throw error;

                if (data && data.length > 0) {
                    allVouchers = [...allVouchers, ...data];
                    if (data.length < pageSize) {
                        more = false;
                    } else {
                        from += pageSize;
                    }
                } else {
                    more = false;
                }
                
                // Safety break
                if (from > 50000) more = false; 
            }
            return allVouchers;
        } catch (err: any) {
            console.error("CRITICAL: Failed to fetch vouchers from Supabase.", err);
            // HAPUS FALLBACK KE MOCK. Biarkan error muncul agar user sadar koneksi bermasalah.
            throw new Error("Gagal mengambil data dari Database. Periksa koneksi internet Anda.");
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
            console.error("Error getting pool stats:", error);
            // Return 0 is safer than mock data here
            return { count: 0 };
        }
    },

    async getDashboardStats(): Promise<{ claimedDigital: number, redeemedDigital: number, redeemedPhysical: number, todayClaimedDigital: number }> {
        if (!supabase) return mockApi.getDashboardStats();
        try {
            const todayStr = new Date().toISOString().split('T')[0];

            const [claimedDig, redeemedDig, redeemedPhys, todayDig] = await Promise.all([
                supabase.from('vouchers').select('*', { count: 'exact', head: true }).eq('type', 'DIGITAL'),
                supabase.from('vouchers').select('*', { count: 'exact', head: true }).eq('type', 'DIGITAL').eq('is_redeemed', true),
                supabase.from('vouchers').select('*', { count: 'exact', head: true }).eq('type', 'PHYSICAL').eq('is_redeemed', true),
                supabase.from('vouchers')
                    .select('*', { count: 'exact', head: true })
                    .eq('type', 'DIGITAL')
                    .gte('claim_date', `${todayStr}T00:00:00`)
                    .lte('claim_date', `${todayStr}T23:59:59`)
            ]);

            return {
                claimedDigital: claimedDig.count || 0,
                redeemedDigital: redeemedDig.count || 0,
                redeemedPhysical: redeemedPhys.count || 0,
                todayClaimedDigital: todayDig.count || 0
            };
        } catch (err) {
            console.error("Error fetching dashboard stats:", err);
            // Jangan return object kosong/nol jika error, lempar error agar UI menampilkan status loading/gagal
            throw new Error("Gagal memuat statistik dashboard.");
        }
    },

    async claimVoucher(data: any): Promise<Voucher> {
        if (!supabase) return mockApi.claimVoucher(data);

        // 1. LIMIT HARIAN
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
        } catch (err) {}

        try {
            // 2. CEK KUOTA HARI INI
            const todayStr = new Date().toISOString().split('T')[0];
            const { count: claimsToday, error: countError } = await supabase
                .from('vouchers')
                .select('*', { count: 'exact', head: true })
                .gte('claim_date', `${todayStr}T00:00:00`)
                .lte('claim_date', `${todayStr}T23:59:59`)
                .eq('type', 'DIGITAL');

            if (countError) throw countError;

            if (typeof claimsToday === 'number' && claimsToday >= dailyLimit) {
                throw new Error(`Mohon maaf, kuota voucher harian (${dailyLimit}) untuk hari ini sudah habis.`);
            }

            // 3. CEK DUPLIKASI USER
            const { data: existing, error: dupError } = await supabase
                .from('vouchers')
                .select('id')
                .eq('whatsapp_number', data.whatsapp_number)
                .maybeSingle();

            if (dupError) throw dupError;
            if (existing) throw new Error("Nomor WhatsApp ini sudah pernah mengklaim voucher.");

            // 4. AMBIL KODE DARI POOL
            let voucherCode = '';
            let discount = 10000;
            let poolId = null;

            const { data: codeData, error: poolError } = await supabase
                .from('voucher_pool')
                .select('*')
                .eq('is_used', false)
                .eq('type', 'DIGITAL')
                .limit(1)
                .maybeSingle();

            if (poolError) throw poolError;

            if (codeData) {
                voucherCode = codeData.code;
                discount = codeData.discount_amount;
                poolId = codeData.id;

                const { error: updatePoolError } = await supabase
                    .from('voucher_pool')
                    .update({ is_used: true })
                    .eq('id', poolId);
                
                if (updatePoolError) throw new Error("Gagal mengupdate pool.");
            } else {
                throw new Error("Mohon maaf, stok voucher Digital saat ini sudah habis.");
            }

            // 5. INSERT DATA
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

            if (insertError) {
                if (poolId) await supabase.from('voucher_pool').update({ is_used: false }).eq('id', poolId);
                throw insertError;
            }

            return newVoucher;

        } catch (err: any) {
            throw new Error(err.message || "Gagal klaim voucher.");
        }
    },

    async redeemVoucher(identifier: string, outlet: string): Promise<Voucher> {
        if (!supabase) return mockApi.redeemVoucher(identifier, outlet);

        try {
            const { data: candidates, error: fetchError } = await supabase
                .from('vouchers')
                .select('*')
                .or(`voucher_code.eq.${identifier},whatsapp_number.eq.${identifier}`)
                .eq('type', 'DIGITAL');

            if (fetchError) throw fetchError;
            
            if (!candidates || candidates.length === 0) {
                throw new Error("Voucher tidak ditemukan.");
            }

            let targetVoucher = candidates.find(v => !v.is_redeemed);
            if (!targetVoucher) {
                 targetVoucher = candidates[0];
                 if (targetVoucher.is_redeemed) throw new Error(`Voucher sudah ditukarkan.`);
            }

            const { data: updatedVoucher, error: updateError } = await supabase
                .from('vouchers')
                .update({ 
                    is_redeemed: true, 
                    redeemed_date: new Date().toISOString(),
                    redeemed_outlet: outlet
                })
                .eq('id', targetVoucher.id)
                .select()
                .single();

            if (updateError) throw updateError;
            return updatedVoucher;
        } catch (err: any) {
             throw new Error(err.message);
        }
    },

    async recordPhysical(data: any): Promise<Voucher> {
        if (!supabase) return mockApi.recordPhysical(data);
        try {
            const { data: existing, error: checkError } = await supabase
                .from('vouchers')
                .select('id')
                .eq('voucher_code', data.voucher_code)
                .maybeSingle();

            if (checkError) throw checkError;
            
            if (existing) {
                throw new Error(`Gagal: Kode voucher fisik '${data.voucher_code}' sudah tercatat/digunakan sebelumnya.`);
            }

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
            const { error } = await supabase.from('voucher_pool').insert(rows);
            if (error) throw error;
            return { success: true, count: codes.length };
        } catch (err: any) {
            throw new Error("Gagal upload ke Database: " + err.message);
        }
    },

    async resetData(): Promise<{ success: boolean }> {
        if (!supabase) return mockApi.resetData();
        try {
            await supabase.from('vouchers').delete().neq('id', 0);
            await supabase.from('voucher_pool').update({ is_used: false }).neq('id', 0);
            return { success: true };
        } catch (err) {
             throw err;
        }
    }
};

export const api = USE_MOCK ? mockApi : supabaseApi;
