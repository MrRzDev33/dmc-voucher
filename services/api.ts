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
            if (err.message === 'Failed to fetch' || err.name === 'TypeError') {
                 console.warn("Supabase login failed (Network Error), switching to Offline Mode.", err);
                 return mockApi.login(username, password);
            }
            console.error("Database Login Error:", err);
            return null;
        }
    },

    async getSettings(key: string): Promise<{ setting_value: string }> {
        if (!supabase) return { setting_value: 'true' };
        
        try {
            // Menggunakan nama kolom 'setting_key' dan 'setting_value' sesuai database
            const { data, error } = await supabase
                .from('app_settings')
                .select('setting_value')
                .eq('setting_key', key)
                .single();
                
            const defaultValue = key === 'daily_limit' ? '1000' : 'true';
            
            if (error && error.code === 'PGRST116') {
                 return { setting_value: defaultValue };
            }

            if (error) throw error;
            if (!data) return { setting_value: defaultValue };
            
            return { setting_value: data.setting_value };
        } catch (e) {
            console.warn(`Error fetching setting ${key}`, e);
            return { setting_value: key === 'daily_limit' ? '1000' : 'true' };
        }
    },

    async updateSetting(key: string, value: string): Promise<{ success: boolean }> {
        if (!supabase) return mockApi.updateSetting(key, value);
        
        try {
            // 1. Cek apakah setting sudah ada (Select terlebih dahulu)
            const { data: existing, error: checkError } = await supabase
                .from('app_settings')
                .select('setting_key')
                .eq('setting_key', key)
                .maybeSingle();

            if (checkError) throw checkError;

            let operationError;

            if (existing) {
                // 2. Jika ada, lakukan UPDATE
                console.log(`Updating setting ${key} to ${value}...`);
                const { error } = await supabase
                    .from('app_settings')
                    .update({ setting_value: value })
                    .eq('setting_key', key);
                operationError = error;
            } else {
                // 3. Jika tidak ada, lakukan INSERT
                console.log(`Inserting setting ${key} to ${value}...`);
                const { error } = await supabase
                    .from('app_settings')
                    .insert({ setting_key: key, setting_value: value });
                operationError = error;
            }

            if (operationError) throw operationError;
            
            return { success: true };

        } catch (err: any) {
            console.error("Update setting failed:", err);
            // Kembalikan pesan error asli dari database agar user tahu penyebabnya (misal: RLS Policy)
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
                if (from > 50000) more = false; 
            }
            return allVouchers;
        } catch (err: any) {
            console.warn("Get vouchers failed, checking connection...", err);
            if (err.message === 'Failed to fetch') return mockApi.getVouchers();
            throw err;
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
            return { count: 0 };
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
            return { claimedDigital: 0, redeemedDigital: 0, redeemedPhysical: 0 };
        }
    },

    async claimVoucher(data: any): Promise<Voucher> {
        if (!supabase) return mockApi.claimVoucher(data);

        // 0. CEK LIMIT HARIAN (Perbaikan nama kolom)
        let dailyLimit = 1000;
        try {
            const { data: limitData } = await supabase
                .from('app_settings')
                .select('setting_value')
                .eq('setting_key', 'daily_limit')
                .maybeSingle();

            if (limitData && limitData.setting_value) {
                dailyLimit = parseInt(limitData.setting_value);
            }
        } catch (err) {}

        try {
            const todayStr = new Date().toISOString().split('T')[0];
            const { count: claimsToday, error: countError } = await supabase
                .from('vouchers')
                .select('*', { count: 'exact', head: true })
                .gte('claim_date', `${todayStr}T00:00:00`)
                .lte('claim_date', `${todayStr}T23:59:59`)
                .eq('type', 'DIGITAL'); 

            if (countError) throw countError;

            if (typeof claimsToday === 'number' && claimsToday >= dailyLimit) {
                throw new Error(`Mohon maaf, kuota voucher harian (${dailyLimit}) sudah habis.`);
            }

            // 1. Cek Duplikat
            const { data: existing, error: dupError } = await supabase
                .from('vouchers')
                .select('id')
                .eq('whatsapp_number', data.whatsapp_number)
                .maybeSingle();

            if (dupError) throw dupError;
            if (existing) throw new Error("Nomor WhatsApp ini sudah pernah mengklaim voucher.");

            // 2. Ambil Kode
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
                await supabase.from('voucher_pool').update({ is_used: true }).eq('id', poolId);
            } else {
                voucherCode = generateVoucherCode();
            }

            // 3. Insert Data
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
            // HANYA fallback ke mock jika benar-benar mati koneksi internetnya
            if (err.message === 'Failed to fetch' || err.message === 'NetworkError') {
                return mockApi.claimVoucher(data);
            }
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
