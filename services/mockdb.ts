
import { Voucher, VoucherType, User, Role } from '../types';
import { generateVoucherCode } from './util';

// Data Dummy Awal
let MOCK_VOUCHERS: any[] = [
    {
        id: 1,
        full_name: 'Andi Contoh',
        birth_year: '1995',
        gender: 'Pria',
        whatsapp_number: '081234567890',
        outlet: 'Bandung - DMC Pusat Cihanjuang',
        voucher_code: '12345678',
        claim_date: new Date().toISOString(),
        is_redeemed: 0,
        type: 'DIGITAL',
        discount_amount: 10000
    }
];

let SETTINGS: any = {
    'claim_enabled': 'true'
};

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const mockApi = {
    async login(username: string, password: string): Promise<User | null> {
        await delay(500);
        if (username === 'admin' && password === 'admin123') {
            return { id: '1', username: 'admin', role: Role.PUSAT };
        }
        if (username === 'kasir' && password === 'kasir123') {
            return { id: '2', username: 'kasir', role: Role.KASIR, outlet: 'Bandung - DMC Pusat Cihanjuang' };
        }
        return null;
    },

    async getSettings(key: string): Promise<{ setting_value: string }> {
        await delay(200);
        return { setting_value: SETTINGS[key] || 'true' };
    },

    async updateSetting(key: string, value: string): Promise<{ success: boolean }> {
        await delay(200);
        SETTINGS[key] = value;
        return { success: true };
    },

    async getVouchers(): Promise<any[]> {
        await delay(500);
        return [...MOCK_VOUCHERS];
    },

    async getPoolStats(type: VoucherType): Promise<{ count: number }> {
        await delay(300);
        return { count: 50 }; // Dummy stock
    },

    async claimVoucher(data: any): Promise<Voucher> {
        await delay(800);
        // Simulasi logic backend
        const existing = MOCK_VOUCHERS.find(v => v.whatsapp_number === data.whatsapp_number);
        if (existing) throw new Error("Nomor WhatsApp ini sudah pernah mengklaim voucher.");

        const newVoucher = {
            id: Date.now(),
            full_name: data.full_name,
            birth_year: data.birth_year,
            whatsapp_number: data.whatsapp_number,
            outlet: data.outlet,
            voucher_code: generateVoucherCode(),
            type: 'DIGITAL',
            discount_amount: 10000,
            claim_date: new Date().toISOString(),
            is_redeemed: 0,
        };
        MOCK_VOUCHERS.unshift(newVoucher);
        return newVoucher as unknown as Voucher;
    },

    async redeemVoucher(identifier: string, outlet: string): Promise<Voucher> {
        await delay(500);
        const index = MOCK_VOUCHERS.findIndex(v => 
            (v.voucher_code === identifier || v.whatsapp_number === identifier) && v.type === 'DIGITAL'
        );
        
        if (index === -1) throw new Error("Voucher tidak ditemukan.");
        if (MOCK_VOUCHERS[index].is_redeemed) throw new Error("Voucher ini sudah ditukarkan sebelumnya.");

        MOCK_VOUCHERS[index] = {
            ...MOCK_VOUCHERS[index],
            is_redeemed: 1,
            redeemed_date: new Date().toISOString(),
            redeemed_outlet: outlet
        };
        return MOCK_VOUCHERS[index];
    },

    async recordPhysical(data: any): Promise<Voucher> {
        await delay(500);
        const newVoucher = {
            id: Date.now(),
            gender: data.gender,
            whatsapp_number: data.whatsapp_number,
            outlet: data.outlet,
            voucher_code: data.voucher_code,
            type: 'PHYSICAL',
            claim_date: new Date().toISOString(),
            is_redeemed: 1,
            redeemed_date: new Date().toISOString(),
            redeemed_outlet: data.outlet
        };
        MOCK_VOUCHERS.unshift(newVoucher);
        return newVoucher as unknown as Voucher;
    },

    async uploadCodes(codes: string[], type: VoucherType, discountAmount?: number): Promise<{ success: boolean, count: number }> {
        await delay(500);
        return { success: true, count: codes.length };
    },

    async resetData(): Promise<{ success: boolean }> {
        await delay(500);
        MOCK_VOUCHERS = [];
        return { success: true };
    }
};

export default mockApi;
