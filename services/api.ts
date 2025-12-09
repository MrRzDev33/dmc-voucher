
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
        if (!supabase) return null;
        
        // MENGGUNAKAN TABEL 'app_users' SESUAI SCREENSHOT
        const { data, error } = await supabase
            .from('app_users')
            .select('*')
            .eq('username', username)
            .single();

        if (error || !data) return null;

        // Validasi password sederhana (untuk production disarankan hashing)
        if (data.password === password) {
            return {
                id: data.id,
                username: data.username,
                role: data.role,
                outlet: data.outlet
            };
        }
        return null;
    },

    async getSettings(key: string): Promise<{ setting_value: string }> {
        if (!supabase) return { setting_value: 'true' };
        
        try {
            // Coba ambil menggunakan kolom 'key' dan 'value'
            const { data, error } = await supabase
                .from('app_settings')
                .select('value')
                .eq('key', key)
                .single();
                
            // Default values: claim_enabled = true, daily_limit = 1000
            const defaultValue = key === 'daily_limit' ? '1000' : 'true';
            
            if (error || !data) {
                return { setting_value: defaultValue };
            }
            return { setting_value: data.value };
        } catch (e) {
            console.error("Error fetching setting:", e);
            return { setting_value: key === 'daily_limit' ? '1000' : 'true' };
        }
    },

    async updateSetting(key: string, value: string): Promise<{ success: boolean }> {
        if (!supabase) return { success: false };
        
        try {
            // Cara Aman: Cek dulu apakah row ada, baru Update atau Insert.
            // Ini menghindari error jika kolom 'key' tidak memiliki unique constraint di DB.
            const { data: existing } = await supabase
                .from('app_settings')
                .select('id')
                .eq('key', key)
                .maybeSingle();

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
            throw new Error(err.message || "Gagal menyimpan pengaturan.");
        }
    },

    async getVouchers(): Promise<any[]> {
        if (!supabase) return [];
        
        const { data, error } = await supabase
            .from('vouchers')
            .select('*')
            .order('claim_date', { ascending: false });

        if (error) throw new Error(error.message);
        return data || [];
    },

    async getPoolStats(type: VoucherType): Promise<{ count: number }> {
        if (!supabase) return { count: 0 };
        
        const { count, error } = await supabase
            .from('voucher_pool')
            .select('*', { count: 'exact', head: true })
            .eq('type', type);

        if (error) console.error("Error stats", error);
        return { count: count || 0 };
    },

    async claimVoucher(data: any): Promise<Voucher> {
        if (!supabase) throw new Error("Supabase client not initialized");

        // 0. CEK LIMIT HARIAN (Fitur Baru)
        // Kita keluarkan logic fetch limit agar errornya terlihat jika gagal
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
            console.warn("Gagal membaca daily_limit, menggunakan default 1000.", err);
        }

        // Hitung klaim hari ini
        // Menggunakan waktu server/UTC untuk konsistensi atau handle timezone di client
        // Di sini kita gunakan string comparison 'YYYY-MM-DD' sederhana (UTC-based)
        const todayStr = new Date().toISOString().split('T')[0];
        
        const { count: claimsToday, error: countError } = await supabase
            .from('vouchers')
            .select('*', { count: 'exact', head: true })
            .gte('claim_date', `${todayStr}T00:00:00`)
            .lte('claim_date', `${todayStr}T23:59:59`)
            .eq('type', 'DIGITAL'); 

        // Jika tidak error saat hitung, dan jumlah >= limit, STOP.
        if (!countError && typeof claimsToday === 'number') {
            if (claimsToday >= dailyLimit) {
                throw new Error(`Mohon maaf, kuota voucher harian (${dailyLimit}) sudah habis. Silakan coba lagi besok.`);
            }
        }

        // 1. Cek Duplikat Nomor WA
        const { data: existing } = await supabase
            .from('vouchers')
            .select('id')
            .eq('whatsapp_number', data.whatsapp_number)
            .maybeSingle();

        if (existing) {
            throw new Error("Nomor WhatsApp ini sudah pernah mengklaim voucher.");
        }

        // 2. Ambil Kode Voucher yang tersedia dari 'voucher_pool'
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

            // Mark as used
            const { error: updateError } = await supabase
                .from('voucher_pool')
                .update({ is_used: true })
                .eq('id', poolId);

            if (updateError) {
                // If update fails (e.g. race condition), fallback to generated code
                console.warn("Concurrency issue on voucher pool, falling back to generated code.");
                voucherCode = generateVoucherCode();
                discount = 10000;
            }
        } else {
            // FALLBACK: Auto-generate code if stock is empty
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

        if (insertError) throw new Error(insertError.message);
        
        return newVoucher;
    },

    async redeemVoucher(identifier: string, outlet: string): Promise<Voucher> {
        if (!supabase) throw new Error("Supabase client not initialized");

        // Cari voucher berdasarkan kode ATAU no WA
        const { data: voucher, error: fetchError } = await supabase
            .from('vouchers')
            .select('*')
            .or(`voucher_code.eq.${identifier},whatsapp_number.eq.${identifier}`)
            .eq('type', 'DIGITAL')
            .maybeSingle();

        if (fetchError || !voucher) {
            throw new Error("Voucher tidak ditemukan.");
        }

        if (voucher.is_redeemed) {
            throw new Error("Voucher ini sudah ditukarkan sebelumnya.");
        }

        // Update status redeem
        const { data: updatedVoucher, error: updateError } = await supabase
            .from('vouchers')
            .update({ 
                is_redeemed: true, 
                redeemed_date: new Date().toISOString(),
                redeemed_outlet: outlet
            })
            .eq('id', voucher.id)
            .select()
            .single();

        if (updateError) throw new Error(updateError.message);
        return updatedVoucher;
    },

    async recordPhysical(data: any): Promise<Voucher> {
        if (!supabase) throw new Error("Supabase client not initialized");

        const { data: newVoucher, error } = await supabase
            .from('vouchers')
            .insert({
                gender: data.gender,
                whatsapp_number: data.whatsapp_number,
                outlet: data.outlet,
                voucher_code: data.voucher_code,
                type: 'PHYSICAL',
                claim_date: new Date().toISOString(),
                is_redeemed: true, // Voucher fisik dianggap langsung redeem saat diinput
                redeemed_date: new Date().toISOString(),
                redeemed_outlet: data.outlet
            })
            .select()
            .single();

        if (error) throw new Error(error.message);
        return newVoucher;
    },

    async uploadCodes(codes: string[], type: VoucherType, discountAmount?: number): Promise<{ success: boolean, count: number }> {
        if (!supabase) throw new Error("Supabase client not initialized");
        
        // Insert ke 'voucher_pool'
        const rows = codes.map(code => ({
            code: code.trim(),
            type,
            discount_amount: discountAmount || 10000,
            is_used: false
        }));

        const { error } = await supabase
            .from('voucher_pool')
            .insert(rows);

        if (error) throw new Error(error.message);
        return { success: true, count: codes.length };
    },

    async resetData(): Promise<{ success: boolean }> {
        if (!supabase) return { success: false };

        // Hapus semua vouchers
        await supabase.from('vouchers').delete().neq('id', 0); // Delete all
        // Reset status codes di voucher_pool
        await supabase.from('voucher_pool').update({ is_used: false }).neq('id', 0);
        
        return { success: true };
    }
};

// Gunakan Mock API jika Supabase belum disetting, gunakan Real API jika sudah.
export const api = USE_MOCK ? mockApi : supabaseApi;
