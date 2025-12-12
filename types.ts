
export type Outlet = string;

export type VoucherType = 'DIGITAL' | 'PHYSICAL';

export interface Voucher {
  id: string;
  fullName?: string; // Disimpan sebagai full_name di DB
  birthYear?: string; // Disimpan sebagai birth_year di DB
  gender?: 'Pria' | 'Wanita';
  whatsappNumber: string; // whatsapp_number
  outlet: Outlet;
  voucherCode: string; // voucher_code
  claimDate: string; // claim_date
  isRedeemed: boolean; // is_redeemed
  redeemedDate?: string; // redeemed_date
  redeemedOutlet?: Outlet; // redeemed_outlet
  type: VoucherType;
  discountAmount?: number; // discount_amount (New Field)
  notes?: string;
}

export enum Role {
    KASIR = "KASIR",
    PUSAT = "PUSAT"
}

export interface User {
    id?: string;
    username: string;
    role: Role;
    outlet?: Outlet; // Untuk role kasir
}

export interface Stats {
    totalClaims: number;
    totalRedeemed: number;
    claimsToday: number;
    claimsByOutlet: { [key: string]: number };
    claimsPerDay: { date: string; count: number }[];
    
    // Field baru untuk statistik akurat dari server
    totalDigitalVouchers: number;
    claimedDigitalVouchers: number;
    totalPhysicalVouchers: number;
    redeemedPhysicalVouchers: number;
    
    // Field KHUSUS untuk limit harian (Hanya Digital Hari Ini)
    todayClaimedDigital: number;
}

export interface UseVoucherStoreReturn {
  vouchers: Voucher[];
  loading: boolean;
  error: string | null;
  stats: Stats;
  
  // Field baru yang menyebabkan error di Dashboard Anda jika tidak ada
  isClaimEnabled: boolean; 
  dailyLimit: number; 
  
  // Fungsi baru
  toggleClaimStatus: (status: boolean) => Promise<void>; 
  updateDailyLimit: (limit: number) => Promise<void>; 
  
  claimVoucher: (data: Omit<Voucher, 'id' | 'voucherCode' | 'claimDate' | 'isRedeemed' | 'type' | 'redeemedDate' | 'redeemedOutlet' | 'discountAmount'>) => Promise<Voucher>;
  redeemVoucher: (voucherIdentifier: string, redeemedOutlet: Outlet) => Promise<Voucher>;
  recordPhysicalVoucher: (data: Omit<Voucher, 'id' | 'claimDate' | 'isRedeemed' | 'type' | 'redeemedDate' | 'redeemedOutlet' | 'discountAmount'>) => Promise<Voucher>;
  loadCodes: (codes: string[], type: VoucherType, discountAmount?: number) => void;
  getVouchers: () => Voucher[];
  resetData: () => void;
}
