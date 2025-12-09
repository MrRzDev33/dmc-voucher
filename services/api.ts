
import { Voucher, VoucherType, User } from '../types';
import { supabase } from './supabaseClient';
import mockApi from './mockdb';

// ============================================================================
// KONFIGURASI KONEKSI DATABASE
// ============================================================================

// Jika supabase belum dikonfigurasi di supabaseClient.ts, gunakan MOCK DATA.
const USE_MOCK = !supabase;

// ============================================================================

const supabaseApi = {
    async login(username: string, password: string): Promise<User | null> {
        if (!supabase) return null;
        
        // Mengambil data user dari tabel 'users'
        const { data, error } = await supabase
            .from('users')
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
        
        const { data } = await supabase
            .from('settings')
            .select('setting_value')
            .eq('setting_key', key)
            .single();
            
        // Default values: claim_enabled = true, daily_limit = 1000
        const defaultValue = key === 'daily_limit' ? '1000' : 'true';
        return data || { setting_value: defaultValue };
    },

    async updateSetting(key: string, value: string): Promise<{ success: boolean }> {
        if (!supabase) return { success: false };
        
        const { error } = await supabase
            .from('settings')
            .upsert({ setting_key: key, setting_value: value });
            
        if (error) throw new Error(error.message);
        return { success: true };
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
            .from('voucher_codes')
            .select('*', { count: 'exact', head: true })
            .eq('type', type);

        if (error) console.error("Error stats", error);
        return { count: count || 0 };
    },

    async claimVoucher(data: any): Promise<Voucher> {
        if (!supabase) throw new Error("Supabase client not initialized");

        // 0. CEK LIMIT HARIAN (Fitur Baru)
        // Ambil limit dari settings
        const { data: limitData } = await supabase
            .from('settings')
            .select('setting_value')
            .eq('setting_key', 'daily_limit')
            .single();
        
        const dailyLimit = limitData ? parseInt(limitData.setting_value) : 1000;

        // Hitung klaim hari ini
        const todayStr = new Date().toISOString().split('T')[0];
        const { count: claimsToday, error: countError } = await supabase
            .from('vouchers')
            .select('*', { count: 'exact', head: true })
            .gte('claim_date', `${todayStr}T00:00:00`)
            .lte('claim_date', `${todayStr}T23:59:59`)
            .eq('type', 'DIGITAL'); // Hanya hitung voucher digital

        if (countError) throw new Error("Gagal memeriksa kuota harian.");
        
        if ((claimsToday || 0) >= dailyLimit) {
            throw new Error("Mohon maaf, kuota voucher harian sudah habis. Silakan coba lagi besok.");
        }

        // 1. Cek Duplikat Nomor WA
        const { data: existing } = await supabase
            .from('vouchers')
            .select('id')
            .eq('whatsapp_number', data.whatsapp_number)
            .single();

        if (existing) {
            throw new Error("Nomor WhatsApp ini sudah pernah mengklaim voucher.");
        }

        // 2. Ambil Kode Voucher yang tersedia (Mencegah Race Condition Sederhana)
        // Kita mengambil 1 kode yang belum terpakai
        const { data: codeData, error: codeError } = await supabase
            .from('voucher_codes')
            .select('*')
            .eq('is_used', false)
            .eq('type', 'DIGITAL')
            .limit(1)
            .single();

        if (codeError || !codeData) {
            throw new Error("Mohon maaf, stok voucher digital saat ini habis.");
        }

        // 3. Tandai Kode sebagai Terpakai
        const { error: updateError } = await supabase
            .from('voucher_codes')
            .update({ is_used: true })
            .eq('id', codeData.id);

        if (updateError) {
            // Jika gagal update (mungkin diambil orang lain milidetik yg sama), coba recursive/ulang
            // Untuk simplifikasi di sini kita lempar error agar user mencoba lagi
            throw new Error("Gagal mengunci kode voucher. Silakan coba tekan tombol klaim lagi.");
        }

        // 4. Masukkan data Klaim Voucher
        const { data: newVoucher, error: insertError } = await supabase
            .from('vouchers')
            .insert({
                full_name: data.full_name,
                birth_year: data.birth_year,
                whatsapp_number: data.whatsapp_number,
                outlet: data.outlet,
                voucher_code: codeData.code,
                type: 'DIGITAL',
                discount_amount: codeData.discount_amount,
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
            .single();

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
        
        const rows = codes.map(code => ({
            code: code.trim(),
            type,
            discount_amount: discountAmount || 10000,
            is_used: false
        }));

        const { error } = await supabase
            .from('voucher_codes')
            .insert(rows);

        if (error) throw new Error(error.message);
        return { success: true, count: codes.length };
    },

    async resetData(): Promise<{ success: boolean }> {
        if (!supabase) return { success: false };

        // Hapus semua vouchers
        await supabase.from('vouchers').delete().neq('id', 0); // Delete all
        // Reset status codes
        await supabase.from('voucher_codes').update({ is_used: false }).neq('id', 0);
        
        return { success: true };
    }
};

// Gunakan Mock API jika Supabase belum disetting, gunakan Real API jika sudah.
export const api = USE_MOCK ? mockApi : supabaseApi;
